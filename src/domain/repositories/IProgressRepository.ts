import type { UserProgress } from '../entities/UserProgress'

/**
 * IProgressRepository Interface
 * Defines the contract for user progress persistence
 */
export interface IProgressRepository {
  /**
   * Load user progress
   */
  load(): Promise<UserProgress>

  /**
   * Save user progress
   */
  save(progress: UserProgress): Promise<void>

  /**
   * Reset all progress
   */
  reset(): Promise<void>

  /**
   * Export progress as JSON string
   */
  export(): Promise<string>

  /**
   * Import progress from JSON string
   * Returns true if successful, false otherwise
   */
  import(jsonString: string): Promise<boolean>
}
