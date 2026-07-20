import { describe, expect, it } from 'vitest'
import { migrateQuestionIds } from './idMigration'

describe('migrateQuestionIds', () => {
  it('returns input unchanged when the migration map is empty', () => {
    const input = JSON.stringify({
      questionProgress: {
        'wk-001': { attempts: 3 },
        'wr-010': { attempts: 1 },
      },
    })
    expect(migrateQuestionIds(input)).toBe(input)
  })

  it('does not modify data without any legacy IDs', () => {
    const input = JSON.stringify({ questionProgress: { 'kv-001': { attempts: 1 } } })
    expect(migrateQuestionIds(input)).toBe(input)
  })

  it('preserves arbitrary JSON content as-is', () => {
    const input = JSON.stringify({
      questionProgress: { 'd1-001': { attempts: 5, correctCount: 3 } },
      bookmarkedQuestionIds: ['r2-001', 'ai-001'],
    })
    expect(migrateQuestionIds(input)).toBe(input)
  })
})
