import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AdaptiveDifficultyService } from '@/domain/services/AdaptiveDifficultyService'
import { QuizSessionService } from '@/domain/services/QuizSessionService'
import { getChapterFromTags, OVERVIEW_CHAPTERS } from '@/domain/valueObjects/OverviewChapter'
import { haptics } from '@/lib/haptics'
import { useSwipe } from '@/lib/useSwipe'
import { useQuizStore } from '@/stores/quizStore'

export interface UseQuizCardOptions {
  isModalOpen?: boolean
  onLastQuestionNext?: (() => void) | undefined
}

export interface UseQuizCardReturn {
  // Store state
  quiz: ReturnType<ReturnType<typeof useQuizStore.getState>['getCurrentQuestion']>
  sessionState: ReturnType<typeof useQuizStore.getState>['sessionState']
  selectedAnswer: number | null
  selectedAnswers: readonly number[]
  isAnswered: boolean
  isCorrect: boolean | null
  isReviewMode: boolean
  deferFeedback: boolean
  hintUsed: boolean
  isBookmarked: boolean
  isAdaptive: boolean
  totalXp: number
  isMultiSelect: boolean
  currentIndex: number
  canGoBack: boolean

  // Chapter state (from domain layer - overview mode only)
  isOverviewMode: boolean
  currentChapter: (typeof OVERVIEW_CHAPTERS)[number] | null
  showChapterIntro: boolean | null | (typeof OVERVIEW_CHAPTERS)[number]
  showChapterComplete: boolean | null | (typeof OVERVIEW_CHAPTERS)[number]
  chapterScore: { score: number; total: number }
  previousChapter: ReturnType<typeof getChapterFromTags>
  showChapterIndicator: boolean | null | (typeof OVERVIEW_CHAPTERS)[number]

  // Overlay state
  showCorrectOverlay: boolean

  // Consecutive tracking
  consecutiveCorrect: number
  consecutiveWrong: number

  // Swipe handlers
  swipeHandlers: ReturnType<typeof useSwipe>

  // Store actions
  selectAnswer: ReturnType<typeof useQuizStore.getState>['selectAnswer']
  toggleAnswer: ReturnType<typeof useQuizStore.getState>['toggleAnswer']
  submitAnswer: ReturnType<typeof useQuizStore.getState>['submitAnswer']
  nextQuestion: ReturnType<typeof useQuizStore.getState>['nextQuestion']
  previousQuestion: ReturnType<typeof useQuizStore.getState>['previousQuestion']
  goToQuestion: ReturnType<typeof useQuizStore.getState>['goToQuestion']
  finishTest: ReturnType<typeof useQuizStore.getState>['finishTest']
  retryQuestion: ReturnType<typeof useQuizStore.getState>['retryQuestion']
  endSession: ReturnType<typeof useQuizStore.getState>['endSession']
  toggleBookmark: ReturnType<typeof useQuizStore.getState>['toggleBookmark']
  useHint: ReturnType<typeof useQuizStore.getState>['useHint']
  dismissChapterIntro: ReturnType<typeof useQuizStore.getState>['dismissChapterIntro']
  dismissChapterComplete: ReturnType<typeof useQuizStore.getState>['dismissChapterComplete']
}

