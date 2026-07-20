import { XpService } from '../services/XpService'
import type { DifficultyLevel } from '../valueObjects/Difficulty'
import { calculateAccuracy } from '../valueObjects/ScoreThresholds'
import { calculateNextReview } from '../valueObjects/SrsInterval'

/**
 * UserProgress Entity - ユーザーの学習進捗を表すエンティティ
 *
 * 【このエンティティの役割】
 * - 問題ごとの回答履歴（正答率、最終回答日時等）
 * - カテゴリごとの統計情報
 * - 連続学習日数（ストリーク）の管理
 *
 * 【データ構造】
 *
 * UserProgress
 * ├── questionProgress: { [questionId]: QuestionProgress }
 * │   └── 各問題の回答履歴
 * ├── categoryProgress: { [categoryId]: CategoryProgress }
 * │   └── カテゴリ別の統計
 * ├── totalAttempts / totalCorrect
 * │   └── 全体の統計
 * └── streakDays / lastSessionAt
 *     └── 連続学習日数
 *
 * 【不変性（Immutability）】
 * Question エンティティと同様、このエンティティも不変。
 * recordAnswer() は新しい UserProgress インスタンスを返す。
 *
 * 【永続化】
 * localStorage に JSON 形式で保存される。
 * toJSON() でシリアライズ、create() でデシリアライズ。
 */

/**
 * 問題ごとの進捗情報
 *
 * 【保持するデータ】
 * - attempts: 回答回数
 * - correctCount: 正解回数
 * - lastAttemptAt: 最終回答日時（Unix timestamp）
 * - lastCorrect: 最後の回答が正解だったか
 *
 * 正答率は correctCount / attempts で計算。
 */
export interface QuestionProgress {
  readonly questionId: string
  readonly attempts: number
  readonly correctCount: number
  readonly lastAttemptAt: number
  readonly lastCorrect: boolean
  readonly nextReviewAt?: number | undefined
  readonly correctStreak?: number | undefined
  /** 忘却回数（マスター後に不正解した回数）。ラプスが多いほど再上昇を遅くする */
  readonly lapseCount?: number | undefined
  /** ラプス前の最大ストリーク。再上昇速度の制限に使用 */
  readonly maxStreakBeforeLapse?: number | undefined
}

/**
 * セッション履歴レコード
 *
 * 各クイズセッション完了時に記録される。
 * セッション履歴グラフや成長分析に使用。
 */
/** カテゴリ別セッション内訳 */
export interface CategoryBreakdown {
  readonly correct: number
  readonly total: number
}

export interface SessionRecord {
  readonly id: string
  readonly completedAt: number
  readonly mode: string
  readonly categoryFilter: string | null
  readonly score: number
  readonly totalQuestions: number
  readonly percentage: number
  /** カテゴリ別正答内訳（v2以降のセッションのみ） */
  readonly categoryBreakdown?: Readonly<Record<string, CategoryBreakdown>> | undefined
}

/**
 * カテゴリごとの進捗情報
 *
 * 【注意】
 * totalQuestions は現在使用されていない（将来の拡張用）。
 * 実際の問題数は QuizSet から取得する。
 */
export interface CategoryProgress {
  readonly categoryId: string
  readonly totalQuestions: number
  readonly attemptedQuestions: number
  readonly correctAnswers: number
  readonly accuracy: number // パーセンテージ（0-100）
}

/**
 * UserProgress のプロパティ型
 */
export interface UserProgressProps {
  readonly modifiedAt: number
  readonly questionProgress: Record<string, QuestionProgress>
  readonly categoryProgress: Record<string, CategoryProgress>
  readonly totalAttempts: number
  readonly totalCorrect: number
  readonly streakDays: number
  readonly lastSessionAt: number
  readonly bookmarkedQuestionIds?: readonly string[] | undefined
  readonly dailyGoal?: number | undefined
  readonly dailyAnswerCounts?: Record<string, number> | undefined
  readonly sessionHistory?: readonly SessionRecord[] | undefined
  /** 累積経験値 (XP) */
  readonly totalXp?: number | undefined
}

export class UserProgress {
  readonly modifiedAt: number
  readonly questionProgress: Readonly<Record<string, QuestionProgress>>
  readonly categoryProgress: Readonly<Record<string, CategoryProgress>>
  readonly totalAttempts: number
  readonly totalCorrect: number
  readonly streakDays: number
  readonly lastSessionAt: number
  readonly bookmarkedQuestionIds: readonly string[]
  readonly dailyGoal: number
  readonly dailyAnswerCounts: Readonly<Record<string, number>>
  readonly sessionHistory: readonly SessionRecord[]
  readonly totalXp: number

