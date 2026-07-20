/**
 * ProgressSlice unit tests — category stats, filtering, daily goal, reset
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { UserProgress } from '@/domain/entities/UserProgress'
import { PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import { useQuizStore } from '../quizStore'

describe('progressSlice', () => {
  beforeEach(async () => {
    localStorage.clear()
    useQuizStore.setState({
      viewState: 'menu',
      sessionState: null,
      sessionWrongAnswers: [],
      savedSession: null,
      userProgress: UserProgress.empty(),
    })
    await useQuizStore.getState().initialize()
  })

  describe('getCategoryStats', () => {
    it('returns stats for all predefined categories', () => {
      const stats = useQuizStore.getState().getCategoryStats()
      for (const cat of PREDEFINED_CATEGORIES) {
        expect(stats[cat.id]).toBeDefined()
        expect(stats[cat.id].categoryId).toBe(cat.id)
      }
    })

    it('shows 0 accuracy when no questions attempted', () => {
      const stats = useQuizStore.getState().getCategoryStats()
      for (const cat of PREDEFINED_CATEGORIES) {
        expect(stats[cat.id].accuracy).toBe(0)
        expect(stats[cat.id].attemptedQuestions).toBe(0)
      }
    })

    it('totalQuestions matches actual question count per category', () => {
      const { allQuestions } = useQuizStore.getState()
      const stats = useQuizStore.getState().getCategoryStats()
      for (const cat of PREDEFINED_CATEGORIES) {
        const expected = allQuestions.filter((q) => q.category === cat.id).length
        expect(stats[cat.id].totalQuestions).toBe(expected)
      }
    })
  })

  describe('getFilteredQuestions', () => {
    it('returns all questions with no filters', () => {
      const all = useQuizStore.getState().getFilteredQuestions(null, null)
      expect(all.length).toBe(useQuizStore.getState().allQuestions.length)
    })

    it('filters by category', () => {
      const filtered = useQuizStore.getState().getFilteredQuestions('workers', null)
      expect(filtered.length).toBeGreaterThan(0)
      expect(filtered.every((q) => q.category === 'workers')).toBe(true)
    })

    it('filters by difficulty', () => {
      const filtered = useQuizStore.getState().getFilteredQuestions(null, 'beginner')
      expect(filtered.length).toBeGreaterThan(0)
      expect(filtered.every((q) => q.difficulty === 'beginner')).toBe(true)
    })

    it('filters by both category and difficulty', () => {
      const filtered = useQuizStore.getState().getFilteredQuestions('workers', 'beginner')
      expect(filtered.every((q) => q.category === 'workers' && q.difficulty === 'beginner')).toBe(true)
    })
  })

  describe('setDailyGoal', () => {
    it('updates dailyGoal in progress', () => {
      useQuizStore.getState().setDailyGoal(10)
      expect(useQuizStore.getState().userProgress.dailyGoal).toBe(10)
    })
  })

  describe('resetUserProgress', () => {
    it('resets to empty progress', async () => {
      // Set a goal first to have non-empty progress
      useQuizStore.getState().setDailyGoal(5)
      expect(useQuizStore.getState().userProgress.dailyGoal).toBe(5)

      await useQuizStore.getState().resetUserProgress()
      const progress = useQuizStore.getState().userProgress
      // dailyGoal resets to default (10), not 0
      expect(progress.dailyGoal).toBe(10)
      expect(Object.keys(progress.questionProgress)).toHaveLength(0)
    })
  })
})
