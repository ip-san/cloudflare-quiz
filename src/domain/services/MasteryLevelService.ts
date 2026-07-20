import { theme } from '@/config/theme'
import { PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import { PASSING_SCORE, SCORE_COLORS } from '@/domain/valueObjects/ScoreThresholds'

export interface MasteryLevelResult {
  readonly index: number
  readonly name: string
  readonly icon: string
}

export function getMasteryLevel(
  accuracy: number,
  totalAttempts: number,
  categoryStats: Record<string, { attemptedQuestions?: number; totalQuestions?: number }>
): MasteryLevelResult {
  const levels = theme.masteryLevels
  const index = computeIndex(accuracy, totalAttempts, categoryStats)
  const level = levels[index]
  return { index, name: level.name, icon: level.icon }
}

function computeIndex(
  accuracy: number,
  totalAttempts: number,
  categoryStats: Record<string, { attemptedQuestions?: number; totalQuestions?: number }>
): number {
  if (totalAttempts === 0) return 0

  const totalQuestions = PREDEFINED_CATEGORIES.reduce(
    (sum, cat) => sum + (categoryStats[cat.id]?.totalQuestions ?? 0),
    0
  )
  const attemptedQuestions = PREDEFINED_CATEGORIES.reduce(
    (sum, cat) => sum + (categoryStats[cat.id]?.attemptedQuestions ?? 0),
    0
  )
  const attemptedRatio = totalQuestions > 0 ? attemptedQuestions / totalQuestions : 0
  const allCategoriesAttempted = PREDEFINED_CATEGORIES.every(
    (cat) => (categoryStats[cat.id]?.attemptedQuestions ?? 0) > 0
  )

  if (accuracy >= SCORE_COLORS.excellent + 5 && allCategoriesAttempted) return 4
  if (accuracy >= SCORE_COLORS.excellent && attemptedRatio >= 0.5) return 3
  if (accuracy >= PASSING_SCORE) return 2
  if (accuracy >= SCORE_COLORS.fair) return 1
  return 0
}
