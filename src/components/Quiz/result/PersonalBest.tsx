import { Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { locale } from '@/config/locale'
import type { SessionRecord } from '@/domain/entities/UserProgress'

interface PersonalBestProps {
  sessionHistory: readonly SessionRecord[]
  currentPercentage: number
}

/**
 * パーソナルベスト表示
 * 今回のスコアが自己ベストかどうかを判定して表示
 */
export function PersonalBest({ sessionHistory, currentPercentage }: PersonalBestProps) {
  const personalBest = useMemo(() => {
    if (sessionHistory.length === 0) return null
    return Math.max(...sessionHistory.map((s) => s.percentage))
  }, [sessionHistory])

  const isNewRecord = personalBest === null || currentPercentage > personalBest

  if (!isNewRecord) return null

  return (
    <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-yellow-400 to-amber-500 px-4 py-3 text-white shadow-lg">
      <Trophy className="h-6 w-6" />
      <span className="text-base font-bold">{locale.personalBest.updated}</span>
      <span className="text-sm opacity-80">{currentPercentage}%</span>
    </div>
  )
}