  private constructor(props: UserProgressProps) {
    this.modifiedAt = props.modifiedAt
    this.questionProgress = Object.freeze({ ...props.questionProgress })
    this.categoryProgress = Object.freeze({ ...props.categoryProgress })
    this.totalAttempts = props.totalAttempts
    this.totalCorrect = props.totalCorrect
    this.streakDays = props.streakDays
    this.lastSessionAt = props.lastSessionAt
    this.bookmarkedQuestionIds = Object.freeze([...(props.bookmarkedQuestionIds ?? [])])
    this.dailyGoal = props.dailyGoal ?? 10
    this.dailyAnswerCounts = Object.freeze({ ...(props.dailyAnswerCounts ?? {}) })
    this.sessionHistory = Object.freeze([...(props.sessionHistory ?? [])])
    this.totalXp = props.totalXp ?? 0
  }

  /**
   * ファクトリメソッド
   *
   * 既存データからの復元、または初期状態の作成に使用。
   */
  static create(props: Partial<UserProgressProps> = {}): UserProgress {
    return new UserProgress({
      modifiedAt: props.modifiedAt ?? Date.now(),
      questionProgress: props.questionProgress ?? {},
      categoryProgress: props.categoryProgress ?? {},
      totalAttempts: props.totalAttempts ?? 0,
      totalCorrect: props.totalCorrect ?? 0,
      streakDays: props.streakDays ?? 0,
      lastSessionAt: props.lastSessionAt ?? 0,
      bookmarkedQuestionIds: props.bookmarkedQuestionIds ?? [],
      dailyGoal: props.dailyGoal,
      dailyAnswerCounts: props.dailyAnswerCounts,
      sessionHistory: props.sessionHistory,
      totalXp: props.totalXp,
    })
  }

  /**
   * 空の進捗を作成（新規ユーザー用）
   */
  static empty(): UserProgress {
    return UserProgress.create()
  }

