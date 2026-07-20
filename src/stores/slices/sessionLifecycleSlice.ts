/**
 * Session Lifecycle Slice - Quiz session start, end, and timer management
 *
 * Handles: startSession, startSessionWithIds, startScenarioSession, retrySession,
 * endSession, finishTest, updateTimer, dismissChapterIntro, dismissChapterComplete
 */

import { locale } from '@/config/locale'
import { SCENARIOS } from '@/data/scenarios'
import { Question } from '@/domain/entities/Question'
import { DailyGoalService } from '@/domain/services/DailyGoalService'
import { type QuizSessionConfig, QuizSessionService, type QuizSessionState } from '@/domain/services/QuizSessionService'
import { getQuizModeById } from '@/domain/valueObjects/QuizMode'
import { getSessionRepository } from '@/infrastructure/persistence/SessionRepository'
import { trackQuizQuit, trackQuizStart, trackSearch } from '@/lib/analytics'
import {
  APP_CONFIG,
  recordCompletedSession,
  recordRecommendFeedback,
  type StoreGet,
  type StoreSet,
  saveSessionSnapshot,
} from '../utils'

export interface SessionLifecycleSlice {
  sessionConfig: QuizSessionConfig
  sessionState: QuizSessionState | null
  sessionWrongAnswers: { questionId: string; selectedAnswer: number; selectedAnswers?: number[] | undefined }[]
  activeScenarioId: string | null
  sessionLabel: string | null

  startSession: (config: Partial<QuizSessionConfig>, options?: { startIndex?: number }) => void
  startSessionWithIds: (questionIds: string[], label?: string) => void
  startScenarioSession: (scenarioId: string) => void
  retrySession: () => void
  finishTest: () => void
  endSession: () => void
  updateTimer: () => void
  dismissChapterIntro: () => void
  dismissChapterComplete: () => void
}

/** セッション初期状態にユーザー進捗のスナップショットを付与（3箇所で共通） */
export function enrichWithProgress(
  initialState: QuizSessionState,
  userProgress: import('@/domain/entities/UserProgress').UserProgress
): QuizSessionState {
  return {
    ...initialState,
    initialStreakDays: userProgress.streakDays,
    initialTodayCount: userProgress.getDailyCount(DailyGoalService.getTodayString()),
    initialXp: userProgress.totalXp,
  }
}

