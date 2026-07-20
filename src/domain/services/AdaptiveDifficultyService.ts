/**
 * AdaptiveDifficultyService - カテゴリ別正答率に応じた難易度調整
 *
 * 正答率が高いカテゴリでは上級問題を優先、低いカテゴリでは初級を多めにする。
 */

import type { Question } from '../entities/Question'
import type { UserProgress } from '../entities/UserProgress'
import { additiveValueScore } from '../valueObjects/ValueScore'

const HIGH_ACCURACY_THRESHOLD = 80
const LOW_ACCURACY_THRESHOLD = 50
const MIN_ATTEMPTS_FOR_ADAPTIVE = 5

export class AdaptiveDifficultyService {
  /**
   * カテゴリ別正答率に基づいて問題をスコアリングし並べ替え
   *
   * - 正答率 80%超のカテゴリ → advanced を優先（intermediate > beginner）
   * - 正答率 50%未満のカテゴリ → beginner を優先（intermediate > advanced）
   * - それ以外 → intermediate を優先
   */
  static reorderByAdaptiveDifficulty(questions: Question[], userProgress: UserProgress): Question[] {
    const categoryAccuracy = this.getCategoryAccuracies(questions, userProgress)

    // Sort key: 難易度スコア(主) → 価値スコア(従, tie-break) → 元index(shuffle 温存)
    // 価値(コスパ)は難易度順序を一切上書きせず、同難易度スコア内でのみ高価値問題を前に出す。
    // これにより「未マスター優先(タイパ)」「アダプティブ難易度」を壊さず価値を弱く効かせる。
    //
    // 【重要】価値 tie-break は「カテゴリ別正答率データがある場合」に限定する。
    // データ希薄時(序盤・ニッチカテゴリ)は全問 difficultyScore=0 に collapse するため、
    // value を効かせるとプール全体が value-DESC に決定論化しシャッフル多様性を失う。
    // データが無い問題は value=0 とし、index(=shuffle 順)で多様性を保つ。
    // 初学者への高価値優先は S2 動機曲線ゲート(QuizSessionService)が別途担う。
    const indexed = questions.map((q, i) => {
      const accuracy = categoryAccuracy.get(q.category)
      const hasData = accuracy !== null && accuracy !== undefined
      return {
        q,
        i,
        score: this.getDifficultyScore(q, categoryAccuracy),
        value: hasData ? this.getValueScore(q) : 0,
      }
    })
    indexed.sort((a, b) => b.score - a.score || b.value - a.value || a.i - b.i)
    return indexed.map((x) => x.q)
  }

  /**
   * 適応的な難易度調整が有効か（十分なデータがあるか）
   */
  static isAdaptiveReady(userProgress: UserProgress): boolean {
    return userProgress.totalAttempts >= MIN_ATTEMPTS_FOR_ADAPTIVE
  }

  private static getCategoryAccuracies(questions: Question[], userProgress: UserProgress): Map<string, number | null> {
    const categories = new Set(questions.map((q) => q.category))
    const result = new Map<string, number | null>()

    for (const cat of categories) {
      const cp = userProgress.categoryProgress[cat]
      if (cp && cp.attemptedQuestions >= 3) {
        result.set(cat, cp.accuracy)
      } else {
        result.set(cat, null)
      }
    }

    return result
  }

  /**
   * 実務価値スコア（同難易度内の tie-break 用）
   * 補正値の単一情報源は valueObjects/ValueScore（weight + practical/trivia 補正）。
   */
  private static getValueScore(question: Question): number {
    return additiveValueScore(question)
  }

  private static getDifficultyScore(question: Question, categoryAccuracy: Map<string, number | null>): number {
    const accuracy = categoryAccuracy.get(question.category)

    // No data yet — use default ordering
    if (accuracy === null || accuracy === undefined) return 0

    const difficultyMap: Record<string, number> = {
      beginner: 0,
      intermediate: 1,
      advanced: 2,
    }
    const diffLevel = difficultyMap[question.difficulty] ?? 1

    if (accuracy >= HIGH_ACCURACY_THRESHOLD) {
      // User is strong → prioritize harder questions
      return diffLevel // advanced=2, intermediate=1, beginner=0
    }
    if (accuracy < LOW_ACCURACY_THRESHOLD) {
      // User is weak → prioritize easier questions
      return 2 - diffLevel // beginner=2, intermediate=1, advanced=0
    }
    // Middle ground → prioritize intermediate
    return diffLevel === 1 ? 2 : 1 // intermediate=2, others=1
  }
}
