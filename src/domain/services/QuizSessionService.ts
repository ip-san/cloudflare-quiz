/**
 * QuizSessionService - クイズセッション管理のドメインサービス
 *
 * 【ドメインサービスとは】
 * DDD において、特定のエンティティに属さないビジネスロジックを
 * カプセル化するもの。クイズセッションの管理は Question や
 * UserProgress 単体の責務ではないため、サービスとして実装。
 *
 * 【設計原則：ステートレス】
 * このサービスはすべてのメソッドが static。
 * 状態を持たず、純粋な関数として動作する。
 *
 * 【なぜ状態を持たないのか】
 * - テストが容易（モックやセットアップ不要）
 * - 予測可能（同じ入力には同じ出力）
 * - スレッドセーフ（状態の競合がない）
 *
 * 【状態管理との役割分担】
 * - QuizSessionService: ビジネスロジック（問題選定、回答判定等）
 * - quizStore (Zustand): 状態の保持と UI への通知
 *
 * 状態の変更はすべて新しいオブジェクトを返すことで行う（不変更新）。
 */

import { Question } from '../entities/Question'
import { UserProgress } from '../entities/UserProgress'
import { PREDEFINED_CATEGORIES } from '../valueObjects/Category'
import type { DifficultyLevel } from '../valueObjects/Difficulty'
import { getChapterFromTags } from '../valueObjects/OverviewChapter'
import type { QuizModeId } from '../valueObjects/QuizMode'
import { calculateAccuracy, PASSING_SCORE } from '../valueObjects/ScoreThresholds'
import { AdaptiveDifficultyService } from './AdaptiveDifficultyService'
import { SpacedRepetitionService } from './SpacedRepetitionService'

/**
 * 動機曲線ゲート: この回答数に達するまでは「初学者」とみなす。
 * 初学者には、ROIは高いが初見では刺さりにくい SDK や上級トリビアを序盤に出さず、
 * 早い成功体験（高頻度・実務直結スキル）を優先する。
 */
const ENGAGEMENT_GATE_ATTEMPTS = 20

/**
 * セッション設定
 *
 * クイズセッションの開始時に指定されるパラメータ。
 */
export interface QuizSessionConfig {
  readonly mode: QuizModeId
  readonly categoryFilter: string | null
  readonly difficultyFilter: DifficultyLevel | null
  readonly questionCount: number | null // null = 全問
  readonly timeLimit: number | null // null = 時間無制限（分単位）
  readonly shuffleQuestions: boolean
  readonly shuffleOptions: boolean
}

/**
 * セッション状態
 *
 * 【不変性】
 * この状態オブジェクトは不変。
 * 状態を変更する場合は新しいオブジェクトを作成する。
 *
 * 【なぜ不変にするか】
 * - React の変更検知が確実に動作
 * - 状態の履歴を追跡可能（デバッグ時に有用）
 * - 意図しない変更を防止
 */
export interface QuizSessionState {
  readonly config: QuizSessionConfig
  readonly questions: readonly Question[]
  readonly currentIndex: number
  readonly selectedAnswer: number | null
  readonly selectedAnswers: readonly number[] // 複数選択用
  readonly isAnswered: boolean
  readonly isCorrect: boolean | null
  readonly score: number
  readonly answeredCount: number
  readonly isCompleted: boolean
  readonly startedAt: number | null
  readonly timeRemaining: number | null // 秒単位
  readonly isReviewMode: boolean
  readonly reviewUserAnswers: readonly number[]
  readonly reviewUserMultiAnswers: readonly (readonly number[])[] // 複数選択の復習用
  readonly hintUsed: boolean
  readonly hintsUsedCount: number
  /** 実力テストモード: 回答後にフィードバックを表示せず即次の問題へ */
  readonly deferFeedback: boolean
  /** セッション開始時のストリーク日数（マイルストーン判定用） */
  readonly initialStreakDays: number
  /** セッション開始前の今日の回答数（デイリーゴール達成判定用） */
  readonly initialTodayCount: number
  /** セッション開始時のXP（レベルアップ判定用） */
  readonly initialXp: number
  /** 各問題の回答履歴 (index → {selectedAnswer, selectedAnswers, isCorrect}) */
  readonly answerHistory: ReadonlyMap<number, AnswerRecord>
  /** 全体像モードのチャプター状態（overview以外は null） */
  readonly overviewChapterState: OverviewChapterState | null
}

