import { Clock, X, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { locale } from '@/config/locale'
import { theme } from '@/config/theme'
import { DailyGoalService } from '@/domain/services/DailyGoalService'
import { SpacedRepetitionService } from '@/domain/services/SpacedRepetitionService'
import { haptics } from '@/lib/haptics'
import { useQuizStore } from '@/stores/quizStore'

const SNAPSHOT_KEY = `${theme.storagePrefix}-snapshot-dismissed`
const LEGACY_SNAPSHOT_KEY = 'snapshot-dismissed-date'

interface DailySnapshotProps {
  onDismiss: () => void
}

/**
 * デイリースナップショット
 *
 * アプリを開いた瞬間に「今日やるべきこと」を端的に伝える。
 * ストリーク・デイリーゴール・SRS復習をダッシュボードカードに集約。
 * 決断疲れを解消し、即座にアクションに移れるようにする。
 * 1日1回表示、スキップ可能。
 */
export function DailySnapshot({ onDismiss }: DailySnapshotProps) {
  const { userProgress, allQuestions, startSession } = useQuizStore(
    useShallow((state) => ({
      userProgress: state.userProgress,
      allQuestions: state.allQuestions,
      startSession: state.startSession,
    }))
  )

  const snapshot = useMemo(() => {
    const now = Date.now()

    // SRS due count
    const dueCount = allQuestions.filter((q) => {
      const qp = userProgress.questionProgress[q.id]
      return qp && qp.attempts > 0 && SpacedRepetitionService.isDue(qp, now)
    }).length

    // SRS review forecast (next 7 days)
    const forecast: { label: string; count: number }[] = []
    const dayMs = 86400000
    const dayLabels = [locale.snapshot.tomorrow, locale.snapshot.dayAfterTomorrow]
    for (let d = 1; d <= 6; d++) {
      const dayStart = now + dayMs * d
      const dayEnd = dayStart + dayMs
      const count = allQuestions.filter((q) => {
        const qp = userProgress.questionProgress[q.id]
        if (!qp || qp.attempts === 0 || qp.nextReviewAt === undefined) return false
        return qp.nextReviewAt > now && qp.nextReviewAt >= dayStart && qp.nextReviewAt < dayEnd
      }).length
      if (count > 0) {
        const label = d <= 2 ? dayLabels[d - 1] : locale.snapshot.daysLater(d)
        forecast.push({ label, count })
      }
    }

    // Last session time
    const lastSession =
      userProgress.sessionHistory.length > 0
        ? userProgress.sessionHistory[userProgress.sessionHistory.length - 1]
        : null
    const hoursSinceLastSession = lastSession ? Math.round((now - lastSession.completedAt) / 3600000) : null

    return { dueCount, hoursSinceLastSession, forecast }
  }, [userProgress, allQuestions])

  const handleQuickStart = () => {
    haptics.light()
    if (snapshot.dueCount > 0) {
      startSession({ mode: 'quick', questionCount: 3 })
    } else {
      startSession({ mode: 'random', questionCount: 10 })
    }
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(SNAPSHOT_KEY, DailyGoalService.getTodayString())
    } catch {
      /* ignore */
    }
    onDismiss()
  }

  return (
    <section
      className="mb-5 animate-view-enter rounded-2xl border border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50 p-4 dark:border-blue-500/30 dark:from-blue-500/10 dark:to-indigo-500/10"
      aria-label={locale.snapshot.todaysPlan}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{locale.snapshot.todaysPlan}</span>
        </div>
        <button
          onClick={handleDismiss}
          className="tap-highlight rounded-full p-2 text-stone-400"
          aria-label={locale.common.close}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Key stats — SRS focused (goal is in MenuHeader's DailyGoalRing) */}
      <div className="mb-3 space-y-1.5 text-sm text-claude-dark">
        {snapshot.dueCount > 0 ? (
          <p>
            <strong>{locale.snapshot.reviewDueStrong(snapshot.dueCount)}</strong>
          </p>
        ) : snapshot.hoursSinceLastSession === null && snapshot.forecast.length === 0 ? (
          <p className="text-stone-500">{locale.snapshot.noDataMessage}</p>
        ) : null}
        {snapshot.hoursSinceLastSession !== null && (
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-stone-400" />
            <span className="text-xs text-stone-500">
              {locale.snapshot.lastSession}:{' '}
              {snapshot.hoursSinceLastSession < 24
                ? locale.snapshot.hoursAgo(snapshot.hoursSinceLastSession)
                : locale.snapshot.daysAgo(snapshot.hoursSinceLastSession / 24)}
            </span>
          </div>
        )}
        {snapshot.forecast.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="text-xs text-stone-500">📅 {locale.snapshot.forecastLabel}:</span>
            {snapshot.forecast.slice(0, 4).map((f) => (
              <span key={f.label} className="text-xs text-stone-500 dark:text-stone-400">
                {f.label} <strong>{locale.snapshot.forecastCount(f.count)}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {snapshot.dueCount > 0 ? (
        <div className="flex gap-2">
          <button
            onClick={() => {
              haptics.light()
              startSession({ mode: 'quick', questionCount: snapshot.dueCount })
            }}
            className="tap-highlight flex-1 rounded-xl bg-blue-500 py-2.5 text-sm font-semibold text-white"
            aria-label={locale.snapshot.reviewAllLabel(snapshot.dueCount)}
          >
            {locale.snapshot.reviewAll(snapshot.dueCount)}
          </button>
          <button
            onClick={handleQuickStart}
            className="tap-highlight rounded-xl border border-blue-300 px-4 py-2.5 text-sm font-medium text-blue-600 dark:border-blue-500/30 dark:text-blue-400"
            aria-label={locale.snapshot.quickCheckLabel}
          >
            {locale.snapshot.quickCheck}
          </button>
        </div>
      ) : (
        <button
          onClick={handleQuickStart}
          className="tap-highlight w-full rounded-xl bg-blue-500 py-2.5 text-sm font-semibold text-white"
          aria-label={locale.snapshot.randomChallengeLabel}
        >
          {locale.snapshot.randomChallenge}
        </button>
      )}
    </section>
  )
}

/** 今日すでにスナップショットを閉じたか確認 */
export function hasSeenSnapshotToday(): boolean {
  try {
    const today = DailyGoalService.getTodayString()
    return localStorage.getItem(SNAPSHOT_KEY) === today || localStorage.getItem(LEGACY_SNAPSHOT_KEY) === today
  } catch {
    return true
  }
}
