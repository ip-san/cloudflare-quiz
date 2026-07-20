/**
 * SpacedRepetitionService - 間隔反復スケジューリングサービス
 *
 * 問題の復習タイミングを管理する。
 * correctStreak に基づいて復習間隔を計算し、
 * 期限到来の問題を優先的に出題する。
 */

import type { Question } from '../entities/Question'
import type { QuestionProgress, UserProgress } from '../entities/UserProgress'
import { calculateNextReview, SRS_INTERVALS_MS } from '../valueObjects/SrsInterval'
import { categoryWeight, VALUE_TAG_MULTIPLIER } from '../valueObjects/ValueScore'

// Re-export for backwards compatibility
export { SRS_INTERVALS_MS }

export class SpacedRepetitionService {
  /**
   * 次回復習日時を計算
   */
  static calculateNextReview(correctStreak: number, now: number): number {
    return calculateNextReview(correctStreak, now)
  }

  /**
   * 問題が復習期限に達しているかを判定
   *
   * - 未回答の問題は常に due（新しい問題として出題）
   * - nextReviewAt が未設定の回答済み問題も due
   * - nextReviewAt <= now なら due
   */
  static isDue(qp: QuestionProgress | undefined, now: number): boolean {
    if (!qp || qp.attempts === 0) return true
    if (qp.nextReviewAt === undefined) return true
    return qp.nextReviewAt <= now
  }

  /**
   * 期限到来の問題数をカウント
   */
  static getDueCount(userProgress: UserProgress, now: number): number {
    const allQp = Object.values(userProgress.questionProgress)
    return allQp.filter((qp) => this.isDue(qp, now)).length
  }

  /**
   * 問題を復習優先度順にソート（最も期限超過が大きいものを先頭に）
   *
   * 期限超過度(overdue)を主、実務価値(valueFactor)を従として合成する。
   * これにより「同程度に忘れかけた問題なら高価値から復習する」（コスパ）を、
   * 「忘れかけた問題を優先する」（タイパ＝忘却防止）を壊さずに両立する。
   */
  static sortByPriority(questions: Question[], userProgress: UserProgress, now: number): Question[] {
    // 優先度は要素ごとに一度だけ算出してから安定ソートする（valueFactor→getCategoryById の
    // 線形探索を比較のたびに呼ばないため。AdaptiveDifficultyService と同じ compute-once パターン）。
    return questions
      .map((q) => ({ q, priority: this.getWeightedOverdue(userProgress.questionProgress[q.id], q, now) }))
      .sort((a, b) => b.priority - a.priority) // More overdue (value-weighted) comes first
      .map((x) => x.q)
  }

  /**
   * 実務価値による優先度係数（weight×tag 合成後の実レンジ 約 0.855〜1.05）
   *
   * カテゴリ weight（実務頻度×インパクトのプロキシ 5/10/15）を主とし、
   * practical/trivia タグで微調整する。overdue に対し弱く効かせるための狭いレンジ。
   * 合成例: weight5+trivia=0.855（下限） / weight15+practical=1.05（上限）。
   */
  private static valueFactor(question: Question): number {
    const weight = categoryWeight(question.category) // 単一情報源: valueObjects/ValueScore
    let factor = 0.85 + 0.15 * (weight / 15) // weight 5→0.90, 10→0.95, 15→1.00（タグ補正前）
    if (question.tags.includes('practical')) factor *= VALUE_TAG_MULTIPLIER.practical
    else if (question.tags.includes('trivia')) factor *= VALUE_TAG_MULTIPLIER.trivia
    return factor
  }

  /**
   * 価値係数を合成した overdue。
   * 期限到来済み（overdue > 0）のみ係数を掛け、未回答(-1)・未到来(負)の順序は不変に保つ
   * （負値に係数を掛けると順序が歪み、due 済み問題を追い越す恐れがあるため）。
   *
   * nextReviewAt 未設定（MAX_SAFE_INTEGER の最大優先度）は係数を掛けない。
   * 巨大値×係数は整数安全範囲を超え、同値タイの順序が浮動小数誤差で不定化するため、
   * 素通しして安定ソート（元順序）に委ねる。
   */
  private static getWeightedOverdue(qp: QuestionProgress | undefined, question: Question, now: number): number {
    const overdue = this.getOverdue(qp, now)
    if (overdue <= 0 || overdue >= Number.MAX_SAFE_INTEGER) return overdue
    return overdue * this.valueFactor(question)
  }

  /**
   * 問題の期限超過度を算出（ミリ秒）
   * 未回答は30日分の overdue として扱う（回答済み問題より低い優先度）
   * nextReviewAt 未設定の回答済み問題は最大優先度
   */
  private static getOverdue(qp: QuestionProgress | undefined, now: number): number {
    if (!qp || qp.attempts === 0) {
      // 未回答: 最低優先度（復習が必要な問題を先に出す）
      return -1
    }
    if (qp.nextReviewAt === undefined) {
      return Number.MAX_SAFE_INTEGER
    }
    return now - qp.nextReviewAt
  }
}
