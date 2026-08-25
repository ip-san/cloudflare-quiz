import { locale } from '@/config/locale'
import { BaseDiagram } from './BaseDiagram'
import { DiagramEndLabels } from './DiagramEndLabels'

interface LayerItem {
  text: string
  sub?: string | undefined
}

interface LayerDiagramProps {
  label?: string | undefined
  layers: LayerItem[]
  /** 意味は domain/valueObjects/Diagram.ts の LayerDiagram.overrides が正典 */
  overrides?: boolean | undefined
}

/**
 * レイヤー図 — 入れ子の階層を視覚表現。
 * overrides=true のときだけ「外側が上書き / ベース」の凡例を添える。
 */
export function LayerDiagram({ label, layers, overrides = false }: LayerDiagramProps) {
  if (layers.length === 0) return null

  // Colors from outermost (highest priority) to innermost
  const layerColors = [
    { fill: 'rgba(249,115,22,0.08)', stroke: 'rgba(249,115,22,0.5)' }, // orange
    { fill: 'rgba(59,130,246,0.08)', stroke: 'rgba(59,130,246,0.4)' }, // blue
    { fill: 'rgba(34,197,94,0.08)', stroke: 'rgba(34,197,94,0.4)' }, // green
    { fill: 'rgba(168,85,247,0.08)', stroke: 'rgba(168,85,247,0.4)' }, // purple
    { fill: 'rgba(107,114,128,0.08)', stroke: 'rgba(107,114,128,0.4)' }, // gray
    { fill: 'rgba(245,158,11,0.08)', stroke: 'rgba(245,158,11,0.4)' }, // amber
  ]

  const n = layers.length
  const pad = 24
  const innerW = 100
  const innerH = 32
  const svgW = innerW + pad * 2 * n
  const svgH = innerH + pad * 2 * n

  return (
    <BaseDiagram label={label} defaultLabel={locale.diagrams.layer} itemCount={layers.length} staggerMs={150}>
      {({ isVisible, getItemDelay }) => (
        <>
          <div className="overflow-x-auto">
            <svg
              width={svgW}
              height={svgH}
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="mx-auto"
              role="img"
              aria-label={label ?? locale.diagrams.layer}
            >
              {/* Layers from outermost to innermost */}
              {layers.map((layer, i) => {
                const color = layerColors[i % layerColors.length]
                const x = pad * i
                const y = pad * i
                const w = svgW - pad * 2 * i
                const h = svgH - pad * 2 * i

                return (
                  <g
                    key={i}
                    className={isVisible ? 'animate-diagram-scale-in' : 'opacity-0'}
                    style={{ animationDelay: getItemDelay(i), transformOrigin: `${svgW / 2}px ${svgH / 2}px` }}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx="10"
                      fill={color.fill}
                      stroke={color.stroke}
                      strokeWidth="1.5"
                    />
                    {/* Label at top-left of each layer */}
                    <text
                      x={x + 10}
                      y={y + 16}
                      className="fill-cf-ink dark:fill-stone-200"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {layer.text}
                    </text>
                    {layer.sub && (
                      <text x={x + 10} y={y + 28} className="fill-stone-500 dark:fill-stone-400" fontSize="8">
                        {layer.sub}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* 実際に上書き関係があるときだけ凡例を出す */}
          {overrides && <DiagramEndLabels left={locale.diagrams.outerOverrides} right={locale.diagrams.innerBase} />}
        </>
      )}
    </BaseDiagram>
  )
}
