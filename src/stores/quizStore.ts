/**
 * Quiz Store - Zustand による状態管理
 *
 * 【このファイルの役割】
 * アプリケーション全体の状態（State）を管理する。
 * React コンポーネントは useQuizStore() フックを通じて状態にアクセスする。
 *
 * 【なぜ Zustand を選んだのか】
 * - Redux より軽量でボイラープレートが少ない
 * - Context API より再レンダリング制御が容易
 * - TypeScript との相性が良い
 * - 学習コストが低い
 *
 * 【アーキテクチャ：クリーンアーキテクチャとの関係】
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  Presentation Layer (React Components)                  │
 * │  └─> useQuizStore() でこのストアにアクセス              │
 * ├─────────────────────────────────────────────────────────┤
 * │  Application Layer (このファイル: quizStore.ts)         │
 * │  └─> Domain Layer と Infrastructure Layer を統合       │
 * ├─────────────────────────────────────────────────────────┤
 * │  Domain Layer (entities, services, valueObjects)        │
 * │  └─> ビジネスロジック（Question, UserProgress 等）      │
 * ├─────────────────────────────────────────────────────────┤
 * │  Infrastructure Layer (repositories, validation)        │
 * │  └─> 永続化、外部システムとの接続                       │
 * └─────────────────────────────────────────────────────────┘
 *
 * 【スライスパターン】
 * ストアは機能別のスライスに分割されている：
 * - viewSlice: 画面遷移の状態管理
 * - sessionSlice: クイズセッションのライフサイクル
 * - progressSlice: ユーザー進捗の管理
 * - bookmarkSlice: ブックマーク管理
 * - resumeSlice: セッションの中断・再開
 *
 * 【再レンダリングの最適化】
 * Zustand は使用しているプロパティのみを監視する。
 * コンポーネントで const { viewState } = useQuizStore() とすると、
 * viewState が変わった時だけ再レンダリングされる。
 */

import { create } from 'zustand'
// Infrastructure imports
import { getProgressRepository, getQuizRepository } from '@/infrastructure'
import { getSessionRepository } from '@/infrastructure/persistence/SessionRepository'
import { reportError, setUserProperties } from '@/lib/analytics'
// Slices
import { createBookmarkSlice } from './slices/bookmarkSlice'
import { createProgressSlice } from './slices/progressSlice'
import { createResumeSlice } from './slices/resumeSlice'
import { createSessionAnswerSlice } from './slices/sessionAnswerSlice'
import { createSessionLifecycleSlice } from './slices/sessionLifecycleSlice'
import { createViewSlice } from './slices/viewSlice'
// Shared types and config
import { APP_CONFIG, type QuizStore } from './utils'

// ============================================================
// Store Implementation
// ============================================================

export const useQuizStore = create<QuizStore>((set, get) => ({
  // Compose slices
  ...createViewSlice(set, get),
  ...createSessionLifecycleSlice(set, get),
  ...createSessionAnswerSlice(set, get),
  ...createProgressSlice(set, get),
  ...createBookmarkSlice(set, get),
  ...createResumeSlice(set, get),

  // Shared state
  allQuestions: [],
  isLoading: true,

  /**
   * アプリ起動時の初期化
   *
   * 【フロー】
   * 1. Repository からクイズデータをロード
   * 2. Repository から学習進捗をロード
   * 3. 状態を更新
   *
   * 【エラーハンドリング】
   * 初期化失敗時も isLoading: false にして UI をブロックしない。
   * デフォルトデータにフォールバックする。
   */
  initialize: async () => {
    if (get().allQuestions.length > 0) return // Already initialized
    set({ isLoading: true })

    try {
      const quizRepo = getQuizRepository()
      const progressRepo = getProgressRepository()

      // Load quiz data
      const activeSet = await quizRepo.getActiveSet()
      const questions = [...activeSet.questions]

      // Load progress
      const progress = await progressRepo.load()

      // Load saved session (for resume)
      const savedSession = getSessionRepository().load()

      set({
        allQuestions: questions,
        userProgress: progress,
        savedSession,
        isLoading: false,
      })

      // GA4 ユーザープロパティ設定（セグメント分析用）
      setUserProperties({
        total_quizzes: progress.sessionHistory.length,
      })
    } catch (error) {
      reportError(error, 'app_init', 'Failed to initialize')
      set({ isLoading: false })
    }
  },
}))

export type { QuizSessionConfig, QuizSessionState } from '@/domain/services/QuizSessionService'
// Re-export types and configs
export { APP_CONFIG }
