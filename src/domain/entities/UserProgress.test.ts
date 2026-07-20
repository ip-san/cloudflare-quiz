import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserProgress } from './UserProgress'

describe('UserProgress Entity', () => {
  let mockNow: number

  beforeEach(() => {
    mockNow = 1700000000000 // Fixed timestamp for tests
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('create()', () => {
    it('should create UserProgress with default values', () => {
      const progress = UserProgress.create()

      expect(progress.totalAttempts).toBe(0)
      expect(progress.totalCorrect).toBe(0)
      expect(progress.streakDays).toBe(0)
      expect(progress.modifiedAt).toBe(mockNow)
      expect(Object.keys(progress.questionProgress)).toHaveLength(0)
      expect(Object.keys(progress.categoryProgress)).toHaveLength(0)
    })

    it('should create UserProgress with provided values', () => {
      const progress = UserProgress.create({
        totalAttempts: 10,
        totalCorrect: 7,
        streakDays: 3,
        modifiedAt: 1699999999999,
      })

      expect(progress.totalAttempts).toBe(10)
      expect(progress.totalCorrect).toBe(7)
      expect(progress.streakDays).toBe(3)
      expect(progress.modifiedAt).toBe(1699999999999)
    })
  })

  describe('empty()', () => {
    it('should create empty UserProgress', () => {
      const progress = UserProgress.empty()

      expect(progress.totalAttempts).toBe(0)
      expect(progress.totalCorrect).toBe(0)
      expect(progress.streakDays).toBe(0)
    })
  })

  describe('recordAnswer()', () => {
    it('should record first correct answer', () => {
      const progress = UserProgress.empty()

      const updated = progress.recordAnswer('q1', 'tools', true)

      expect(updated.totalAttempts).toBe(1)
      expect(updated.totalCorrect).toBe(1)
      expect(updated.questionProgress['q1']).toBeDefined()
      expect(updated.questionProgress['q1'].attempts).toBe(1)
      expect(updated.questionProgress['q1'].correctCount).toBe(1)
      expect(updated.questionProgress['q1'].lastCorrect).toBe(true)
    })

    it('should record first incorrect answer', () => {
      const progress = UserProgress.empty()

      const updated = progress.recordAnswer('q1', 'tools', false)

      expect(updated.totalAttempts).toBe(1)
      expect(updated.totalCorrect).toBe(0)
      expect(updated.questionProgress['q1'].attempts).toBe(1)
      expect(updated.questionProgress['q1'].correctCount).toBe(0)
      expect(updated.questionProgress['q1'].lastCorrect).toBe(false)
    })

    it('should accumulate attempts for same question', () => {
      let progress = UserProgress.empty()

      progress = progress.recordAnswer('q1', 'tools', false)
      progress = progress.recordAnswer('q1', 'tools', true)
      progress = progress.recordAnswer('q1', 'tools', true)

      expect(progress.questionProgress['q1'].attempts).toBe(3)
      expect(progress.questionProgress['q1'].correctCount).toBe(2)
      expect(progress.totalAttempts).toBe(3)
      expect(progress.totalCorrect).toBe(2)
    })

    it('should update category progress', () => {
      let progress = UserProgress.empty()

      progress = progress.recordAnswer('q1', 'tools', true)
      progress = progress.recordAnswer('q2', 'tools', false)

      expect(progress.categoryProgress['tools']).toBeDefined()
      expect(progress.categoryProgress['tools'].attemptedQuestions).toBe(2)
      expect(progress.categoryProgress['tools'].correctAnswers).toBe(1)
    })

    it('should not increment attemptedQuestions for repeated attempts on same question', () => {
      let progress = UserProgress.empty()

      progress = progress.recordAnswer('q1', 'tools', true)
      progress = progress.recordAnswer('q1', 'tools', false) // Same question
      progress = progress.recordAnswer('q1', 'tools', true) // Same question

      // attemptedQuestions should only count unique questions
      expect(progress.categoryProgress['tools'].attemptedQuestions).toBe(1)
      // correctAnswers counts unique questions answered correctly (not total correct attempts)
      expect(progress.categoryProgress['tools'].correctAnswers).toBe(1)
    })

    it('should be immutable - original progress unchanged', () => {
      const original = UserProgress.empty()
      const updated = original.recordAnswer('q1', 'tools', true)

      expect(original.totalAttempts).toBe(0)
      expect(updated.totalAttempts).toBe(1)
    })

    it('should update lastSessionAt', () => {
      const progress = UserProgress.empty()
      const updated = progress.recordAnswer('q1', 'tools', true)

      expect(updated.lastSessionAt).toBe(mockNow)
    })
  })

  describe('getOverallAccuracy()', () => {
    it('should return 0 when no attempts', () => {
      const progress = UserProgress.empty()

      expect(progress.getOverallAccuracy()).toBe(0)
    })

    it('should calculate correct accuracy', () => {
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)
      progress = progress.recordAnswer('q2', 'tools', true)
      progress = progress.recordAnswer('q3', 'tools', false)
      progress = progress.recordAnswer('q4', 'tools', false)

      expect(progress.getOverallAccuracy()).toBe(50)
    })

    it('should round accuracy', () => {
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)
      progress = progress.recordAnswer('q2', 'tools', true)
      progress = progress.recordAnswer('q3', 'tools', false)

      // 2/3 = 66.67% -> rounds to 67%
      expect(progress.getOverallAccuracy()).toBe(67)
    })
  })

  describe('getQuestionAccuracy()', () => {
    it('should return null for unattempted question', () => {
      const progress = UserProgress.empty()

      expect(progress.getQuestionAccuracy('q1')).toBeNull()
    })

    it('should return accuracy for attempted question', () => {
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)
      progress = progress.recordAnswer('q1', 'tools', false)

      expect(progress.getQuestionAccuracy('q1')).toBe(50)
    })
  })

  describe('isWeakQuestion()', () => {
    it('should return false for unattempted question', () => {
      const progress = UserProgress.empty()

      expect(progress.isWeakQuestion('q1')).toBe(false)
    })

    it('should return false when attempts below minAttempts', () => {
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', false)

      expect(progress.isWeakQuestion('q1', 50, 2)).toBe(false)
    })

    it('should return true when accuracy below threshold', () => {
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', false)
      progress = progress.recordAnswer('q1', 'tools', false)

      expect(progress.isWeakQuestion('q1', 50, 1)).toBe(true)
    })

    it('should return false when accuracy at or above threshold', () => {
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)
      progress = progress.recordAnswer('q1', 'tools', false)

      // 50% accuracy, threshold 50%
      expect(progress.isWeakQuestion('q1', 50, 1)).toBe(false)
    })

    it('should use default threshold of 50%', () => {
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', false)
      progress = progress.recordAnswer('q1', 'tools', false)
      progress = progress.recordAnswer('q1', 'tools', true)

      // 33% accuracy < 50%
      expect(progress.isWeakQuestion('q1')).toBe(true)
    })
  })

  describe('hasAttempted()', () => {
    it('should return false for unattempted question', () => {
      const progress = UserProgress.empty()

      expect(progress.hasAttempted('q1')).toBe(false)
    })

    it('should return true for attempted question', () => {
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)

      expect(progress.hasAttempted('q1')).toBe(true)
    })
  })

  describe('streak calculation', () => {
    it('should start streak at 1 for first session', () => {
      const progress = UserProgress.empty()
      const updated = progress.recordAnswer('q1', 'tools', true)

      expect(updated.streakDays).toBe(1)
    })

    it('should maintain streak for same day', () => {
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)

      // Same day, different time
      mockNow = mockNow + 3600000 // 1 hour later
      progress = progress.recordAnswer('q2', 'tools', true)

      expect(progress.streakDays).toBe(1)
    })

    it('should increment streak for consecutive days', () => {
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)

      // Next day
      mockNow = mockNow + 86400000 // 1 day later
      vi.spyOn(Date, 'now').mockImplementation(() => mockNow)
      progress = progress.recordAnswer('q2', 'tools', true)

      expect(progress.streakDays).toBe(2)
    })

    it('should reset streak after missing a day', () => {
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)

      // Skip a day (2 days later)
      mockNow = mockNow + 172800000 // 2 days later
      vi.spyOn(Date, 'now').mockImplementation(() => mockNow)
      progress = progress.recordAnswer('q2', 'tools', true)

      expect(progress.streakDays).toBe(1)
    })

    it('should handle month boundary correctly', () => {
      // Set to Jan 31, 2024 20:00 local time
      mockNow = new Date(2024, 0, 31, 20, 0, 0).getTime()
      vi.spyOn(Date, 'now').mockImplementation(() => mockNow)

      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)

      // Move to Feb 1, 2024 08:00 local time (next day, crossing month boundary)
      mockNow = new Date(2024, 1, 1, 8, 0, 0).getTime()
      vi.spyOn(Date, 'now').mockImplementation(() => mockNow)
      progress = progress.recordAnswer('q2', 'tools', true)

      expect(progress.streakDays).toBe(2)
    })

    it('should handle year boundary correctly', () => {
      // Set to Dec 31, 2024 20:00 local time
      mockNow = new Date(2024, 11, 31, 20, 0, 0).getTime()
      vi.spyOn(Date, 'now').mockImplementation(() => mockNow)

      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)

      // Move to Jan 1, 2025 08:00 local time (next day, crossing year boundary)
      mockNow = new Date(2025, 0, 1, 8, 0, 0).getTime()
      vi.spyOn(Date, 'now').mockImplementation(() => mockNow)
      progress = progress.recordAnswer('q2', 'tools', true)

      expect(progress.streakDays).toBe(2)
    })
  })

  describe('toJSON()', () => {
    it('should return serializable object', () => {
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)

      const json = progress.toJSON()

      expect(json.totalAttempts).toBe(1)
      expect(json.totalCorrect).toBe(1)
      expect(json.questionProgress['q1']).toBeDefined()
      expect(json.categoryProgress['tools']).toBeDefined()
    })

    it('should create independent copy', () => {
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)

      const json = progress.toJSON()
      // Cast to mutable type to test that modifying the JSON doesn't affect the original
      ;(json as { totalAttempts: number }).totalAttempts = 999

      expect(progress.totalAttempts).toBe(1)
    })
  })

  describe('bookmarks', () => {
    it('should start with empty bookmarks', () => {
      const progress = UserProgress.create()
      expect(progress.bookmarkedQuestionIds).toEqual([])
    })

    it('should add a bookmark', () => {
      const progress = UserProgress.create()
      const updated = progress.toggleBookmark('q1')

      expect(updated.isBookmarked('q1')).toBe(true)
      expect(updated.bookmarkedQuestionIds).toContain('q1')
    })

    it('should remove a bookmark when toggled again', () => {
      const progress = UserProgress.create()
      const added = progress.toggleBookmark('q1')
      const removed = added.toggleBookmark('q1')

      expect(removed.isBookmarked('q1')).toBe(false)
      expect(removed.bookmarkedQuestionIds).not.toContain('q1')
    })

    it('should not modify original on toggle', () => {
      const original = UserProgress.create()
      const updated = original.toggleBookmark('q1')

      expect(original.isBookmarked('q1')).toBe(false)
      expect(updated.isBookmarked('q1')).toBe(true)
    })

    it('should manage multiple bookmarks', () => {
      let progress = UserProgress.create()
      progress = progress.toggleBookmark('q1')
      progress = progress.toggleBookmark('q2')
      progress = progress.toggleBookmark('q3')

      expect(progress.bookmarkedQuestionIds).toHaveLength(3)
      expect(progress.isBookmarked('q1')).toBe(true)
      expect(progress.isBookmarked('q2')).toBe(true)
      expect(progress.isBookmarked('q3')).toBe(true)
    })

    it('should preserve bookmarks in toJSON', () => {
      let progress = UserProgress.create()
      progress = progress.toggleBookmark('q1')
      progress = progress.toggleBookmark('q2')

      const json = progress.toJSON()
      expect(json.bookmarkedQuestionIds).toEqual(['q1', 'q2'])
    })

    it('should restore bookmarks from create', () => {
      const progress = UserProgress.create({
        bookmarkedQuestionIds: ['q1', 'q2'],
      })

      expect(progress.isBookmarked('q1')).toBe(true)
      expect(progress.isBookmarked('q2')).toBe(true)
      expect(progress.isBookmarked('q3')).toBe(false)
    })

    it('should have frozen bookmarkedQuestionIds', () => {
      const progress = UserProgress.create({
        bookmarkedQuestionIds: ['q1'],
      })

      expect(Object.isFrozen(progress.bookmarkedQuestionIds)).toBe(true)
    })
  })

  describe('immutability', () => {
    it('should have frozen questionProgress', () => {
      const progress = UserProgress.empty()

      expect(Object.isFrozen(progress.questionProgress)).toBe(true)
    })

    it('should have frozen categoryProgress', () => {
      const progress = UserProgress.empty()

      expect(Object.isFrozen(progress.categoryProgress)).toBe(true)
    })
  })
})

