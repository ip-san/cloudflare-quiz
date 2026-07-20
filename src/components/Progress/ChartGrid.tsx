import { PASSING_SCORE } from '@/domain/valueObjects/ScoreThresholds'

/** Y軸のラベル値 */
const Y_LABELS = [0, 25, 50, 75, 100]

interface ChartGridProps {
  gridColor: string
  padding: { top: number; left: number }
  innerWidth: number
  innerHeight: number
}

/** パーセンテージ → Y座標 */
export function percentToY(percentage: number, padding: { top: number }, innerHeight: number): number {
  return padding.top + innerHeight - (percentage / 100) * innerHeight
}

/** グリッドライン + Y軸ラベル + 合格ライン（両チャートで共通） */
export function ChartGrid({ gridColor, padding, innerWidth, innerHeight }: ChartGridProps) {
  return (
    <>
      {Y_LABELS.map((v) => {
        const y = percentToY(v, padding, innerHeight)
        return (
          <g key={v}>
            <line
              x1={padding.left}
              y1={y}
              x2={padding.left + innerWidth}
              y2={y}
              stroke={gridColor}
              strokeDasharray={v === 0 ? undefined : '4,4'}
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-stone-400 text-[10px]">
              {v}%
            </text>
          </g>
        )
      })}
      <line
        x1={padding.left}
        y1={percentToY(PASSING_SCORE, padding, innerHeight)}
        x2={padding.left + innerWidth}
        y2={percentToY(PASSING_SCORE, padding, innerHeight)}
        stroke="#F6821F"
        strokeDasharray="6,3"
        strokeWidth={1}
        opacity={0.5}
      />
    </>
  )
}
