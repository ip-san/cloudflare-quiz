import { ArrowLeft, XCircle } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AppLogo } from '@/components/Layout/AppLogo'
import { InstallPrompt } from '@/components/Layout/InstallPrompt'
import { OfflineIndicator } from '@/components/Layout/OfflineIndicator'
import { hasSeenTutorial, markTutorialSeen, TutorialScreen } from '@/components/Layout/TutorialScreen'
import { hasSeenWelcome, WelcomeScreen } from '@/components/Layout/WelcomeScreen'
import { ModeSelection } from '@/components/Menu/ModeSelection'
import { Timer } from '@/components/Quiz/chapter/Timer'
import { QuizCard } from '@/components/Quiz/QuizCard'
import { locale } from '@/config/locale'
import { theme } from '@/config/theme'
import { SCENARIOS } from '@/data/scenarios'
import { getChapterFromTags } from '@/domain/valueObjects/OverviewChapter'
import { headerStyles, pageStyles } from '@/lib/styles'
import { applyUrlIntent, buildUrlSearch, parseUrlIntent } from '@/lib/urlSync'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useQuizStore } from '@/stores/quizStore'

// Lazy-load screens not needed on initial render
const QuizResult = lazy(() => import('@/components/Quiz/QuizResult').then((m) => ({ default: m.QuizResult })))
const ProgressDashboard = lazy(() =>
  import('@/components/Progress/ProgressDashboard').then((m) => ({ default: m.ProgressDashboard }))
)
const ExplanationReader = lazy(() =>
  import('@/components/Reader/ExplanationReader').then((m) => ({ default: m.ExplanationReader }))
)
const ScenarioList = lazy(() => import('@/components/Quiz/ScenarioView').then((m) => ({ default: m.ScenarioList })))
const ScenarioView = lazy(() => import('@/components/Quiz/ScenarioView').then((m) => ({ default: m.ScenarioView })))
const StudyFirstView = lazy(() =>
  import('@/components/Menu/StudyFirstView').then((m) => ({ default: m.StudyFirstView }))
)

/** Compact loading indicator for lazy-loaded screens */
function LoadingSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-claude-cream dark:bg-stone-900">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-claude-orange dark:border-stone-700" />
    </div>
  )
}

/** Update theme-color meta tag for status bar coloring */
function setThemeColor(color: string) {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', color)
}

const PWAUpdatePrompt = lazy(() =>
  import('@/components/Layout/PWAUpdatePrompt').then((m) => ({ default: m.PWAUpdatePrompt }))
)