export interface AnswerRecord {
  readonly selectedAnswer: number | null
  readonly selectedAnswers: readonly number[]
  readonly isCorrect: boolean
}

/**
 * 全体像モードのチャプター範囲（問題インデックス）
 */
export interface ChapterRange {
  readonly chapterId: number
  readonly startIndex: number // inclusive
  readonly endIndex: number // exclusive
}

/**
 * 全体像モードのチャプター状態
 *
 * overview モードでのみ使用。チャプターの遷移
 * （イントロ → 問題 → 完了）をドメイン層で管理する。
 */
export interface OverviewChapterState {
  readonly chapters: readonly ChapterRange[]
  readonly currentChapterId: number
  readonly chapterPhase: 'intro' | 'questions' | 'complete'
  readonly dismissedIntros: ReadonlySet<number>
  readonly dismissedCompletes: ReadonlySet<number>
}

/**
 * クイズセッション管理サービス
 */
export class QuizSessionService {
  /**
   * Fisher-Yates シャッフルアルゴリズム
   *
   * 【なぜ Fisher-Yates か】
   * - O(n) の計算量
   * - 均一な分布を保証
   * - シンプルで理解しやすい
   *
   * 【注意】
   * 元の配列を変更せず、新しい配列を返す。
   */
  static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  /**
   * 学習の初期段階（初学者）かどうか。回答総数で判定する。
   */
  static isEarlyStage(userProgress: UserProgress): boolean {
    return userProgress.totalAttempts < ENGAGEMENT_GATE_ATTEMPTS
  }

  /**
   * 初学者には刺さりにくい問題（SDK カテゴリ / 上級トリビア）か。
   * これらは ROI は高くても初見の動機を下げやすいため、序盤は後回しにする。
   */
  private static isLowEngagementForBeginner(question: Question): boolean {
    if (question.category === 'sdk') return true
    if (question.difficulty === 'advanced' && question.tags.includes('trivia')) return true
    return false
  }

  /**
   * 低エンゲージメント問題を後方へ回す安定パーティション（相対順序は保持）。
   * 除外ではないため、序盤セッションの slice には乗らないが問題自体は失われない。
   */
  private static deprioritizeLowEngagement(questions: Question[]): Question[] {
    const primary: Question[] = []
    const gated: Question[] = []
    for (const q of questions) {
      if (this.isLowEngagementForBeginner(q)) gated.push(q)
      else primary.push(q)
    }
    return [...primary, ...gated]
  }

