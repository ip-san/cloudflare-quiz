import { useMemo } from 'react'
import { locale } from '@/config/locale'
import type { Question } from '@/domain/entities/Question'
import type { UserProgress } from '@/domain/entities/UserProgress'
import { SpacedRepetitionService } from '@/domain/services/SpacedRepetitionService'
import { getQuizModeById, type QuizModeId } from '@/domain/valueObjects/QuizMode'
import { haptics } from '@/lib/haptics'

interface QuickActionsProps {
  allQuestions: readonly Question[]
  userProgress: UserProgress
  onStart: (mode: QuizModeId, questionCount?: number) => void
}

interface QuickAction {
  mode: QuizModeId
  icon: string
  label: string
  sublabel: string
  priority: number
  questionCount?: number
}

export function QuickActions({ allQuestions, userProgress, onStart }: QuickActionsProps) {
  const actions = useMemo(() => {
    const now = Date.now()
    const candidates: QuickAction[] = []

    // SRS due count
    const dueCount = allQuestions.filter((q) => {
      const qp = userProgress.questionProgress[q.id]
      return qp && qp.attempts > 0 && SpacedRepetitionService.isDue(qp, now)
    }).length

    // Weak question count
    const weakCount = allQuestions.filter((q) => userProgress.isWeakQuestion(q.id, 50, 2)).length

    // Bookmarked count
    const bookmarkedCount = userProgress.bookmarkedQuestionIds.length

    const modeName = (id: QuizModeId) => getQuizModeById(id)?.name ?? id

    // SRS review — highest priority when due
    if (dueCount > 0) {
      candidates.push({
        mode: 'quick',
        icon: '⚡',
        label: modeName('quick'),
        sublabel: locale.snapshot.reviewDue(dueCount),
        priority: 100,
        questionCount: dueCount,
      })
    }

    // Random — always available, good default
    candidates.push({
      mode: 'random',
      icon: '🎲',
      label: modeName('random'),
      sublabel: locale.common.approxMinutes,
      priority: 50,
    })

    // Weak mode — when user has weak questions
    // Note: actual session includes prerequisites (beginner questions in weak categories),
    // so session count may exceed weakCount.
    if (weakCount > 0) {
      candidates.push({
        mode: 'weak',
        icon: '🔥',
        label: modeName('weak'),
        sublabel: `${locale.common.questionSuffix}${weakCount}+`,
        priority: 80,
      })
    }

    // Bookmarked
    if (bookmarkedCount > 0) {
      candidates.push({
        mode: 'bookmark',
        icon: '📌',
        label: modeName('bookmark'),
        sublabel: locale.recommend.questionCount(bookmarkedCount),
        priority: 45,
      })
    }

    // Full test — for experienced users
    if (userProgress.totalAttempts >= 50) {
      candidates.push({
        mode: 'full',
        icon: '🎯',
        label: modeName('full'),
        sublabel: getQuizModeById('full')?.description ?? '',
        priority: 30,
      })
    }

    // Sort by priority and take top 3
    return candidates.sort((a, b) => b.priority - a.priority).slice(0, 3)
  }, [allQuestions, userProgress])

  if (actions.length === 0) return null

  return (
    <div className="mb-5">
      <div className={`grid gap-2 ${actions.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {actions.map((action) => (
          <button
            key={action.mode}
            onClick={() => {
              haptics.light()
              onStart(action.mode, action.questionCount)
            }}
            className="tap-highlight flex flex-col items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-3 text-center dark:border-stone-700 dark:bg-stone-800"
          >
            <span className="text-xl">{action.icon}</span>
            <span className="text-xs font-semibold text-claude-dark dark:text-stone-200">{action.label}</span>
            <span className="text-[10px] text-stone-500">{action.sublabel}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
