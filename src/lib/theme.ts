/**
 * Dark mode theme management
 * Persists preference to localStorage, respects system preference as default
 */

import { theme as appTheme } from '@/config/theme'
import { trackThemeChange } from '@/lib/analytics'

const STORAGE_KEY = `${appTheme.storagePrefix}-theme`
const LEGACY_STORAGE_KEY = 'claude-quiz-theme'

export type Theme = 'light' | 'dark' | 'system'

export function getStoredTheme(): Theme {
  try {
    return (
      (localStorage.getItem(STORAGE_KEY) as Theme) ?? (localStorage.getItem(LEGACY_STORAGE_KEY) as Theme) ?? 'system'
    )
  } catch {
    return 'system'
  }
}

export function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
    trackThemeChange(theme) // GA4: track user-initiated theme changes (not called on init)
  } catch {
    /* ignore */
  }
}

export function applyTheme(theme: Theme): void {
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  document.documentElement.classList.toggle('dark', isDark)

  // Update theme-color meta for status bar
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', isDark ? '#1a1a1a' : '#FAF9F5')
  }
}

export function initTheme(): void {
  applyTheme(getStoredTheme())
}