  /**
   * カテゴリの weight に基づいて、指定数の問題をバランスよく抽出する。
   * 各カテゴリから weight 比率に応じた問題数を割り当て、カテゴリ内はシャッフル。
   * 端数は weight の大きいカテゴリから優先的に割り当てる。
   */
  static weightedSampleByCategory(questions: Question[], count: number): Question[] {
    const categoryWeights = new Map<string, number>()
    for (const cat of PREDEFINED_CATEGORIES) {
      categoryWeights.set(cat.id, cat.weight)
    }

    // Group questions by category
    const byCategory = new Map<string, Question[]>()
    for (const q of questions) {
      const list = byCategory.get(q.category) ?? []
      list.push(q)
      byCategory.set(q.category, list)
    }

    // Calculate allocation per category based on weight
    const totalWeight = [...byCategory.keys()].reduce((sum, id) => sum + (categoryWeights.get(id) ?? 10), 0)
    const allocations: { id: string; target: number; available: number; fraction: number }[] = []
    for (const [id, qs] of byCategory) {
      const weight = categoryWeights.get(id) ?? 10
      const exact = (weight / totalWeight) * count
      allocations.push({ id, target: Math.floor(exact), available: qs.length, fraction: exact - Math.floor(exact) })
    }

    // Distribute remainder to categories with largest fractional parts (respecting available count)
    let remaining = count - allocations.reduce((s, a) => s + a.target, 0)
    allocations.sort((a, b) => b.fraction - a.fraction)
    for (const alloc of allocations) {
      if (remaining <= 0) break
      if (alloc.target < alloc.available) {
        alloc.target++
        remaining--
      }
    }

    // If a category doesn't have enough questions, redistribute excess to others
    let excess = 0
    for (const alloc of allocations) {
      if (alloc.target > alloc.available) {
        excess += alloc.target - alloc.available
        alloc.target = alloc.available
      }
    }
    // Distribute excess to categories that have room, sorted by weight desc
    allocations.sort((a, b) => (categoryWeights.get(b.id) ?? 10) - (categoryWeights.get(a.id) ?? 10))
    for (const alloc of allocations) {
      if (excess <= 0) break
      const room = alloc.available - alloc.target
      if (room > 0) {
        const add = Math.min(room, excess)
        alloc.target += add
        excess -= add
      }
    }

    // Pick shuffled questions from each category
    const result: Question[] = []
    for (const alloc of allocations) {
      const pool = byCategory.get(alloc.id) ?? []
      const shuffled = this.shuffleArray(pool)
      result.push(...shuffled.slice(0, alloc.target))
    }

    return this.shuffleArray(result)
  }

