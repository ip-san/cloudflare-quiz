import { useEffect, useState } from 'react'
import { locale } from '@/config/locale'
import { trackLevelUp } from '@/lib/analytics'

interface LevelUpBadgeProps {
  /** セッション開始時の累積XP */
  previousXp: number
  /** 現在の累積XP */
  currentXp: number
}

/**
 * XP増加時に表示するバッジ（大きなXP獲得を祝福）
 * シナリオ完走ボーナス等、まとまったXP獲得時にのみ表示。
 */
export function LevelUpBadge({ previousXp, currentXp }: LevelUpBadgeProps) {
  const [show, setShow] = useState(false)
  const gain = currentXp - previousXp

  // Show only for significant XP gains (30+ XP, e.g. scenario completion bonus)
  const isSignificant = gain >= 30

  useEffect(() => {
    if (isSignificant) {
      setShow(true)
      trackLevelUp(gain, currentXp)
      const timer = setTimeout(() => setShow(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [isSignificant, gain, currentXp])

  if (!show || !isSignificant) return null

  return (
    <div
      className="mb-4 animate-bounce-in rounded-2xl border border-amber-300 bg-linear-to-r from-amber-50 to-yellow-50 p-4 text-center dark:border-amber-500/30 dark:from-amber-500/10 dark:to-yellow-500/10"
      role="status"
      aria-live="polite"
    >
      <p className="text-2xl" aria-hidden="true">
        ✨
      </p>
      <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{locale.mastery.xpGained(gain)}</p>
      <p className="text-xs text-stone-600 dark:text-stone-400">{locale.mastery.totalXpLabel(currentXp)}</p>
    </div>
  )
}
