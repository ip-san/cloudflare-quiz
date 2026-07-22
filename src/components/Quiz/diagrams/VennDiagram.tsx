import { locale } from '@/config/locale'
import { BaseDiagram } from './BaseDiagram'

interface VennSet {
  text: string
  items?: string[] | undefined
}

interface VennDiagramProps {
  label?: string | undefined
  sets: VennSet[]
  intersectionLabel?: string | undefined
}

/**
 * ベン図 — 集合の重なりで概念の共通点・差異を視覚表現
 * Skills vs Agents, Permission modes, 機能の重なりに最適。
 * 2〜3つの集合に対応。
 */
export function VennDiagram({ label, sets, intersectionLabel }: VennDiagramProps) {
  if (sets.length < 2 || sets.length > 3) return null

  // Set colors with transparency
  const setColors = [
    { fill: 'rgba(249,115,22,0.12)', stroke: 'rgba(249,115,22,0.5)' }, // orange
    { fill: 'rgba(59,130,246,0.12)', stroke: 'rgba(59,130,246,0.5)' }, // blue
    { fill: 'rgba(34,197,94,0.12)', stroke: 'rgba(34,197,94,0.5)' }, // green
  ]

  const is3 = sets.length === 3
  const svgW = is3 ? 280 : 240
  const svgH = is3 ? 200 : 160
  const r = is3 ? 56 : 60
  const cx = svgW / 2
  const cy = svgH / 2

  // Circle positions
  const circlePositions = is3
    ? [
        { x: cx - 30, y: cy - 20 }, // top-left
        { x: cx + 30, y: cy - 20 }, // top-right
        { x: cx, y: cy + 20 }, // bottom-center
      ]
    : [
        { x: cx - 28, y: cy },
        { x: cx + 28, y: cy },
      ]

  // Label positions (outside the circles)
  const labelPositions = is3
    ? [
        { x: cx - 64, y: cy - 52 },
        { x: cx + 64, y: cy - 52 },
        { x: cx, y: cy + 62 },
      ]
    : [
        { x: cx - 56, y: cy - r - 8 },
        { x: cx + 56, y: cy - r - 8 },
      ]

  return (
    <BaseDiagram label={label} defaultLabel={locale.diagrams.venn} itemCount={sets.length + 1} staggerMs={200}>
      {({ isVisible, getItemDelay }) => (
        <div className="overflow-x-auto">
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="mx-auto"
            role="img"
            aria-label={label ?? locale.diagrams.venn}
          >
            {/* Circles */}
            {sets.map((_set, i) => {
              const pos = circlePositions[i]
              const color = setColors[i]
              return (
                <g
                  key={i}
                  className={isVisible ? 'animate-diagram-scale-in' : 'opacity-0'}
                  style={{ animationDelay: getItemDelay(i), transformOrigin: `${pos.x}px ${pos.y}px` }}
                >
                  <circle cx={pos.x} cy={pos.y} r={r} fill={color.fill} stroke={color.stroke} strokeWidth="1.5" />
                </g>
              )
            })}

            {/* Set labels */}
            {sets.map((set, i) => {
              const lpos = labelPositions[i]
              return (
                <g
                  key={`label-${i}`}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transition: `opacity 0.4s ease ${parseInt(getItemDelay(i))}ms`,
                  }}
                >
                  <text
                    x={lpos.x}
                    y={lpos.y}
                    textAnchor="middle"
                    className="fill-cf-ink dark:fill-stone-200"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {set.text}
                  </text>
                  {/* Items listed below set name */}
                  {set.items?.map((item, j) => (
                    <text
                      key={j}
                      x={lpos.x}
                      y={lpos.y + 13 + j * 11}
                      textAnchor="middle"
                      className="fill-stone-500 dark:fill-stone-400"
                      fontSize="8"
                    >
                      {item}
                    </text>
                  ))}
                </g>
              )
            })}

            {/* Intersection label */}
            {intersectionLabel && (
              <text
                x={cx}
                y={is3 ? cy : cy + 4}
                textAnchor="middle"
                className="fill-cf-ink dark:fill-stone-200"
                fontSize="9"
                fontWeight="600"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transition: `opacity 0.4s ease ${parseInt(getItemDelay(sets.length))}ms`,
                }}
              >
                {intersectionLabel}
              </text>
            )}
          </svg>
        </div>
      )}
    </BaseDiagram>
  )
}
