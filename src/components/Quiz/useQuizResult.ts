import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { getScoreMessage } from '@/domain/services/ScoreMessageService'
import { calculateAccuracy } from '@/domain/valueObjects/ScoreThresholds'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'
import { APP_CONFIG, useQuizStore } from '@/stores/quizStore'

// Star emoji divisor for share text
export const STAR_PERCENTAGE_DIVISOR = 20

export interface UseQuizResultReturn {
  // Animation state
  showStars: boolean
  showContent: boolean
  noMotion: boolean

  // Derived values
  percentage: number
  isPassing: boolean
  result: ReturnType<typeof getScoreMessage>
  isFirstSession: boolean

  // Store state
  sessionState: ReturnType<typeof useQuizStore.getState>['sessionState']
  sessionConfig: ReturnType<typeof useQuizStore.getState>['sessionConfig']
  sessionWrongAnswers: ReturnType<typeof useQuizStore.getState>['sessionWrongAnswers']
  userProgress: ReturnType<typeof useQuizStore.getState>['userProgress']
  categoryStats: ReturnType<ReturnType<typeof useQuizStore.getState>['getCategoryStats']>
  score: number
  answeredCount: number
  totalQuestions: number
  hasUnanswered: boolean
  hintsUsedCount: number
  isReviewMode: boolean
  hasWrongAnswers: boolean

  // Handlers
  handleRetry: () => void
  handleBackToMenu: () => void
  startReviewSession: () => void
}

export function useQuizResult(): UseQuizResultReturn {
  const {
    sessionState,
    endSession,
    retrySession,
    startReviewSession,
    sessionConfig,
    sessionWrongAnswers,
    userProgress,
    getCategoryStats,
  } = useQuizStore(
    useShallow((state) => ({
      sessionState: state.sessionState,
      endSession: state.endSession,
      retrySession: state.retrySession,
      startReviewSession: state.startReviewSession,
      sessionConfig: state.sessionConfig,
      sessionWrongAnswers: state.sessionWrongAnswers,
      userProgress: state.userProgress,
      getCategoryStats: state.getCategoryStats,
    }))
  )

  const categoryStats = useMemo(() => getCategoryStats(), [getCategoryStats])

  const score = sessionState?.score ?? 0
  const answeredCount = sessionState?.answeredCount ?? 0
  const totalQuestions = sessionState?.questions.length ?? 0
  const hasUnanswered = answeredCount < totalQuestions
  const hintsUsedCount = sessionState?.hintsUsedCount ?? 0
  const isReviewMode = sessionState?.isReviewMode ?? false
  const hasWrongAnswers = sessionWrongAnswers.length > 0
  const isFirstSession = userProgress.sessionHistory.length <= 1

  // Prevent NaN when no questions answered (edge case: timer expired immediately)
  const percentage = calculateAccuracy(score, answeredCount)
  const isPassing = percentage >= APP_CONFIG.passingScore

  const noMotion = usePrefersReducedMotion()

  const [showStars, setShowStars] = useState(false)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    if (noMotion) {
      setShowStars(true)
      setShowContent(true)
      return
    }

    const starsTimer = setTimeout(() => setShowStars(true), 900)
    const contentTimer = setTimeout(() => setShowContent(true), 1200)

    return () => {
      clearTimeout(starsTimer)
      clearTimeout(contentTimer)
    }
  }, [noMotion])

  const result = getScoreMessage(percentage)

  const handleRetry = () => {
    retrySession()
  }

  const handleBackToMenu = () => {
    endSession()
  }

  return {
    // Animation state
    showStars,
    showContent,
    noMotion,

    // Derived values
    percentage,
    isPassing,
    result,
    isFirstSession,

    // Store state
    sessionState,
    sessionConfig,
    sessionWrongAnswers,
    userProgress,
    categoryStats,
    score,
    answeredCount,
    totalQuestions,
    hasUnanswered,
    hintsUsedCount,
    isReviewMode,
    hasWrongAnswers,

    // Handlers
    handleRetry,
    handleBackToMenu,
    startReviewSession,
  }
}
