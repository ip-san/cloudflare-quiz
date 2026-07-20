import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { DailyGoalService } from '@/domain/services/DailyGoalService'
import { type QuizSessionConfig } from '@/domain/services/QuizSessionService'
import { haptics } from '@/lib/haptics'
import { applyTheme, getStoredTheme, setStoredTheme, type Theme } from '@/lib/theme'
import { useQuizStore } from '@/stores/quizStore'
import { type ViewState } from '@/stores/utils'

interface UseMenuHeaderOptions {
  openWithModes?: boolean | undefined
  onMenuOpened?: (() => void) | undefined
}

export interface MenuHeaderState {
  // Store values
  bookmarkedCount: number
  setViewState: (view: ViewState) => void
  openReaderWithFilter: (filter: string) => void
  startSession: (config: Partial<QuizSessionConfig>, options?: { startIndex?: number }) => void
  // Theme
  currentTheme: Theme
  toggleTheme: () => void
  // Menu open state
  menuOpen: boolean
  openMenu: () => void
  openMenuWithModes: () => void
  closeMenu: () => void
  // Modes expand
  modesExpanded: boolean
  toggleModesExpanded: () => void
  // Update check (PWA)
  updateStatus: 'checking' | 'latest' | 'error' | null
  handleUpdateCheck: () => Promise<void>
  // Overlays
  showShortcuts: boolean
  setShowShortcuts: (v: boolean) => void
  showCategoryPicker: boolean
  setShowCategoryPicker: (v: boolean) => void
  showUnansweredPicker: boolean
  setShowUnansweredPicker: (v: boolean) => void
  // Action wrapper
  handleMenuAction: (action: () => void) => void
  // Derived values
  streak: number
  todayCount: number
  dailyGoal: number
  goalProgress: number
  goalAchieved: boolean
}

export function useMenuHeader({ openWithModes, onMenuOpened }: UseMenuHeaderOptions): MenuHeaderState {
  const { setViewState, openReaderWithFilter, userProgress, startSession, getBookmarkedCount } = useQuizStore(
    useShallow((state) => ({
      setViewState: state.setViewState,
      openReaderWithFilter: state.openReaderWithFilter,
      userProgress: state.userProgress,
      startSession: state.startSession,
      getBookmarkedCount: state.getBookmarkedCount,
    }))
  )

  const bookmarkedCount = getBookmarkedCount()

  const [currentTheme, setCurrentTheme] = useState<Theme>(() => getStoredTheme())
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modesExpanded, setModesExpanded] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'latest' | 'error' | null>(null)
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showUnansweredPicker, setShowUnansweredPicker] = useState(false)

  // Open menu externally with modes expanded
  useEffect(() => {
    if (openWithModes) {
      setMenuOpen(true)
      setModesExpanded(true)
      onMenuOpened?.()
    }
  }, [openWithModes, onMenuOpened])

  // Close menu on Escape key
  useEffect(() => {
    if (!menuOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  // Cleanup update timer on unmount
  useEffect(() => {
    return () => {
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current)
    }
  }, [])

  // Derived daily-goal values
  const streak = userProgress.streakDays
  const today = DailyGoalService.getTodayString()
  const todayCount = userProgress.getDailyCount(today)
  const dailyGoal = userProgress.dailyGoal
  const goalProgress = Math.min(DailyGoalService.getProgress(todayCount, dailyGoal) * 100, 100)
  const goalAchieved = goalProgress >= 100

  const toggleTheme = useCallback(() => {
    const next: Theme = currentTheme === 'dark' ? 'light' : 'dark'
    setStoredTheme(next)
    applyTheme(next)
    setCurrentTheme(next)
  }, [currentTheme])

  const handleMenuAction = useCallback((action: () => void) => {
    haptics.light()
    setMenuOpen(false)
    action()
  }, [])

  const openMenu = useCallback(() => {
    setModesExpanded(false)
    setMenuOpen(true)
  }, [])

  const openMenuWithModes = useCallback(() => {
    setMenuOpen(true)
    setModesExpanded(true)
  }, [])

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
  }, [])

  const toggleModesExpanded = useCallback(() => {
    setModesExpanded((prev) => !prev)
  }, [])

  const handleUpdateCheck = useCallback(async () => {
    if (updateStatus === 'checking') return
    haptics.light()
    setUpdateStatus('checking')
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg) {
        await reg.update()
        await new Promise((r) => setTimeout(r, 1000))
        if (reg.waiting) {
          window.location.reload()
          return
        }
      }
      setUpdateStatus('latest')
      updateTimerRef.current = setTimeout(() => setUpdateStatus(null), 3000)
    } catch {
      setUpdateStatus('error')
      updateTimerRef.current = setTimeout(() => setUpdateStatus(null), 3000)
    }
  }, [updateStatus])

  return {
    // Store values
    bookmarkedCount,
    setViewState,
    openReaderWithFilter,
    startSession,
    // Theme
    currentTheme,
    toggleTheme,
    // Menu open state
    menuOpen,
    openMenu,
    openMenuWithModes,
    closeMenu,
    // Modes expand
    modesExpanded,
    toggleModesExpanded,
    // Update check (PWA)
    updateStatus,
    handleUpdateCheck,
    // Overlays
    showShortcuts,
    setShowShortcuts,
    showCategoryPicker,
    setShowCategoryPicker,
    showUnansweredPicker,
    setShowUnansweredPicker,
    // Action wrapper
    handleMenuAction,
    // Derived values
    streak,
    todayCount,
    dailyGoal,
    goalProgress,
    goalAchieved,
  }
}
