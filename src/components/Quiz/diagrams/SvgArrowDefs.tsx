/**
 * SvgArrowDefs — SVG <defs> 内の arrowhead marker 定義を共通化
 *
 * SequenceDiagram / NetworkDiagram / SwimlaneDiagram で同一パターンが
 * 重複していたものをパラメータ化して共通化。
 *
 * 使い方:
 * ```tsx
 * <svg ...>
 *   <SvgArrowDefs id="my-arrow" />
 *   <line ... markerEnd="url(#my-arrow)" />
 * </svg>
 * ```
 */

interface SvgArrowDefsProps {
  /** marker の id 属性。url(#id) で参照する */
  id: string
  /** markerWidth（デフォルト: 7） */
  markerWidth?: number | undefined
  /** markerHeight（デフォルト: 5） */
  markerHeight?: number | undefined
  /** orient 属性（デフォルト: "auto-start-reverse"） */
  orient?: string | undefined
  /** fill 色（デフォルト: "#9CA3AF"） */
  fill?: string | undefined
}

export function SvgArrowDefs({
  id,
  markerWidth = 7,
  markerHeight = 5,
  orient = 'auto-start-reverse',
  fill = '#9CA3AF',
}: SvgArrowDefsProps) {
  return (
    <defs>
      <marker
        id={id}
        viewBox="0 0 10 7"
        refX="10"
        refY="3.5"
        markerWidth={markerWidth}
        markerHeight={markerHeight}
        orient={orient}
      >
        <path d="M 0 0 L 10 3.5 L 0 7 z" fill={fill} />
      </marker>
    </defs>
  )
}
