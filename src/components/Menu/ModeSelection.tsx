import { ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { locale } from '@/config/locale'
import { SpacedRepetitionService } from '@/domain/services/SpacedRepetitionService'
import { haptics } from '@/lib/haptics'
import { NotificationService } from '@/lib/notifications'
import { useQuizStore } from '@/stores/quizStore'
import { ChapterProgressMap } from './ChapterProgressMap'
import { DailySnapshot, hasSeenSnapshotToday } from './DailySnapshot'
import { FirstTimeGuide } from './FirstTimeGuide'
import { MenuHeader } from './MenuHeader'
import { NotificationOptIn } from './NotificationOptIn'
import { QuickActions } from './QuickActions'
import { QuizSearch } from './QuizSearch'
import { ResumeSessionBanner } from './ResumeSessionBanner'

export function ModeSelection() {
  const { allQuestions, startSession, startSessionWithIds, userProgress } = useQuizStore(
    useShallow((state) => ({
      allQuestions: state.allQuestions,
      startSession: state.startSession,
      startSessionWithIds: state.startSessionWithIds,
      userProgress: state.userProgress,
    }))
  )

  const [snapshotDismissed, setSnapshotDismissed] = useState(() => hasSeenSnapshotToday())
  const [openMenuWithModes, setOpenMenuWithModes] = useState(false)

  const incorrectCount = useMemo(
    () => allQuestions.filter((q) => !userProgress.isCorrectlyAnswered(q.id)).length,
    [allQuestions, userProgress]
  )

  // Show startup review reminder if notifications are permitted (once per day)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run only on mount
  useEffect(() => {
    if (userProgress.totalAttempts > 0) {
      const now = Date.now()
      const dueCount = allQuestions.filter((q) => {
        const qp = userProgress.questionProgress[q.id]
        return qp && qp.attempts > 0 && SpacedRepetitionService.isDue(qp, now)
      }).length
      NotificationService.showStartupReminder(dueCount)
    }
  }, [])

  return (
    <div className="flex min-h-dvh flex-col bg-claude-cream dark:bg-stone-900">
      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
        <div className="mx-auto w-full sm:max-w-2xl lg:max-w-4xl">
          {/* Resume session banner */}
          <ResumeSessionBanner />

          {/* Header */}
          <MenuHeader
            totalQuestions={allQuestions.length}
            answeredCount={allQuestions.length - incorrectCount}
            hasProgress={userProgress.totalAttempts > 0}
            openWithModes={openMenuWithModes}
            onMenuOpened={() => setOpenMenuWithModes(false)}
          />

          {/* Notification opt-in — shown after user has established a learning habit (3+ sessions) */}
          {userProgress.sessionHistory.length >= 3 && <NotificationOptIn />}

          {/* Daily Snapshot — removes decision paralysis (includes SRS info) */}
          {userProgress.totalAttempts > 0 && !snapshotDismissed && (
            <DailySnapshot onDismiss={() => setSnapshotDismissed(true)} />
          )}

          {/* Quick actions — shown when DailySnapshot is dismissed */}
          {userProgress.totalAttempts > 0 && snapshotDismissed && (
            <QuickActions
              allQuestions={allQuestions}
              userProgress={userProgress}
              onStart={(mode, questionCount) =>
                startSession({ mode, ...(questionCount !== undefined && { questionCount }) })
              }
            />
          )}

          {/* First-time user: simplified entry point */}
          {userProgress.totalAttempts === 0 && <FirstTimeGuide onOpenModes={() => setOpenMenuWithModes(true)} />}

          {/* Quiz mode launcher — for returning users */}
          {userProgress.totalAttempts > 0 && (
            <button
              onClick={() => {
                haptics.light()
                setOpenMenuWithModes(true)
              }}
              className="tap-highlight mb-5 flex w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left dark:border-stone-700 dark:bg-stone-800"
            >
              <span className="text-xl">🎮</span>
              <div className="flex-1">
                <span className="text-sm font-medium text-claude-dark dark:text-stone-200">
                  {locale.menuHeader.quizModesButton}
                </span>
                <p className="text-xs text-stone-500">{locale.menuHeader.quizModesDesc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-stone-300 dark:text-stone-600" />
            </button>
          )}

          {/* Search — shown after first quiz to avoid overwhelming first-time users */}
          {userProgress.totalAttempts > 0 && <QuizSearch />}

          {/* Chapter progress map — hidden for first-time users to reduce cognitive load */}
          {userProgress.totalAttempts > 0 && (
            <ChapterProgressMap
              allQuestions={allQuestions}
              userProgress={userProgress}
              onStartChapter={(_chapterId, startIndex) => startSession({ mode: 'overview' }, { startIndex })}
              onResumeChapter={(questionIds, label) => startSessionWithIds(questionIds, label)}
              onNextStep={() => startSession({ mode: 'full' })}
            />
          )}
        </div>
      </div>
    </div>
  )
}
