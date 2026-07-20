import { describe, expect, it } from 'vitest'
import { DailyGoalService } from './DailyGoalService'

describe('DailyGoalService', () => {
  describe('getTodayString', () => {
    it('should return YYYY-MM-DD format', () => {
      const date = new Date(2024, 0, 15) // Jan 15, 2024
      expect(DailyGoalService.getTodayString(date)).toBe('2024-01-15')
    })

    it('should pad single-digit month and day', () => {
      const date = new Date(2024, 2, 5) // Mar 5, 2024
      expect(DailyGoalService.getTodayString(date)).toBe('2024-03-05')
    })

    it('should handle December', () => {
      const date = new Date(2024, 11, 31) // Dec 31, 2024
      expect(DailyGoalService.getTodayString(date)).toBe('2024-12-31')
    })
  })

  describe('getProgress', () => {
    it('should return 0 when count is 0', () => {
      expect(DailyGoalService.getProgress(0, 10)).toBe(0)
    })

    it('should return fraction when partial', () => {
      expect(DailyGoalService.getProgress(5, 10)).toBe(0.5)
    })

    it('should cap at 1.0 when exceeded', () => {
      expect(DailyGoalService.getProgress(15, 10)).toBe(1)
    })

    it('should return 1.0 when exactly at goal', () => {
      expect(DailyGoalService.getProgress(10, 10)).toBe(1)
    })

    it('should return 1 for zero goal', () => {
      expect(DailyGoalService.getProgress(0, 0)).toBe(1)
    })
  })

  describe('isGoalNewlyAchieved', () => {
    it('should return true when crossing the goal', () => {
      expect(DailyGoalService.isGoalNewlyAchieved(9, 10, 10)).toBe(true)
    })

    it('should return true when exceeding the goal', () => {
      expect(DailyGoalService.isGoalNewlyAchieved(9, 12, 10)).toBe(true)
    })

    it('should return false when already past goal', () => {
      expect(DailyGoalService.isGoalNewlyAchieved(10, 11, 10)).toBe(false)
    })

    it('should return false when below goal', () => {
      expect(DailyGoalService.isGoalNewlyAchieved(5, 6, 10)).toBe(false)
    })

    it('should return false when no change', () => {
      expect(DailyGoalService.isGoalNewlyAchieved(9, 9, 10)).toBe(false)
    })
  })
})