  /**
   * セッション用の問題リストを準備
   *
   * 【処理フロー】
   * 1. カテゴリでフィルタ
   * 2. 難易度でフィルタ
   * 3. モードに応じた問題選択（苦手モードなど）
   * 4. シャッフル（設定に応じて）
   * 5. 問題数の制限
   *
   * 【苦手モード（weak）の挙動】
   * 1. まず苦手問題（正答率 < weakThreshold）を抽出
   * 2. 苦手問題がなければ未回答問題にフォールバック
   * 3. 未回答問題もなければ全問題を使用
   */
  static prepareSessionQuestions(
    allQuestions: Question[],
    config: QuizSessionConfig,
    userProgress: UserProgress,
    weakThreshold: number = 50,
    minAttemptsForWeak: number = 1
  ): Question[] {
    let questions = [...allQuestions]

    // Filter by category
    if (config.categoryFilter) {
      questions = questions.filter((q) => q.category === config.categoryFilter)
    }

    // Filter by difficulty
    if (config.difficultyFilter) {
      questions = questions.filter((q) => q.difficulty === config.difficultyFilter)
    }

    // For practical / trivia modes, filter to questions with that practicality tag.
    // Fallback: if no tagged questions exist yet (classification not applied), keep the
    // unfiltered set so the session never starts with 0 questions.
    if (config.mode === 'practical') {
      const filtered = questions.filter((q) => q.tags.includes('practical'))
      if (filtered.length > 0) questions = filtered
    } else if (config.mode === 'trivia') {
      const filtered = questions.filter((q) => q.tags.includes('trivia'))
      if (filtered.length > 0) questions = filtered
    }

    // For overview mode, filter to tagged questions and sort by order tag
    if (config.mode === 'overview') {
      questions = questions.filter((q) => q.tags.includes('overview'))
      questions.sort((a, b) => {
        const getOrder = (q: Question): number => {
          const orderTag = q.tags.find((t) => t.startsWith('overview-'))
          return orderTag ? parseInt(orderTag.replace('overview-', ''), 10) : 999
        }
        return getOrder(a) - getOrder(b)
      })
    }

    // For bookmark mode, filter to bookmarked questions
    if (config.mode === 'bookmark') {
      const bookmarked = questions.filter((q) => userProgress.isBookmarked(q.id))
      if (bookmarked.length > 0) {
        questions = bookmarked
      }
    }

    // For weak mode: find weak questions + their prerequisite fundamentals
    let weakUsedSRS = false
    if (config.mode === 'weak') {
      const now = Date.now()
      const allWeakQuestions = questions.filter((q) =>
        userProgress.isWeakQuestion(q.id, weakThreshold, minAttemptsForWeak)
      )
      // Prefer due weak questions; fall back to all weak if none are due
      const dueWeak = allWeakQuestions.filter((q) =>
        SpacedRepetitionService.isDue(userProgress.questionProgress[q.id], now)
      )
      const weakQuestions = dueWeak.length > 0 ? dueWeak : allWeakQuestions

      if (weakQuestions.length > 0) {
        // Find categories where user is weak
        const weakCategories = new Set(weakQuestions.map((q) => q.category))

        // Find unmastered fundamentals in those categories
        // (beginner questions user hasn't answered or got wrong)
        const prerequisites = questions.filter(
          (q) =>
            weakCategories.has(q.category) &&
            q.difficulty === 'beginner' &&
            !weakQuestions.some((w) => w.id === q.id) &&
            (userProgress.getQuestionAccuracy(q.id) ?? 0) < 100
        )

        // Build sequence: fundamentals first, then weak questions
        // This helps user build understanding before re-attempting hard questions
        const combined = [
          ...SpacedRepetitionService.sortByPriority(prerequisites, userProgress, Date.now()),
          ...SpacedRepetitionService.sortByPriority(weakQuestions, userProgress, Date.now()),
        ]

        // Deduplicate (a question could be both prerequisite and weak)
        const seen = new Set<string>()
        questions = combined.filter((q) => {
          if (seen.has(q.id)) return false
          seen.add(q.id)
          return true
        })
        weakUsedSRS = true
      } else {
        // Fallback: try unanswered questions (these should be shuffled normally)
        const unansweredQuestions = questions.filter((q) => !userProgress.hasAttempted(q.id))
        if (unansweredQuestions.length > 0) {
          questions = unansweredQuestions
        }
      }
    }

    // For quick mode, pick SRS-due questions (most overdue first, 3 questions)
    if (config.mode === 'quick') {
      const now = Date.now()
      const dueQuestions = questions.filter((q) => {
        const qp = userProgress.questionProgress[q.id]
        return qp && qp.attempts > 0 && SpacedRepetitionService.isDue(qp, now)
      })
      if (dueQuestions.length > 0) {
        questions = SpacedRepetitionService.sortByPriority(dueQuestions, userProgress, now)
      } else {
        // Fallback: oldest-answered questions (most likely forgotten)
        const answered = questions
          .filter((q) => userProgress.hasAttempted(q.id))
          .sort((a, b) => {
            const aTime = userProgress.questionProgress[a.id]?.lastAttemptAt ?? 0
            const bTime = userProgress.questionProgress[b.id]?.lastAttemptAt ?? 0
            return aTime - bTime // oldest first
          })
        if (answered.length > 0) {
          questions = answered
        }
      }
    }

    // For unanswered mode, filter to incorrect/unanswered questions
    if (config.mode === 'unanswered') {
      const incorrect = questions.filter((q) => !userProgress.isCorrectlyAnswered(q.id))
      if (incorrect.length > 0) {
        questions = incorrect
      }
    }

    // Adaptive difficulty: for random/category modes, prioritize questions
    // the user hasn't mastered yet (unmastered first, then mastered)
    // Also apply difficulty-based adaptive ordering when sufficient data exists
    if ((config.mode === 'random' || config.mode === 'category') && userProgress.totalAttempts > 0) {
      const unmastered = questions.filter((q) => (userProgress.getQuestionAccuracy(q.id) ?? 0) < 100)
      const mastered = questions.filter((q) => (userProgress.getQuestionAccuracy(q.id) ?? 0) >= 100)

      // Apply adaptive difficulty within unmastered questions
      const orderedUnmastered = AdaptiveDifficultyService.isAdaptiveReady(userProgress)
        ? AdaptiveDifficultyService.reorderByAdaptiveDifficulty(this.shuffleArray(unmastered), userProgress)
        : this.shuffleArray(unmastered)

      questions = [...orderedUnmastered, ...this.shuffleArray(mastered)]
    }

    // Shuffle if needed (skip when SRS priority or adaptive ordering was applied)
    const srsApplied = weakUsedSRS || config.mode === 'quick'
    const adaptiveApplied = (config.mode === 'random' || config.mode === 'category') && userProgress.totalAttempts > 0
    if (config.shuffleQuestions && !srsApplied && !adaptiveApplied) {
      questions = this.shuffleArray(questions)
    }

    // Engagement gate (動機曲線): 初学者の random/category セッションでは、SDK と上級トリビアを
    // 後方へ回し、序盤に「早い成功体験 → 高ROIだが地味な項目」の順で動機を温める。
    // ハード除外ではなくパーティション（順序入れ替え）なので、出題プールは枯渇しない。
    if ((config.mode === 'random' || config.mode === 'category') && this.isEarlyStage(userProgress)) {
      questions = this.deprioritizeLowEngagement(questions)
    }

    // For full (実力テスト) mode: use weighted sampling by category
    if (config.mode === 'full' && config.questionCount && config.questionCount < questions.length) {
      questions = this.weightedSampleByCategory(questions, config.questionCount)
    } else if (config.questionCount && config.questionCount < questions.length) {
      questions = questions.slice(0, config.questionCount)
    }

    return questions
  }

