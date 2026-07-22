import { Compass, RefreshCw, TrendingUp, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { locale } from '@/config/locale'
import { PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import type { QuizModeId } from '@/domain/valueObjects/QuizMode'
import { calculateAccuracy, MASTERY_THRESHOLD, PASSING_SCORE } from '@/domain/valueObjects/ScoreThresholds'

interface CategoryStat {
  totalQuestions: number
  attemptedQuestions: number
  correctAnswers: number
}

interface LearningRecommendationProps {
  categoryStats: Record<string, CategoryStat>
  totalAttempts: number
  onStartSession: (config: { mode: QuizModeId; categoryFilter?: string | null }) => void
}

/**
 * 学習レコメンドエンジン
 * ユーザーの進捗からパーソナライズされた「次にやるべきこと」を提案
 */
export function LearningRecommendation({ categoryStats, totalAttempts, onStartSession }: LearningRecommendationProps) {
  const recommendation = useMemo(() => {
    if (totalAttempts === 0) return null

    // Find weakest category (lowest accuracy with at least 1 attempt)
    let weakestCat: { id: string; name: string; icon: string; accuracy: number } | null = null
    let strongestCat: { id: string; name: string; accuracy: number } | null = null
    const untouchedCategories: { id: string; name: string; icon: string }[] = []
    let allMastered = true

    for (const category of PREDEFINED_CATEGORIES) {
      const stats = categoryStats[category.id]
      if (!stats || stats.attemptedQuestions === 0) {
        untouchedCategories.push({ id: category.id, name: category.name, icon: category.icon })
        allMastered = false
        continue
      }

      const accuracy = calculateAccuracy(stats.correctAnswers, stats.attemptedQuestions)

      if (accuracy < PASSING_SCORE) allMastered = false

      if (!weakestCat || accuracy < weakestCat.accuracy) {
        weakestCat = { id: category.id, name: category.name, icon: category.icon, accuracy }
      }
      if (!strongestCat || accuracy > strongestCat.accuracy) {
        strongestCat = { id: category.id, name: category.name, accuracy }
      }
    }

    // Priority 1: Untouched categories exist → explore new territory
    if (untouchedCategories.length > 0) {
      const next = untouchedCategories[0]
      return {
        type: 'explore' as const,
        icon: <Compass className="h-5 w-5 text-blue-500" />,
        title: locale.recommendation.newArea,
        message: locale.recommendation.exploreMessage(next.name, next.icon),
        action: locale.recommendation.exploreAction(next.name),
        onAction: () => onStartSession({ mode: 'category', categoryFilter: next.id }),
      }
    }

    // Priority 2: All mastered
    if (allMastered) {
      return {
        type: 'mastered' as const,
        icon: <Trophy className="h-5 w-5 text-yellow-500" />,
        title: locale.recommendation.allMastered,
        message: locale.recommendation.allMasteredMessage,
        action: locale.recommendation.fullTestAction,
        onAction: () => onStartSession({ mode: 'full' }),
      }
    }

    // Priority 3: Weakest category → focused improvement
    if (weakestCat && weakestCat.accuracy < PASSING_SCORE) {
      return {
        type: 'improve' as const,
        icon: <TrendingUp className="h-5 w-5 text-orange-500" />,
        title: locale.recommendation.growthArea,
        message: locale.recommendation.improveMessage(weakestCat.name, weakestCat.icon, weakestCat.accuracy),
        action: locale.recommendation.improveAction(weakestCat.name),
        onAction: () => onStartSession({ mode: 'category', categoryFilter: weakestCat.id }),
      }
    }

    // Priority 4: Advanced mastery push (PASSING_SCORE–MASTERY_THRESHOLD range → push to mastery)
    if (weakestCat && weakestCat.accuracy >= PASSING_SCORE && weakestCat.accuracy < MASTERY_THRESHOLD) {
      return {
        type: 'mastery-push' as const,
        icon: <TrendingUp className="h-5 w-5 text-purple-500" />,
        title: locale.recommendation.expertGoal,
        message: locale.recommendation.masteryMessage(weakestCat.name, weakestCat.icon, weakestCat.accuracy),
        action: locale.recommendation.masteryAction(weakestCat.name),
        onAction: () => onStartSession({ mode: 'category', categoryFilter: weakestCat.id }),
      }
    }

    // Priority 5: General reinforcement
    return {
      type: 'reinforce' as const,
      icon: <RefreshCw className="h-5 w-5 text-green-500" />,
      title: locale.recommendation.retention,
      message: locale.recommendation.retentionMessage,
      action: locale.recommendation.weakModeAction,
      onAction: () => onStartSession({ mode: 'weak' }),
    }
  }, [categoryStats, totalAttempts, onStartSession])

  if (!recommendation) return null

  return (
    <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs dark:bg-stone-800">
          {recommendation.icon}
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{locale.recommendation.heading}</p>
          <p className="mt-0.5 text-sm font-semibold text-cf-ink">{recommendation.title}</p>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">{recommendation.message}</p>
          <button
            onClick={recommendation.onAction}
            className="tap-highlight mt-3 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white"
          >
            {recommendation.action}
          </button>
        </div>
      </div>
    </div>
  )
}
