import { locale } from '@/config/locale'
import { BaseDiagram } from './BaseDiagram'

interface ComparisonDiagramProps {
  label?: string | undefined
  columns: Array<{ heading: string; items: string[] }>
}

export function ComparisonDiagram({ label, columns }: ComparisonDiagramProps) {
  return (
    <BaseDiagram label={label} defaultLabel={locale.diagrams.comparison} itemCount={columns.length} staggerMs={150}>
      {({ isVisible, getItemDelay }) =>
        columns.length === 0 ? null : (
          <div
            className="grid gap-2 overflow-x-auto"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(80px, 1fr))` }}
          >
            {columns.map((col, i) => (
              <div
                key={i}
                className={`rounded-lg border border-stone-200 transition-none ${
                  isVisible ? 'animate-diagram-fade-up' : 'opacity-0'
                }`}
                style={{ animationDelay: getItemDelay(i) }}
              >
                {/* Column header */}
                <div
                  className={`rounded-t-lg px-2 py-1.5 text-center text-xs font-medium ${
                    i === 0 ? 'bg-cf-accent/10 text-cf-ink' : 'bg-stone-100 text-cf-ink dark:bg-stone-700'
                  }`}
                >
                  {col.heading}
                </div>
                {/* Column items */}
                <ul className="px-2 py-1.5">
                  {col.items.map((item, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-1 text-[10px] leading-relaxed text-stone-600 dark:text-stone-400"
                    >
                      <span className="mt-0.5 text-stone-400" aria-hidden="true">
                        -
                      </span>
                      <span className="break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )
      }
    </BaseDiagram>
  )
}