  /**
   * セッションの初期状態を作成
   */
  static createInitialState(
    questions: Question[],
    config: QuizSessionConfig,
    options?: {
      isReviewMode?: boolean
      reviewUserAnswers?: number[]
      reviewUserMultiAnswers?: number[][]
    }
  ): QuizSessionState {
    const isReviewMode = options?.isReviewMode ?? false
    const reviewUserAnswers = options?.reviewUserAnswers ?? []
    const reviewUserMultiAnswers = options?.reviewUserMultiAnswers ?? []

    // In review mode, pre-populate the first question's state
    const firstQuestion = questions[0]
    let firstUserAnswer: number | null = null
    let firstSelectedAnswers: readonly number[] = []
    let firstIsCorrect: boolean | null = null

    if (isReviewMode && firstQuestion) {
      if (firstQuestion.isMultiSelect) {
        firstSelectedAnswers = reviewUserMultiAnswers[0] ?? []
        firstIsCorrect = firstQuestion.isCorrectMultiAnswer([...firstSelectedAnswers])
      } else {
        firstUserAnswer = reviewUserAnswers.length > 0 ? reviewUserAnswers[0] : null
        firstIsCorrect = firstUserAnswer !== null ? firstQuestion.isCorrectAnswer(firstUserAnswer) : null
      }
    }

    return {
      config,
      questions: Object.freeze(questions),
      currentIndex: 0,
      selectedAnswer: firstUserAnswer,
      selectedAnswers: Object.freeze(firstSelectedAnswers as number[]),
      isAnswered: isReviewMode,
      isCorrect: firstIsCorrect,
      score: 0,
      answeredCount: 0,
      isCompleted: false,
      startedAt: Date.now(),
      timeRemaining: config.timeLimit ? config.timeLimit * 60 : null,
      isReviewMode,
      reviewUserAnswers: Object.freeze(reviewUserAnswers),
      reviewUserMultiAnswers: Object.freeze(reviewUserMultiAnswers.map((a) => Object.freeze([...a]))),
      hintUsed: false,
      hintsUsedCount: 0,
      deferFeedback: config.mode === 'full',
      initialStreakDays: 0,
      initialTodayCount: 0,
      initialXp: 0,
      answerHistory: new Map(),
      overviewChapterState: config.mode === 'overview' ? this.buildOverviewChapterState(questions, 0) : null,
    }
  }

  /**
   * 全体像モードのチャプター状態を構築
   */
  /**
   * 全体像モードのチャプター状態を任意の startIndex から構築（public: セッション再開用）
   */
  static buildOverviewChapterStateFromIndex(questions: readonly Question[], startIndex: number): OverviewChapterState {
    return this.buildOverviewChapterState(questions, startIndex)
  }

