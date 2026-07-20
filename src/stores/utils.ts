/**
 * Store utilities - Helper functions and shared types for quiz store slices
 */

import { theme } from '@/config/theme'
import type { Question } from '@/domain/entities/Question'
import type { UserProgress } from '@/domain/entities/UserProgress'
import { type QuizSessionConfig, type QuizSessionState } from '@/domain/services/QuizSessionService'
import { XpService } from '@/domain/services/XpService'
import type { QuizModeId } from '@/domain/valueObjects/QuizMode'
import { calculateAccuracy } from '@/domain/valueObjects/ScoreThresholds'
import { getProgressRepository } from '@/infrastructure'
import {
  getSessionRepository,
  type SavedAnswerRecord,
  type SavedSessionData,
} from '@/infrastructure/persistence/SessionRepository'
import {
  reportError,
  setUserProperties,
  trackQuizComplete,
  trackRecommendFeedback,
  trackScenarioComplete,
} from '@/lib/analytics'

// ============================================================
// View State
// ============================================================

/**
 * 画面の状態を表す型
 *
 * 【状態遷移】
 * menu ─(startSession)─> quiz ─(complete)─> result ─(endSession)─> menu
 *   │                                          │
 *   ├────────────(showProgress)────────────> progress
 *   └────────────(setViewState)────────────> reader
 */
export type ViewState =
  | 'menu'
  | 'quiz'
  | 'result'
  | 'progress'
  | 'reader'
  | 'scenarioSelect'
  | 'studyFirst'
  | 'tutorial'

// ============================================================
// App Configuration
// ============================================================

/**
 * アプリケーション設定
 */
import { PASSING_SCORE, SCORE_COLORS } from '@/domain/valueObjects/ScoreThresholds'

export const APP_CONFIG = {
  title: `${theme.appName} マスタークイズ`,
  version: '2.0.0',
  passingScore: PASSING_SCORE,
  weakThreshold: SCORE_COLORS.fair,
  minAttemptsForWeak: 1,
  defaultMode: 'random' as QuizModeId,
}

// ============================================================
// Store Interface
// ============================================================

import type { DifficultyLevel } from '@/domain/valueObjects/Difficulty'

/**
 * ストアのインターフェース定義
 */
export interface QuizStore {
  // View state
  viewState: ViewState
  readerInitialFilter: string | null

  // Quiz data (using domain entities)
  allQuestions: Question[]

  // Session state
  sessionConfig: QuizSessionConfig
  sessionState: QuizSessionState | null
  sessionWrongAnswers: { questionId: string; selectedAnswer: number; selectedAnswers?: number[] | undefined }[]

  // Progress state (using domain entity)
  userProgress: UserProgress

  // Saved session state (for resume)
  savedSession: SavedSessionData | null

  isLoading: boolean

  // View actions
  setViewState: (state: ViewState) => void
  openReaderWithFilter: (filter: string) => void

  // Initialization
  initialize: () => Promise<void>

  // Session actions
  startSession: (config: Partial<QuizSessionConfig>, options?: { startIndex?: number }) => void
  startSessionWithIds: (questionIds: string[], label?: string) => void
  startScenarioSession: (scenarioId: string) => void
  activeScenarioId: string | null
  /** 検索キーワードなど、カスタムセッションのラベル */
  sessionLabel: string | null
  retrySession: () => void
  retryQuestion: () => void
  selectAnswer: (index: number) => void
  toggleAnswer: (index: number) => void
  submitAnswer: () => void
  nextQuestion: () => void
  previousQuestion: () => void
  goToQuestion: (index: number) => void
  finishTest: () => void
  endSession: () => void

  // Timer actions
  updateTimer: () => void

  // Chapter actions (overview mode)
  dismissChapterIntro: () => void
  dismissChapterComplete: () => void

  // Bookmark actions
  toggleBookmark: (questionId: string) => void
  getBookmarkedCount: () => number

  // Resume actions
  suspendSession: () => void
  resumeSession: () => void
  discardSavedSession: () => void

  // Review actions
  startReviewSession: () => void

  // Daily goal actions
  setDailyGoal: (goal: number) => void

  // Hint actions
  useHint: () => void

  // Export actions
  exportProgressCsv: () => Promise<void>

  // Progress actions
  loadUserProgress: () => Promise<void>
  resetUserProgress: () => Promise<void>

  // Computed getters
  getCurrentQuestion: () => Question | null
  getProgress: () => { current: number; total: number }
  getFilteredQuestions: (categoryId: string | null, difficulty: DifficultyLevel | null) => Question[]
  getCategoryStats: () => Record<
    string,
    {
      categoryId: string
      totalQuestions: number
      attemptedQuestions: number
      correctAnswers: number
      accuracy: number
    }
  >
}

// ============================================================
// Slice Creator Type
// ============================================================

export type StoreSet = (partial: Partial<QuizStore> | ((state: QuizStore) => Partial<QuizStore>)) => void
export type StoreGet = () => QuizStore

// ============================================================
// Helper Functions
// ============================================================

