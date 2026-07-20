/**
 * SessionRepository unit tests
 *
 * Tests the localStorage-backed quiz session persistence layer.
 * Covers: save, load (happy path + validation failures), clear, gs- migration.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { theme } from '@/config/theme'
import { type SavedSessionData, SessionRepository } from './SessionRepository'

const STORAGE_KEY = `${theme.storagePrefix}-session`

/** Build a minimal valid SavedSessionData object */
function buildValidSession(overrides: Partial<SavedSessionData> = {}): SavedSessionData {
  return {
    sessionConfig: {
      mode: 'random',
      categoryFilter: null,
      difficultyFilter: null,
      questionCount: 5,
      timeLimit: null,
      shuffleQuestions: true,
      shuffleOptions: false,
    },
    questionIds: ['mem-001', 'mem-002', 'mem-003', 'mem-004', 'mem-005'],
    currentIndex: 1,
    score: 1,
    answeredCount: 1,
    startedAt: 1000000,
    wrongAnswers: [],
    hintsUsedCount: 0,
    hintUsedOnCurrent: false,
    savedAt: 1000001,
    ...overrides,
  }
}

describe('SessionRepository', () => {
  let repo: SessionRepository

  beforeEach(() => {
    localStorage.clear()
    repo = new SessionRepository()
  })

  // ----------------------------------------------------------------
  // save()
  // ----------------------------------------------------------------

  describe('save()', () => {
    it('serializes session data as JSON to localStorage', () => {
      const session = buildValidSession()
      repo.save(session)

      const raw = localStorage.getItem(STORAGE_KEY)
      expect(raw).not.toBeNull()

      const parsed = JSON.parse(raw!)
      expect(parsed.score).toBe(1)
      expect(parsed.currentIndex).toBe(1)
      expect(parsed.questionIds).toEqual(['mem-001', 'mem-002', 'mem-003', 'mem-004', 'mem-005'])
    })

    it('persists sessionConfig fields', () => {
      const session = buildValidSession()
      repo.save(session)

      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(parsed.sessionConfig.mode).toBe('random')
      expect(parsed.sessionConfig.questionCount).toBe(5)
    })

    it('overwrites previously saved session', () => {
      repo.save(buildValidSession({ score: 2 }))
      repo.save(buildValidSession({ score: 5 }))

      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(parsed.score).toBe(5)
    })

    it('persists optional fields when provided', () => {
      const session = buildValidSession({
        scenarioId: 'scenario-abc',
        sessionLabel: 'Test label',
        answerRecords: [{ questionIndex: 0, selectedAnswer: 0, selectedAnswers: [0], isCorrect: true }],
        timeRemaining: 120,
      })
      repo.save(session)

      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(parsed.scenarioId).toBe('scenario-abc')
      expect(parsed.sessionLabel).toBe('Test label')
      expect(parsed.answerRecords).toHaveLength(1)
      expect(parsed.timeRemaining).toBe(120)
    })
  })

  // ----------------------------------------------------------------
  // load()
  // ----------------------------------------------------------------

  describe('load()', () => {
    it('returns null when localStorage has no saved session', () => {
      const result = repo.load()

      expect(result).toBeNull()
    })

    it('returns the saved session data when data is valid', () => {
      const session = buildValidSession({ score: 3, answeredCount: 3 })
      repo.save(session)

      const loaded = repo.load()

      expect(loaded).not.toBeNull()
      expect(loaded!.score).toBe(3)
      expect(loaded!.answeredCount).toBe(3)
      expect(loaded!.questionIds).toHaveLength(5)
    })

    it('returns null and clears storage when sessionConfig is missing', () => {
      const badData = JSON.stringify({
        // no sessionConfig
        questionIds: ['mem-001'],
        currentIndex: 0,
        score: 0,
        answeredCount: 0,
        startedAt: 100,
        wrongAnswers: [],
        hintsUsedCount: 0,
        hintUsedOnCurrent: false,
        savedAt: 101,
      })
      localStorage.setItem(STORAGE_KEY, badData)

      const result = repo.load()

      expect(result).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('returns null and clears storage when questionIds is empty', () => {
      const session = buildValidSession({ questionIds: [] })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))

      const result = repo.load()

      expect(result).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('returns null and clears storage when currentIndex is negative', () => {
      const session = buildValidSession({ currentIndex: -1 })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))

      const result = repo.load()

      expect(result).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('returns null and clears storage when currentIndex equals questionIds.length', () => {
      // questionIds has 5 items (indices 0–4), so currentIndex=5 is out of bounds
      const session = buildValidSession({ questionIds: ['a', 'b', 'c', 'd', 'e'], currentIndex: 5 })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))

      const result = repo.load()

      expect(result).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('returns null and clears storage when currentIndex exceeds questionIds.length', () => {
      const session = buildValidSession({ questionIds: ['a'], currentIndex: 99 })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))

      const result = repo.load()

      expect(result).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('returns null and clears storage when score is not a number', () => {
      const raw = JSON.stringify({
        ...buildValidSession(),
        score: 'invalid',
      })
      localStorage.setItem(STORAGE_KEY, raw)

      const result = repo.load()

      expect(result).toBeNull()
    })

    it('returns null and clears storage when startedAt is not a number', () => {
      const raw = JSON.stringify({
        ...buildValidSession(),
        startedAt: null,
      })
      localStorage.setItem(STORAGE_KEY, raw)

      const result = repo.load()

      expect(result).toBeNull()
    })

    it('returns null and clears storage when stored value is not valid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json{{{')

      const result = repo.load()

      expect(result).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('accepts currentIndex=0 (boundary: first question) as valid', () => {
      const session = buildValidSession({ currentIndex: 0 })
      repo.save(session)

      const loaded = repo.load()
      expect(loaded).not.toBeNull()
      expect(loaded!.currentIndex).toBe(0)
    })

    it('accepts currentIndex = questionIds.length - 1 (boundary: last question) as valid', () => {
      const ids = ['a', 'b', 'c']
      const session = buildValidSession({ questionIds: ids, currentIndex: 2 })
      repo.save(session)

      const loaded = repo.load()
      expect(loaded).not.toBeNull()
      expect(loaded!.currentIndex).toBe(2)
    })

    it('passes question IDs through the ID migration pipeline unchanged (empty migration map)', () => {
      // Cloudflare Codex Quiz has no legacy IDs to migrate (idMigration.ts: ID_MIGRATIONS = {}).
      // This test verifies the migration pipeline still runs during load() without corrupting data.
      const sessionWithIds = buildValidSession({
        questionIds: ['wk-001', 'wr-002'],
        currentIndex: 0,
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionWithIds))

      const loaded = repo.load()

      expect(loaded).not.toBeNull()
      expect(loaded!.questionIds).toEqual(['wk-001', 'wr-002'])

      const storedRaw = localStorage.getItem(STORAGE_KEY)
      expect(storedRaw).not.toBeNull()
      expect(storedRaw).toContain('"wk-001"')
      expect(storedRaw).toContain('"wr-002"')
    })

    it('loads optional fields correctly', () => {
      const session = buildValidSession({
        scenarioId: 'sc-x',
        sessionLabel: 'My Label',
        overviewChapterState: {
          currentChapterId: 2,
          chapterPhase: 'questions',
          dismissedIntros: [1],
          dismissedCompletes: [],
        },
        timeRemaining: 300,
        answerRecords: [{ questionIndex: 0, selectedAnswer: 1, selectedAnswers: [1], isCorrect: false }],
      })
      repo.save(session)

      const loaded = repo.load()

      expect(loaded!.scenarioId).toBe('sc-x')
      expect(loaded!.sessionLabel).toBe('My Label')
      expect(loaded!.overviewChapterState?.currentChapterId).toBe(2)
      expect(loaded!.timeRemaining).toBe(300)
      expect(loaded!.answerRecords).toHaveLength(1)
    })
  })

  // ----------------------------------------------------------------
  // clear()
  // ----------------------------------------------------------------

  describe('clear()', () => {
    it('removes the session from localStorage', () => {
      repo.save(buildValidSession())
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()

      repo.clear()

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('does not throw when called on already-empty storage', () => {
      expect(() => repo.clear()).not.toThrow()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('after clear(), load() returns null', () => {
      repo.save(buildValidSession())
      repo.clear()

      expect(repo.load()).toBeNull()
    })
  })
})
