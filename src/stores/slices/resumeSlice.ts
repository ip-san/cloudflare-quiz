/**
 * Resume Slice - Session resume/suspend management
 */

import { Question } from '@/domain/entities/Question'
import {
  type AnswerRecord,
  type QuizSessionConfig,
  QuizSessionService,
  type QuizSessionState,
} from '@/domain/services/QuizSessionService'
import { getSessionRepository, type SavedSessionData } from '@/infrastructure/persistence/SessionRepository'
import { trackSessionResume } from '@/lib/analytics'
import { type StoreGet, type StoreSet, saveSessionSnapshot } from '../utils'

export interface ResumeSlice {
  savedSession: SavedSessionData | null

  suspendSession: () => void
  resumeSession: () => void
  discardSavedSession: () => void
  startReviewSession: () => void
}

export const createResumeSlice = (set: StoreSet, get: StoreGet): ResumeSlice => ({
  savedSession: null,

  suspendSession: () => {
    const state = get()
    if (state.sessionState && !state.sessionState.isCompleted) {
      saveSessionSnapshot(state.sessionState, state.sessionWrongAnswers, () => ({
        activeScenarioId: get().activeScenarioId,
        sessionLabel: get().sessionLabel,
      }))
      const saved = getSessionRepository().load()
      set({
        viewState: 'menu',
        sessionState: null,
        savedSession: saved,
      })
    } else {
      set({
        viewState: 'menu',
        sessionState: null,
      })
    }
  },

  resumeSession: () => {
    const state = get()
    const saved = state.savedSession
    if (!saved) return

    const questionMap = new Map(state.allQuestions.map((q) => [q.id, q]))
    const questions = saved.questionIds.map((id) => questionMap.get(id)).filter((q): q is Question => q !== undefined)

    if (questions.length === 0) {
      getSessionRepository().clear()
      set({ savedSession: null })
      return
    }

    // Rebuild answer history Map from saved records for O(1) question state lookup
    const answerHistory = new Map<number, AnswerRecord>()
    if (saved.answerRecords) {
      for (const r of saved.answerRecords) {
        answerHistory.set(r.questionIndex, {
          selectedAnswer: r.selectedAnswer,
          selectedAnswers: Object.freeze([...r.selectedAnswers]),
          isCorrect: r.isCorrect,
        })
      }
    }

    const sessionState = QuizSessionService.createInitialState(questions, saved.sessionConfig)

    const safeCurrentIndex = Math.min(saved.currentIndex, questions.length - 1)
    const currentRecord = answerHistory.get(safeCurrentIndex)

    // Restore overview chapter state from saved data, or rebuild from questions
    let overviewChapterState = sessionState.overviewChapterState
    if (saved.overviewChapterState && overviewChapterState) {
      const savedChapterId = saved.overviewChapterState.currentChapterId
      const validChapterId = overviewChapterState.chapters.some((ch) => ch.chapterId === savedChapterId)
        ? savedChapterId
        : 0
      overviewChapterState = {
        chapters: overviewChapterState.chapters, // Recomputed from questions
        currentChapterId: validChapterId,
        chapterPhase: saved.overviewChapterState.chapterPhase,
        dismissedIntros: new Set(saved.overviewChapterState.dismissedIntros),
        dismissedCompletes: new Set(saved.overviewChapterState.dismissedCompletes),
      }
    }

    const resumedState: QuizSessionState = {
      ...sessionState,
      currentIndex: safeCurrentIndex,
      score: saved.score,
      answeredCount: saved.answeredCount,
      startedAt: saved.startedAt,
      timeRemaining: saved.timeRemaining ?? sessionState.timeRemaining,
      hintsUsedCount: saved.hintsUsedCount,
      hintUsed: saved.hintUsedOnCurrent ?? false,
      answerHistory,
      selectedAnswer: currentRecord?.selectedAnswer ?? null,
      selectedAnswers: currentRecord?.selectedAnswers ?? Object.freeze([]),
      overviewChapterState,
    }

    // GA4: remaining = total questions minus already answered
    trackSessionResume(saved.sessionConfig.mode, questions.length - saved.answeredCount)

    set({
      sessionConfig: saved.sessionConfig,
      sessionState: resumedState,
      sessionWrongAnswers: [...saved.wrongAnswers],
      savedSession: null,
      activeScenarioId: saved.scenarioId ?? null,
      sessionLabel: saved.sessionLabel ?? null,
      viewState: 'quiz',
    })
  },

  discardSavedSession: () => {
    getSessionRepository().clear()
    set({ savedSession: null })
  },

  startReviewSession: () => {
    const state = get()
    if (!state.sessionState || state.sessionWrongAnswers.length === 0) return

    const wrongQuestionIds = new Set(state.sessionWrongAnswers.map((w) => w.questionId))
    const wrongQuestions = state.sessionState.questions.filter((q) => wrongQuestionIds.has(q.id))
    const answerMap = new Map(state.sessionWrongAnswers.map((w) => [w.questionId, w.selectedAnswer]))
    const multiAnswerMap = new Map(
      state.sessionWrongAnswers.filter((w) => w.selectedAnswers).map((w) => [w.questionId, w.selectedAnswers ?? []])
    )
    const reviewUserAnswers = wrongQuestions.map((q) => answerMap.get(q.id) ?? -1)
    const reviewUserMultiAnswers = wrongQuestions.map((q) => multiAnswerMap.get(q.id) ?? [])

    const config: QuizSessionConfig = {
      mode: 'review',
      categoryFilter: null,
      difficultyFilter: null,
      questionCount: null,
      timeLimit: null,
      shuffleQuestions: false,
      shuffleOptions: false,
    }

    const sessionState = QuizSessionService.createInitialState([...wrongQuestions], config, {
      isReviewMode: true,
      reviewUserAnswers,
      reviewUserMultiAnswers,
    })

    set({
      sessionState,
      sessionConfig: config,
      viewState: 'quiz',
    })
  },
})
