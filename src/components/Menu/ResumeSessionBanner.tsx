import { PlayCircle, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { locale } from '@/config/locale'
import { getQuizModeById } from '@/domain/valueObjects/QuizMode'
import { useQuizStore } from '@/stores/quizStore'

/**
 * 前回の途中セッションがある場合にメニュー画面に表示するバナー
 */
export function ResumeSessionBanner() {
  const { savedSession, resumeSession, discardSavedSession } = useQuizStore(
    useShallow((state) => ({
      savedSession: state.savedSession,
      resumeSession: state.resumeSession,
      discardSavedSession: state.discardSavedSession,
    }))
  )

  if (!savedSession) return null

  const mode = getQuizModeById(savedSession.sessionConfig.mode)
  const hasLabel = savedSession.sessionLabel && savedSession.sessionConfig.mode === 'custom'
  const modeName = hasLabel ? `🔍 ${savedSession.sessionLabel}` : (mode?.name ?? savedSession.sessionConfig.mode)
  const modeIcon = hasLabel ? '🔍' : (mode?.icon ?? '📋')
  const progress = `${savedSession.currentIndex + 1} / ${savedSession.questionIds.length}`
  const scoreText =
    savedSession.answeredCount > 0
      ? `${savedSession.score}/${savedSession.answeredCount}${locale.resumeSession.correctSuffix}`
      : ''

  return (
    <div className="mb-5 animate-slide-down rounded-2xl border border-cf-accent/30 bg-linear-to-r from-cf-accent/10 to-cf-accent/5 p-4 dark:from-cf-accent/15 dark:to-cf-accent/5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xl">{modeIcon}</span>
        <div className="flex-1">
          <span className="text-sm font-semibold text-cf-ink">{locale.resumeSession.hasResume}</span>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {locale.resumeSession.progressText(modeName, progress)}
            {scoreText && ` (${scoreText})`}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={resumeSession}
          className="tap-highlight inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-cf-accent px-4 py-3 text-base font-semibold text-white"
        >
          <PlayCircle className="h-5 w-5" />
          {locale.resumeSession.resumeButton}
        </button>
        <button
          onClick={discardSavedSession}
          className="tap-highlight inline-flex items-center justify-center gap-1.5 rounded-2xl border border-stone-300 px-4 py-3 text-stone-500 dark:border-stone-600 dark:text-stone-400"
          aria-label={locale.resumeSession.discardLabel}
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-sm">{locale.resumeSession.discardButton}</span>
        </button>
      </div>
    </div>
  )
}
