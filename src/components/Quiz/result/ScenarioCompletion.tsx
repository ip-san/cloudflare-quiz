import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { locale } from '@/config/locale'
import { SCENARIOS } from '@/data/scenarios'
import { haptics } from '@/lib/haptics'

/**
 * シナリオ完走時の締めくくり。
 *
 * 1. `completionMessage`（何を身につけたか）を提示する。
 *    ——このフィールドは全15シナリオに書かれていたのに、これまでUIから
 *    一度も参照されていなかった（テストが存在チェックだけしていたため
 *    生きているように見えていた）。
 * 2. `nextSteps`（実際に手を動かす次の一歩）へ繋ぐ。知識で終わらせない。
 */
export function ScenarioCompletion({ scenarioId }: { scenarioId: string }) {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)

  if (!scenario) return null

  const copyCommand = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      haptics.light()
      setCopiedCommand(command)
      window.setTimeout(() => setCopiedCommand(null), 1500)
    } catch {
      // クリップボードが使えない環境（権限拒否・非セキュアコンテキスト）では
      // 何もしない。コマンド自体は画面に見えているので手で選択できる。
    }
  }

  return (
    <div className="mb-4 rounded-2xl bg-linear-to-br from-blue-50 to-indigo-50 p-4 text-left dark:from-stone-800 dark:to-stone-800">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">{scenario.icon}</span>
        <h3 className="font-bold text-cf-ink text-sm">{scenario.title}</h3>
      </div>
      <p className="text-sm text-stone-700 leading-relaxed dark:text-stone-300">{scenario.completionMessage}</p>

      {scenario.nextSteps && scenario.nextSteps.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 font-semibold text-stone-500 text-xs">{locale.scenario.nextStepsTitle}</p>
          <ul className="space-y-2">
            {scenario.nextSteps.map((step) => (
              <li key={step.label} className="rounded-xl bg-white/70 p-3 dark:bg-stone-900/40">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-cf-accent text-xs">▶</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cf-ink text-sm">{step.label}</p>

                    {step.command && (
                      <button
                        onClick={() => copyCommand(step.command as string)}
                        aria-label={locale.scenario.copyCommand(step.command)}
                        className="tap-highlight mt-1.5 flex w-full items-center gap-2 rounded-lg bg-stone-100 px-2.5 py-1.5 text-left dark:bg-stone-800"
                      >
                        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-stone-700 dark:text-stone-200">
                          {step.command}
                        </code>
                        {copiedCommand === step.command ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                        )}
                      </button>
                    )}

                    {step.docUrl && (
                      <a
                        href={step.docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-cf-accent text-xs hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {locale.scenario.openDocs}
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
