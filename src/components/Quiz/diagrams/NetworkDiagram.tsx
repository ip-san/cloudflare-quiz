import { locale } from '@/config/locale'
import { BaseDiagram } from './BaseDiagram'
import { SvgArrowDefs } from './SvgArrowDefs'

interface NetworkNode {
  id: string
  text: string
  sub?: string | undefined
}

interface NetworkEdge {
  from: string
  to: string
  label?: string | undefined
  dashed?: boolean | undefined
}

interface NetworkDiagramProps {
  label?: string | undefined
  nodes: NetworkNode[]
  edges: NetworkEdge[]
}

/**
 * ネットワーク図 — ボックス＆アローで接続関係を視覚表現
 * MCP アーキテクチャ、Agent Teams、Plugin 関係図に最適。
 * ノードを自動グリッド配置し、SVG の線で接続する。
 */
export function NetworkDiagram({ label, nodes, edges }: NetworkDiagramProps) {
  if (nodes.length === 0) return null

  // Layout: arrange nodes in rows of up to 3
  const cols = Math.min(nodes.length, 3)
  const nodeW = 100
  const nodeH = 48
  const gapX = 60
  const gapY = 56
  const padX = 20
  const padY = 28

  const positions = nodes.map((_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      x: padX + col * (nodeW + gapX),
      y: padY + row * (nodeH + gapY),
    }
  })

  const rows = Math.ceil(nodes.length / cols)
  const svgW = padX * 2 + cols * nodeW + (cols - 1) * gapX
  const svgH = padY * 2 + rows * nodeH + (rows - 1) * gapY

  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]))

  // Colors for nodes
  const nodeColors = [
    { fill: '#FFF7ED', stroke: '#F97316' }, // orange
    { fill: '#EFF6FF', stroke: '#3B82F6' }, // blue
    { fill: '#F0FDF4', stroke: '#22C55E' }, // green
    { fill: '#FAF5FF', stroke: '#A855F7' }, // purple
    { fill: '#FEF2F2', stroke: '#EF4444' }, // red
    { fill: '#FFFBEB', stroke: '#F59E0B' }, // amber
  ]

  return (
    <BaseDiagram label={label} defaultLabel={locale.diagrams.network} itemCount={nodes.length} staggerMs={150}>
      {({ isVisible, getItemDelay }) => (
        <div className="overflow-x-auto">
          <svg
            width={svgW}
            height={svgH}
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="mx-auto"
            role="img"
            aria-label={label ?? locale.diagrams.network}
          >
            <SvgArrowDefs id="net-arrow" markerWidth={8} markerHeight={6} orient="auto-start-reverse" />

            {/* Edges */}
            {edges.map((edge, i) => {
              const fi = nodeIndex.get(edge.from)
              const ti = nodeIndex.get(edge.to)
              if (fi == null || ti == null) return null
              const fp = positions[fi]
              const tp = positions[ti]
              const x1 = fp.x + nodeW / 2
              const y1 = fp.y + nodeH / 2
              const x2 = tp.x + nodeW / 2
              const y2 = tp.y + nodeH / 2

              // Clamp to node boundary
              const dx = x2 - x1
              const dy = y2 - y1
              const len = Math.sqrt(dx * dx + dy * dy) || 1
              const nx = dx / len
              const ny = dy / len
              const sx = x1 + nx * (nodeW / 2 + 2)
              const sy = y1 + ny * (nodeH / 2 + 2)
              const ex = x2 - nx * (nodeW / 2 + 6)
              const ey = y2 - ny * (nodeH / 2 + 6)

              return (
                <g
                  key={`e-${i}`}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transition: `opacity 0.4s ease ${parseInt(getItemDelay(Math.max(fi, ti)))}ms`,
                  }}
                >
                  <line
                    x1={sx}
                    y1={sy}
                    x2={ex}
                    y2={ey}
                    stroke="#9CA3AF"
                    strokeWidth="1.5"
                    strokeDasharray={edge.dashed ? '4 3' : undefined}
                    markerEnd="url(#net-arrow)"
                  />
                  {edge.label && (
                    <text
                      x={(sx + ex) / 2}
                      y={(sy + ey) / 2 - 5}
                      textAnchor="middle"
                      className="fill-stone-500 dark:fill-stone-400"
                      fontSize="9"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Nodes */}
            {nodes.map((node, i) => {
              const pos = positions[i]
              const color = nodeColors[i % nodeColors.length]
              return (
                <g
                  key={node.id}
                  className={isVisible ? 'animate-diagram-scale-in' : 'opacity-0'}
                  style={{
                    animationDelay: getItemDelay(i),
                    transformOrigin: `${pos.x + nodeW / 2}px ${pos.y + nodeH / 2}px`,
                  }}
                >
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={nodeW}
                    height={nodeH}
                    rx="8"
                    fill={color.fill}
                    stroke={color.stroke}
                    strokeWidth="1.5"
                  />
                  <text
                    x={pos.x + nodeW / 2}
                    y={pos.y + (node.sub ? 18 : nodeH / 2 + 4)}
                    textAnchor="middle"
                    className="fill-claude-dark dark:fill-stone-200"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {node.text}
                  </text>
                  {node.sub && (
                    <text
                      x={pos.x + nodeW / 2}
                      y={pos.y + 34}
                      textAnchor="middle"
                      className="fill-stone-500 dark:fill-stone-400"
                      fontSize="9"
                    >
                      {node.sub}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </BaseDiagram>
  )
}
