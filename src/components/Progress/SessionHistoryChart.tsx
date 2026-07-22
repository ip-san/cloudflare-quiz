import { locale } from '@/config/locale'
import type { SessionRecord } from '@/domain/entities/UserProgress'
import { PASSING_SCORE } from '@/domain/valueObjects/ScoreThresholds'
import { cardStyles } from '@/lib/styles'
import { ChartGrid } from './ChartGrid'

interface SessionHistoryChartProps {
  sessions: readonly SessionRecord[]
}

const CHART_WIDTH = 600
const CHART_HEIGHT = 200
const PADDING = { top: 20, right: 20, bottom: 30, left: 40 }

const INNER_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right
const INNER_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom

/**
 * SessionHistoryChart - セッション履歴折れ線グラフ（SVG）
 *
 * 直近20セッションの正答率を折れ線グラフで表示。
 * npm依存なし、SVG直書きで軽量。
 */
export function SessionHistoryChart({ sessions }: SessionHistoryChartProps) {
  // Recalculate on each render to react to theme changes (no stale cache)
  const isDark = document.documentElement.classList.contains('dark')
  const gridColor = isDark ? '#444' : '#e7e5e4'
  const dotStroke = isDark ? '#2a2a2a' : 'white'

  if (sessions.length < 2) {
    return (
      <div className={`${cardStyles.base} p-6 text-center`}>
        <p className="text-sm text-stone-400">{locale.progress.needMoreSessions}</p>
      </div>
    )
  }

  const recent = sessions.slice(-20)
  const maxY = 100
  const minY = 0

  const points = recent.map((s, i) => ({
    x: PADDING.left + (i / Math.max(recent.length - 1, 1)) * INNER_WIDTH,
    y: PADDING.top + INNER_HEIGHT - ((s.percentage - minY) / (maxY - minY)) * INNER_HEIGHT,
    percentage: s.percentage,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  // Area fill path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${PADDING.top + INNER_HEIGHT} L ${points[0].x} ${PADDING.top + INNER_HEIGHT} Z`

  return (
    <div className={`${cardStyles.base} p-4`}>
      <h3 className="mb-3 text-sm font-semibold text-cf-ink">{locale.progress.chartTitle}</h3>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={locale.progress.chartLabel}
      >
        <ChartGrid gridColor={gridColor} padding={PADDING} innerWidth={INNER_WIDTH} innerHeight={INNER_HEIGHT} />

        {/* Area fill */}
        <path d={areaD} fill="#F6821F" opacity={0.1} />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#F6821F" strokeWidth={2} />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#F6821F" stroke={dotStroke} strokeWidth={1.5}>
            <title>{`${locale.sessionHistory.sessionLabel(i + 1)}: ${p.percentage}%`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-xs text-stone-500">
        <span>{locale.progress.past}</span>
        <span className="flex items-center gap-1">
          {/* ChartGrid の合格ライン(破線 cf-orange, opacity 0.5)と同じ見た目の凡例スウォッチ */}
          <span className="inline-block w-4 border-t border-dashed border-cf-orange opacity-50" />
          合格ライン({PASSING_SCORE}%)
        </span>
        <span>{locale.progress.latest}</span>
      </div>
    </div>
  )
}
