import { useEffect } from 'react'
import { locale } from '@/config/locale'
import { DailyGoalService } from '@/domain/services/DailyGoalService'
import { StreakMilestoneService } from '@/domain/services/StreakMilestoneService'
import { trackDailyGoal, trackStreakMilestone } from '@/lib/analytics'

interface StreakMilestoneBadgeProps {
  currentStreak: number
  previousStreak: number
}

/**
 * StreakMilestoneBadge - ストリークマイルストーン達成バッジ
 *
 * クイズ結果画面で、マイルストーン（3日、7日、14日…）を
 * 達成した際に表示するお祝いバッジ。
 */
export function StreakMilestoneBadge({ currentStreak, previousStreak }: StreakMilestoneBadgeProps) {
  const milestone = StreakMilestoneService.getMilestone(currentStreak, previousStreak)

  useEffect(() => {
    if (milestone) trackStreakMilestone(currentStreak, milestone.label)
  }, [milestone, currentStreak])

  if (!milestone) return null

  return (
    <div className="animate-pulse-success rounded-xl border border-amber-200 bg-linear-to-r from-amber-50 to-yellow-50 px-5 py-4 text-center shadow-xs">
      <div className="mb-1 text-3xl">{milestone.emoji}</div>
      <p className="text-sm font-bold text-amber-700">{milestone.label}</p>
      <p className="text-xs text-amber-600">{locale.streakBanner.streakAchieved(currentStreak)}</p>
    </div>
  )
}

interface DailyGoalBadgeProps {
  previousTodayCount: number
  currentTodayCount: number
  dailyGoal: number
}

/**
 * DailyGoalBadge - デイリーゴール達成バッジ
 *
 * クイズ結果画面で、今日のゴールを初めて達成した際に表示。
 */
export function DailyGoalBadge({ previousTodayCount, currentTodayCount, dailyGoal }: DailyGoalBadgeProps) {
  const isNewlyAchieved = DailyGoalService.isGoalNewlyAchieved(previousTodayCount, currentTodayCount, dailyGoal)

  useEffect(() => {
    if (isNewlyAchieved) trackDailyGoal(currentTodayCount, dailyGoal)
  }, [isNewlyAchieved, currentTodayCount, dailyGoal])

  if (!isNewlyAchieved) return null

  return (
    <div className="animate-pulse-success rounded-xl border border-green-200 bg-linear-to-r from-green-50 to-emerald-50 px-5 py-4 text-center shadow-xs">
      <div className="mb-1 text-3xl">🎯</div>
      <p className="text-sm font-bold text-green-700">{locale.streakBanner.dailyGoalDone}</p>
      <p className="text-xs text-green-600">{locale.streakBanner.dailyGoalProgress(currentTodayCount, dailyGoal)}</p>
    </div>
  )
}
