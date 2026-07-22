import { locale } from '@/config/locale'
import { BaseDiagram } from './BaseDiagram'
import { SvgArrowDefs } from './SvgArrowDefs'

interface SequenceMessage {
  from: number
  to: number
  text: string
  dashed?: boolean | undefined
}

interface SequenceDiagramProps {
  label?: string | undefined
  actors: string[]
  messages: SequenceMessage[]
}

/**
 * シーケンス図 — アクター間メッセージの時系列を視覚表現
 * Hook 実行順序、MCP プロトコル、SDK リクエストフローに最適。
 */
export function SequenceDiagram({ label, actors, messages }: SequenceDiagramProps) {
  if (actors.length < 2 || messages.length === 0) return null

  const actorW = 72
  const actorGap = 32
  const headerH = 36
  const msgH = 36
  const padX = 12
  const padY = 12

  const totalW = padX * 2 + actors.length * actorW + (actors.length - 1) * actorGap
  const totalH = padY + headerH + messages.length * msgH + 16

  const actorX = (i: number) => padX + i * (actorW + actorGap) + actorW / 2

  // Actor colors
  const actorColors = ['#F97316', '#3B82F6', '#22C55E', '#A855F7', '#EF4444']

  return (
    <BaseDiagram
      label={label}
      defaultLabel={locale.diagrams.sequence}
      itemCount={messages.length}
      staggerMs={180}
      initialDelayMs={300}
    >
      {({ isVisible, getItemDelay }) => (
        <div className="overflow-x-auto">
          <svg
            width={totalW}
            height={totalH}
            viewBox={`0 0 ${totalW} ${totalH}`}
            className="mx-auto"
            role="img"
            aria-label={label ?? locale.diagrams.sequence}
          >
            <SvgArrowDefs id="seq-arrow" markerWidth={7} markerHeight={5} orient="auto-start-reverse" />

            {/* Actor headers + lifelines */}
            {actors.map((actor, i) => {
              const x = actorX(i)
              const color = actorColors[i % actorColors.length]
              return (
                <g key={i}>
                  {/* Lifeline */}
                  <line
                    x1={x}
                    y1={padY + headerH}
                    x2={x}
                    y2={totalH - 4}
                    stroke="#D1D5DB"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                    style={{ opacity: isVisible ? 1 : 0, transition: 'opacity 0.3s ease 200ms' }}
                  />
                  {/* Actor box */}
                  <g
                    className={isVisible ? 'animate-diagram-scale-in' : 'opacity-0'}
                    style={{ animationDelay: getItemDelay(0), transformOrigin: `${x}px ${padY + headerH / 2}px` }}
                  >
                    <rect
                      x={x - actorW / 2 + 4}
                      y={padY}
                      width={actorW - 8}
                      height={headerH - 4}
                      rx="6"
                      fill={color + '18'}
                      stroke={color}
                      strokeWidth="1.5"
                    />
                    <text
                      x={x}
                      y={padY + headerH / 2 + 3}
                      textAnchor="middle"
                      className="fill-cf-ink dark:fill-stone-200"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {actor}
                    </text>
                  </g>
                </g>
              )
            })}

            {/* Messages */}
            {messages.map((msg, i) => {
              const y = padY + headerH + (i + 0.5) * msgH
              const fromX = actorX(msg.from)
              const toX = actorX(msg.to)
              const isReverse = msg.to < msg.from
              const startX = fromX + (isReverse ? -8 : 8)
              const endX = toX + (isReverse ? 8 : -8)
              const midX = (startX + endX) / 2

              return (
                <g
                  key={i}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transition: `opacity 0.35s ease ${parseInt(getItemDelay(i + 1))}ms`,
                  }}
                >
                  <line
                    x1={startX}
                    y1={y}
                    x2={endX}
                    y2={y}
                    stroke="#9CA3AF"
                    strokeWidth="1.5"
                    strokeDasharray={msg.dashed ? '4 3' : undefined}
                    markerEnd="url(#seq-arrow)"
                  />
                  <text
                    x={midX}
                    y={y - 6}
                    textAnchor="middle"
                    className="fill-stone-600 dark:fill-stone-400"
                    fontSize="9"
                  >
                    {msg.text}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </BaseDiagram>
  )
}
