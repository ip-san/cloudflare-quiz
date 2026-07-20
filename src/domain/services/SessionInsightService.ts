/**
 * SessionInsightService - セッション分析サービス
 *
 * セッション履歴から学習傾向を分析し、
 * 成長の可視化に使用する。
 */

import type { SessionRecord } from '../entities/UserProgress'

export class SessionInsightService {
  /**
   * 直近5セッション vs 前5セッションの正答率差を返す
   * データが10件未満の場合は null（5 vs 5 の比較に必要）
   */
  static getImprovementTrend(history: readonly SessionRecord[]): number | null {
    if (history.length < 10) return null

    const recent = history.slice(-5)
    const previous = history.slice(-10, -5)

    if (previous.length === 0) return null

    const recentAvg = recent.reduce((sum, s) => sum + s.percentage, 0) / recent.length
    const previousAvg = previous.reduce((sum, s) => sum + s.percentage, 0) / previous.length

    return Math.round(recentAvg - previousAvg)
  }

  /**
   * 履歴中の最高スコア（パーセンテージ）を返す
   * 履歴がない場合は null
   */
  static getBestScore(history: readonly SessionRecord[]): number | null {
    if (history.length === 0) return null
    return Math.max(...history.map((s) => s.percentage))
  }

  /**
   * 直近Nセッションを取得（最新が末尾）
   */
  static getRecentSessions(history: readonly SessionRecord[], count: number = 10): readonly SessionRecord[] {
    return history.slice(-count)
  }
}
