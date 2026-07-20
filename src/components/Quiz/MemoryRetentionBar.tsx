import { locale } from '@/config/locale'
import type { QuestionProgress } from '@/domain/entities/UserProgress'
import { SRS_INTERVALS_MS } from '@/domain/valueObjects/SrsInterval'

interface MemoryRetentionBarProps {
  questionProgress: QuestionProgress | undefined
}

/**
 * SRSストリークに基づく記憶定着度を可視化
 *
 * correctStreak (0-9) を SRS_INTERVALS_MS.length (9段階) に対する
 * パーセンテージとして表示。ストリークが進むほどバーが伸び、
 * 色が赤→黄→緑に変化して定着度を直感的に伝える。
 *
 * 表示条件: 1回以上回答した問題のみ（初回未回答は非表示）
 */
export function MemoryRetentionBar({ questionProgress }: MemoryRetentionBarProps) {
  if (!questionProgress || questionProgress.attempts === 0) return null

  const streak = questionProgress.correctStreak ?? 0
  const maxStreak = SRS_INTERVALS_MS.length || 1 // 9段階（ゼロ除算防止）
  const percentage = Math.min(Math.round((streak / maxStreak) * 100), 100)
  const remaining = Math.max(0, maxStreak - streak)

  // ストリーク段階に応じたラベル（0=短期記憶 → 7+=長期記憶化）
  const labels = locale.retention.labels
  const getLabel = (): string => {
    if (streak === 0) return labels[0]
    if (streak <= 2) return labels[1]
    if (streak <= 4) return labels[2]
    if (streak <= 6) return labels[3]
    return labels[4]
  }

  const getColor = (): string => {
    if (streak === 0) return 'bg-red-400'
    if (streak <= 2) return 'bg-amber-400'
    if (streak <= 4) return 'bg-yellow-400'
    if (streak <= 6) return 'bg-green-400'
    return 'bg-emerald-500'
  }

  const label = getLabel()
  const description = remaining > 0 ? `${label} — ${locale.retention.remainingMessage(remaining)}` : label

  return (
    // biome-ignore lint/a11y/useSemanticElements: <meter> cannot be styled with Tailwind; using role="meter" for accessibility
    <div
      className="mt-2 rounded-lg bg-stone-50 px-3 py-2 dark:bg-stone-800/50"
      title={locale.retention.helpTooltip}
      role="meter"
      aria-label={locale.retention.meterLabel}
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={description}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-medium text-stone-600 dark:text-stone-400">
          {locale.retention.meterLabel}
        </span>
        <span className="text-[10px] text-stone-500">{description}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
        <div
          className={`h-full rounded-full transition-all duration-700 ${getColor()}`}
          style={{ width: `${Math.max(percentage, 5)}%` }}
        />
      </div>
    </div>
  )
}
