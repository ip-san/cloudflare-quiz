import { Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { locale } from '@/config/locale'
import { hasSeenWelcome } from './WelcomeScreen'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * PWAインストール促進バナー
 *
 * Android: beforeinstallprompt イベントで「追加」ボタン表示
 * iOS: 手動操作の案内（共有 → ホーム画面に追加）
 * 既にインストール済み（standalone）の場合は非表示
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone)

  useEffect(() => {
    if (isStandalone) return
    try {
      if (sessionStorage.getItem('pwa-install-dismissed')) {
        setDismissed(true)
        return
      }
    } catch {
      /* private browsing */
    }

    if (isIOS) {
      // iOS: show guide after 2 seconds
      const timer = setTimeout(() => setShowIOSGuide(true), 2000)
      return () => clearTimeout(timer)
    }

    // Android/Desktop: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isIOS, isStandalone])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    try {
      await deferredPrompt.prompt()
      await deferredPrompt.userChoice
    } catch {
      /* prompt failed */
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setDismissed(true)
    setShowIOSGuide(false)
    try {
      sessionStorage.setItem('pwa-install-dismissed', '1')
    } catch {
      /* private browsing */
    }
  }

  // Don't show if dismissed, already installed, or welcome screen is still showing
  if (dismissed || isStandalone || !hasSeenWelcome()) return null

  // iOS guide
  if (isIOS && showIOSGuide) {
    return (
      <div className="fixed bottom-4 left-3 right-3 z-40 mx-auto max-w-sm animate-slide-down">
        <div className="rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-stone-700">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share className="h-5 w-5 text-cf-accent" />
              <p className="text-sm font-semibold text-cf-ink">{locale.install.useAsApp}</p>
            </div>
            <button onClick={handleDismiss} className="p-1 text-stone-400" aria-label={locale.common.close}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2 text-xs text-stone-600 dark:text-stone-400">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cf-accent text-xs font-bold text-white">
                1
              </span>
              <span>{locale.install.iosStep1}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cf-accent text-xs font-bold text-white">
                2
              </span>
              <span>{locale.install.iosStep2}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Android/Desktop: standard install prompt
  if (!deferredPrompt) return null

  return (
    <div className="fixed bottom-4 left-3 right-3 z-40 mx-auto max-w-sm animate-slide-down">
      <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-stone-200 dark:bg-stone-800 dark:ring-stone-700">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cf-accent/10">
          <Download className="h-5 w-5 text-cf-accent" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-cf-ink">{locale.install.installApp}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">{locale.install.installDesc}</p>
        </div>
        <button
          onClick={handleInstall}
          className="tap-highlight shrink-0 rounded-full bg-cf-accent px-4 py-2 text-sm font-semibold text-white"
        >
          {locale.install.addButton}
        </button>
        <button onClick={handleDismiss} className="shrink-0 p-1 text-stone-400" aria-label={locale.common.close}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
