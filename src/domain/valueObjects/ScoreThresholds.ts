/**
 * スコアしきい値の定義（Single Source of Truth）
 *
 * パッシングスコア、証明書発行条件、色分け基準など、
 * アプリ全体で使われるスコアしきい値を一箇所に集約。
 * ハードコードされた 70, 80 等の数値はここを参照すること。
 */

/** パッシングスコア（合格ライン） */
export const PASSING_SCORE = 70

/** 証明書発行条件 */
export const CERTIFICATE_THRESHOLDS = {
  full: 80,
  overview: 70,
} as const

/** スコア色分け基準 */
export const SCORE_COLORS = {
  excellent: 80,
  good: 70,
  fair: 50,
} as const

/** カテゴリマスタリー判定しきい値（Opus 分析トリガー） */
export const MASTERY_THRESHOLD = 90

/**
 * スコアに応じた色分け判定
 */
export function getScoreLevel(percentage: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (percentage >= SCORE_COLORS.excellent) return 'excellent'
  if (percentage >= SCORE_COLORS.good) return 'good'
  if (percentage >= SCORE_COLORS.fair) return 'fair'
  return 'poor'
}

/**
 * 証明書発行可能か判定
 */
export function isCertificateEligible(mode: string, percentage: number): boolean {
  if (mode === 'full') return percentage >= CERTIFICATE_THRESHOLDS.full
  if (mode === 'overview') return percentage >= CERTIFICATE_THRESHOLDS.overview
  return false
}

/**
 * 正答率を計算（ゼロ除算防止付き）
 *
 * 全画面で統一して使用すること（ロジックの分散を防ぐ）。
 */
export function calculateAccuracy(correct: number, attempted: number): number {
  return attempted > 0 ? Math.round((correct / attempted) * 100) : 0
}
