/**
 * LocalStorageProgressRepository unit tests
 *
 * Tests the localStorage-backed implementation of IProgressRepository.
 * Covers: load, save, reset, export, import — including migration and error paths.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { theme } from '@/config/theme'
import { UserProgress } from '@/domain/entities/UserProgress'
import { LocalStorageProgressRepository } from './LocalStorageProgressRepository'

const STORAGE_KEY = `${theme.storagePrefix}-progress`

/** Build a minimal valid UserProgressProps JSON string */
function buildValidProgressJson(overrides: Record<string, unknown> = {}): string {
  const base = {
    modifiedAt: 1000000,
    questionProgress: {},
    categoryProgress: {},
    totalAttempts: 0,
    totalCorrect: 0,
    streakDays: 0,
    lastSessionAt: 0,
    ...overrides,
  }
  return JSON.stringify(base)
}

describe('LocalStorageProgressRepository', () => {
  let repo: LocalStorageProgressRepository

  beforeEach(() => {
    localStorage.clear()
    repo = new LocalStorageProgressRepository()
  })

  // ----------------------------------------------------------------
  // load()
  // ----------------------------------------------------------------

  describe('load()', () => {
    it('returns empty UserProgress when localStorage has no data', async () => {
      const progress = await repo.load()

      expect(progress.totalAttempts).toBe(0)
      expect(progress.totalCorrect).toBe(0)
      expect(progress.streakDays).toBe(0)
      expect(Object.keys(progress.questionProgress)).toHaveLength(0)
    })

    it('returns UserProgress populated from valid stored data', async () => {
      const stored = buildValidProgressJson({
        totalAttempts: 10,
        totalCorrect: 7,
        streakDays: 3,
        questionProgress: {
          'mem-001': {
            questionId: 'mem-001',
            attempts: 2,
            correctCount: 1,
            lastAttemptAt: 999,
            lastCorrect: true,
          },
        },
      })
      localStorage.setItem(STORAGE_KEY, stored)

      const progress = await repo.load()

      expect(progress.totalAttempts).toBe(10)
      expect(progress.totalCorrect).toBe(7)
      expect(progress.streakDays).toBe(3)
      expect(progress.questionProgress['mem-001']).toBeDefined()
      expect(progress.questionProgress['mem-001'].attempts).toBe(2)
    })

    it('returns empty UserProgress and removes corrupted data when validation fails', async () => {
      // Malformed JSON (not a valid UserProgress object)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ broken: true }))

      const progress = await repo.load()

      expect(progress.totalAttempts).toBe(0)
      // Corrupted data should have been cleared
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('returns empty UserProgress when stored string is not valid JSON', async () => {
      localStorage.setItem(STORAGE_KEY, 'not-json{{{')

      const progress = await repo.load()

      expect(progress.totalAttempts).toBe(0)
    })

    it('passes question IDs through the ID migration pipeline unchanged (empty migration map)', async () => {
      // Cloudflare Codex Quiz has no legacy IDs to migrate (idMigration.ts: ID_MIGRATIONS = {}).
      // This test verifies the migration pipeline still runs during load() without corrupting data.
      const storedWithId = buildValidProgressJson({
        questionProgress: {
          'wk-001': {
            questionId: 'wk-001',
            attempts: 1,
            correctCount: 1,
            lastAttemptAt: 123,
            lastCorrect: true,
          },
        },
      })
      localStorage.setItem(STORAGE_KEY, storedWithId)

      const progress = await repo.load()

      expect(progress.questionProgress['wk-001']).toBeDefined()

      const stored = localStorage.getItem(STORAGE_KEY)
      expect(stored).not.toBeNull()
      expect(stored).toContain('"wk-001"')
    })
  })

  // ----------------------------------------------------------------
  // save()
  // ----------------------------------------------------------------

  describe('save()', () => {
    it('serializes UserProgress to JSON in localStorage', async () => {
      const progress = UserProgress.create({
        modifiedAt: 2000000,
        totalAttempts: 5,
        totalCorrect: 3,
        streakDays: 2,
        lastSessionAt: 1999999,
        questionProgress: {},
        categoryProgress: {},
      })

      await repo.save(progress)

      const raw = localStorage.getItem(STORAGE_KEY)
      expect(raw).not.toBeNull()

      const parsed = JSON.parse(raw!)
      expect(parsed.totalAttempts).toBe(5)
      expect(parsed.totalCorrect).toBe(3)
      expect(parsed.streakDays).toBe(2)
    })

    it('adds a modifiedAt timestamp when saving', async () => {
      const before = Date.now()
      await repo.save(UserProgress.empty())
      const after = Date.now()

      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(raw!)

      expect(parsed.modifiedAt).toBeGreaterThanOrEqual(before)
      expect(parsed.modifiedAt).toBeLessThanOrEqual(after)
    })

    it('overwrites previously saved data', async () => {
      const first = UserProgress.create({
        totalAttempts: 1,
        totalCorrect: 1,
        questionProgress: {},
        categoryProgress: {},
        modifiedAt: 1,
        streakDays: 0,
        lastSessionAt: 0,
      })
      await repo.save(first)

      const second = UserProgress.create({
        totalAttempts: 99,
        totalCorrect: 50,
        questionProgress: {},
        categoryProgress: {},
        modifiedAt: 2,
        streakDays: 0,
        lastSessionAt: 0,
      })
      await repo.save(second)

      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = JSON.parse(raw!)
      expect(parsed.totalAttempts).toBe(99)
    })
  })

  // ----------------------------------------------------------------
  // reset()
  // ----------------------------------------------------------------

  describe('reset()', () => {
    it('replaces existing progress with an empty record in localStorage', async () => {
      // Pre-populate storage
      const stored = buildValidProgressJson({ totalAttempts: 42, totalCorrect: 20 })
      localStorage.setItem(STORAGE_KEY, stored)

      await repo.reset()

      const raw = localStorage.getItem(STORAGE_KEY)
      expect(raw).not.toBeNull()

      const parsed = JSON.parse(raw!)
      expect(parsed.totalAttempts).toBe(0)
      expect(parsed.totalCorrect).toBe(0)
    })

    it('creates a fresh storage entry when localStorage was empty', async () => {
      await repo.reset()

      const raw = localStorage.getItem(STORAGE_KEY)
      expect(raw).not.toBeNull()

      const parsed = JSON.parse(raw!)
      expect(parsed.totalAttempts).toBe(0)
    })
  })

  // ----------------------------------------------------------------
  // export()
  // ----------------------------------------------------------------

  describe('export()', () => {
    it('returns valid JSON string of current progress', async () => {
      const stored = buildValidProgressJson({ totalAttempts: 8, totalCorrect: 5 })
      localStorage.setItem(STORAGE_KEY, stored)

      const exported = await repo.export()

      expect(() => JSON.parse(exported)).not.toThrow()
      const parsed = JSON.parse(exported)
      expect(parsed.totalAttempts).toBe(8)
      expect(parsed.totalCorrect).toBe(5)
    })

    it('returns JSON of empty progress when storage is empty', async () => {
      const exported = await repo.export()

      expect(() => JSON.parse(exported)).not.toThrow()
      const parsed = JSON.parse(exported)
      expect(parsed.totalAttempts).toBe(0)
    })

    it('export → import round-trip preserves data', async () => {
      // Set up initial progress
      const stored = buildValidProgressJson({
        totalAttempts: 15,
        totalCorrect: 10,
        streakDays: 4,
      })
      localStorage.setItem(STORAGE_KEY, stored)

      const exported = await repo.export()

      // Reset and re-import
      localStorage.clear()
      const importResult = await repo.import(exported)
      expect(importResult).toBe(true)

      const reloaded = await repo.load()
      expect(reloaded.totalAttempts).toBe(15)
      expect(reloaded.totalCorrect).toBe(10)
      expect(reloaded.streakDays).toBe(4)
    })
  })

  // ----------------------------------------------------------------
  // import()
  // ----------------------------------------------------------------

  describe('import()', () => {
    it('returns true and saves data when given valid JSON', async () => {
      const validJson = buildValidProgressJson({
        totalAttempts: 20,
        totalCorrect: 18,
        streakDays: 7,
      })

      const result = await repo.import(validJson)

      expect(result).toBe(true)

      const progress = await repo.load()
      expect(progress.totalAttempts).toBe(20)
      expect(progress.totalCorrect).toBe(18)
    })

    it('returns false for invalid JSON string', async () => {
      const result = await repo.import('not valid json {{{')

      expect(result).toBe(false)
    })

    it('returns false for JSON that fails schema validation', async () => {
      // Missing required fields
      const invalidJson = JSON.stringify({ foo: 'bar' })

      const result = await repo.import(invalidJson)

      expect(result).toBe(false)
    })

    it('returns false for JSON with wrong field types', async () => {
      const wrongTypes = JSON.stringify({
        modifiedAt: 'not-a-number',
        questionProgress: {},
        categoryProgress: {},
        totalAttempts: 'five',
        totalCorrect: 0,
        streakDays: 0,
        lastSessionAt: 0,
      })

      const result = await repo.import(wrongTypes)

      expect(result).toBe(false)
    })

    it('does not modify storage when import fails', async () => {
      const validJson = buildValidProgressJson({ totalAttempts: 5 })
      localStorage.setItem(STORAGE_KEY, validJson)

      const result = await repo.import('invalid json')
      expect(result).toBe(false)

      // Original data should be untouched
      const raw = localStorage.getItem(STORAGE_KEY)
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed.totalAttempts).toBe(5)
    })
  })
})
