import { WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { locale } from '@/config/locale'

/**
 * オフライン時に画面上部にバナーを表示する。
 * PWAはService Workerでオフライン動作するが、ユーザーに状態を伝える。
 */
export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 bg-stone-200 px-4 py-1.5 text-xs text-stone-700 dark:bg-stone-700 dark:text-white"
      style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + 6px)` }}
    >
      <WifiOff className="h-3.5 w-3.5" />
      {locale.offline.indicator}
    </div>
  )
}
