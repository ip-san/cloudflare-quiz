import { locale } from '@/config/locale'
import type { KeyCombo } from '@/domain/valueObjects/Diagram'
import { BaseDiagram } from './BaseDiagram'

interface KeyboardDiagramProps {
  label?: string | undefined
  combos: KeyCombo[]
  sequence?: boolean | undefined
  caption?: string | undefined
}

/**
 * キーボード図 — ショートカット操作を物理キー（キーキャップ）で視覚表現。
 * `Ctrl+C`（同時押し）/`Esc Esc`（連打=sequence）/`Shift+Tab`（モード循環）等に最適。
 * combos: 同時押しするキーの組の配列。sequence=true なら手順として矢印で連結する。
 */
export function KeyboardDiagram({ label, combos, sequence = false, caption }: KeyboardDiagramProps) {
  if (combos.length === 0) return null

  return (
    <BaseDiagram label={label} defaultLabel={locale.diagrams.keyboard} itemCount={combos.length} staggerMs={180}>
      {({ isVisible, getItemDelay }) => (
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
            {combos.map((combo, ci) => (
              <div key={ci} className="flex items-center gap-2">
                {/* 区切り: sequence は矢印（連打/手順）、比較は「/」 */}
                {ci > 0 && (
                  <span
                    aria-hidden="true"
                    className="text-sm font-bold text-stone-400 dark:text-stone-500"
                    style={{
                      opacity: isVisible ? 1 : 0,
                      transition: `opacity 0.3s ease ${parseInt(getItemDelay(ci))}ms`,
                    }}
                  >
                    {sequence ? '→' : '/'}
                  </span>
                )}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex items-center gap-1 ${isVisible ? 'animate-diagram-scale-in' : 'opacity-0'}`}
                    style={{ animationDelay: getItemDelay(ci) }}
                  >
                    {combo.keys.map((key, ki) => (
                      <div key={ki} className="flex items-center gap-1">
                        {ki > 0 && (
                          <span aria-hidden="true" className="text-xs font-bold text-stone-400 dark:text-stone-500">
                            +
                          </span>
                        )}
                        <kbd className={keycapClass(key.highlight)}>{key.label}</kbd>
                      </div>
                    ))}
                  </div>
                  {combo.caption && (
                    <span className="text-[10px] text-stone-500 dark:text-stone-400">{combo.caption}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {caption && <p className="text-[11px] text-stone-500 dark:text-stone-400">{caption}</p>}
        </div>
      )}
    </BaseDiagram>
  )
}

/** キーキャップの見た目。highlight=操作対象キーをアクセント色で強調 */
function keycapClass(highlight?: boolean): string {
  const base =
    'inline-flex whitespace-nowrap min-w-[2rem] items-center justify-center rounded-md border px-2 py-1 font-mono text-xs font-semibold shadow-[0_2px_0_0_rgba(0,0,0,0.12)] dark:shadow-[0_2px_0_0_rgba(0,0,0,0.4)] transition-none'
  if (highlight) {
    return `${base} border-cf-accent/50 bg-cf-accent/15 text-cf-accent`
  }
  return `${base} border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-600 dark:bg-stone-700/60 dark:text-stone-200`
}
