import { Flame } from 'lucide-react'
import { useEffect, useState } from 'react'
import { locale } from '@/config/locale'
import { Toast } from './Toast'
import { useToastPhase } from './useToastPhase'

interface StreakToastProps {
  streak: number
}

/**
 * 連続正解時のトースト通知
 * 3, 5, 10, 15, 20 問連続正解でアニメーション表示
 */
export function StreakToast({ streak }: StreakToastProps) {
  const { phase, trigger, style } = useToastPhase(2000)
  const [lastShown, setLastShown] = useState(0)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (streak === 0) {
      setLastShown(0)
      return
    }
    const milestones = [3, 5, 10, 15, 20]
    if (milestones.includes(streak) && streak !== lastShown) {
      setLastShown(streak)
      const label =
        streak >= 20
          ? locale.streak.amazing20
          : streak >= 10
            ? locale.streak.great10
            : streak >= 5
              ? locale.streak.nice5
              : locale.streak.good3
      setMessage(locale.streak.streakMessage(label, streak))
      return trigger()
    }
  }, [streak, lastShown, trigger])

  return (
    <Toast
      phase={phase}
      style={style}
      icon={<Flame className="h-5 w-5" />}
      message={message}
      gradient="from-orange-500 to-red-500"
    />
  )
}