export default function App() {
  const {
    viewState,
    getProgress,
    sessionState,
    activeScenarioId,
    readerInitialFilter,
    isLoading,
    initialize,
    endSession,
    suspendSession,
    startSession,
    startSessionWithIds,
    startScenarioSession,
    setViewState,
    openReaderWithFilter,
  } = useQuizStore(
    useShallow((state) => ({
      viewState: state.viewState,
      getProgress: state.getProgress,
      sessionState: state.sessionState,
      activeScenarioId: state.activeScenarioId,
      readerInitialFilter: state.readerInitialFilter,
      isLoading: state.isLoading,
      initialize: state.initialize,
      endSession: state.endSession,
      suspendSession: state.suspendSession,
      startSession: state.startSession,
      startSessionWithIds: state.startSessionWithIds,
      startScenarioSession: state.startScenarioSession,
      setViewState: state.setViewState,
      openReaderWithFilter: state.openReaderWithFilter,
    }))
  )
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenWelcome())
  const [showTutorial, setShowTutorial] = useState(() => !hasSeenTutorial())
  const [microQuizTip, setMicroQuizTip] = useState<string | null>(null)

  // Clear micro-quiz tip when returning to menu
  useEffect(() => {
    if (viewState === 'menu') setMicroQuizTip(null)
  }, [viewState])

  // Initialize store on mount + dispatch the URL intent exactly once.
  //
  // The URL is captured BEFORE `initialize()` so the URL-writer effect can't
  // clear it between the store's set({isLoading: false}) and our `.then()`.
  // The ref guard makes React 18 Strict Mode's double-mount harmless.
  const dispatchedRef = useRef(false)
  useEffect(() => {
    if (dispatchedRef.current) return
    dispatchedRef.current = true
    const initialSearch = window.location.search
    initialize().then(() => {
      const intent = parseUrlIntent(initialSearch)
      applyUrlIntent(
        intent,
        { startSession, startSessionWithIds, startScenarioSession, setViewState, openReaderWithFilter },
        {
          labels: { recommend: locale.sessionLabels.recommend, shared: locale.sessionLabels.shared },
          onIdsDispatched: () => {
            try {
              window.history.replaceState({}, '', window.location.pathname)
            } catch {
              /* cross-origin iframe */
            }
          },
        }
      )
    })
  }, [initialize, startSession, startSessionWithIds, startScenarioSession, setViewState, openReaderWithFilter])

  // Keep the browser address bar in sync with the current view/session so users can copy & share.
  // Deps are narrowed to the specific session fields that affect the URL so we don't
  // rewrite on every answer / timer tick.
  const currentQuestionId = sessionState?.questions[sessionState.currentIndex]?.id ?? null
  const sessionMode = sessionState?.config.mode ?? null
  const categoryFilter = sessionState?.config.categoryFilter ?? null
  useEffect(() => {
    if (isLoading) return
    const search = buildUrlSearch({
      viewState,
      sessionMode,
      categoryFilter,
      activeScenarioId,
      currentQuestionId,
      readerInitialFilter,
    })
    const target = `${window.location.pathname}${search}`
    if (target !== `${window.location.pathname}${window.location.search}`) {
      try {
        window.history.replaceState(window.history.state, '', target)
      } catch {
        /* cross-origin iframe */
      }
    }
  }, [viewState, sessionMode, categoryFilter, activeScenarioId, currentQuestionId, readerInitialFilter, isLoading])

  // Scroll to top on view change
  // biome-ignore lint/correctness/useExhaustiveDependencies: viewState change is the intentional trigger
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [viewState])

  // Browser back button — always returns to menu
  useEffect(() => {
    if (isLoading) return

    const handlePopState = () => {
      const currentView = useQuizStore.getState().viewState
      if (currentView === 'menu') return

      if (currentView === 'quiz') {
        const session = useQuizStore.getState().sessionState
        if (session?.isReviewMode) {
          endSession()
        } else {
          suspendSession()
        }
      } else {
        endSession()
      }
    }

    window.addEventListener('popstate', handlePopState)

    // Push one state entry when leaving menu (so back goes to menu, not out of app)
    // Only push if not already at this view (prevent duplicate entries)
    if (viewState !== 'menu' && window.history.state?.view !== viewState) {
      window.history.replaceState({ view: 'menu' }, '')
      window.history.pushState({ view: viewState }, '')
    }

    return () => window.removeEventListener('popstate', handlePopState)
  }, [viewState, isLoading, endSession, suspendSession])

  // PWA overlays — declared before early returns so all screens can use it
  const pwaOverlays = (
    <>
      <OfflineIndicator />
      <InstallPrompt />
      <Suspense fallback={null}>
        <PWAUpdatePrompt />
      </Suspense>
    </>
  )

  // Show welcome screen for first-time users (with PWA install prompt)
  if (showWelcome && !isLoading) {
    return (
      <>
        <WelcomeScreen onComplete={() => setShowWelcome(false)} />
        {pwaOverlays}
      </>
    )
  }

  // Show tutorial for users who haven't seen it yet (after welcome, before menu)
  if (showTutorial && !hasSeenTutorial() && !isLoading) {
    return (
      <>
        <TutorialScreen
          onComplete={(_action) => {
            markTutorialSeen()
            setShowTutorial(false)
            // チュートリアル後はメニュー画面へ（アプリの全体像を把握してから学習開始）
          }}
        />
        {pwaOverlays}
      </>
    )
  }

  // Show branded loading screen
  if (isLoading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-claude-cream">
        <div className="animate-bounce-in text-center">
          <div className="mb-4 flex justify-center">
            <AppLogo size={96} />
          </div>
          <h1 className="mb-1 text-xl font-bold text-claude-dark">{theme.appName}</h1>
          <p className="text-sm text-claude-gray">読み込み中...</p>
        </div>
      </div>
    )
  }

  // Render based on view state with entrance animation
  const viewContent = (() => {
    switch (viewState) {
      case 'menu':
        return <ModeSelection />
      case 'progress':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <ProgressDashboard />
          </Suspense>
        )
      case 'reader':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <ExplanationReader />
          </Suspense>
        )
      case 'scenarioSelect':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <ScenarioSelectView />
          </Suspense>
        )
      case 'result':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <QuizResult />
          </Suspense>
        )
      case 'studyFirst':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <StudyFirstViewWrapper />
          </Suspense>
        )
      case 'tutorial':
        return <TutorialScreen onComplete={() => endSession()} />
      default:
        return null
    }
  })()

  if (viewContent) {
    // Status bar color per screen
    const themeColors: Record<string, string> = {
      menu: '#FAF9F5',
      progress: '#FAF9F5',
      reader: '#FAF9F5',
      result: '#FAF9F5',
      scenarioSelect: '#FAF9F5',
      studyFirst: '#FAF9F5',
      tutorial: '#FAF9F5',
    }
    setThemeColor(themeColors[viewState] ?? '#FAF9F5')

    return (
      <div className="min-h-dvh bg-claude-cream" key={viewState}>
        <div className="animate-view-enter">{viewContent}</div>
        {pwaOverlays}
      </div>
    )
  }

  // Quiz view
  const progress = getProgress()
  const timeRemaining = sessionState?.timeRemaining ?? null

  return <QuizView progress={progress} timeRemaining={timeRemaining} microQuizTip={microQuizTip} />
}