  private static buildOverviewChapterState(questions: readonly Question[], startIndex: number): OverviewChapterState {
    // チャプター範囲を問題のタグから計算
    const chapterMap = new Map<number, { start: number; end: number }>()
    for (let i = 0; i < questions.length; i++) {
      const ch = getChapterFromTags(questions[i].tags)
      if (!ch) continue
      const existing = chapterMap.get(ch.id)
      if (existing) {
        existing.end = i + 1
      } else {
        chapterMap.set(ch.id, { start: i, end: i + 1 })
      }
    }
    const chapters: ChapterRange[] = Array.from(chapterMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([chapterId, range]) => ({ chapterId, startIndex: range.start, endIndex: range.end }))

    // startIndex からチャプターを特定
    const startChapter = chapters.find((c) => startIndex >= c.startIndex && startIndex < c.endIndex)
    const currentChapterId = startChapter?.chapterId ?? chapters[0]?.chapterId ?? 1

    // startIndex がチャプター先頭ならイントロ、途中ならイントロスキップ
    const isChapterStart = startChapter ? startIndex === startChapter.startIndex : true
    const dismissedIntros = new Set<number>()
    if (!isChapterStart) {
      dismissedIntros.add(currentChapterId)
    }

    return {
      chapters,
      currentChapterId,
      chapterPhase: isChapterStart ? 'intro' : 'questions',
      dismissedIntros,
      dismissedCompletes: new Set(),
    }
  }

  /**
   * デフォルト設定を作成
   */
  static createDefaultConfig(): QuizSessionConfig {
    return {
      mode: 'random',
      categoryFilter: null,
      difficultyFilter: null,
      questionCount: 20,
      timeLimit: null,
      shuffleQuestions: true,
      shuffleOptions: false,
    }
  }

  /**
   * 回答を選択（単一選択用）
   *
   * すでに回答済みの場合は何もしない。
   */
  static selectAnswer(state: QuizSessionState, answerIndex: number): QuizSessionState {
    if (state.isAnswered) {
      return state
    }
    return {
      ...state,
      selectedAnswer: answerIndex,
    }
  }

  /**
   * 回答をトグル（複数選択用）
   *
   * すでに選択されていれば解除、されていなければ追加。
   * 回答済みの場合は何もしない。
   */
  static toggleAnswer(state: QuizSessionState, answerIndex: number): QuizSessionState {
    if (state.isAnswered) {
      return state
    }
    const current = [...state.selectedAnswers]
    const idx = current.indexOf(answerIndex)
    if (idx >= 0) {
      current.splice(idx, 1)
    } else {
      current.push(answerIndex)
    }
    return {
      ...state,
      selectedAnswers: Object.freeze(current),
    }
  }

  /**
   * 回答を確定
   *
   * 【戻り値】
   * - newState: 更新された状態
   * - isCorrect: 正解だったかどうか
   *
   * 選択されていない場合や、すでに回答済みの場合は null を返す。
   */
  static submitAnswer(state: QuizSessionState): {
    newState: QuizSessionState
    isCorrect: boolean
  } | null {
    if (state.isAnswered) {
      return null
    }

    const currentQuestion = state.questions[state.currentIndex]
    if (!currentQuestion) {
      return null
    }

    let isCorrect: boolean

    if (currentQuestion.isMultiSelect) {
      if (state.selectedAnswers.length === 0) {
        return null
      }
      isCorrect = currentQuestion.isCorrectMultiAnswer([...state.selectedAnswers])
    } else {
      if (state.selectedAnswer === null) {
        return null
      }
      isCorrect = currentQuestion.isCorrectAnswer(state.selectedAnswer)
    }

    // Check if this question was previously answered (re-answer scenario)
    const previousRecord = state.answerHistory.get(state.currentIndex)
    const isReAnswer = !!previousRecord

    // Save answer to history
    const newHistory = new Map(state.answerHistory)
    newHistory.set(state.currentIndex, {
      selectedAnswer: state.selectedAnswer,
      selectedAnswers: state.selectedAnswers,
      isCorrect,
    })

    // Adjust score: subtract previous answer's contribution, add new one
    let scoreDelta = isCorrect ? 1 : 0
    if (isReAnswer && previousRecord.isCorrect) {
      scoreDelta -= 1 // remove previous correct point
    }
    // Prevent negative score
    const newScore = Math.max(0, state.score + scoreDelta)

    const newState: QuizSessionState = {
      ...state,
      isAnswered: true,
      isCorrect,
      score: newScore,
      answeredCount: isReAnswer ? state.answeredCount : state.answeredCount + 1,
      answerHistory: newHistory,
    }

    return { newState, isCorrect }
  }