describe('XP integration', () => {
  it('starts with 0 XP', () => {
    expect(UserProgress.empty().totalXp).toBe(0)
  })

  it('gains 10 XP on correct first answer', () => {
    const updated = UserProgress.empty().recordAnswer('q1', 'memory', true)
    expect(updated.totalXp).toBe(10)
  })

  it('gains 2 XP on incorrect answer', () => {
    const updated = UserProgress.empty().recordAnswer('q1', 'memory', false)
    expect(updated.totalXp).toBe(2)
  })

  it('gains 15 XP on correct SRS review (previously answered)', () => {
    let progress = UserProgress.empty()
    progress = progress.recordAnswer('q1', 'memory', true)
    const xpAfterFirst = progress.totalXp
    progress = progress.recordAnswer('q1', 'memory', true)
    expect(progress.totalXp - xpAfterFirst).toBe(15) // 10 base + 5 SRS bonus
  })

  it('does not gain XP on retry', () => {
    let progress = UserProgress.empty()
    progress = progress.recordAnswer('q1', 'memory', false)
    const xpBefore = progress.totalXp
    progress = progress.recordAnswer('q1', 'memory', true, true)
    expect(progress.totalXp).toBe(xpBefore)
  })

  it('accumulates XP across multiple answers', () => {
    let progress = UserProgress.empty()
    progress = progress.recordAnswer('q1', 'memory', true) // +10
    progress = progress.recordAnswer('q2', 'tools', true) // +10
    progress = progress.recordAnswer('q3', 'skills', false) // +2
    expect(progress.totalXp).toBe(22)
  })

  it('preserves XP through toJSON/create roundtrip', () => {
    let progress = UserProgress.empty()
    progress = progress.recordAnswer('q1', 'memory', true)
    const restored = UserProgress.create(progress.toJSON())
    expect(restored.totalXp).toBe(progress.totalXp)
  })
})

