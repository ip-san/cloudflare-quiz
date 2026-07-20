/**
 * XpService - 経験値 (XP) とレベル計算サービス
 *
 * 回答ごとにXPを付与し、累積XPからレベルを算出する。
 * 「間違えても成長している」感覚を与えるため、不正解でもXPを付与する。
 */

import type { DifficultyLevel } from '../valueObjects/Difficulty'

/**
 * XP付与量（難易度連動）
 *
 * 「易問を量産するのが最速レベルアップ」という歪んだ最適戦略を防ぐため、
 * 難所(advanced)への挑戦を厚遇する。difficulty は Question 由来の客観属性であり
 * ユーザーが操作できないため、ゲーミング耐性が高い。
 * 既定値 intermediate は従来の正解10/不正解2と一致し、後方互換を保つ。
 */
const XP_CORRECT_BY_DIFFICULTY: Record<DifficultyLevel, number> = {
  beginner: 8,
  intermediate: 10,
  advanced: 14,
}
const XP_INCORRECT_BY_DIFFICULTY: Record<DifficultyLevel, number> = {
  beginner: 2,
  intermediate: 2,
  advanced: 3,
}
const XP_SRS_BONUS = 5 // SRS復習で正解した場合の追加ボーナス
const XP_SCENARIO_COMPLETE = 50

/** レベル定義 */
export interface XpLevel {
  readonly level: number
  readonly name: string
  readonly icon: string
  readonly minXp: number
}

/**
 * XPレベルは「学習量」を表す（マスタリーレベルの「正答率」とは別軸）
 * マスタリーレベル（MasteryLevelService）: 正答率ベースの実力指標
 * XPレベル: 累積学習量ベースの継続指標
 */
const LEVELS: readonly XpLevel[] = [
  { level: 1, name: 'はじめの一歩', icon: '🌱', minXp: 0 },
  { level: 2, name: '学習習慣', icon: '🌿', minXp: 50 },
  { level: 3, name: 'コツコツ型', icon: '🌳', minXp: 150 },
  { level: 4, name: '継続の達人', icon: '⭐', minXp: 400 },
  { level: 5, name: '学びの探求者', icon: '💎', minXp: 800 },
  { level: 6, name: '知識の伝道師', icon: '👑', minXp: 1500 },
  { level: 7, name: 'エキスパート', icon: '🏆', minXp: 3000 },
]

export class XpService {
  /**
   * 回答によるXP付与量を計算
   *
   * @param difficulty 問題の難易度。難所ほど高XP。未指定時は intermediate（従来値）
   */
  static calculateAnswerXp(
    isCorrect: boolean,
    isSrsReview: boolean,
    difficulty: DifficultyLevel = 'intermediate'
  ): number {
    // 不正な difficulty 値（JSON 由来の型外文字列等）でも NaN を永続化しないよう intermediate にフォールバック
    const table = isCorrect ? XP_CORRECT_BY_DIFFICULTY : XP_INCORRECT_BY_DIFFICULTY
    let xp = table[difficulty] ?? table.intermediate
    if (isCorrect && isSrsReview) {
      xp += XP_SRS_BONUS
    }
    return xp
  }

  /**
   * シナリオ完走ボーナスXP
   */
  static getScenarioCompleteXp(): number {
    return XP_SCENARIO_COMPLETE
  }

  /**
   * XPからレベル情報を取得
   */
  static getLevel(totalXp: number): XpLevel {
    const xp = Math.max(totalXp, 0)
    let current = LEVELS[0]
    for (const level of LEVELS) {
      if (xp >= level.minXp) {
        current = level
      } else {
        break
      }
    }
    return current
  }

  /**
   * 次のレベルまでの進捗を計算（0-100%）
   */
  static getProgressToNextLevel(totalXp: number): { percentage: number; currentXp: number; nextXp: number } {
    const current = this.getLevel(totalXp)
    const nextIdx = LEVELS.findIndex((l) => l.level === current.level) + 1

    if (nextIdx >= LEVELS.length) {
      return { percentage: 100, currentXp: totalXp, nextXp: totalXp }
    }

    const next = LEVELS[nextIdx]
    const progressInLevel = totalXp - current.minXp
    const levelRange = next.minXp - current.minXp
    const percentage = Math.min(Math.round((progressInLevel / levelRange) * 100), 100)

    return { percentage, currentXp: totalXp, nextXp: next.minXp }
  }

  /**
   * レベルアップが発生したかを判定
   */
  static checkLevelUp(previousXp: number, newXp: number): XpLevel | null {
    const prevLevel = this.getLevel(previousXp)
    const newLevel = this.getLevel(newXp)
    if (newLevel.level > prevLevel.level) {
      return newLevel
    }
    return null
  }

  /**
   * 全レベル定義を取得
   */
  static getAllLevels(): readonly XpLevel[] {
    return LEVELS
  }
}
