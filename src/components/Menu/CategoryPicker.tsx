import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { locale } from '@/config/locale'
import { PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import type { QuizModeId } from '@/domain/valueObjects/QuizMode'
import { calculateAccuracy, SCORE_COLORS } from '@/domain/valueObjects/ScoreThresholds'
import { haptics } from '@/lib/haptics'
import { useQuizStore } from '@/stores/quizStore'

interface CategoryPickerProps {
  onClose: () => void
  /** Quiz mode to start (default: 'category') */
  mode?: QuizModeId
  /** Dialog title override */
  title?: string
}

/**
 * カテゴリ選択ダイアログ（ボトムシート）
 * カテゴリ別学習 / 未回答モードで共有
 */
export function CategoryPicker({ onClose, mode = 'category', title }: CategoryPickerProps) {
  const { startSession, getCategoryStats, allQuestions, userProgress } = useQuizStore(
    useShallow((state) => ({
      startSession: state.startSession,
      getCategoryStats: state.getCategoryStats,
      allQuestions: state.allQuestions,
      userProgress: state.userProgress,
    }))
  )
  const categoryStats = getCategoryStats()
  const isUnanswered = mode === 'unanswered'

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? locale.categoryPicker.dialogLabel}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        role="presentation"
      />
      <div className="relative mx-2 mb-2 w-full max-w-sm animate-slide-down rounded-2xl bg-white p-5 shadow-2xl dark:bg-stone-800 sm:mx-4 sm:mb-0 sm:animate-none">
        <h3 className="mb-2 text-center text-lg font-semibold text-claude-dark">
          {title ?? locale.categoryPicker.title}
        </h3>
        {isUnanswered && <UnansweredProgress allQuestions={allQuestions} userProgress={userProgress} />}
        <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
          {PREDEFINED_CATEGORIES.map((cat) => {
            const catStats = categoryStats[cat.id]
            const accuracy = catStats?.accuracy ?? 0
            const attempted = (catStats?.attemptedQuestions ?? 0) > 0

            // Count incorrect/unanswered for this category
            const unansweredCount = isUnanswered
              ? allQuestions.filter((q) => q.category === cat.id && !userProgress.isCorrectlyAnswered(q.id)).length
              : 0

            const disabled = isUnanswered && unansweredCount === 0

            return (
              <button
                key={cat.id}
                onClick={() => {
                  if (disabled) return
                  onClose()
                  haptics.light()
                  startSession({ mode, categoryFilter: cat.id })
                }}
                disabled={disabled}
                className="tap-highlight flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-stone-50 active:bg-stone-100 disabled:opacity-40 dark:hover:bg-stone-700 dark:active:bg-stone-600"
              >
                <span className="text-xl">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-claude-dark">{cat.name}</span>
                  {isUnanswered &&
                    (() => {
                      const catTotal = allQuestions.filter((q) => q.category === cat.id).length
                      const catAnswered = catTotal - unansweredCount
                      const catPct = catTotal > 0 ? Math.round((catAnswered / catTotal) * 100) : 0
                      return (
                        <div className="mt-1">
                          <div className="flex justify-between text-[10px] text-stone-500">
                            <span>
                              {catAnswered}/{catTotal}
                              {locale.common.questionSuffix}
                            </span>
                            <span>{catPct}%</span>
                          </div>
                          <div
                            className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-600"
                            role="progressbar"
                            aria-valuenow={catPct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={locale.menuHeader.categoryLabel(cat.name, catAnswered, catTotal)}
                          >
                            <div
                              className={`h-full rounded-full transition-all ${catPct >= 100 ? 'bg-emerald-500' : 'bg-claude-orange'}`}
                              style={{ width: `${catPct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })()}
                </div>
                {!isUnanswered && attempted && (
                  <span
                    className={`text-xs font-medium ${accuracy >= SCORE_COLORS.excellent ? 'text-emerald-500' : accuracy >= SCORE_COLORS.fair ? 'text-amber-500' : 'text-red-500'}`}
                  >
                    {accuracy}%
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <button
          onClick={onClose}
          className="tap-highlight mt-3 w-full rounded-xl py-3 text-sm font-medium text-stone-500"
        >
          {locale.categoryPicker.cancel}
        </button>
      </div>
    </div>
  )
}

function UnansweredProgress({
  allQuestions,
  userProgress,
}: {
  allQuestions: readonly { id: string }[]
  userProgress: { isCorrectlyAnswered: (id: string) => boolean }
}) {
  const total = allQuestions.length
  const correct = allQuestions.filter((q) => userProgress.isCorrectlyAnswered(q.id)).length
  const pct = calculateAccuracy(correct, total)

  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs text-stone-500">
        <span>
          {correct} / {total} {locale.common.questionSuffix} {locale.menu.answered}
        </span>
        <span>{pct}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={locale.menuHeader.answeredLabel(correct, total)}
      >
        <div className="h-full rounded-full bg-claude-orange transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
