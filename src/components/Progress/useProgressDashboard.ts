import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { locale } from '@/config/locale'
import { getMasteryLevel } from '@/domain/services/MasteryLevelService'
import { SessionInsightService } from '@/domain/services/SessionInsightService'
import { PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import { calculateAccuracy, SCORE_COLORS } from '@/domain/valueObjects/ScoreThresholds'
import { getProgressRepository } from '@/infrastructure/persistence/LocalStorageProgressRepository'
import { platformAPI } from '@/lib/platformAPI'
import { useQuizStore } from '@/stores/quizStore'

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseProgressDashboardReturn {
  // Store state
  allQuestions: ReturnType<typeof useQuizStore.getState>['allQuestions']
  userProgress: ReturnType<typeof useQuizStore.getState>['userProgress']
  // Store actions
  setViewState: ReturnType<typeof useQuizStore.getState>['setViewState']
  startSession: ReturnType<typeof useQuizStore.getState>['startSession']
  // Derived values
  categoryStats: ReturnType<ReturnType<typeof useQuizStore.getState>['getCategoryStats']>
  overallAccuracy: number
  hasNoProgress: boolean
  masteryIndex: number
  trendInfo: { trend: number | null; best: number | null }
  teachableCategories: typeof PREDEFINED_CATEGORIES
  // UI state
  exportStatus: string | null
  isStatusError: boolean
  showCharts: boolean
  showCategories: boolean
  showDataManagement: boolean
  setShowCharts: (value: boolean) => void
  setShowCategories: (value: boolean) => void
  setShowDataManagement: (value: boolean) => void
  // Handlers
  handleExport: () => Promise<void>
  handleImport: () => Promise<void>
  handleExportCsv: () => Promise<void>
  handleReset: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProgressDashboard(): UseProgressDashboardReturn {
  const {
    allQuestions,
    userProgress,
    getCategoryStats,
    setViewState,
    startSession,
    resetUserProgress,
    loadUserProgress,
    exportProgressCsv,
  } = useQuizStore(
    useShallow((state) => ({
      allQuestions: state.allQuestions,
      userProgress: state.userProgress,
      getCategoryStats: state.getCategoryStats,
      setViewState: state.setViewState,
      startSession: state.startSession,
      resetUserProgress: state.resetUserProgress,
      loadUserProgress: state.loadUserProgress,
      exportProgressCsv: state.exportProgressCsv,
    }))
  )

  // ── UI state ──────────────────────────────────────────────────────────────
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [showCharts, setShowCharts] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [showDataManagement, setShowDataManagement] = useState(false)
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
    }
  }, [])

  const showStatus = useCallback((message: string, duration = 3000) => {
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
    setExportStatus(message)
    statusTimeoutRef.current = setTimeout(() => {
      setExportStatus(null)
      statusTimeoutRef.current = null
    }, duration)
  }, [])

  // ── Derived values ────────────────────────────────────────────────────────
  const categoryStats = getCategoryStats()
  const overallAccuracy = userProgress.getOverallAccuracy()
  const hasNoProgress = userProgress.totalAttempts === 0
  const masteryIndex = getMasteryLevel(overallAccuracy, userProgress.totalAttempts, categoryStats).index

  const trendInfo = {
    trend: SessionInsightService.getImprovementTrend(userProgress.sessionHistory),
    best: SessionInsightService.getBestScore(userProgress.sessionHistory),
  }

  const teachableCategories = PREDEFINED_CATEGORIES.filter((cat) => {
    const stats = categoryStats[cat.id]
    if (!stats || stats.attemptedQuestions < 5) return false
    return calculateAccuracy(stats.correctAnswers, stats.attemptedQuestions) >= SCORE_COLORS.excellent + 10
  })

  // ── Status error detection ─────────────────────────────────────────────
  const isStatusError =
    exportStatus !== null &&
    (exportStatus === locale.progress.exportFailed ||
      exportStatus === locale.progress.importFailed ||
      exportStatus === locale.progress.invalidFile ||
      exportStatus === locale.progress.csvExportFailed ||
      exportStatus.startsWith(locale.progress.errorPrefix))

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      const progressRepo = getProgressRepository()
      const jsonData = await progressRepo.export()
      const result = await platformAPI.exportProgress(jsonData)
      if (result.success) showStatus(locale.progress.exported)
      else if ('error' in result && result.error !== 'cancelled')
        showStatus(`${locale.progress.errorPrefix}: ${result.error}`, 5000)
    } catch {
      showStatus(locale.progress.exportFailed, 5000)
    }
  }

  const handleImport = async () => {
    try {
      const result = await platformAPI.importProgress()
      if (result.success && result.data) {
        if (window.confirm(locale.progress.confirmOverwrite)) {
          const progressRepo = getProgressRepository()
          const success = await progressRepo.import(result.data)
          if (success) {
            await loadUserProgress()
            showStatus(locale.progress.imported)
          } else {
            showStatus(locale.progress.invalidFile, 5000)
          }
        }
      } else if (result.error !== 'cancelled') {
        showStatus(`${locale.progress.errorPrefix}: ${result.error}`, 5000)
      }
    } catch {
      showStatus(locale.progress.importFailed, 5000)
    }
  }

  const handleExportCsv = async () => {
    try {
      await exportProgressCsv()
      showStatus(locale.progress.csvExported)
    } catch {
      showStatus(locale.progress.csvExportFailed, 5000)
    }
  }

  const handleReset = async () => {
    if (window.confirm(locale.progress.confirmReset)) {
      await resetUserProgress()
    }
  }

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    // Store state
    allQuestions,
    userProgress,
    // Store actions
    setViewState,
    startSession,
    // Derived values
    categoryStats,
    overallAccuracy,
    hasNoProgress,
    masteryIndex,
    trendInfo,
    teachableCategories,
    // UI state
    exportStatus,
    isStatusError,
    showCharts,
    showCategories,
    showDataManagement,
    setShowCharts,
    setShowCategories,
    setShowDataManagement,
    // Handlers
    handleExport,
    handleImport,
    handleExportCsv,
    handleReset,
  }
}
