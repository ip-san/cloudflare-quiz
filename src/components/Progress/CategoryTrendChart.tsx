import { useState } from 'react'
import { locale } from '@/config/locale'
import type { SessionRecord } from '@/domain/entities/UserProgress'
import { type Category, PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import { getColorHex } from '@/lib/colors'
import { cardStyles } from '@/lib/styles'
import { ChartGrid, percentToY } from './ChartGrid'

interface CategoryTrendChartProps {
  sessions: readonly SessionRecord[]
}

const CHART_WIDTH = 600
const CHART_HEIGHT = 220
const PADDING = { top: 20, right: 20, bottom: 30, left: 40 }
const INNER_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right
const INNER_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom

/** カテゴリごとに直近セッションから累積正答率を計算 */
function computeCategoryTrends(
  sessions: readonly SessionRecord[],
  categoryId: string,
  maxPoints: number
): { percentage: number }[] {
  // categoryBreakdown を持つセッションのみ対象
  const relevant = sessions.filter((s) => s.categoryBreakdown?.[categoryId])
  if (relevant.length === 0) return []

  // 累積で計算（セッションを重ねるごとの正答率推移）
  let totalCorrect = 0
  let totalCount = 0
  const points: { percentage: number }[] = []

  for (const s of relevant) {
    const b = s.categoryBreakdown?.[categoryId]
    if (!b) continue
    totalCorrect += b.correct
    totalCount += b.total
    points.push({ percentage: Math.round((totalCorrect / totalCount) * 100) })
  }

  return points.slice(-maxPoints)
}

export function CategoryTrendChart({ sessions }: CategoryTrendChartProps) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => {
    // Default: show top 3 categories by session count
    const counts: Record<string, number> = {}
    for (const s of sessions) {
      if (!s.categoryBreakdown) continue
      for (const cat of Object.keys(s.categoryBreakdown)) {
        counts[cat] = (counts[cat] ?? 0) + 1
      }
    }
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id)
    return new Set(top.length > 0 ? top : PREDEFINED_CATEGORIES.slice(0, 3).map((c) => c.id))
  })

  const isDark = document.documentElement.classList.contains('dark')
  const gridColor = isDark ? '#444' : '#e7e5e4'

  // Check if we have any data
  const hasBreakdownData = sessions.some((s) => s.categoryBreakdown)
  if (!hasBreakdownData) {
    return (
      <div className={`${cardStyles.base} p-6 text-center`}>
        <h3 className="mb-2 text-sm font-semibold text-cf-ink dark:text-stone-200">{locale.categoryTrend.heading}</h3>
        <p className="text-sm text-stone-400">{locale.categoryTrend.emptyMessage}</p>
      </div>
    )
  }

  const MAX_POINTS = 15
  const categoryLines: {
    category: Category
    points: { percentage: number }[]
    color: string
  }[] = []

  for (const cat of PREDEFINED_CATEGORIES) {
    if (!selectedCategories.has(cat.id)) continue
    const points = computeCategoryTrends(sessions, cat.id, MAX_POINTS)
    if (points.length >= 2) {
      categoryLines.push({ category: cat, points, color: getColorHex(cat.id) })
    }
  }

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size > 1) next.delete(id) // Keep at least 1
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className={`${cardStyles.base} p-4`}>
      <h3 className="mb-2 text-sm font-semibold text-cf-ink dark:text-stone-200">{locale.categoryTrend.heading}</h3>

      {/* Category toggles */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PREDEFINED_CATEGORIES.map((cat) => {
          const isSelected = selectedCategories.has(cat.id)
          const hasTrend = computeCategoryTrends(sessions, cat.id, MAX_POINTS).length >= 2
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              disabled={!hasTrend && !isSelected}
              className={`tap-highlight rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                isSelected
                  ? 'text-white'
                  : hasTrend
                    ? 'bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400'
                    : 'bg-stone-50 text-stone-300 dark:bg-stone-800 dark:text-stone-600'
              }`}
              style={isSelected ? { backgroundColor: getColorHex(cat.id) } : undefined}
            >
              {cat.icon} {cat.name}
            </button>
          )
        })}
      </div>

      {categoryLines.length === 0 ? (
        <p className="py-4 text-center text-xs text-stone-500">{locale.categoryTrend.insufficientData}</p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="w-full"
            role="img"
            aria-label={locale.categoryTrend.chartLabel}
          >
            <ChartGrid gridColor={gridColor} padding={PADDING} innerWidth={INNER_WIDTH} innerHeight={INNER_HEIGHT} />

            {/* Category lines */}
            {categoryLines.map(({ category, points, color }) => {
              if (points.length < 2) return null
              const svgPoints = points.map((p, i) => ({
                x: PADDING.left + (i / (points.length - 1)) * INNER_WIDTH,
                y: percentToY(p.percentage, PADDING, INNER_HEIGHT),
                percentage: p.percentage,
              }))
              const pathD = svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

              return (
                <g key={category.id}>
                  <path d={pathD} fill="none" stroke={color} strokeWidth={2} opacity={0.8} />
                  {svgPoints.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} opacity={0.9}>
                      <title>
                        {category.name}: {p.percentage}%
                      </title>
                    </circle>
                  ))}
                  {/* End label */}
                  <text
                    x={svgPoints[svgPoints.length - 1].x + 4}
                    y={svgPoints[svgPoints.length - 1].y + 3}
                    className="text-[9px] font-medium"
                    fill={color}
                  >
                    {svgPoints[svgPoints.length - 1].percentage}%
                  </text>
                </g>
              )
            })}
          </svg>
          <div className="mt-1 flex items-center justify-between text-xs text-stone-500">
            <span>{locale.progress.past}</span>
            <span>{locale.progress.latest}</span>
          </div>
        </>
      )}
    </div>
  )
}
