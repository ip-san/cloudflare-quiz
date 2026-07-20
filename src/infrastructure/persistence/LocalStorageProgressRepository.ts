import { theme } from '@/config/theme'
import { reportError } from '@/lib/analytics'
import { UserProgress } from '../../domain/entities/UserProgress'
import type { IProgressRepository } from '../../domain/repositories/IProgressRepository'
import { validateUserProgress } from '../validation/QuizValidator'

import { migrateQuestionIds } from './idMigration'

const STORAGE_KEY = `${theme.storagePrefix}-progress`

/**
 * LocalStorageProgressRepository
 * Implementation of IProgressRepository using localStorage
 */
export class LocalStorageProgressRepository implements IProgressRepository {
  /**
   * Load user progress from localStorage
   */
  async load(): Promise<UserProgress> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return UserProgress.empty()
      }

      const data = migrateQuestionIds(stored)
      if (data !== stored) {
        localStorage.setItem(STORAGE_KEY, data)
      }

      const result = validateUserProgress(data)
      if (!result.success || !result.data) {
        console.warn('Invalid progress data, clearing corrupted data:', result.errors)
        localStorage.removeItem(STORAGE_KEY)
        return UserProgress.empty()
      }

      return UserProgress.create(result.data)
    } catch (error) {
      reportError(error, 'progress_load', 'Failed to load progress')
      return UserProgress.empty()
    }
  }

  /**
   * Save user progress to localStorage
   * @throws Error if save fails (e.g., quota exceeded)
   */
  async save(progress: UserProgress): Promise<void> {
    try {
      const data = {
        ...progress.toJSON(),
        modifiedAt: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      reportError(error, 'progress_save', 'Failed to save progress')
      // Re-throw so callers can handle (e.g., show user notification)
      throw error
    }
  }

  /**
   * Reset all progress
   */
  async reset(): Promise<void> {
    try {
      const emptyProgress = UserProgress.empty()
      await this.save(emptyProgress)
    } catch (error) {
      console.error('Failed to reset progress:', error)
    }
  }

  /**
   * Export progress as JSON string
   */
  async export(): Promise<string> {
    const progress = await this.load()
    return JSON.stringify(progress.toJSON(), null, 2)
  }

  /**
   * Import progress from JSON string
   */
  async import(jsonString: string): Promise<boolean> {
    try {
      const result = validateUserProgress(jsonString)
      if (!result.success || !result.data) {
        return false
      }

      const progress = UserProgress.create(result.data)
      await this.save(progress)
      return true
    } catch {
      return false
    }
  }
}

// Singleton instance
let progressRepositoryInstance: LocalStorageProgressRepository | null = null

export function getProgressRepository(): LocalStorageProgressRepository {
  if (!progressRepositoryInstance) {
    progressRepositoryInstance = new LocalStorageProgressRepository()
  }
  return progressRepositoryInstance
}
