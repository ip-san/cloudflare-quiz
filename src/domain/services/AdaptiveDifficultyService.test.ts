import { describe, expect, it } from 'vitest'
import { Question } from '../entities/Question'
import { UserProgress } from '../entities/UserProgress'
import { AdaptiveDifficultyService } from './AdaptiveDifficultyService'

function makeQuestion(id: string, category: string, difficulty: string, tags?: string[]): Question {
  return Question.create({
    id,
    category,
    difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
    question: `Question ${id}`,
    options: [{ text: 'A' }, { text: 'B', wrongFeedback: 'Wrong' }],
    correctIndex: 0,
    explanation: 'Explanation',
    tags,
  })
}

describe('AdaptiveDifficultyService', () => {
  describe('isAdaptiveReady', () => {
    it('returns false with 0 attempts', () => {
      const progress = UserProgress.empty()
      expect(AdaptiveDifficultyService.isAdaptiveReady(progress)).toBe(false)
    })

    it('returns true with 5+ attempts', () => {
      const progress = UserProgress.create({ totalAttempts: 5 })
      expect(AdaptiveDifficultyService.isAdaptiveReady(progress)).toBe(true)
    })
  })

  describe('reorderByAdaptiveDifficulty', () => {
    it('prioritizes advanced for high-accuracy categories', () => {
      const questions = [
        makeQuestion('q1', 'memory', 'beginner'),
        makeQuestion('q2', 'memory', 'advanced'),
        makeQuestion('q3', 'memory', 'intermediate'),
      ]

      const progress = UserProgress.create({
        totalAttempts: 10,
        categoryProgress: {
          memory: { categoryId: 'memory', totalQuestions: 10, attemptedQuestions: 10, correctAnswers: 9, accuracy: 90 },
        },
      })

      const result = AdaptiveDifficultyService.reorderByAdaptiveDifficulty(questions, progress)
      // Advanced should come first for high accuracy
      expect(result[0].difficulty).toBe('advanced')
    })

    it('prioritizes beginner for low-accuracy categories', () => {
      const questions = [
        makeQuestion('q1', 'tools', 'advanced'),
        makeQuestion('q2', 'tools', 'beginner'),
        makeQuestion('q3', 'tools', 'intermediate'),
      ]

      const progress = UserProgress.create({
        totalAttempts: 10,
        categoryProgress: {
          tools: { categoryId: 'tools', totalQuestions: 10, attemptedQuestions: 10, correctAnswers: 3, accuracy: 30 },
        },
      })

      const result = AdaptiveDifficultyService.reorderByAdaptiveDifficulty(questions, progress)
      // Beginner should come first for low accuracy
      expect(result[0].difficulty).toBe('beginner')
    })

    it('preserves order when no category data exists', () => {
      const questions = [makeQuestion('q1', 'unknown', 'beginner'), makeQuestion('q2', 'unknown', 'advanced')]

      const progress = UserProgress.create({ totalAttempts: 10 })
      const result = AdaptiveDifficultyService.reorderByAdaptiveDifficulty(questions, progress)
      // No reordering expected (all scores are 0)
      expect(result.length).toBe(2)
    })

    it('breaks difficulty-score ties by value when accuracy data exists (higher weight first)', () => {
      // Both categories have data with the same accuracy → same difficulty score → value decides
      const questions = [
        makeQuestion('low', 'kv-cache', 'beginner'), // weight 10
        makeQuestion('high', 'workers', 'beginner'), // weight 15
      ]
      const progress = UserProgress.create({
        totalAttempts: 10,
        categoryProgress: {
          'kv-cache': {
            categoryId: 'kv-cache',
            totalQuestions: 10,
            attemptedQuestions: 5,
            correctAnswers: 4,
            accuracy: 80,
          },
          workers: {
            categoryId: 'workers',
            totalQuestions: 10,
            attemptedQuestions: 5,
            correctAnswers: 4,
            accuracy: 80,
          },
        },
      })
      const result = AdaptiveDifficultyService.reorderByAdaptiveDifficulty(questions, progress)
      expect(result[0].id).toBe('high') // higher-value category surfaces first on a tie
    })

    it('does NOT let value collapse the order when no accuracy data exists (preserves shuffle diversity)', () => {
      // Data-sparse: all difficulty scores are 0 AND no accuracy data → value must be inert,
      // so the incoming (shuffled) order is preserved rather than forced to value-DESC.
      const lowThenHigh = [
        makeQuestion('low', 'kv-cache', 'beginner'), // weight 10
        makeQuestion('high', 'workers', 'beginner', ['practical']), // weight 15 + practical
      ]
      const progress = UserProgress.create({ totalAttempts: 10 }) // no categoryProgress
      const result = AdaptiveDifficultyService.reorderByAdaptiveDifficulty(lowThenHigh, progress)
      expect(result.map((q) => q.id)).toEqual(['low', 'high']) // input order kept, value did NOT reorder
    })

    it('value tie-break never overrides difficulty ordering', () => {
      // High accuracy → advanced prioritized. A high-value beginner must NOT jump the advanced.
      const questions = [
        makeQuestion('beginnerHighValue', 'memory', 'beginner', ['practical']), // weight 15 + practical
        makeQuestion('advancedLowValue', 'sdk', 'advanced'), // weight 5
      ]
      const progress = UserProgress.create({
        totalAttempts: 10,
        categoryProgress: {
          memory: { categoryId: 'memory', totalQuestions: 10, attemptedQuestions: 10, correctAnswers: 9, accuracy: 90 },
          sdk: { categoryId: 'sdk', totalQuestions: 10, attemptedQuestions: 10, correctAnswers: 9, accuracy: 90 },
        },
      })
      const result = AdaptiveDifficultyService.reorderByAdaptiveDifficulty(questions, progress)
      expect(result[0].difficulty).toBe('advanced') // difficulty(タイパ) dominates value(コスパ)
    })

    it('prefers practical over trivia within the same difficulty score (with accuracy data)', () => {
      const questions = [
        makeQuestion('trivia', 'workers', 'beginner', ['trivia']),
        makeQuestion('practical', 'workers', 'beginner', ['practical']),
      ]
      const progress = UserProgress.create({
        totalAttempts: 10,
        categoryProgress: {
          workers: {
            categoryId: 'workers',
            totalQuestions: 10,
            attemptedQuestions: 5,
            correctAnswers: 4,
            accuracy: 80,
          },
        },
      })
      const result = AdaptiveDifficultyService.reorderByAdaptiveDifficulty(questions, progress)
      expect(result[0].id).toBe('practical')
    })
  })
})
