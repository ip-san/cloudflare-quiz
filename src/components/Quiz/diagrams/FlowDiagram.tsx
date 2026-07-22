import { locale } from '@/config/locale'
import { BaseDiagram } from './BaseDiagram'

interface FlowDiagramProps {
  label?: string | undefined
  steps: Array<{ text: string; sub?: string | undefined }>
}

/**
 * フロー図 — パイプライン型で処理の流れを視覚表現
 * ステップ間をグラデーション矢印で接続。進行方向が直感的にわかる。
 */
export function FlowDiagram({ label, steps }: FlowDiagramProps) {
  // Color progression: orange → blue → green
  const getStepColor = (index: number, total: number) => {
    if (total <= 1) return { bg: 'bg-cf-accent/10', border: 'border-cf-accent/30' }
    const ratio = index / (total - 1)
    if (ratio === 0) return { bg: 'bg-cf-accent/10', border: 'border-cf-accent/30' }
    if (ratio < 0.5) return { bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30' }
    if (ratio < 1)
      return { bg: 'bg-indigo-50 dark:bg-indigo-500/10', border: 'border-indigo-200 dark:border-indigo-500/30' }
    return { bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/30' }
  }

  return (
    <BaseDiagram label={label} defaultLabel={locale.diagrams.flow} itemCount={steps.length}>
      {({ isVisible, getItemDelay }) => (
        <div className="space-y-0.5">
          {steps.map((step, i) => {
            const color = getStepColor(i, steps.length)
            return (
              <div key={i}>
                {/* Connector arrow */}
                {i > 0 && (
                  <div
                    className="flex items-center justify-center py-0.5"
                    style={{ opacity: isVisible ? 1 : 0, animationDelay: getItemDelay(i) }}
                    aria-hidden="true"
                  >
                    <svg width="20" height="14" viewBox="0 0 20 14" className="text-cf-accent/50">
                      <path
                        d="M10 0 L10 8 M6 6 L10 10 L14 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
                {/* Step card */}
                <div
                  className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 transition-none ${color.bg} ${color.border} ${
                    isVisible ? 'animate-diagram-slide-right' : 'opacity-0'
                  }`}
                  style={{ animationDelay: getItemDelay(i) }}
                >
                  {/* Step number badge */}
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cf-accent/20 text-[10px] font-bold text-cf-accent">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium leading-relaxed text-cf-ink break-words dark:text-stone-200">
                      {step.text}
                    </div>
                    {step.sub && (
                      <div className="text-[10px] leading-relaxed text-stone-500 break-words dark:text-stone-400">
                        {step.sub}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </BaseDiagram>
  )
}
