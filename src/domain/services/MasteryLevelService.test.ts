import { describe, expect, it } from 'vitest'
import { PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import { getMasteryLevel } from './MasteryLevelService'

const emptyCategoryStats = {}

// 実装(MasteryLevelService)と同じ PREDEFINED_CATEGORIES から導出する。
// カテゴリ一覧をハードコードすると、テーマへのカテゴリ追加のたびに
// 「全カテゴリ着手」系のテストが黙って壊れる(2026-07-22 に10カテゴリ化で顕在化)。
function makeCategoryStats(attempted: number, total: number) {
  const stats: Record<string, { attemptedQuestions: number; totalQuestions: number }> = {}
  for (const cat of PREDEFINED_CATEGORIES) {
    stats[cat.id] = { attemptedQuestions: attempted, totalQuestions: total }
  }
  return stats
}

describe('getMasteryLevel', () => {
  it('returns level 0 (入門者) when no attempts', () => {
    const result = getMasteryLevel(0, 0, emptyCategoryStats)
    expect(result.index).toBe(0)
    expect(result.name).toBe('エッジ入門者')
    expect(result.icon).toBe('🌱')
  })

  it('returns level 0 (入門者) when accuracy below 50%', () => {
    const result = getMasteryLevel(30, 10, makeCategoryStats(5, 50))
    expect(result.index).toBe(0)
  })

  it('returns level 1 (学習者) at 50% accuracy', () => {
    const result = getMasteryLevel(50, 10, makeCategoryStats(5, 50))
    expect(result.index).toBe(1)
    expect(result.name).toBe('エッジ学習者')
  })

  it('returns level 2 (実践者) at 70% accuracy', () => {
    const result = getMasteryLevel(70, 20, makeCategoryStats(10, 50))
    expect(result.index).toBe(2)
    expect(result.name).toBe('エッジ実践者')
  })

  it('returns level 3 (推進者) at 80% accuracy with 50%+ categories attempted', () => {
    const result = getMasteryLevel(80, 50, makeCategoryStats(30, 50))
    expect(result.index).toBe(3)
    expect(result.name).toBe('エッジ推進者')
  })

  it('returns level 2 (実践者) at 80% accuracy without enough category coverage', () => {
    // 80% accuracy but less than half categories attempted
    const stats = makeCategoryStats(0, 50)
    stats.workers = { attemptedQuestions: 10, totalQuestions: 50 }
    const result = getMasteryLevel(80, 10, stats)
    expect(result.index).toBe(2) // Falls back to 実践者 (70%+ rule)
  })

  it('returns level 4 (牽引役) at 85% with all categories attempted', () => {
    const result = getMasteryLevel(85, 100, makeCategoryStats(10, 50))
    expect(result.index).toBe(4)
    expect(result.name).toBe('エッジ牽引役')
    expect(result.icon).toBe('👑')
  })

  it('returns level 3 (推進者) at 85% with most categories but not all', () => {
    // 85% accuracy, 7/8 categories attempted, 50%+ questions attempted
    const stats = makeCategoryStats(30, 50) // 240/400 = 60% attempted
    stats['kv-cache'] = { attemptedQuestions: 0, totalQuestions: 50 } // one missing
    const result = getMasteryLevel(85, 100, stats)
    expect(result.index).toBe(3) // 推進者: 80%+ accuracy, 52.5% attempted ratio
  })

  it('handles empty category stats gracefully', () => {
    const result = getMasteryLevel(90, 50, {})
    expect(result.index).toBe(2) // 70%+ but no category data → 実践者
  })
})
