/**
 * Progress Slice - User progress management
 */

import type { Question } from '@/domain/entities/Question'
import { UserProgress } from '@/domain/entities/UserProgress'
import { ProgressExportService } from '@/domain/services/ProgressExportService'
import { PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import type { DifficultyLevel } from '@/domain/valueObjects/Difficulty'
import { calculateAccuracy } from '@/domain/valueObjects/ScoreThresholds'
import { getProgressRepository } from '@/infrastructure'
import { platformAPI } from '@/lib/platformAPI'
import type { StoreGet, StoreSet } from '../utils'

export interface ProgressSlice {
  userProgress: UserProgress

  loadUserProgress: () => Promise<void>
  resetUserProgress: () => Promise<void>
  setDailyGoal: (goal: number) => void
  exportProgressCsv: () => Promise<void>
  getCategoryStats: () => Record<
    string,
    {
      categoryId: string
      totalQuestions: number
      attemptedQuestions: number
      correctAnswers: number
      accuracy: number
    }
  >
  getFilteredQuestions: (categoryId: string | null, difficulty: DifficultyLevel | null) => Question[]
}

export const createProgressSlice = (set: StoreSet, get: StoreGet): ProgressSlice => ({
  userProgress: UserProgress.empty(),

  loadUserProgress: async () => {
    const progress = await getProgressRepository().load()
    set({ userProgress: progress })
  },

  resetUserProgress: async () => {
    await getProgressRepository().reset()
    set({ userProgress: UserProgress.empty() })
  },

  setDailyGoal: (goal) => {
    const state = get()
    const updatedProgress = UserProgress.create({
      ...state.userProgress.toJSON(),
      dailyGoal: goal,
      modifiedAt: Date.now(),
    })
    set({ userProgress: updatedProgress })
    getProgressRepository()
      .save(updatedProgress)
      .catch((error) => {
        console.error('Failed to save daily goal:', error)
      })
  },

  exportProgressCsv: async () => {
    const state = get()
    const dateStr = new Date().toISOString().split('T')[0]
    const questionCsv = ProgressExportService.generateQuestionCsv(state.allQuestions, state.userProgress)
    const categoryCsv = ProgressExportService.generateCategoryCsv(state.allQuestions, state.userProgress)
    const combinedCsv = `${questionCsv}\r\n\r\n--- カテゴリ別サマリー ---\r\n${categoryCsv}`
    await platformAPI.exportCsv(combinedCsv, `quiz-progress-${dateStr}.csv`)
  },

  getCategoryStats: () => {
    const state = get()
    const stats: Record<
      string,
      {
        categoryId: string
        totalQuestions: number
        attemptedQuestions: number
        correctAnswers: number
        accuracy: number
      }
    > = {}

    for (const category of PREDEFINED_CATEGORIES) {
      const categoryQuestions = state.allQuestions.filter((q) => q.category === category.id)
      const attemptedQuestions = categoryQuestions.filter((q) => state.userProgress.hasAttempted(q.id))
      const correctAnswers = attemptedQuestions.filter((q) => state.userProgress.isCorrectlyAnswered(q.id)).length

      stats[category.id] = {
        categoryId: category.id,
        totalQuestions: categoryQuestions.length,
        attemptedQuestions: attemptedQuestions.length,
        correctAnswers,
        accuracy: calculateAccuracy(correctAnswers, attemptedQuestions.length),
      }
    }

    return stats
  },

  getFilteredQuestions: (categoryId, difficulty) => {
    const state = get()
    let questions = state.allQuestions

    if (categoryId) {
      questions = questions.filter((q) => q.category === categoryId)
    }

    if (difficulty) {
      questions = questions.filter((q) => q.difficulty === difficulty)
    }

    return questions
  },
})