/** Quiz content switcher — renders ScenarioView or QuizCard based on mode */
function QuizContent({ isModalOpen }: { isModalOpen: boolean }) {
  const { sessionState, activeScenarioId } = useQuizStore(
    useShallow((state) => ({ sessionState: state.sessionState, activeScenarioId: state.activeScenarioId }))
  )
  const mode = sessionState?.config.mode

  if (mode === 'scenario' && activeScenarioId) {
    const scenario = SCENARIOS.find((s) => s.id === activeScenarioId)
    if (scenario) {
      return (
        <Suspense fallback={<LoadingSpinner />}>
          <ScenarioView scenario={scenario} isModalOpen={isModalOpen} />
        </Suspense>
      )
    }
  }

  return <QuizCard isModalOpen={isModalOpen} />
}

/** Scenario selection screen */
function ScenarioSelectView() {
  const { endSession, startScenarioSession } = useQuizStore(
    useShallow((state) => ({ endSession: state.endSession, startScenarioSession: state.startScenarioSession }))
  )
  return (
    <div className="min-h-dvh bg-claude-cream dark:bg-stone-900">
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/80 backdrop-blur-xs dark:border-stone-700 dark:bg-stone-800/80">
        <div className="mx-auto max-w-3xl px-4 pb-2 pt-3">
          <div className="flex items-center gap-3">
            <button onClick={endSession} className="tap-highlight rounded-full p-1" aria-label="戻る">
              <ArrowLeft className="h-5 w-5 text-stone-600 dark:text-stone-300" />
            </button>
            <h1 className="text-lg font-bold text-claude-dark">実践シナリオ</h1>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-4">
        <Suspense fallback={<LoadingSpinner />}>
          <ScenarioList onSelect={(id) => startScenarioSession(id)} />
        </Suspense>
      </div>
    </div>
  )
}

/** Study First view wrapper — connects store to StudyFirstView */
function StudyFirstViewWrapper() {
  const { allQuestions, userProgress, endSession, startSession } = useQuizStore(
    useShallow((state) => ({
      allQuestions: state.allQuestions,
      userProgress: state.userProgress,
      endSession: state.endSession,
      startSession: state.startSession,
    }))
  )
  return (
    <StudyFirstView
      allQuestions={allQuestions}
      userProgress={userProgress}
      onBack={endSession}
      onStartQuiz={(_chapterId, startIndex) => startSession({ mode: 'overview' }, { startIndex })}
    />
  )
}

/**
 * Quiz View Component — native app-like layout
 * Sticky header + scrollable content + bottom sheet dialog
 */
