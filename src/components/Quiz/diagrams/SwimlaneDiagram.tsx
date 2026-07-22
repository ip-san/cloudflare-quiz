import { locale } from '@/config/locale'
import { BaseDiagram } from './BaseDiagram'
import { SvgArrowDefs } from './SvgArrowDefs'

interface SwimlaneLane {
  name: string
  segments: Array<{ start: number; end: number; text?: string | undefined }>
}

interface SwimlaneDiagramProps {
  label?: string | undefined
  lanes: SwimlaneLane[]
  totalSteps?: number | undefined
}

/**
 * スイムレーン図 — 並列処理のタイムラインを視覚表現
 * Agent Teams、Ctrl+B バックグラウンド処理、CI/CD パイプラインに最適。
 */
export function SwimlaneDiagram({ label, lanes, totalSteps }: SwimlaneDiagramProps) {
  if (lanes.length === 0) return null

  // Determine total range
  const maxStep = totalSteps ?? Math.max(...lanes.flatMap((l) => l.segments.map((s) => s.end)))

  const labelW = 72
  const padX = 8
  const padY = 8
  const laneH = 28
  const laneGap = 6
  const barW = 200

  const svgW = labelW + padX * 2 + barW + 16
  const svgH = padY * 2 + lanes.length * laneH + (lanes.length - 1) * laneGap + 20 // +20 for time axis

  // Lane colors
  const laneColors = [
    { fill: '#F97316', bg: 'rgba(249,115,22,0.15)' },
    { fill: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
    { fill: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
    { fill: '#A855F7', bg: 'rgba(168,85,247,0.15)' },
    { fill: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  ]

  const barLeft = labelW + padX
  const toX = (step: number) => barLeft + (step / maxStep) * barW

  return (
    <BaseDiagram label={label} defaultLabel={locale.diagrams.swimlane} itemCount={lanes.length} staggerMs={150}>
      {({ isVisible, getItemDelay }) => (
        <div className="overflow-x-auto">
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="mx-auto"
            role="img"
            aria-label={label ?? locale.diagrams.swimlane}
          >
            <SvgArrowDefs id="swim-arrow" markerWidth={7} markerHeight={5} orient="auto" />

            {/* Lanes */}
            {lanes.map((lane, i) => {
              const y = padY + i * (laneH + laneGap)
              const color = laneColors[i % laneColors.length]

              return (
                <g
                  key={i}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transition: `opacity 0.4s ease ${parseInt(getItemDelay(i))}ms`,
                  }}
                >
                  {/* Lane label */}
                  <text
                    x={labelW - 4}
                    y={y + laneH / 2 + 4}
                    textAnchor="end"
                    className="fill-cf-ink dark:fill-stone-200"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {lane.name}
                  </text>

                  {/* Track background */}
                  <rect
                    x={barLeft}
                    y={y}
                    width={barW}
                    height={laneH}
                    rx="4"
                    fill="rgba(156,163,175,0.08)"
                    stroke="rgba(156,163,175,0.2)"
                    strokeWidth="0.5"
                  />

                  {/* Segments */}
                  {lane.segments.map((seg, j) => {
                    const sx = toX(seg.start)
                    const ex = toX(seg.end)
                    const segW = Math.max(ex - sx, 4)
                    return (
                      <g key={j}>
                        <rect
                          x={sx}
                          y={y + 3}
                          width={segW}
                          height={laneH - 6}
                          rx="3"
                          fill={color.bg}
                          stroke={color.fill}
                          strokeWidth="1"
                        />
                        {seg.text && segW > 20 && (
                          <text
                            x={sx + segW / 2}
                            y={y + laneH / 2 + 3}
                            textAnchor="middle"
                            className="fill-cf-ink dark:fill-stone-200"
                            fontSize="8"
                            fontWeight="500"
                          >
                            {seg.text}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </g>
              )
            })}

            {/* Time axis arrow */}
            <g style={{ opacity: isVisible ? 1 : 0, transition: 'opacity 0.4s ease 500ms' }}>
              <line
                x1={barLeft}
                y1={svgH - 10}
                x2={barLeft + barW}
                y2={svgH - 10}
                stroke="#9CA3AF"
                strokeWidth="1"
                markerEnd="url(#swim-arrow)"
              />
              <text x={barLeft + barW + 4} y={svgH - 6} className="fill-stone-500 dark:fill-stone-400" fontSize="9">
                {locale.diagrams.time}
              </text>
            </g>
          </svg>
        </div>
      )}
    </BaseDiagram>
  )
}
