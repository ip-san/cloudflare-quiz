import { describe, expect, it } from 'vitest'
import { Question } from '../entities/Question'
import {
  additiveValueScore,
  categoryWeight,
  DEFAULT_CATEGORY_WEIGHT,
  VALUE_TAG_BONUS,
  VALUE_TAG_MULTIPLIER,
} from './ValueScore'

function q(category: string, tags?: string[]): Question {
  return Question.create({
    id: 'q',
    question: 'q',
    options: [{ text: 'A' }, { text: 'B' }],
    correctIndex: 0,
    explanation: 'e',
    category,
    difficulty: 'beginner',
    tags,
  })
}

describe('ValueScore', () => {
  it('returns the category weight from theme', () => {
    expect(categoryWeight('workers')).toBe(15)
    expect(categoryWeight('kv-cache')).toBe(10)
  })

  it('falls back to DEFAULT_CATEGORY_WEIGHT for unknown categories', () => {
    expect(categoryWeight('does-not-exist')).toBe(DEFAULT_CATEGORY_WEIGHT)
  })

  it('additiveValueScore = weight + tag bonus', () => {
    expect(additiveValueScore(q('workers'))).toBe(15) // no tag
    expect(additiveValueScore(q('workers', ['practical']))).toBe(15 + VALUE_TAG_BONUS.practical)
    expect(additiveValueScore(q('workers', ['trivia']))).toBe(15 + VALUE_TAG_BONUS.trivia)
    expect(additiveValueScore(q('kv-cache', ['trivia']))).toBe(10 + VALUE_TAG_BONUS.trivia)
  })

  it('practical outranks neutral outranks trivia at equal weight', () => {
    const practical = additiveValueScore(q('workers', ['practical']))
    const neutral = additiveValueScore(q('workers'))
    const trivia = additiveValueScore(q('workers', ['trivia']))
    expect(practical).toBeGreaterThan(neutral)
    expect(neutral).toBeGreaterThan(trivia)
  })

  // drift 検知: これらの値は scripts/value-constants.mjs に複製されている（TS↔mjs 境界のため）。
  // 値を変える場合は scripts/value-constants.mjs も同時に更新すること（value-constants.test.mjs が検知）。
  it('keeps value-correction constants stable (sync guard for the .mjs duplicate)', () => {
    expect(VALUE_TAG_BONUS).toEqual({ practical: 6, trivia: -4 })
    expect(VALUE_TAG_MULTIPLIER).toEqual({ practical: 1.05, trivia: 0.95 })
    expect(DEFAULT_CATEGORY_WEIGHT).toBe(10)
  })
})