function QuizView({
  progress,
  timeRemaining,
  microQuizTip,
}: {
  progress: { current: number; total: number }
  timeRemaining: number | null
  microQuizTip?: string | null
}) {
  const { endSession, suspendSession, sessionState, sessionLabel } = useQuizStore(
    useShallow((state) => ({
      endSession: state.endSession,
      suspendSession: state.suspendSession,
      sessionState: state.sessionState,
      sessionLabel: state.sessionLabel,
    }))
  )
  const isReviewMode = sessionState?.isReviewMode ?? false
  const isOverviewMode = sessionState?.config.mode === 'overview'
  const isCustomMode = sessionState?.config.mode === 'custom'
  const [showQuitDialog, setShowQuitDialog] = useState(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const currentChapter = useMemo(() => {
    if (!isOverviewMode || !sessionState) return null
    const currentQuestion = sessionState.questions[sessionState.currentIndex]
    return currentQuestion ? getChapterFromTags(currentQuestion.tags) : null
  }, [isOverviewMode, sessionState])

  const handleQuitClick = () => {
    setShowQuitDialog(true)
  }

  const handleConfirmQuit = () => {
    setShowQuitDialog(false)
    if (isReviewMode) {
      endSession()
    } else {
      suspendSession()
    }
  }

  const handleCancelQuit = useCallback(() => {
    setShowQuitDialog(false)
    // Restore focus to the trigger button
    requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  useFocusTrap(dialogRef, showQuitDialog, handleCancelQuit)

  // Quiz screen uses lighter status bar
  useEffect(() => {
    setThemeColor('#FAF9F5')
  }, [])

  return (
    <div className={`flex min-h-dvh flex-col ${pageStyles.quiz}`}>
      {/* Sticky header — native navigation bar feel */}
      <div className={headerStyles.sticky}>
        <div className="mx-auto max-w-3xl px-4 pb-2 pt-3 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isReviewMode && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">復習</span>
              )}
              {isOverviewMode && currentChapter && (
                <span className="rounded-full bg-claude-orange/10 px-2.5 py-0.5 text-xs font-medium text-claude-orange">
                  {currentChapter.icon} Ch.{currentChapter.id}
                </span>
              )}
              {isCustomMode && sessionLabel && (
                <span className="max-w-32 truncate rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  🔍 {sessionLabel}
                </span>
              )}
              <span className="text-sm text-stone-500">
                <span className="font-bold text-claude-dark">{progress.current}</span>
                <span className="mx-0.5 text-stone-400">/</span>
                <span>{progress.total}</span>
              </span>
              {timeRemaining !== null && <Timer />}
            </div>
            <button
              ref={triggerRef}
              onClick={handleQuitClick}
              className="tap-highlight flex items-center gap-1.5 rounded-full px-1 py-1 sm:border sm:border-stone-300 sm:px-3.5 sm:py-1.5 sm:dark:border-stone-600"
              aria-label={isReviewMode ? '復習を終了する' : 'クイズを中止する'}
            >
              <XCircle className="h-6 w-6 text-stone-400 sm:h-4 sm:w-4" />
              <span className="hidden text-sm font-medium text-stone-600 dark:text-stone-300 sm:inline">
                {isReviewMode ? '終了' : '中止'}
              </span>
            </button>
          </div>
          {/* Progress bar */}
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700 sm:h-1"
            role="progressbar"
            aria-valuenow={progress.current}
            aria-valuemin={1}
            aria-valuemax={progress.total}
            aria-label="問題の進捗"
          >
            <div
              className="h-full rounded-full progress-gradient transition-all"
              style={{
                width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Micro-quiz context banner */}
      {microQuizTip && (
        <div className="mx-3 mt-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 dark:border-indigo-500/30 dark:bg-indigo-500/10 sm:mx-auto sm:max-w-3xl">
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">💡 {microQuizTip}</p>
          <p className="text-[10px] text-indigo-500/70">作業中の苦戦から自動検出されました</p>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1">
        <div className="mx-auto px-3 py-3 sm:max-w-3xl sm:px-4 sm:py-6">
          <QuizContent isModalOpen={showQuitDialog} />
        </div>
      </div>

      {/* iOS-style bottom sheet dialog */}
      {showQuitDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quit-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelQuit()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCancelQuit()
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />
          {/* Sheet */}
          <div
            className="relative mx-2 mb-2 w-full max-w-sm animate-slide-down rounded-2xl bg-white p-6 shadow-2xl dark:bg-stone-800 sm:mx-4 sm:mb-0 sm:animate-none"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            ref={(el) => {
              dialogRef.current = el
              if (el) {
                const btns = el.querySelectorAll('button')
                btns[0]?.focus()
              }
            }}
          >
            <h3 id="quit-dialog-title" className="mb-2 text-center text-lg font-semibold text-claude-dark">
              {isReviewMode ? '復習を中止しますか？' : 'クイズを中止しますか？'}
            </h3>
            <p className="mb-6 text-center text-sm text-stone-500">
              {isReviewMode ? 'メニューに戻ります。' : '進捗は保存されます。あとで続きから再開できます。'}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleCancelQuit}
                className="tap-highlight w-full rounded-2xl bg-claude-orange py-3.5 text-base font-semibold text-white"
              >
                続ける
              </button>
              <button
                onClick={handleConfirmQuit}
                className="tap-highlight w-full rounded-2xl py-3.5 text-base font-semibold text-red-500"
              >
                中止する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
