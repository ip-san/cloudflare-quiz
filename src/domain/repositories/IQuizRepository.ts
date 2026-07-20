import type { QuizSet } from '../entities/QuizSet'

/**
 * IQuizRepository Interface
 * Defines the contract for quiz data persistence
 * Following DDD, this interface is in the domain layer
 * but implementation is in the infrastructure layer
 */
export interface IQuizRepository {
  /**
   * Get the default (read-only) quiz set
   */
  getDefaultSet(): Promise<QuizSet>

  /**
   * Get the currently active quiz set
   */
  getActiveSet(): Promise<QuizSet>
}
