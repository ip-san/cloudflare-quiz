/**
 * SessionRepository - クイズセッションの途中状態を永続化
 *
 * アプリを閉じても途中のセッションを再開できるようにする。
 * Question エンティティは保存せず、ID のみ保持してサイズを最小化。
 */

import { theme } from '@/config/theme'
import { reportError } from '@/lib/analytics'
import type { QuizSessionConfig } from '../../domain/services/QuizSessionService'
import { migrateQuestionIds as migrateSessionIds } from './idMigration'

const STORAGE_KEY = `${theme.storagePrefix}-session`

export interface SavedAnswerRecord {
  readonly questionIndex: number
  readonly selectedAnswer: number | null
  readonly selectedAnswers: readonly number[]
  readonly isCorrect: boolean
}

export interface SavedSessionData {
  readonly sessionConfig: QuizSessionConfig
  readonly questionIds: string[]
  readonly currentIndex: number
  readonly score: number
  readonly answeredCount: number
  readonly startedAt: number
  readonly wrongAnswers: { questionId: string; selectedAnswer: number; selectedAnswers?: number[] | undefined }[]
  readonly hintsUsedCount: number
  readonly hintUsedOnCurrent: boolean
  readonly savedAt: number
  readonly answerRecords?: SavedAnswerRecord[] | undefined
  readonly scenarioId?: string | undefined
  readonly sessionLabel?: string | undefined
  readonly overviewChapterState?:
    | {
        readonly currentChapterId: number
        readonly chapterPhase: 'intro' | 'questions' | 'complete'
        readonly dismissedIntros: number[]
        readonly dismissedCompletes: number[]
      }
    | undefined
  readonly timeRemaining?: number | null | undefined
}

export class SessionRepository {
  save(data: SavedSessionData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      reportError(error, 'session_save', 'Failed to save session')
    }
  }

  load(): SavedSessionData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return null

      const migrated = migrateSessionIds(stored)
      if (migrated !== stored) {
        localStorage.setItem(STORAGE_KEY, migrated)
      }
      const data = JSON.parse(migrated) as SavedSessionData
      // Validate required fields and types
      if (
        !data.sessionConfig ||
        !Array.isArray(data.questionIds) ||
        data.questionIds.length === 0 ||
        typeof data.currentIndex !== 'number' ||
        data.currentIndex < 0 ||
        data.currentIndex >= data.questionIds.length ||
        typeof data.score !== 'number' ||
        typeof data.answeredCount !== 'number' ||
        typeof data.startedAt !== 'number'
      ) {
        this.clear()
        return null
      }
      return data
    } catch {
      this.clear()
      return null
    }
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  }
}

// Singleton
let sessionRepositoryInstance: SessionRepository | null = null

export function getSessionRepository(): SessionRepository {
  if (!sessionRepositoryInstance) {
    sessionRepositoryInstance = new SessionRepository()
  }
  return sessionRepositoryInstance
}