describe('addXp', () => {
  it('adds XP', () => {
    expect(UserProgress.empty().addXp(50).totalXp).toBe(50)
  })

  it('returns same instance for 0 or negative', () => {
    const progress = UserProgress.create({ totalXp: 100 })
    expect(progress.addXp(0)).toBe(progress)
    expect(progress.addXp(-10)).toBe(progress)
  })
})

describe('recordSession', () => {
  it('should add a session record to sessionHistory', () => {
    const progress = UserProgress.empty()
    const updated = progress.recordSession('random', null, 8, 10)
    expect(updated.sessionHistory.length).toBe(1)
    expect(updated.sessionHistory[0].mode).toBe('random')
    expect(updated.sessionHistory[0].score).toBe(8)
    expect(updated.sessionHistory[0].totalQuestions).toBe(10)
    expect(updated.sessionHistory[0].percentage).toBe(80)
  })

  it('should keep max 100 sessions', () => {
    let progress = UserProgress.empty()
    for (let i = 0; i < 105; i++) {
      progress = progress.recordSession('random', null, 5, 10)
    }
    expect(progress.sessionHistory.length).toBe(100)
  })
})

describe('recordAnswer nextReviewAt', () => {
  it('should set nextReviewAt on recordAnswer', () => {
    const progress = UserProgress.empty()
    const updated = progress.recordAnswer('q1', 'tools', true)
    expect(updated.questionProgress['q1'].nextReviewAt).toBeDefined()
    expect(updated.questionProgress['q1'].nextReviewAt).toBeGreaterThan(Date.now())
  })

  it('should reset SRS streak on wrong answer', () => {
    let progress = UserProgress.empty()
    // Answer correctly 3 times
    for (let i = 0; i < 3; i++) {
      progress = progress.recordAnswer('q1', 'tools', true)
    }
    const longInterval = progress.questionProgress['q1'].nextReviewAt! - Date.now()
    // Answer incorrectly
    progress = progress.recordAnswer('q1', 'tools', false)
    const shortInterval = progress.questionProgress['q1'].nextReviewAt! - Date.now()
    // After wrong answer, interval should be shorter (reset to 1h)
    expect(shortInterval).toBeLessThan(longInterval)
    expect(shortInterval).toBeLessThan(4000000) // < ~1.1 hours
  })
})

describe('dailyAnswerCounts retry handling', () => {
  it('should not increment daily count on retry (non-first attempt)', () => {
    let progress = UserProgress.empty()
    // First attempt
    progress = progress.recordAnswer('q1', 'tools', false)
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const countAfterFirst = progress.dailyAnswerCounts[todayStr] ?? 0
    // Second attempt (retry)
    progress = progress.recordAnswer('q1', 'tools', true)
    const countAfterRetry = progress.dailyAnswerCounts[todayStr] ?? 0
    // Daily count should NOT increment on retry
    expect(countAfterRetry).toBe(countAfterFirst)
  })
})