  /**
   * 回答を記録し、更新された進捗を返す
   *
   * 【不変更新パターン】
   * 既存のオブジェクトを変更せず、新しいオブジェクトを返す。
   * これにより React の変更検知が確実に動作する。
   *
   * 【更新される項目】
   * 1. questionProgress[questionId] - 該当問題の統計
   * 2. categoryProgress[categoryId] - 該当カテゴリの統計
   * 3. totalAttempts / totalCorrect - 全体統計
   * 4. streakDays - 連続学習日数
   * 5. lastSessionAt / modifiedAt - タイムスタンプ
   */
  recordAnswer(
    questionId: string,
    categoryId: string,
    isCorrect: boolean,
    isRetry = false,
    difficulty: DifficultyLevel = 'intermediate'
  ): UserProgress {
    const now = Date.now()
    const existing = this.questionProgress[questionId]

    // On retry, only update timestamps — don't inflate SRS streak
    if (isRetry) {
      const retryProgress: QuestionProgress = {
        ...(existing ?? { questionId, attempts: 0, correctCount: 0, lastAttemptAt: 0, lastCorrect: false }),
        lastAttemptAt: now,
        lastCorrect: isCorrect,
      }
      return UserProgress.create({
        ...this.toJSON(),
        questionProgress: { ...this.questionProgress, [questionId]: retryProgress },
        modifiedAt: now,
      })
    }

    // Calculate SRS streak with lapse penalty
    const prevStreak = existing?.correctStreak ?? 0
    const prevLapseCount = existing?.lapseCount ?? 0
    const prevMaxStreak = existing?.maxStreakBeforeLapse ?? 0

    let correctStreak: number
    let lapseCount = prevLapseCount
    let maxStreakBeforeLapse = prevMaxStreak
    if (isCorrect) {
      // After a lapse, cap re-climb: streak can't exceed half of pre-lapse max
      const maxAfterLapse = prevLapseCount > 0 ? Math.max(2, Math.floor(prevMaxStreak / 2)) : Infinity
      correctStreak = Math.min(prevStreak + 1, maxAfterLapse)
    } else {
      // Wrong answer: reset streak, record lapse if previously mastered (streak >= 3)
      correctStreak = 0
      if (prevStreak >= 3) {
        lapseCount = prevLapseCount + 1
        maxStreakBeforeLapse = Math.max(prevMaxStreak, prevStreak)
      }
    }
    const nextReviewAt = calculateNextReview(correctStreak, now)

    const newQuestionProgress: QuestionProgress = {
      questionId,
      attempts: (existing?.attempts ?? 0) + 1,
      correctCount: (existing?.correctCount ?? 0) + (isCorrect ? 1 : 0),
      lastAttemptAt: now,
      lastCorrect: isCorrect,
      nextReviewAt,
      correctStreak,
      lapseCount,
      maxStreakBeforeLapse,
    }

    // Update category progress
    const existingCategory = this.categoryProgress[categoryId]
    const isFirstAttempt = !existing || existing.attempts === 0
    const isFirstCorrect = isCorrect && (!existing || existing.correctCount === 0)
    const attemptedQuestions = (existingCategory?.attemptedQuestions ?? 0) + (isFirstAttempt ? 1 : 0)
    const correctAnswers = (existingCategory?.correctAnswers ?? 0) + (isFirstCorrect ? 1 : 0)

    const newCategoryProgress: CategoryProgress = {
      categoryId,
      totalQuestions: existingCategory?.totalQuestions ?? 0,
      attemptedQuestions,
      correctAnswers,
      accuracy: calculateAccuracy(correctAnswers, attemptedQuestions),
    }

    // Calculate new streak
    const newStreakDays = this.calculateNewStreak(now)

    // Update daily answer count (only for first attempts, not retries)
    const todayStr = this.getDateString(now)
    const newDailyCounts = {
      ...this.dailyAnswerCounts,
      [todayStr]: (this.dailyAnswerCounts[todayStr] ?? 0) + (isFirstAttempt ? 1 : 0),
    }

    // Calculate XP gain
    const isSrsReview = (existing?.attempts ?? 0) > 0
    const xpGain = isRetry ? 0 : XpService.calculateAnswerXp(isCorrect, isSrsReview, difficulty)

    return new UserProgress({
      modifiedAt: now,
      questionProgress: {
        ...this.questionProgress,
        [questionId]: newQuestionProgress,
      },
      categoryProgress: {
        ...this.categoryProgress,
        [categoryId]: newCategoryProgress,
      },
      totalAttempts: this.totalAttempts + 1,
      totalCorrect: this.totalCorrect + (isCorrect ? 1 : 0),
      streakDays: newStreakDays,
      lastSessionAt: now,
      bookmarkedQuestionIds: this.bookmarkedQuestionIds,
      dailyGoal: this.dailyGoal,
      dailyAnswerCounts: newDailyCounts,
      sessionHistory: this.sessionHistory,
      totalXp: this.totalXp + xpGain,
    })
  }

  /**
   * 連続学習日数を計算
   *
   * 【ロジック】
   * - 初回セッション → 1日
   * - 同日の2回目以降 → 変化なし
   * - 前日からの継続 → +1日
   * - 2日以上空いた → リセット（1日に戻る）
   *
   * 【タイムゾーン】
   * UTC を使用して日付を比較する。
   * これにより、タイムゾーンの違いによる不整合を防ぐ。
   */
  private calculateNewStreak(now: number): number {
    // Convert timestamp to local date number (YYYYMMDD format for reliable comparison)
    // Uses local timezone to match dailyAnswerCounts and user's perception of "today"
    const getLocalDateNumber = (timestamp: number): number => {
      const date = new Date(timestamp)
      return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
    }

    // First session ever
    if (this.lastSessionAt === 0) {
      return 1
    }

    const lastDate = getLocalDateNumber(this.lastSessionAt)
    const today = getLocalDateNumber(now)

    // Same day - no change to streak
    if (lastDate === today) {
      return this.streakDays
    }

    // Calculate yesterday correctly (handles month/year boundaries + DST)
    const todayDate = new Date(now)
    todayDate.setDate(todayDate.getDate() - 1)
    const yesterday = getLocalDateNumber(todayDate.getTime())

    // Consecutive day - increment streak
    if (lastDate === yesterday) {
      return this.streakDays + 1
    }

    // Gap in days - reset streak
    return 1
  }

