/**
 * ValueScore - 実務価値スコアの共有定数とヘルパー
 *
 * 「高価値スキルを優先的に学ぶ」ための価値補正を一元管理する単一情報源。
 * カテゴリ weight（theme.ts, 5/10/15）と practical/trivia タグ補正を組み合わせる。
 *
 * 用途により合成方法が異なる:
 * - 加点方式（tie-break 用）: AdaptiveDifficultyService の同難易度内並べ替え
 * - 乗法方式（overdue への係数）: SpacedRepetitionService の復習順
 * いずれも weight 既定値とタグ補正の「意味」はここに集約し、係数の散在を防ぐ。
 */

import type { Question } from '../entities/Question'
import { getCategoryById } from './Category'

/** カテゴリ weight 未設定時の既定値（標準カテゴリ相当） */
export const DEFAULT_CATEGORY_WEIGHT = 10

/** practical/trivia タグによる価値補正（加点コンテキスト用の加算値）。tie-break の getValueScore で使用 */
export const VALUE_TAG_BONUS = { practical: 6, trivia: -4 } as const

/** practical/trivia タグによる価値補正（乗法コンテキスト用の係数）。SRS の overdue 係数で使用 */
export const VALUE_TAG_MULTIPLIER = { practical: 1.05, trivia: 0.95 } as const

/** カテゴリの実務価値プロキシ weight を取得（未設定は既定値にフォールバック） */
export function categoryWeight(category: string): number {
  return getCategoryById(category)?.weight ?? DEFAULT_CATEGORY_WEIGHT
}

/**
 * 加点方式の価値スコア（tie-break 用）: weight + タグ補正。
 * 同条件（同難易度スコア等）の問題群を高価値順に並べるための弱いシグナル。
 */
export function additiveValueScore(question: Question): number {
  const tags = question.tags
  const bonus = tags.includes('practical')
    ? VALUE_TAG_BONUS.practical
    : tags.includes('trivia')
      ? VALUE_TAG_BONUS.trivia
      : 0
  return categoryWeight(question.category) + bonus
}
