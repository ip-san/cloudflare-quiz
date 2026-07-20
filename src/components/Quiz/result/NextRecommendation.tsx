import { ArrowRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { locale } from '@/config/locale'
import { PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import type { QuizModeId } from '@/domain/valueObjects/QuizMode'
import { PASSING_SCORE } from '@/domain/valueObjects/ScoreThresholds'
import { haptics } from '@/lib/haptics'
import { useQuizStore } from '@/stores/quizStore'

interface NextRecommendationProps {
  mode: string
  percentage: number
}

/**
 * 結果画面の「次におすすめ」カード
 * 完了したモードとスコアに応じて次のアクションを提案
 */
export function NextRecommendation({ mode, percentage }: NextRecommendationProps) {
  const { allQuestions, getCategoryStats, startSession } = useQuizStore(
    useShallow((state) => ({
      allQuestions: state.allQuestions,
      getCategoryStats: state.getCategoryStats,
      startSession: state.startSession,
    }))
  )
  const categoryStats = getCategoryStats()

  // Find weakest category
  const weakCategory = PREDEFINED_CATEGORIES.map((cat) => ({
    cat,
    accuracy: categoryStats[cat.id]?.accuracy ?? 0,
    attempted: categoryStats[cat.id]?.attemptedQuestions ?? 0,
  }))
    .filter((c) => c.attempted > 0)
    .sort((a, b) => a.accuracy - b.accuracy)[0]

  // Find category with most unanswered
  const mostUnanswered = PREDEFINED_CATEGORIES.map((cat) => {
    const total = allQuestions.filter((q) => q.category === cat.id).length
    const attempted = categoryStats[cat.id]?.attemptedQuestions ?? 0
    return { cat, unanswered: total - attempted }
  })
    .filter((c) => c.unanswered > 0)
    .sort((a, b) => b.unanswered - a.unanswered)[0]

  // Decide recommendation
  let icon: string
  let title: string
  let description: string
  let nextMode: QuizModeId = 'random'
  let categoryFilter: string | undefined

  if (mode === 'overview' && percentage >= PASSING_SCORE) {
    icon = '🏆'
    title = locale.nextRecommend.fullTest
    description = locale.nextRecommend.fullTestDesc
    nextMode = 'full'
  } else if (percentage < 50 && weakCategory) {
    icon = '📖'
    title = locale.recommendation.reviewAction(weakCategory.cat.name)
    description = locale.recommendation.reviewDesc(weakCategory.accuracy)
    nextMode = 'category'
    categoryFilter = weakCategory.cat.id
  } else if (mostUnanswered && mostUnanswered.unanswered > 10) {
    icon = '🗺️'
    title = locale.recommendation.unansweredTitle(mostUnanswered.cat.name, mostUnanswered.unanswered)
    description = locale.nextRecommend.unansweredDesc
    nextMode = 'category'
    categoryFilter = mostUnanswered.cat.id
  } else if (weakCategory && weakCategory.accuracy < PASSING_SCORE) {
    icon = '🎯'
    title = locale.recommendation.strengthenTitle(weakCategory.cat.name)
    description = locale.recommendation.strengthenDesc(weakCategory.accuracy)
    nextMode = 'category'
    categoryFilter = weakCategory.cat.id
  } else {
    icon = '🎲'
    title = locale.nextRecommend.randomTest
    description = locale.nextRecommend.randomTestDesc
    nextMode = 'random'
  }

  return (
    <button
      onClick={() => {
        haptics.light()
        startSession({ mode: nextMode, ...(categoryFilter !== undefined && { categoryFilter }) })
      }}
      aria-label={`${title} — ${description}`}
      className="tap-highlight mb-3 flex w-full items-center gap-3 rounded-2xl border border-claude-orange/30 bg-claude-orange/5 p-4 text-left dark:bg-claude-orange/10"
    >
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-bold text-claude-dark">{title}</p>
        <p className="text-xs text-stone-500">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-claude-orange" />
    </button>
  )
}
