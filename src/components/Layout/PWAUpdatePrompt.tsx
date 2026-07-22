import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { locale } from '@/config/locale'

/**
 * PWA更新通知バナー
 *
 * registerType: 'autoUpdate' により、新バージョンは自動適用される。
 * このコンポーネントは更新適用後にリロードを促すバナーを表示する。
 */
export function PWAUpdatePrompt() {
  const [updated, setUpdated] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handleControllerChange = () => setUpdated(true)
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
  }, [])

  if (!updated) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-slide-down">
      <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-stone-700">
        <RefreshCw className="h-5 w-5 shrink-0 text-cf-accent" />
        <p className="flex-1 text-sm text-stone-800 dark:text-white">{locale.pwaUpdate.updated}</p>
        <button
          onClick={() => window.location.reload()}
          className="tap-highlight shrink-0 rounded-full bg-cf-accent px-4 py-1.5 text-xl font-bold text-white"
        >
          {locale.pwaUpdate.reload}
        </button>
      </div>
    </div>
  )
}