export function useQuizCard({
  isModalOpen: _isModalOpen = false,
  onLastQuestionNext,
}: UseQuizCardOptions): UseQuizCardReturn {
  const {
    getCurrentQuestion,
    sessionState,
    selectAnswer,
    toggleAnswer,
    submitAnswer,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    finishTest,
    retryQuestion,
    endSession,
    toggleBookmark,
    useHint,
    dismissChapterIntro,
    dismissChapterComplete,
  } = useQuizStore(
    useShallow((state) => ({
      getCurrentQuestion: state.getCurrentQuestion,
      sessionState: state.sessionState,
      selectAnswer: state.selectAnswer,
      toggleAnswer: state.toggleAnswer,
      submitAnswer: state.submitAnswer,
      nextQuestion: state.nextQuestion,
      previousQuestion: state.previousQuestion,
      goToQuestion: state.goToQuestion,
      finishTest: state.finishTest,
      retryQuestion: state.retryQuestion,
      endSession: state.endSession,
      toggleBookmark: state.toggleBookmark,
      useHint: state.useHint,
      dismissChapterIntro: state.dismissChapterIntro,
      dismissChapterComplete: state.dismissChapterComplete,
    }))
  )

  const quiz = getCurrentQuestion()
  const selectedAnswer = sessionState?.selectedAnswer ?? null
  const selectedAnswers = sessionState?.selectedAnswers ?? []
  const isAnswered = sessionState?.isAnswered ?? false
  const isCorrect = sessionState?.isCorrect ?? null
  const isReviewMode = sessionState?.isReviewMode ?? false
  const deferFeedback = sessionState?.deferFeedback ?? false
  const hintUsed = sessionState?.hintUsed ?? false

  const isBookmarked = useQuizStore((state) => (quiz ? state.userProgress.isBookmarked(quiz.id) : false))
  const isAdaptive = useQuizStore((state) => {
    const mode = state.sessionConfig.mode
    return (mode === 'random' || mode === 'category') && AdaptiveDifficultyService.isAdaptiveReady(state.userProgress)
  })
  const totalXp = useQuizStore((state) => state.userProgress.totalXp)

  const isMultiSelect = quiz?.isMultiSelect ?? false
  const currentIndex = sessionState?.currentIndex ?? 0
  const canGoBack = currentIndex > 0

  // Chapter state from domain layer (overview mode only)
  // IMPORTANT: チャプター状態は OverviewChapterState（ドメイン層）で管理。useState 禁止
  const isOverviewMode = sessionState?.config.mode === 'overview'
  const chapterState = sessionState?.overviewChapterState ?? null
  const currentChapter = useMemo(() => {
    if (!chapterState) return null
    return OVERVIEW_CHAPTERS.find((c) => c.id === chapterState.currentChapterId) ?? null
  }, [chapterState])
  const showChapterIntro = chapterState?.chapterPhase === 'intro' && currentChapter
  const showChapterComplete = chapterState?.chapterPhase === 'complete' && currentChapter
  const chapterScore = useMemo(() => {
    if (!showChapterComplete || !sessionState || !currentChapter) return { score: 0, total: 0 }
    return QuizSessionService.getChapterScore(sessionState, currentChapter.id)
  }, [showChapterComplete, sessionState, currentChapter])

  // Chapter indicator: show "Ch.N" badge when chapter changes
  const previousChapter = useMemo(() => {
    if (!isOverviewMode || !sessionState || sessionState.currentIndex === 0) return null
    const prevQuestion = sessionState.questions[sessionState.currentIndex - 1]
    return prevQuestion ? getChapterFromTags(prevQuestion.tags) : null
  }, [isOverviewMode, sessionState])
  const showChapterIndicator =
    isOverviewMode && currentChapter && currentChapter.id !== previousChapter?.id && !showChapterIntro

  // Track consecutive correct/wrong answers for toasts
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0)
  const [consecutiveWrong, setConsecutiveWrong] = useState(0)
  const prevIsAnsweredRef = useRef(false)

  // Scroll to top on question change
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentIndex change is the intentional trigger
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [currentIndex])

  // Reset streak on new session (questions array identity changes)
  const questionsRef = useRef(sessionState?.questions)
  useEffect(() => {
    if (sessionState?.questions !== questionsRef.current) {
      questionsRef.current = sessionState?.questions
      setConsecutiveCorrect(0)
      setConsecutiveWrong(0)
    }
  }, [sessionState?.questions])

  // Haptic feedback + overlay on answer result
  const [showCorrectOverlay, setShowCorrectOverlay] = useState(false)
  useEffect(() => {
    // Only trigger on fresh answer submission (isAnswered: false → true)
    const isNewSubmission = isAnswered && !prevIsAnsweredRef.current
    prevIsAnsweredRef.current = isAnswered

    if (isNewSubmission && isCorrect !== null) {
      if (isCorrect) {
        haptics.success()
        if (!deferFeedback) setShowCorrectOverlay(true)
        setConsecutiveCorrect((prev) => prev + 1)
        setConsecutiveWrong(0)
      } else {
        haptics.error()
        setConsecutiveCorrect(0)
        setConsecutiveWrong((prev) => prev + 1)
      }
    } else if (!isAnswered) {
      setShowCorrectOverlay(false)
    }
  }, [isAnswered, isCorrect, deferFeedback])

  // Swipe to navigate questions (respects chapter boundary and scenario epilogue)
  // Swipe/next: domain layer handles chapter boundaries via overviewChapterState
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      haptics.light()
      if (onLastQuestionNext) {
        onLastQuestionNext()
      } else {
        nextQuestion()
      }
    },
    onSwipeRight: () => {
      if (canGoBack) {
        haptics.light()
        previousQuestion()
      }
    },
  })

  return {
    // Store state
    quiz,
    sessionState,
    selectedAnswer,
    selectedAnswers,
    isAnswered,
    isCorrect,
    isReviewMode,
    deferFeedback,
    hintUsed,
    isBookmarked,
    isAdaptive,
    totalXp,
    isMultiSelect,
    currentIndex,
    canGoBack,

    // Chapter state
    isOverviewMode,
    currentChapter,
    showChapterIntro,
    showChapterComplete,
    chapterScore,
    previousChapter,
    showChapterIndicator,

    // Overlay state
    showCorrectOverlay,

    // Consecutive tracking
    consecutiveCorrect,
    consecutiveWrong,

    // Swipe handlers
    swipeHandlers,

    // Store actions
    selectAnswer,
    toggleAnswer,
    submitAnswer,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    finishTest,
    retryQuestion,
    endSession,
    toggleBookmark,
    useHint,
    dismissChapterIntro,
    dismissChapterComplete,
  }
}