  /**
   * タイムスタンプをローカル日付文字列（YYYY-MM-DD）に変換
   */
  private getDateString(timestamp: number): string {
    const d = new Date(timestamp)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * 指定日の回答数を取得
   */
  getDailyCount(dateStr: string): number {
    return this.dailyAnswerCounts[dateStr] ?? 0
  }

  /**
   * 全体の正答率を取得（パーセンテージ）
   */
  getOverallAccuracy(): number {
    if (this.totalAttempts === 0) return 0
    return Math.round((this.totalCorrect / this.totalAttempts) * 100)
  }

  /**
   * 特定の問題の正答率を取得
   *
   * 未回答の場合は null を返す。
   */
  getQuestionAccuracy(questionId: string): number | null {
    const qp = this.questionProgress[questionId]
    if (!qp || qp.attempts === 0) return null
    return calculateAccuracy(qp.correctCount, qp.attempts)
  }

  /**
   * 苦手問題かどうかを判定
   *
   * 【判定条件】
   * 1. minAttempts 回以上回答している
   * 2. 正答率が threshold% 未満
   *
   * 【使用場面】
   * 「苦手克服モード」で出題する問題を選定する際に使用。
   */
  isWeakQuestion(questionId: string, threshold: number = 50, minAttempts: number = 1): boolean {
    const qp = this.questionProgress[questionId]
    if (!qp || qp.attempts < minAttempts) return false
    const accuracy = (qp.correctCount / qp.attempts) * 100
    return accuracy < threshold
  }

  /**
   * 問題に回答したことがあるかを判定
   */
  hasAttempted(questionId: string): boolean {
    const qp = this.questionProgress[questionId]
    return qp !== undefined && qp.attempts > 0
  }

  /**
   * この問題を正解済みか（最後の回答が正解）
   *
   * 未回答・不正解の両方を「未正解」として扱う。
   * 全画面で統一して使用すること（ロジックの分散を防ぐ）。
   */
  isCorrectlyAnswered(questionId: string): boolean {
    const qp = this.questionProgress[questionId]
    return !!qp && qp.attempts > 0 && !!qp.lastCorrect
  }

  /**
   * XPを加算する（ボーナスXP等）
   */
  addXp(amount: number): UserProgress {
    if (amount <= 0) return this
    return UserProgress.create({
      ...this.toJSON(),
      totalXp: this.totalXp + amount,
      modifiedAt: Date.now(),
    })
  }

  /**
   * ブックマークをトグル（追加/解除）
   *
   * 不変更新パターンで新しいインスタンスを返す。
   */
  toggleBookmark(questionId: string): UserProgress {
    const isCurrentlyBookmarked = this.bookmarkedQuestionIds.includes(questionId)
    const newBookmarks = isCurrentlyBookmarked
      ? this.bookmarkedQuestionIds.filter((id) => id !== questionId)
      : [...this.bookmarkedQuestionIds, questionId]

    return UserProgress.create({
      ...this.toJSON(),
      bookmarkedQuestionIds: newBookmarks,
      modifiedAt: Date.now(),
    })
  }

  /**
   * セッション完了を記録
   */
  recordSession(
    mode: string,
    categoryFilter: string | null,
    score: number,
    totalQuestions: number,
    categoryBreakdown?: Record<string, CategoryBreakdown>
  ): UserProgress {
    const percentage = calculateAccuracy(score, totalQuestions)
    const record: SessionRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      completedAt: Date.now(),
      mode,
      categoryFilter,
      score,
      totalQuestions,
      percentage,
      ...(categoryBreakdown && { categoryBreakdown }),
    }
    // Keep last 100 sessions
    const newHistory = [...this.sessionHistory, record].slice(-100)
    return UserProgress.create({
      ...this.toJSON(),
      sessionHistory: newHistory,
      modifiedAt: Date.now(),
    })
  }

  /**
   * ブックマークされているかを判定
   */
  isBookmarked(questionId: string): boolean {
    return this.bookmarkedQuestionIds.includes(questionId)
  }

  /**
   * JSON シリアライズ用
   */
  toJSON(): UserProgressProps {
    return {
      modifiedAt: this.modifiedAt,
      questionProgress: { ...this.questionProgress },
      categoryProgress: { ...this.categoryProgress },
      totalAttempts: this.totalAttempts,
      totalCorrect: this.totalCorrect,
      streakDays: this.streakDays,
      lastSessionAt: this.lastSessionAt,
      bookmarkedQuestionIds: [...this.bookmarkedQuestionIds],
      dailyGoal: this.dailyGoal,
      dailyAnswerCounts: { ...this.dailyAnswerCounts },
      sessionHistory: [...this.sessionHistory],
      totalXp: this.totalXp,
    }
  }
}
