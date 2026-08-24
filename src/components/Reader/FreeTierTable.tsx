import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { locale } from '@/config/locale'
import { FREE_TIER_SERVICES } from '@/data/freeTier'
import { useQuizStore } from '@/stores/quizStore'

/**
 * 無料枠早見表
 *
 * 個人開発者の最大の関心事「無料でどこまで行けるか」を1画面で見せる。
 * 数値は src/data/freeTier.ts が持ち、`node scripts/verify-free-tier.mjs` で
 * ドキュメントキャッシュと機械照合している。
 */
export function FreeTierTable() {
  const { setViewState } = useQuizStore(useShallow((state) => ({ setViewState: state.setViewState })))

  return (
    <div className="min-h-dvh bg-cf-bg pb-16">
      <header className="sticky top-0 z-10 border-stone-200 border-b bg-cf-bg/95 backdrop-blur dark:border-stone-700">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => setViewState('menu')}
            aria-label={locale.common.back}
            className="tap-highlight rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-cf-ink text-lg">{locale.freeTier.title}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-4">
        <p className="mb-5 text-sm text-stone-600 leading-relaxed dark:text-stone-300">{locale.freeTier.intro}</p>

        <div className="space-y-4">
          {FREE_TIER_SERVICES.map((svc) => (
            <section key={svc.id} className="rounded-2xl bg-white p-4 shadow-xs dark:bg-stone-800">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xl">{svc.icon}</span>
                <h2 className="font-bold text-base text-cf-ink">{svc.name}</h2>
              </div>
              <p className="mb-3 text-stone-500 text-xs">{svc.summary}</p>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {svc.items.map((item) => (
                      <tr key={item.label} className="border-stone-100 border-b last:border-0 dark:border-stone-700/60">
                        <th
                          scope="row"
                          className="py-2 pr-3 text-left align-top font-medium text-stone-600 dark:text-stone-300"
                        >
                          {item.label}
                        </th>
                        <td className="py-2 align-top">
                          <span className="font-semibold text-cf-ink">{item.free}</span>
                          {item.note && (
                            <span className="mt-0.5 block text-[11px] text-stone-500 leading-relaxed">{item.note}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <a
                href={svc.docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-cf-accent text-xs hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {locale.freeTier.officialDocs}
              </a>
            </section>
          ))}
        </div>

        <p className="mt-6 text-[11px] text-stone-500 leading-relaxed">{locale.freeTier.disclaimer}</p>
      </div>
    </div>
  )
}
