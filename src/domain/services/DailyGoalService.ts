/**
 * DailyGoalService - デイリーゴール管理サービス
 *
 * 日付のフォーマット、ゴール進捗の計算、
 * ゴール達成判定を行う。
 */

export class DailyGoalService {
  /**
   * 現在のローカル日付を YYYY-MM-DD 形式で返す
   */
  static getTodayString(now: Date = new Date()): string {
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * ゴールに対する進捗率を返す（0.0 〜 1.0）
   */
  static getProgress(todayCount: number, dailyGoal: number): number {
    if (dailyGoal <= 0) return 1
    return Math.min(todayCount / dailyGoal, 1)
  }

  /**
   * ゴールが今回の回答で初めて達成されたかを判定
   */
  static isGoalNewlyAchieved(previousCount: number, newCount: number, dailyGoal: number): boolean {
    return previousCount < dailyGoal && newCount >= dailyGoal
  }
}
