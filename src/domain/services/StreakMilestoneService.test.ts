import { describe, expect, it } from 'vitest'
import { StreakMilestoneService } from './StreakMilestoneService'

describe('StreakMilestoneService', () => {
  describe('getMilestone', () => {
    it('should return 3-day milestone when crossing from 2 to 3', () => {
      const milestone = StreakMilestoneService.getMilestone(3, 2)
      expect(milestone).not.toBeNull()
      expect(milestone!.days).toBe(3)
    })

    it('should return 7-day milestone when crossing from 6 to 7', () => {
      const milestone = StreakMilestoneService.getMilestone(7, 6)
      expect(milestone).not.toBeNull()
      expect(milestone!.days).toBe(7)
    })

    it('should return null when no milestone is crossed', () => {
      expect(StreakMilestoneService.getMilestone(5, 4)).toBeNull()
      expect(StreakMilestoneService.getMilestone(8, 7)).toBeNull()
      expect(StreakMilestoneService.getMilestone(15, 14)).toBeNull()
    })

    it('should return null when streak did not change', () => {
      expect(StreakMilestoneService.getMilestone(7, 7)).toBeNull()
    })

    it('should return null when streak decreased', () => {
      expect(StreakMilestoneService.getMilestone(1, 5)).toBeNull()
    })

    it('should return the highest milestone when crossing multiple', () => {
      // Jumping from 0 to 7 crosses both 3 and 7
      const milestone = StreakMilestoneService.getMilestone(7, 0)
      expect(milestone).not.toBeNull()
      expect(milestone!.days).toBe(7)
    })

    it('should detect all milestone values', () => {
      const milestones = StreakMilestoneService.getAllMilestones()
      for (const ms of milestones) {
        const result = StreakMilestoneService.getMilestone(ms.days, ms.days - 1)
        expect(result).not.toBeNull()
        expect(result!.days).toBe(ms.days)
      }
    })

    it('should return null for 0 streak', () => {
      expect(StreakMilestoneService.getMilestone(0, 0)).toBeNull()
    })
  })

  describe('getStreakLabel', () => {
    it('should return empty for 0 days', () => {
      expect(StreakMilestoneService.getStreakLabel(0)).toBe('')
    })

    it('should return today message for 1 day', () => {
      expect(StreakMilestoneService.getStreakLabel(1)).toBe('今日も学習中！')
    })

    it('should return days for 2+ days', () => {
      expect(StreakMilestoneService.getStreakLabel(5)).toBe('5日連続学習中！')
      expect(StreakMilestoneService.getStreakLabel(30)).toBe('30日連続学習中！')
    })
  })
})
