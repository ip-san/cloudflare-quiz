import { locale } from '@/config/locale'
import { BaseDiagram } from './BaseDiagram'

interface HierarchyDiagramProps {
  label?: string | undefined
  items: Array<{ text: string; sub?: string | undefined }>
  /** items の並びが本当に優先順位を表すときだけ true（既定 false） */
  ranked?: boolean | undefined
}

const LONG_TEXT_THRESHOLD = 40
const LONG_SUB_THRESHOLD = 60

/**
 * 階層図 — 縦並びのグループ・リストを視覚表現
 *
 * ranked=true のときだけ「ピラミッド型（上ほど幅が狭く優先度が高い）+
 * 高優先/低優先ラベル + 重要度の色グラデーション」で描画する。
 * ranked でない場合（既定）は、順序に意味のない列挙・包含構造として
 * 優先度を示唆しない均一な縦リストで描画する。
 *
 * 長文（text>40字 or sub>60字）が含まれる場合は全幅カードに切り替えて
 * セルからの文字はみ出しを防ぐ。
 */
export function HierarchyDiagram({ label, items, ranked = false }: HierarchyDiagramProps) {
  const hasLongContent = items.some(
    (it) => (it.text?.length ?? 0) > LONG_TEXT_THRESHOLD || (it.sub?.length ?? 0) > LONG_SUB_THRESHOLD
  )

  // ranked: top (most important) is orange, bottom fades to gray.
  // unranked: uniform neutral cards — no importance implied by position.
  const getColor = (index: number, total: number) => {
    if (!ranked)
      return {
        bg: 'bg-stone-50 dark:bg-stone-800',
        border: 'border-stone-200 dark:border-stone-700',
        text: 'text-stone-700 dark:text-stone-300',
      }
    if (index === 0) return { bg: 'bg-cf-accent/15', border: 'border-cf-accent/40', text: 'text-cf-accent' }
    const ratio = index / (total - 1)
    if (ratio < 0.5)
      return {
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        border: 'border-amber-200 dark:border-amber-500/30',
        text: 'text-amber-700 dark:text-amber-300',
      }
    return {
      bg: 'bg-stone-100 dark:bg-stone-800',
      border: 'border-stone-200 dark:border-stone-700',
      text: 'text-stone-600 dark:text-stone-400',
    }
  }

  return (
    <BaseDiagram label={label} defaultLabel={locale.diagrams.hierarchy} itemCount={items.length}>
      {({ isVisible, getItemDelay }) => (
        <>
          <div className="flex flex-col items-center gap-0.5">
            {items.map((item, i) => {
              const color = getColor(i, items.length)
              // Pyramid: width narrows at top (reversed: top=narrow=high priority).
              // Only when ranked — unranked lists get uniform width so position
              // doesn't falsely imply importance. Long-content mode: full width.
              const widthPercent = hasLongContent || !ranked ? 100 : 50 + (i / Math.max(items.length - 1, 1)) * 50

              return (
                <div key={i} className="flex w-full flex-col items-center">
                  {/* Connector line */}
                  {i > 0 && (
                    <div
                      className="h-2 w-px bg-stone-300 dark:bg-stone-600"
                      style={{ opacity: isVisible ? 1 : 0, animationDelay: getItemDelay(i) }}
                      aria-hidden="true"
                    />
                  )}
                  {/* Item — trapezoid feel via variable width (compact mode only) */}
                  <div
                    className={`rounded-lg border px-3 py-1.5 transition-none ${
                      hasLongContent ? 'text-left' : 'text-center'
                    } ${color.bg} ${color.border} ${isVisible ? 'animate-diagram-scale-in' : 'opacity-0'}`}
                    style={{ width: `${widthPercent}%`, animationDelay: getItemDelay(i) }}
                  >
                    {hasLongContent ? (
                      <>
                        <div
                          className={`text-xs font-semibold leading-relaxed break-words ${
                            i === 0 && ranked ? 'text-cf-accent' : color.text
                          }`}
                        >
                          {item.text}
                        </div>
                        {item.sub && (
                          <div className="mt-1 text-[11px] leading-relaxed text-stone-600 break-words dark:text-stone-400">
                            {item.sub}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <span
                          className={`text-xs font-semibold break-words ${i === 0 && ranked ? 'text-cf-accent' : color.text}`}
                        >
                          {item.text}
                        </span>
                        {item.sub && (
                          <span className="ml-1.5 text-[10px] text-stone-500 break-words dark:text-stone-500">
                            {item.sub}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Priority indicator — only for genuinely ranked lists in compact mode
              (long-content cards don't read as a pyramid) */}
          {ranked && !hasLongContent && (
            <div
              className="mt-1.5 flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-500"
              aria-hidden="true"
            >
              <span>{locale.diagrams.highPriority}</span>
              <span>{locale.diagrams.lowPriority}</span>
            </div>
          )}
        </>
      )}
    </BaseDiagram>
  )
}