export const createSessionLifecycleSlice = (set: StoreSet, get: StoreGet): SessionLifecycleSlice => ({
  sessionConfig: QuizSessionService.createDefaultConfig(),
  sessionState: null,
  sessionWrongAnswers: [],
  activeScenarioId: null,
  sessionLabel: null,

  startSession: (configOverrides, options?: { startIndex?: number }) => {
    const state = get()
    const modeConfig = configOverrides.mode ? getQuizModeById(configOverrides.mode) : null

    const config: QuizSessionConfig = {
      ...state.sessionConfig,
      ...configOverrides,
      timeLimit:
        configOverrides.timeLimit !== undefined
          ? configOverrides.timeLimit
          : (modeConfig?.timeLimit ?? state.sessionConfig.timeLimit),
      questionCount:
        configOverrides.questionCount !== undefined
          ? configOverrides.questionCount
          : modeConfig
            ? modeConfig.questionCount
            : state.sessionConfig.questionCount,
      shuffleQuestions: modeConfig?.shuffleQuestions ?? state.sessionConfig.shuffleQuestions,
      shuffleOptions: modeConfig?.shuffleOptions ?? state.sessionConfig.shuffleOptions,
    }

    const sessionQuestions = QuizSessionService.prepareSessionQuestions(
      state.allQuestions,
      config,
      state.userProgress,
      APP_CONFIG.weakThreshold,
      APP_CONFIG.minAttemptsForWeak
    )

    if (sessionQuestions.length === 0) return

    const initialState = QuizSessionService.createInitialState(sessionQuestions, config)
    const startIndex = options?.startIndex ? Math.min(options.startIndex, sessionQuestions.length - 1) : 0

    // 全体像モード: startIndex に応じたチャプター状態を再構築
    const overviewChapterState =
      config.mode === 'overview' && startIndex > 0
        ? QuizSessionService.buildOverviewChapterStateFromIndex(sessionQuestions, startIndex)
        : initialState.overviewChapterState

    const sessionState = {
      ...enrichWithProgress(initialState, state.userProgress),
      currentIndex: startIndex,
      overviewChapterState,
    }

    set({
      sessionConfig: config,
      sessionState,
      sessionWrongAnswers: [],
      savedSession: null,
      activeScenarioId: null,
      sessionLabel: null,
      viewState: 'quiz',
    })

    trackQuizStart(config.mode, sessionQuestions.length, config.categoryFilter ?? undefined)

    if (config.mode !== 'review') {
      saveSessionSnapshot(sessionState, [], () => ({
        activeScenarioId: get().activeScenarioId,
        sessionLabel: get().sessionLabel,
      }))
    }
  },

  startSessionWithIds: (questionIds: string[], label?: string) => {
    const state = get()
    const questionMap = new Map(state.allQuestions.map((q) => [q.id, q]))
    const questions = questionIds.map((id) => questionMap.get(id)).filter((q): q is Question => q !== undefined)

    if (questions.length === 0) return
    trackSearch(questions.length)

    const config: QuizSessionConfig = {
      mode: 'custom',
      categoryFilter: null,
      difficultyFilter: null,
      questionCount: null,
      timeLimit: null,
      shuffleQuestions: false,
      shuffleOptions: false,
    }

    const sessionState = enrichWithProgress(
      QuizSessionService.createInitialState(questions, config),
      state.userProgress
    )

    set({
      sessionConfig: config,
      sessionState,
      sessionWrongAnswers: [],
      savedSession: null,
      activeScenarioId: null,
      sessionLabel: label ?? null,
      viewState: 'quiz',
    })
    saveSessionSnapshot(sessionState, [], () => ({
      activeScenarioId: get().activeScenarioId,
      sessionLabel: get().sessionLabel,
    }))
  },

  startScenarioSession: (scenarioId: string) => {
    const scenario = SCENARIOS.find((s) => s.id === scenarioId)
    if (!scenario) return

    const state = get()
    const questionMap = new Map(state.allQuestions.map((q) => [q.id, q]))
    const questionIds = scenario.steps.flatMap((s) => (s.type === 'question' && s.questionId ? [s.questionId] : []))
    const questions = questionIds.map((id) => questionMap.get(id)).filter((q): q is Question => q !== undefined)

    if (questions.length === 0) return

    const config: QuizSessionConfig = {
      mode: 'scenario',
      categoryFilter: null,
      difficultyFilter: null,
      questionCount: null,
      timeLimit: null,
      shuffleQuestions: false,
      shuffleOptions: false,
    }

    const sessionState = enrichWithProgress(
      QuizSessionService.createInitialState(questions, config),
      state.userProgress
    )

    set({
      sessionConfig: config,
      sessionState,
      sessionWrongAnswers: [],
      savedSession: null,
      activeScenarioId: scenarioId,
      sessionLabel: null,
      viewState: 'quiz',
    })
    saveSessionSnapshot(sessionState, [], () => ({
      activeScenarioId: get().activeScenarioId,
      sessionLabel: get().sessionLabel,
    }))
  },

  retrySession: () => {
    const state = get()
    if (!state.sessionState) return

    const config = state.sessionConfig
    let questions = [...state.sessionState.questions]

    if (config.shuffleQuestions) {
      questions = QuizSessionService.shuffleArray(questions)
    }

    const sessionState = enrichWithProgress(
      QuizSessionService.createInitialState(questions, config),
      state.userProgress
    )

    set({
      sessionConfig: config,
      sessionState,
      sessionWrongAnswers: [],
      savedSession: null,
      viewState: 'quiz',
    })

    if (config.mode !== 'review') {
      saveSessionSnapshot(sessionState, [], () => ({
        activeScenarioId: get().activeScenarioId,
        sessionLabel: get().sessionLabel,
      }))
    }
  },

  finishTest: () => {
    const state = get()
    if (!state.sessionState || state.sessionState.isCompleted) return

    const historySize = state.sessionState.answerHistory.size

    let finalScore: number
    let finalCount: number
    if (historySize > 0) {
      let correctCount = 0
      state.sessionState.answerHistory.forEach((record) => {
        if (record.isCorrect) correctCount++
      })
      finalScore = correctCount
      finalCount = historySize
    } else {
      finalScore = state.sessionState.score
      finalCount = state.sessionState.answeredCount
    }

    if (finalCount === 0) {
      getSessionRepository().clear()
      set({ viewState: 'menu', sessionState: null, savedSession: null, sessionWrongAnswers: [] })
      return
    }

    getSessionRepository().clear()

    const completedState = {
      ...state.sessionState,
      score: finalScore,
      answeredCount: finalCount,
      isCompleted: true,
    }
    recordCompletedSession(
      completedState,
      () => state.userProgress,
      (p) => set({ userProgress: p }),
      get().activeScenarioId
    )

    // Record recommend feedback if this was a recommend session
    if (get().sessionLabel === locale.sessionLabels.recommend) {
      recordRecommendFeedback(completedState)
    }

    set({
      sessionState: completedState,
      viewState: 'result',
    })
  },

  endSession: () => {
    const state = get()
    if (state.sessionState && state.sessionConfig && !state.sessionState.isCompleted) {
      trackQuizQuit(state.sessionConfig.mode, state.sessionState.answeredCount, state.sessionState.questions.length)
    }
    getSessionRepository().clear()
    set({
      viewState: 'menu',
      sessionState: null,
      sessionWrongAnswers: [],
      activeScenarioId: null,
      sessionLabel: null,
    })
  },

  updateTimer: () => {
    const state = get()
    if (!state.sessionState) return

    const newSessionState = QuizSessionService.updateTimer(state.sessionState)

    if (newSessionState.isCompleted && !state.sessionState.isCompleted) {
      getSessionRepository().clear()
      recordCompletedSession(
        newSessionState,
        () => state.userProgress,
        (p) => set({ userProgress: p })
      )
      set({
        sessionState: newSessionState,
        viewState: 'result',
      })
    } else {
      set({ sessionState: newSessionState })
    }
  },

  dismissChapterIntro: () => {
    const state = get()
    if (!state.sessionState) return
    const newSessionState = QuizSessionService.dismissChapterIntro(state.sessionState)
    set({ sessionState: newSessionState })
    saveSessionSnapshot(newSessionState, state.sessionWrongAnswers, () => ({
      activeScenarioId: get().activeScenarioId,
      sessionLabel: get().sessionLabel,
    }))
  },

  dismissChapterComplete: () => {
    const state = get()
    if (!state.sessionState) return
    const newSessionState = QuizSessionService.dismissChapterComplete(state.sessionState)
    if (newSessionState.isCompleted) {
      getSessionRepository().clear()
      recordCompletedSession(
        newSessionState,
        () => get().userProgress,
        (p) => set({ userProgress: p }),
        get().activeScenarioId
      )
      set({ sessionState: newSessionState, viewState: 'result' })
    } else {
      set({ sessionState: newSessionState })
      saveSessionSnapshot(newSessionState, state.sessionWrongAnswers, () => ({
        activeScenarioId: get().activeScenarioId,
        sessionLabel: get().sessionLabel,
      }))
    }
  },
})
