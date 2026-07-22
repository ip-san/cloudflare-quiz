import { Bell, X } from 'lucide-react'
import { useState } from 'react'
import { locale } from '@/config/locale'
import { theme } from '@/config/theme'
import { haptics } from '@/lib/haptics'
import { NotificationService } from '@/lib/notifications'

const DISMISSED_KEY = `${theme.storagePrefix}-notification-opt-in-dismissed`

/**
 * PWA 通知許可のオプトインバナー
 *
 * 表示条件（親コンポーネント ModeSelection.tsx と分担）:
 * - PWA版 + 3セッション以上完了 → ModeSelection が判定
 * - 通知権限が未設定 (default) → shouldAskPermission() が判定
 * - iOS Safari 非スタンドアロンでは非表示 → shouldAskPermission() が判定
 * - 一度許可/拒否/閉じたら再表示しない → localStorage で管理
 */
export function NotificationOptIn() {
  const [visible, setVisible] = useState(() => {
    if (!NotificationService.shouldAskPermission()) return false
    try {
      return localStorage.getItem(DISMISSED_KEY) !== 'true'
    } catch {
      return false
    }
  })

  if (!visible) return null

  const handleAllow = async () => {
    haptics.light()
    await NotificationService.requestPermission()
    setVisible(false)
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  return (
    <div
      className="mb-4 animate-view-enter rounded-2xl border border-blue-200 bg-blue-50/50 px-4 py-3 dark:border-blue-500/20 dark:bg-blue-500/5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-cf-ink dark:text-stone-200">{locale.notification.title}</p>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{locale.notification.desc}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleAllow}
              className="tap-highlight rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {locale.notification.allow}
            </button>
            <button
              onClick={handleDismiss}
              className="tap-highlight rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-500 dark:border-stone-600"
            >
              {locale.notification.later}
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="tap-highlight rounded-full p-1 text-stone-400"
          aria-label={locale.common.close}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
