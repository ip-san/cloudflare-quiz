import { describe, expect, it } from 'vitest'
import type { SessionRecord } from '../entities/UserProgress'
import { SessionInsightService } from './SessionInsightService'

function createSession(percentage: number, index: number = 0): SessionRecord {
  return {
    id: String(index),
    completedAt: 1700000000000 + index * 1000,
    mode: 'random',
    categoryFilter: null,
    score: Math.round(percentage / 10),
    totalQuestions: 10,
    percentage,
  }
}

describe('SessionInsightService', () => {
  describe('getImprovementTrend', () => {
    it('should return null with fewer than 6 sessions', () => {
      const history = Array.from({ length: 5 }, (_, i) => createSession(70, i))
      expect(SessionInsightService.getImprovementTrend(history)).toBeNull()
    })

    it('should return positive when improving', () => {
      const history = [
        // Previous 5: avg 60%
        ...Array.from({ length: 5 }, (_, i) => createSession(60, i)),
        // Recent 5: avg 80%
        ...Array.from({ length: 5 }, (_, i) => createSession(80, i + 5)),
      ]
      expect(SessionInsightService.getImprovementTrend(history)).toBe(20)
    })

    it('should return negative when declining', () => {
      const history = [
        ...Array.from({ length: 5 }, (_, i) => createSession(80, i)),
        ...Array.from({ length: 5 }, (_, i) => createSession(60, i + 5)),
      ]
      expect(SessionInsightService.getImprovementTrend(history)).toBe(-20)
    })

    it('should return 0 when no change', () => {
      const history = Array.from({ length: 10 }, (_, i) => createSession(70, i))
      expect(SessionInsightService.getImprovementTrend(history)).toBe(0)
    })

    it('should use only last 10 sessions when more data exists', () => {
      const history = [
        ...Array.from({ length: 20 }, (_, i) => createSession(50, i)),
        ...Array.from({ length: 5 }, (_, i) => createSession(60, i + 20)),
        ...Array.from({ length: 5 }, (_, i) => createSession(80, i + 25)),
      ]
      // last 10: [60,60,60,60,60, 80,80,80,80,80] → trend = 80-60 = 20
      expect(SessionInsightService.getImprovementTrend(history)).toBe(20)
    })
  })

  describe('getBestScore', () => {
    it('should return null for empty history', () => {
      expect(SessionInsightService.getBestScore([])).toBeNull()
    })

    it('should return the highest percentage', () => {
      const history = [createSession(60, 0), createSession(90, 1), createSession(75, 2)]
      expect(SessionInsightService.getBestScore(history)).toBe(90)
    })
  })

  describe('getRecentSessions', () => {
    it('should return last N sessions', () => {
      const history = Array.from({ length: 20 }, (_, i) => createSession(70, i))
      const recent = SessionInsightService.getRecentSessions(history, 5)
      expect(recent).toHaveLength(5)
      expect(recent[0].id).toBe('15')
    })

    it('should return all sessions if fewer than N', () => {
      const history = [createSession(70, 0), createSession(80, 1)]
      const recent = SessionInsightService.getRecentSessions(history, 10)
      expect(recent).toHaveLength(2)
    })
  })
})
