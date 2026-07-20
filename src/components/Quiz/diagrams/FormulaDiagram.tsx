import { locale } from '@/config/locale'
import { BaseDiagram } from './BaseDiagram'

interface FormulaComponent {
  text: string
  sub?: string | undefined
  highlight?: boolean | undefined
}

interface FormulaDiagramProps {
  label?: string | undefined
  result: string
  components: FormulaComponent[]
  operator?: string | undefined
}

/**
 * 計算式図 — トークン計算やコンテキスト構成の内訳を視覚表現
 * コンテキストウィンドウ使用量、スコア計算、リソース配分に最適。
 * components を operator で結合し、result に等しいことを示す。
 */
export function FormulaDiagram({ label, result, components, operator = '+' }: FormulaDiagramProps) {
  if (components.length === 0) return null

  // Colors for components
  const componentColors = [
    { bg: 'bg-claude-orange/10', border: 'border-claude-orange/30', text: 'text-claude-orange' },
    {
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      border: 'border-blue-200 dark:border-blue-500/30',
      text: 'text-blue-600 dark:text-blue-400',
    },
    {
      bg: 'bg-green-50 dark:bg-green-500/10',
      border: 'border-green-200 dark:border-green-500/30',
      text: 'text-green-600 dark:text-green-400',
    },
    {
      bg: 'bg-purple-50 dark:bg-purple-500/10',
      border: 'border-purple-200 dark:border-purple-500/30',
      text: 'text-purple-600 dark:text-purple-400',
    },
    {
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      border: 'border-amber-200 dark:border-amber-500/30',
      text: 'text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <BaseDiagram label={label} defaultLabel={locale.diagrams.formula} itemCount={components.length + 1} staggerMs={150}>
      {({ isVisible, getItemDelay }) => (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {components.map((comp, i) => {
            const color = comp.highlight ? componentColors[0] : componentColors[(i % (componentColors.length - 1)) + 1]

            return (
              <div key={i} className="flex items-center gap-1.5">
                {/* Operator between components */}
                {i > 0 && (
                  <span
                    className="text-sm font-bold text-stone-400 dark:text-stone-500"
                    style={{
                      opacity: isVisible ? 1 : 0,
                      transition: `opacity 0.3s ease ${parseInt(getItemDelay(i))}ms`,
                    }}
                  >
                    {operator}
                  </span>
                )}
                {/* Component box */}
                <div
                  className={`rounded-lg border px-2.5 py-1.5 text-center transition-none ${color.bg} ${color.border} ${
                    isVisible ? 'animate-diagram-scale-in' : 'opacity-0'
                  }`}
                  style={{ animationDelay: getItemDelay(i) }}
                >
                  <div className={`text-[11px] font-semibold ${color.text}`}>{comp.text}</div>
                  {comp.sub && <div className="text-[9px] text-stone-500 dark:text-stone-500">{comp.sub}</div>}
                </div>
              </div>
            )
          })}

          {/* Equals sign + result */}
          <span
            className="text-sm font-bold text-stone-400 dark:text-stone-500"
            style={{
              opacity: isVisible ? 1 : 0,
              transition: `opacity 0.3s ease ${parseInt(getItemDelay(components.length))}ms`,
            }}
          >
            ＝
          </span>
          <div
            className={`rounded-lg border border-claude-orange/50 bg-claude-orange/15 px-3 py-1.5 text-center transition-none ${
              isVisible ? 'animate-diagram-scale-in' : 'opacity-0'
            }`}
            style={{ animationDelay: getItemDelay(components.length) }}
          >
            <div className="text-[11px] font-bold text-claude-orange">{result}</div>
          </div>
        </div>
      )}
    </BaseDiagram>
  )
}