  /**
   * 次の問題へ進む
   *
   * 最後の問題だった場合は isCompleted: true を設定。
   */
  static nextQuestion(state: QuizSessionState): QuizSessionState {
    const nextIndex = state.currentIndex + 1
    const ocs = state.overviewChapterState

    // 全体像モード: チャプター境界で完了画面を挟む
    if (ocs && ocs.chapterPhase === 'questions' && nextIndex < state.questions.length) {
      const currentRange = ocs.chapters.find((c) => c.chapterId === ocs.currentChapterId)
      if (currentRange && nextIndex >= currentRange.endIndex) {
        return {
          ...state,
          overviewChapterState: { ...ocs, chapterPhase: 'complete' },
        }
      }
    }

    if (nextIndex >= state.questions.length) {
      // 全体像モード最終チャプター: 完了画面を先に出す
      if (ocs && ocs.chapterPhase === 'questions') {
        return {
          ...state,
          overviewChapterState: { ...ocs, chapterPhase: 'complete' },
        }
      }
      return {
        ...state,
        isCompleted: true,
        overviewChapterState: ocs ? { ...ocs, chapterPhase: 'complete' } : null,
      }
    }

    // In review mode, pre-populate the next question's answer state
    if (state.isReviewMode) {
      const nextQuestion = state.questions[nextIndex]
      if (nextQuestion?.isMultiSelect) {
        const userMultiAnswer = state.reviewUserMultiAnswers[nextIndex] ?? []
        return {
          ...state,
          currentIndex: nextIndex,
          selectedAnswer: null,
          selectedAnswers: Object.freeze([...userMultiAnswer]),
          isAnswered: true,
          isCorrect: nextQuestion.isCorrectMultiAnswer([...userMultiAnswer]),
          hintUsed: false,
        }
      }
      const userAnswer = state.reviewUserAnswers[nextIndex] ?? null
      return {
        ...state,
        currentIndex: nextIndex,
        selectedAnswer: userAnswer,
        selectedAnswers: Object.freeze([]),
        isAnswered: true,
        isCorrect: nextQuestion && userAnswer !== null ? nextQuestion.isCorrectAnswer(userAnswer) : null,
        hintUsed: false,
      }
    }

    return {
      ...state,
      currentIndex: nextIndex,
      selectedAnswer: null,
      selectedAnswers: Object.freeze([]),
      isAnswered: false,
      isCorrect: null,
      hintUsed: false,
    }
  }

  /**
   * チャプターイントロを閉じて問題フェーズへ遷移
   */
  static dismissChapterIntro(state: QuizSessionState): QuizSessionState {
    const ocs = state.overviewChapterState
    if (!ocs || ocs.chapterPhase !== 'intro') return state
    return {
      ...state,
      overviewChapterState: {
        ...ocs,
        chapterPhase: 'questions',
        dismissedIntros: new Set([...ocs.dismissedIntros, ocs.currentChapterId]),
      },
    }
  }

