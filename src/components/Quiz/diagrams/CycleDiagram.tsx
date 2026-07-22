import { locale } from '@/config/locale'
import { BaseDiagram } from './BaseDiagram'

interface CycleDiagramProps {
  label?: string | undefined
  trigger?: string | undefined
  states: Array<{ text: string; sub?: string | undefined }>
}

/**
 * 循環図 — 円形配置で状態遷移を視覚表現
 * 各状態を円周上に配置し、矢印で循環を示す。
 */
export function CycleDiagram({ label, trigger, states }: CycleDiagramProps) {
  if (states.length === 0) return null

  // Colors for each state
  const colors = [
    'border-cf-accent/40 bg-cf-accent/10',
    'border-blue-300 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10',
    'border-green-300 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10',
    'border-purple-300 bg-purple-50 dark:border-purple-500/30 dark:bg-purple-500/10',
  ]

  return (
    <BaseDiagram label={label} defaultLabel={locale.diagrams.cycle} itemCount={states.length}>
      {({ isVisible, getItemDelay }) => (
        <>
          {/* Circular layout — flex-wrap fallback for narrow screens */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {states.map((state, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {/* Arrow between states */}
                {i > 0 && (
                  <svg
                    width="16"
                    height="12"
                    viewBox="0 0 16 12"
                    className="shrink-0 text-cf-accent/50"
                    aria-hidden="true"
                    style={{ opacity: isVisible ? 1 : 0, animationDelay: getItemDelay(i) }}
                  >
                    <path
                      d="M0 6 L10 6 M8 3 L11 6 L8 9"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {/* State node */}
                <div
                  className={`rounded-xl border px-3 py-1.5 text-center transition-none ${colors[i % colors.length]} ${
                    isVisible ? 'animate-diagram-scale-in' : 'opacity-0'
                  }`}
                  style={{ animationDelay: getItemDelay(i) }}
                >
                  <div className="text-[11px] font-semibold text-cf-ink">{state.text}</div>
                  {state.sub && (
                    <div className="max-w-[96px] break-words text-[9px] text-stone-500 dark:text-stone-500">
                      {state.sub}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Return arrow — cycle indicator */}
            <svg
              width="20"
              height="14"
              viewBox="0 0 20 14"
              className="shrink-0 text-cf-accent/40"
              aria-hidden="true"
              style={{ opacity: isVisible ? 1 : 0, animationDelay: getItemDelay(states.length) }}
            >
              <path
                d="M2 7 C2 2 18 2 18 7 M16 5 L18 7 L16 9"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {trigger && (
            <p className="mt-1 text-center text-[10px] text-stone-500 dark:text-stone-500">
              <code className="rounded-sm bg-stone-100 px-1 py-0.5 font-mono text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                {trigger}
              </code>{' '}
              {locale.diagrams.switchSuffix}
            </p>
          )}
        </>
      )}
    </BaseDiagram>
  )
}
