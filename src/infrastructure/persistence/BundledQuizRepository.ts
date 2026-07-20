// Import default quiz data
import defaultQuizData from '../../data/quizzes.json'
import { QuizSet } from '../../domain/entities/QuizSet'
import type { IQuizRepository } from '../../domain/repositories/IQuizRepository'
import { type QuizFileData } from '../validation/QuizValidator'

/**
 * BundledQuizRepository
 * Implementation of IQuizRepository using the bundled default quiz data
 */
export class BundledQuizRepository implements IQuizRepository {
  private defaultSet: QuizSet | null = null

  constructor() {
    try {
      this.initializeDefaultSet()
    } catch (error) {
      console.error('Critical: Failed to initialize default quiz set:', error)
      this.defaultSet = null
    }
  }

  /**
   * Initialize the default quiz set from bundled JSON
   */
  private initializeDefaultSet(): void {
    try {
      this.defaultSet = QuizSet.createDefault(defaultQuizData as QuizFileData)
    } catch (error) {
      console.error('Failed to create default quiz set from bundled data:', error)
      throw error
    }
  }

  /**
   * Get the default (read-only) quiz set
   */
  async getDefaultSet(): Promise<QuizSet> {
    if (!this.defaultSet) {
      try {
        this.initializeDefaultSet()
      } catch (_error) {
        throw new Error('Failed to load default quiz set. The application may need to be reinstalled.')
      }
    }
    if (!this.defaultSet) {
      throw new Error('Default quiz set is unavailable.')
    }
    return this.defaultSet
  }

  /**
   * Get the currently active quiz set (always the default set)
   */
  async getActiveSet(): Promise<QuizSet> {
    return this.getDefaultSet()
  }
}

// Singleton instance
let quizRepositoryInstance: BundledQuizRepository | null = null

export function getQuizRepository(): BundledQuizRepository {
  if (!quizRepositoryInstance) {
    quizRepositoryInstance = new BundledQuizRepository()
  }
  return quizRepositoryInstance
}
