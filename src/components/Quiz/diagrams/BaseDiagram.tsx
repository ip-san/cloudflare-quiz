import type { ReactNode, RefObject } from 'react'
import { useDiagramAnimation } from './useDiagramAnimation'

interface BaseDiagramContext {
  containerRef: RefObject<HTMLDivElement | null>
  isVisible: boolean
  getItemDelay: (index: number) => string
}

interface BaseDiagramProps {
  label?: string | undefined
  defaultLabel: string
  itemCount: number
  staggerMs?: number | undefined
  initialDelayMs?: number | undefined
  children: (ctx: BaseDiagramContext) => ReactNode
}

/**
 * BaseDiagram — render-props ラッパー
 *
 * - useDiagramAnimation の呼び出しを集約
 * - 外側 div（ref + aria-label）を共通化
 * - ラベル表示 <p> を共通化
 *
 * 使い方:
 * ```tsx
 * <BaseDiagram label={label} defaultLabel={locale.diagrams.xxx} itemCount={items.length}>
 *   {({ containerRef, isVisible, getItemDelay }) => (
 *     // containerRef は BaseDiagram が外側 div に付けるため子では不要
 *     // ただし SVG など内部要素へのアクセスが必要な場合は ctx から取得可
 *     <div>...</div>
 *   )}
 * </BaseDiagram>
 * ```
 */
export function BaseDiagram({ label, defaultLabel, itemCount, staggerMs, initialDelayMs, children }: BaseDiagramProps) {
  const ctx = useDiagramAnimation({
    itemCount,
    ...(staggerMs !== undefined && { staggerMs }),
    ...(initialDelayMs !== undefined && { initialDelayMs }),
  })

  return (
    <div ref={ctx.containerRef} aria-label={label ?? defaultLabel}>
      {label && <p className="mb-2 text-xs font-medium text-stone-500 dark:text-stone-400">{label}</p>}
      {children(ctx)}
    </div>
  )
}