  /**
   * チャプター完了画面を閉じて次のチャプターへ（またはセッション完了）
   */
  static dismissChapterComplete(state: QuizSessionState): QuizSessionState {
    const ocs = state.overviewChapterState
    if (!ocs || ocs.chapterPhase !== 'complete') return state

    const currentIdx = ocs.chapters.findIndex((c) => c.chapterId === ocs.currentChapterId)
    const nextChapterRange = ocs.chapters[currentIdx + 1]
    const dismissedCompletes = new Set([...ocs.dismissedCompletes, ocs.currentChapterId])

    if (!nextChapterRange) {
      // 最終チャプター → セッション完了
      return {
        ...state,
        isCompleted: true,
        overviewChapterState: { ...ocs, dismissedCompletes, chapterPhase: 'complete' },
      }
    }

    // 次のチャプターのイントロへ
    return {
      ...state,
      currentIndex: nextChapterRange.startIndex,
      selectedAnswer: null,
      selectedAnswers: Object.freeze([]),
      isAnswered: false,
      isCorrect: null,
      hintUsed: false,
      overviewChapterState: {
        ...ocs,
        currentChapterId: nextChapterRange.chapterId,
        chapterPhase: 'intro',
        dismissedCompletes,
      },
    }
  }

  /**
   * チャプタースコアを計算
   */
  static getChapterScore(state: QuizSessionState, chapterId: number): { score: number; total: number } {
    const ocs = state.overviewChapterState
    if (!ocs) return { score: 0, total: 0 }
    const range = ocs.chapters.find((c) => c.chapterId === chapterId)
    if (!range) return { score: 0, total: 0 }

    let score = 0
    let total = 0
    for (let i = range.startIndex; i < range.endIndex; i++) {
      const record = state.answerHistory.get(i)
      if (record) {
        total++
        if (record.isCorrect) score++
      }
    }
    return { score, total }
  }

  /**
   * タイマーを更新（1秒減算）
   *
   * 時間切れになった場合は isCompleted: true を設定。
   */
  static updateTimer(state: QuizSessionState): QuizSessionState {
    if (state.timeRemaining === null || state.timeRemaining <= 0) {
      return state
    }

    // Pause timer when reviewing a previously answered question
    if (state.answerHistory.has(state.currentIndex) && !state.isAnswered) {
      return state
    }

    const newTime = state.timeRemaining - 1

    if (newTime <= 0) {
      return {
        ...state,
        timeRemaining: 0,
        isCompleted: true,
      }
    }

    return {
      ...state,
      timeRemaining: newTime,
    }
  }

  /**
   * 現在の問題をリトライ（回答済み状態をリセット）
   *
   * 不正解の場合にのみリトライ可能。
   * スコアは変更しないが、リトライ後に正解してもスコアに加算しない。
   */
  static retryQuestion(state: QuizSessionState): QuizSessionState {
    if (!state.isAnswered || state.isCorrect) {
      return state
    }

    // Keep answerHistory entry (so navigation knows this was answered)
    // but reset UI state to allow re-answering.
    // submitAnswer will treat this as isReAnswer and adjust score accordingly.
    return {
      ...state,
      selectedAnswer: null,
      selectedAnswers: Object.freeze([]),
      isAnswered: false,
      isCorrect: null,
      hintUsed: false,
    }
  }

  /**
   * ヒントを使用
   *
   * 回答済みまたは既にヒント使用済みの場合は何もしない。
   */
  static useHint(state: QuizSessionState): QuizSessionState {
    if (state.isAnswered || state.hintUsed) return state
    return {
      ...state,
      hintUsed: true,
      hintsUsedCount: state.hintsUsedCount + 1,
    }
  }

  /**
   * 現在の問題を取得
   */
  static getCurrentQuestion(state: QuizSessionState): Question | null {
    return state.questions[state.currentIndex] ?? null
  }

  /**
   * 進捗情報を取得
   */
  static getProgress(state: QuizSessionState): { current: number; total: number } {
    return {
      current: state.currentIndex + 1,
      total: state.questions.length,
    }
  }

  /**
   * スコアをパーセンテージで計算
   */
  static calculateScorePercentage(state: QuizSessionState): number {
    return calculateAccuracy(state.score, state.answeredCount)
  }

  /**
   * 合格判定
   */
  static hasPassed(state: QuizSessionState, passingScore: number = PASSING_SCORE): boolean {
    return this.calculateScorePercentage(state) >= passingScore
  }
}