/**
 * セッション状態のスナップショットを保存（途中再開用）
 */
export function saveSessionSnapshot(
  sessionState: QuizSessionState,
  wrongAnswers: { questionId: string; selectedAnswer: number; selectedAnswers?: number[] | undefined }[],
  getStoreValues: () => { activeScenarioId: string | null; sessionLabel: string | null }
): void {
  const answerRecords: SavedAnswerRecord[] = []
  sessionState.answerHistory.forEach((record, index) => {
    answerRecords.push({
      questionIndex: index,
      selectedAnswer: record.selectedAnswer,
      selectedAnswers: [...record.selectedAnswers],
      isCorrect: record.isCorrect,
    })
  })

  const data: SavedSessionData = {
    sessionConfig: sessionState.config,
    questionIds: sessionState.questions.map((q) => q.id),
    currentIndex: sessionState.currentIndex,
    score: sessionState.score,
    answeredCount: sessionState.answeredCount,
    startedAt: sessionState.startedAt ?? Date.now(),
    wrongAnswers: [...wrongAnswers],
    hintsUsedCount: sessionState.hintsUsedCount,
    hintUsedOnCurrent: sessionState.hintUsed,
    savedAt: Date.now(),
    answerRecords,
    scenarioId: getStoreValues().activeScenarioId ?? undefined,
    sessionLabel: getStoreValues().sessionLabel ?? undefined,
    overviewChapterState: sessionState.overviewChapterState
      ? {
          currentChapterId: sessionState.overviewChapterState.currentChapterId,
          chapterPhase: sessionState.overviewChapterState.chapterPhase,
          dismissedIntros: [...sessionState.overviewChapterState.dismissedIntros],
          dismissedCompletes: [...sessionState.overviewChapterState.dismissedCompletes],
        }
      : undefined,
    timeRemaining: sessionState.timeRemaining,
  }
  getSessionRepository().save(data)
}

/**
 * Record completed session in history and save progress
 */
export function recordCompletedSession(
  sessionState: QuizSessionState,
  getCurrentProgress: () => UserProgress,
  updateStore: (progress: UserProgress) => void,
  scenarioId?: string | null
): void {
  if (sessionState.isReviewMode) return

  const categoryBreakdown: Record<string, { correct: number; total: number }> = {}
  for (const [idx, record] of sessionState.answerHistory) {
    const question = sessionState.questions[idx]
    if (!question) continue
    const cat = question.category
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = { correct: 0, total: 0 }
    }
    categoryBreakdown[cat].total++
    if (record.isCorrect) {
      categoryBreakdown[cat].correct++
    }
  }

  let updatedProgress = getCurrentProgress().recordSession(
    sessionState.config.mode,
    sessionState.config.categoryFilter ?? null,
    sessionState.score,
    sessionState.answeredCount,
    categoryBreakdown
  )

  // Scenario completion bonus XP
  if (sessionState.config.mode === 'scenario') {
    updatedProgress = updatedProgress.addXp(XpService.getScenarioCompleteXp())
  }

  updateStore(updatedProgress)
  getProgressRepository()
    .save(updatedProgress)
    .catch((error) => reportError(error, 'progress_save_finish', 'Failed to save progress on session finish'))

  const accuracy = calculateAccuracy(sessionState.score, sessionState.answeredCount)
  const durationSec = sessionState.startedAt ? Math.round((Date.now() - sessionState.startedAt) / 1000) : 0
  trackQuizComplete(sessionState.config.mode, sessionState.score, sessionState.answeredCount, accuracy, durationSec)

  if (sessionState.config.mode === 'scenario' && scenarioId) {
    trackScenarioComplete(scenarioId, sessionState.score, sessionState.answeredCount, accuracy)
  }

  // ユーザープロパティを更新（セグメント分析用）
  setUserProperties({
    total_quizzes: updatedProgress.sessionHistory.length,
  })
}

/**
 * Record feedback for a completed recommend session.
 * Stores per-question results in localStorage for the recommend pipeline to read.
 */
export function recordRecommendFeedback(sessionState: QuizSessionState): void {
  const results: Array<{ id: string; correct: boolean; category: string }> = []
  for (const [idx, record] of sessionState.answerHistory) {
    const question = sessionState.questions[idx]
    if (!question) continue
    results.push({ id: question.id, correct: record.isCorrect, category: question.category })
  }

  if (results.length === 0) return

  const entry = {
    date: new Date().toISOString().slice(0, 10),
    total: results.length,
    correct: results.filter((r) => r.correct).length,
    accuracy: Math.round((results.filter((r) => r.correct).length / results.length) * 100),
    results,
  }

  // Send to GA4 for analytics
  trackRecommendFeedback(entry.total, entry.correct, entry.accuracy)

  try {
    const existing = JSON.parse(localStorage.getItem('recommend-feedback') || '[]')
    existing.push(entry)
    // Keep last 30 entries
    localStorage.setItem('recommend-feedback', JSON.stringify(existing.slice(-30)))
  } catch {
    localStorage.setItem('recommend-feedback', JSON.stringify([entry]))
  }
}
