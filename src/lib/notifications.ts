/**
 * PWA ローカル通知 — SRS復習リマインダー
 *
 * Notification API を使い、アプリ起動時に復習リマインダーを表示。
 *
 * 注意: PWA の Notification API はアプリがフォアグラウンドの時のみ動作。
 * バックグラウンド通知には Service Worker + FCM/APNs が必要だが、
 * このアプリはサーバーレス（GitHub Pages）なので、起動時の即時通知に限定。
 * iOS では PWA をホーム画面に追加しないと通知が使えない制限あり。
 */

import { theme } from '@/config/theme'

const NOTIFICATION_KEY = `${theme.storagePrefix}-notification-permission`
const SHOWN_KEY = `${theme.storagePrefix}-reminder-shown`

export class NotificationService {
  /**
   * 通知がサポートされているか
   */
  static isSupported(): boolean {
    return 'Notification' in window
  }

  /**
   * 通知許可をリクエスト
   */
  static async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false

    const result = await Notification.requestPermission()
    try {
      localStorage.setItem(NOTIFICATION_KEY, result)
    } catch {
      /* ignore */
    }
    return result === 'granted'
  }

  /**
   * アプリ起動時にSRS復習リマインダーを即時表示
   * 1日1回のみ表示。アプリを開いた時にリマインダーとして機能。
   */
  static showStartupReminder(dueCount: number): void {
    if (!this.isSupported() || Notification.permission !== 'granted') return
    if (dueCount === 0) return

    // 今日すでに表示済みならスキップ
    const today = new Date().toISOString().slice(0, 10)
    try {
      if (localStorage.getItem(SHOWN_KEY) === today) return
      localStorage.setItem(SHOWN_KEY, today)
    } catch {
      /* ignore */
    }

    try {
      new Notification(theme.appName, {
        body: `🧠 復習待ちの問題が${dueCount}問あります`,
        icon: '/cloudflare-quiz/icons/icon-192.png',
        tag: 'srs-review',
        requireInteraction: false,
      })
    } catch {
      // Notification constructor can throw in restricted contexts
    }
  }

  /**
   * ユーザーがまだ通知許可を求められていないかチェック
   */
  static shouldAskPermission(): boolean {
    if (!this.isSupported()) return false
    if (Notification.permission !== 'default') return false

    // iOS/iPadOS Safari (non-standalone) does not support notifications
    // Only show opt-in if running as installed PWA
    // iPad on iOS 13+ sends Macintosh UA, so also check maxTouchPoints
    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    if (isIOS && !isStandalone) return false

    try {
      return localStorage.getItem(NOTIFICATION_KEY) !== 'denied'
    } catch {
      return true
    }
  }
}
