import { describe, expect, it } from 'vitest'
import { Question } from '../entities/Question'
import { type QuestionProgress, UserProgress } from '../entities/UserProgress'
import { SpacedRepetitionService } from './SpacedRepetitionService'

const DAY_MS = 86400000

function createQP(overrides: Partial<QuestionProgress> = {}): QuestionProgress {
  return {
    questionId: 'q1',
    attempts: 1,
    correctCount: 1,
    lastAttemptAt: 1000,
    lastCorrect: true,
    ...overrides,
  }
}

function createQuestion(id: string, category = 'workers', tags?: string[]): Question {
  return Question.create({
    id,
    question: `Question ${id}`,
    options: [{ text: 'A' }, { text: 'B', wrongFeedback: 'Wrong' }],
    correctIndex: 0,
    explanation: 'Explanation',
    category,
    difficulty: 'beginner',
    tags,
  })
}

describe('SpacedRepetitionService', () => {
  const now = 1700000000000

  describe('calculateNextReview', () => {
    it('should return now + 1 hour for streak 0', () => {
      expect(SpacedRepetitionService.calculateNextReview(0, now)).toBe(now + 3600000)
    })

    it('should return now + 4 hours for streak 1', () => {
      expect(SpacedRepetitionService.calculateNextReview(1, now)).toBe(now + 14400000)
    })

    it('should return now + 1 day for streak 2', () => {
      expect(SpacedRepetitionService.calculateNextReview(2, now)).toBe(now + DAY_MS)
    })

    it('should return now + 3 days for streak 3', () => {
      expect(SpacedRepetitionService.calculateNextReview(3, now)).toBe(now + 3 * DAY_MS)
    })

    it('should return now + 7 days for streak 4', () => {
      expect(SpacedRepetitionService.calculateNextReview(4, now)).toBe(now + 7 * DAY_MS)
    })

    it('should return now + 14 days for streak 5', () => {
      expect(SpacedRepetitionService.calculateNextReview(5, now)).toBe(now + 14 * DAY_MS)
    })

    it('should return now + 30 days for streak 6', () => {
      expect(SpacedRepetitionService.calculateNextReview(6, now)).toBe(now + 30 * DAY_MS)
    })

    it('should return now + 60 days for streak 7', () => {
      expect(SpacedRepetitionService.calculateNextReview(7, now)).toBe(now + 60 * DAY_MS)
    })

    it('should return now + 90 days for streak 8+', () => {
      expect(SpacedRepetitionService.calculateNextReview(8, now)).toBe(now + 90 * DAY_MS)
      expect(SpacedRepetitionService.calculateNextReview(10, now)).toBe(now + 90 * DAY_MS)
    })
  })

  describe('isDue', () => {
    it('should return true for undefined (never attempted)', () => {
      expect(SpacedRepetitionService.isDue(undefined, now)).toBe(true)
    })

    it('should return true for question with 0 attempts', () => {
      const qp = createQP({ attempts: 0 })
      expect(SpacedRepetitionService.isDue(qp, now)).toBe(true)
    })

    it('should return true when nextReviewAt is undefined', () => {
      const qp = createQP({ nextReviewAt: undefined })
      expect(SpacedRepetitionService.isDue(qp, now)).toBe(true)
    })

    it('should return true when overdue', () => {
      const qp = createQP({ nextReviewAt: now - 1 })
      expect(SpacedRepetitionService.isDue(qp, now)).toBe(true)
    })

    it('should return true when exactly due', () => {
      const qp = createQP({ nextReviewAt: now })
      expect(SpacedRepetitionService.isDue(qp, now)).toBe(true)
    })

    it('should return false when not yet due', () => {
      const qp = createQP({ nextReviewAt: now + DAY_MS })
      expect(SpacedRepetitionService.isDue(qp, now)).toBe(false)
    })
  })

  describe('getDueCount', () => {
    it('should count due questions from progress', () => {
      const progress = UserProgress.create({
        questionProgress: {
          q1: createQP({ questionId: 'q1', nextReviewAt: now - DAY_MS }),
          q2: createQP({ questionId: 'q2', nextReviewAt: now + DAY_MS }),
          q3: createQP({ questionId: 'q3', nextReviewAt: now }),
        },
      })

      expect(SpacedRepetitionService.getDueCount(progress, now)).toBe(2)
    })
  })

  describe('sortByPriority', () => {
    it('should sort most overdue first', () => {
      const q1 = createQuestion('q1')
      const q2 = createQuestion('q2')
      const q3 = createQuestion('q3')

      const progress = UserProgress.create({
        questionProgress: {
          q1: createQP({ questionId: 'q1', nextReviewAt: now - DAY_MS }), // 1 day overdue
          q2: createQP({ questionId: 'q2', nextReviewAt: now - 3 * DAY_MS }), // 3 days overdue
          q3: createQP({ questionId: 'q3', nextReviewAt: now }), // just due
        },
      })

      const sorted = SpacedRepetitionService.sortByPriority([q1, q2, q3], progress, now)
      expect(sorted[0].id).toBe('q2') // Most overdue
      expect(sorted[1].id).toBe('q1')
      expect(sorted[2].id).toBe('q3')
    })

    it('should prioritize overdue questions over never-attempted', () => {
      const q1 = createQuestion('q1')
      const q2 = createQuestion('q2')

      const progress = UserProgress.create({
        questionProgress: {
          q1: createQP({ questionId: 'q1', nextReviewAt: now - DAY_MS }),
          // q2 not in questionProgress → never attempted
        },
      })

      const sorted = SpacedRepetitionService.sortByPriority([q1, q2], progress, now)
      expect(sorted[0].id).toBe('q1') // Overdue questions take priority over unanswered
    })

    it('breaks ties by value: same overdue → higher category weight first', () => {
      const low = createQuestion('low', 'kv-cache') // weight 10
      const high = createQuestion('high', 'workers') // weight 15

      const progress = UserProgress.create({
        questionProgress: {
          low: createQP({ questionId: 'low', nextReviewAt: now - DAY_MS }),
          high: createQP({ questionId: 'high', nextReviewAt: now - DAY_MS }),
        },
      })

      const sorted = SpacedRepetitionService.sortByPriority([low, high], progress, now)
      expect(sorted[0].id).toBe('high') // same overdue, higher value wins the tie-break
    })

    it('value tie-break must not override a clearly more-overdue low-value question', () => {
      const lowButOverdue = createQuestion('lowOverdue', 'kv-cache') // weight 10
      const highButFresh = createQuestion('highFresh', 'workers') // weight 15

      const progress = UserProgress.create({
        questionProgress: {
          lowOverdue: createQP({ questionId: 'lowOverdue', nextReviewAt: now - 10 * DAY_MS }),
          highFresh: createQP({ questionId: 'highFresh', nextReviewAt: now - DAY_MS }),
        },
      })

      const sorted = SpacedRepetitionService.sortByPriority([highButFresh, lowButOverdue], progress, now)
      expect(sorted[0].id).toBe('lowOverdue') // forgetting risk (タイパ) dominates value (コスパ)
    })

    it('keeps a stable order for answered questions with no nextReviewAt (no precision drift)', () => {
      // nextReviewAt 未設定 → 最大優先度(MAX_SAFE_INTEGER)。価値係数を掛けず素通しするため
      // カテゴリ価値が違っても巨大値の浮動小数誤差で順序が揺れないことを保証する。
      const high = createQuestion('high', 'workers') // weight 15
      const low = createQuestion('low', 'kv-cache') // weight 10
      const progress = UserProgress.create({
        questionProgress: {
          high: createQP({ questionId: 'high' }), // nextReviewAt undefined
          low: createQP({ questionId: 'low' }), // nextReviewAt undefined
        },
      })
      const sorted = SpacedRepetitionService.sortByPriority([high, low], progress, now)
      // 入力順を安定保持（係数による追い越しが起きない）
      expect(sorted.map((qq) => qq.id)).toEqual(['high', 'low'])
      const reversed = SpacedRepetitionService.sortByPriority([low, high], progress, now)
      expect(reversed.map((qq) => qq.id)).toEqual(['low', 'high'])
    })

    it('prefers practical-tagged questions over trivia at equal overdue', () => {
      const trivia = createQuestion('trivia', 'workers', ['trivia'])
      const practical = createQuestion('practical', 'workers', ['practical'])

      const progress = UserProgress.create({
        questionProgress: {
          trivia: createQP({ questionId: 'trivia', nextReviewAt: now - DAY_MS }),
          practical: createQP({ questionId: 'practical', nextReviewAt: now - DAY_MS }),
        },
      })

      const sorted = SpacedRepetitionService.sortByPriority([trivia, practical], progress, now)
      expect(sorted[0].id).toBe('practical')
    })
  })
})
