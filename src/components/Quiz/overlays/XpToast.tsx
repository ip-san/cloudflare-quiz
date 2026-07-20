import { Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Toast } from './Toast'
import { useToastPhase } from './useToastPhase'

interface XpToastProps {
  totalXp: number
  /** キュー管理: 表示完了時コールバック */
  onComplete?: () => void
}

/**
 * XP獲得トースト — 回答ごとにXP獲得量を��示
 * totalXp の変化を���知して表示する。
 * StreakToast と同時表示されないよう、短い遅延後に表示。
 */
export function XpToast({ totalXp, onComplete }: XpToastProps) {
  const { phase, trigger, style } = useToastPhase(1000, onComplete)
  const prevXpRef = useRef<number | null>(null)
  const gainRef = useRef(0)
  const delayRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    // Skip first render — just record initial value
    if (prevXpRef.current === null) {
      prevXpRef.current = totalXp
      return () => clearTimeout(delayRef.current)
    }
    const gain = totalXp - prevXpRef.current
    prevXpRef.current = totalXp
    // Only show toast for meaningful XP gains (correct answers: 10+, not wrong: 2)
    if (gain >= 5) {
      gainRef.current = gain
      // Delay to avoid overlapping with StreakToast (which triggers immediately)
      clearTimeout(delayRef.current)
      delayRef.current = setTimeout(() => trigger(), 300)
    }
    return () => clearTimeout(delayRef.current)
  }, [totalXp, trigger])

  return (
    <Toast
      phase={phase}
      style={style}
      icon={<Sparkles className="h-4 w-4" />}
      message={`+${gainRef.current} XP`}
      gradient="from-amber-500 to-orange-500"
      offsetY="8rem"
    />
  )
}
