/**
 * SRS (Spaced Repetition System) 間隔計算
 *
 * 復習タイミングの計算ロジック。
 * Entity/Service の循環依存を避けるため、独立した値オブジェクトとして定義。
 */

/** 間隔反復の復習間隔テーブル（ミリ秒） */
export const SRS_INTERVALS_MS: readonly number[] = [
  3600000, // 0: 1時間
  14400000, // 1: 4時間
  86400000, // 2: 1日
  259200000, // 3: 3日
  604800000, // 4: 7日
  1209600000, // 5: 14日
  2592000000, // 6: 30日
  5184000000, // 7: 60日
  7776000000, // 8+: 90日
]

/**
 * 次回復習日時を計算
 *
 * @param correctStreak - 連続正解数
 * @param now - 現在時刻（Unix timestamp）
 * @returns 次回復習日時（Unix timestamp）
 */
export function calculateNextReview(correctStreak: number, now: number): number {
  const index = Math.min(correctStreak, SRS_INTERVALS_MS.length - 1)
  return now + SRS_INTERVALS_MS[index]
}
