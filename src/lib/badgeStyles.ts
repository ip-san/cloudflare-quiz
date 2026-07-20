import type { DifficultyLevel } from '@/domain/valueObjects/Difficulty'

const DIFFICULTY_CONFIG: Record<DifficultyLevel, { label: string; style: string }> = {
  beginner: { label: '初級', style: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' },
  intermediate: { label: '中級', style: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300' },
  advanced: { label: '上級', style: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
}

/** 難易度バッジのクラス名を返す */
export function getDifficultyStyle(difficulty: DifficultyLevel): string {
  return DIFFICULTY_CONFIG[difficulty]?.style ?? ''
}

/** 難易度の表示ラベルを返す */
export function getDifficultyLabel(difficulty: DifficultyLevel): string {
  return DIFFICULTY_CONFIG[difficulty]?.label ?? difficulty
}
