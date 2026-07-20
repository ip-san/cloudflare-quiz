import { describe, expect, it } from 'vitest'
import { ALL_MODE_IDS, getQuizModeById, PREDEFINED_QUIZ_MODES, QuizMode } from './QuizMode'

describe('QuizMode Value Object', () => {
  describe('create()', () => {
    it('should create QuizMode with valid data', () => {
      const mode = QuizMode.create({
        id: 'random',
        name: 'Random Quiz',
        description: 'A random quiz',
        icon: '🎲',
        questionCount: 20,
        timeLimit: 10,
        shuffleQuestions: true,
        shuffleOptions: false,
      })

      expect(mode.id).toBe('random')
      expect(mode.name).toBe('Random Quiz')
      expect(mode.description).toBe('A random quiz')
      expect(mode.icon).toBe('🎲')
      expect(mode.questionCount).toBe(20)
      expect(mode.timeLimit).toBe(10)
      expect(mode.shuffleQuestions).toBe(true)
      expect(mode.shuffleOptions).toBe(false)
    })

    it('should throw error for invalid mode id', () => {
      expect(() =>
        QuizMode.create({
          id: 'invalid' as any,
          name: 'Invalid',
          description: '',
          icon: '',
          questionCount: null,
          timeLimit: null,
          shuffleQuestions: true,
          shuffleOptions: false,
        })
      ).toThrow('Invalid quiz mode: invalid')
    })

    it('should accept all valid mode ids', () => {
      ALL_MODE_IDS.forEach((modeId) => {
        const mode = QuizMode.create({
          id: modeId,
          name: 'Test',
          description: '',
          icon: '',
          questionCount: null,
          timeLimit: null,
          shuffleQuestions: true,
          shuffleOptions: false,
        })
        expect(mode.id).toBe(modeId)
      })
    })
  })

  describe('fromId()', () => {
    it('should return predefined mode by id', () => {
      const mode = QuizMode.fromId('full')

      expect(mode.id).toBe('full')
      expect(mode.name).toBe('実力テスト')
    })

    it('should throw error for unknown id', () => {
      expect(() => QuizMode.fromId('nonexistent' as any)).toThrow('Unknown quiz mode: nonexistent')
    })
  })

  describe('hasTimeLimit()', () => {
    it('should return true when timeLimit is set', () => {
      const mode = QuizMode.fromId('full') // Has 60 minute time limit

      expect(mode.hasTimeLimit()).toBe(true)
    })

    it('should return false when timeLimit is null', () => {
      const mode = QuizMode.fromId('random') // No time limit

      expect(mode.hasTimeLimit()).toBe(false)
    })

    it('should return false when timeLimit is 0', () => {
      const mode = QuizMode.create({
        id: 'custom',
        name: 'Test',
        description: '',
        icon: '',
        questionCount: null,
        timeLimit: 0,
        shuffleQuestions: true,
        shuffleOptions: false,
      })

      expect(mode.hasTimeLimit()).toBe(false)
    })
  })

  describe('hasQuestionLimit()', () => {
    it('should return true when questionCount is set', () => {
      const mode = QuizMode.fromId('random') // Has 20 question limit

      expect(mode.hasQuestionLimit()).toBe(true)
    })

    it('should return true when questionCount is 100', () => {
      const mode = QuizMode.fromId('full') // 100 question limit

      expect(mode.hasQuestionLimit()).toBe(true)
    })

    it('should return false when questionCount is null', () => {
      const mode = QuizMode.fromId('category') // No question limit

      expect(mode.hasQuestionLimit()).toBe(false)
    })

    it('should return false when questionCount is 0', () => {
      const mode = QuizMode.create({
        id: 'custom',
        name: 'Test',
        description: '',
        icon: '',
        questionCount: 0,
        timeLimit: null,
        shuffleQuestions: true,
        shuffleOptions: false,
      })

      expect(mode.hasQuestionLimit()).toBe(false)
    })
  })

  describe('equals()', () => {
    it('should return true for same id', () => {
      const m1 = QuizMode.fromId('random')
      const m2 = QuizMode.fromId('random')

      expect(m1.equals(m2)).toBe(true)
    })

    it('should return false for different id', () => {
      const m1 = QuizMode.fromId('random')
      const m2 = QuizMode.fromId('full')

      expect(m1.equals(m2)).toBe(false)
    })
  })

  describe('toJSON()', () => {
    it('should return serializable object', () => {
      const mode = QuizMode.fromId('random')
      const json = mode.toJSON()

      expect(json.id).toBe('random')
      expect(json.name).toBe('ランダム20問')
      expect(json.questionCount).toBe(20)
      expect(json.timeLimit).toBeNull()
      expect(json.shuffleQuestions).toBe(true)
      expect(json.shuffleOptions).toBe(false)
    })
  })
})

describe('PREDEFINED_QUIZ_MODES', () => {
  it('should have 12 predefined modes', () => {
    expect(PREDEFINED_QUIZ_MODES).toHaveLength(12)
  })

  it('every QuizModeId except custom must have a PREDEFINED entry', () => {
    // custom is dynamic (user-configured), so it's excluded
    const predefinedIds = PREDEFINED_QUIZ_MODES.map((m) => m.id)

    for (const id of ALL_MODE_IDS) {
      if (id === 'custom') continue
      expect(
        predefinedIds,
        `Mode "${id}" is missing from PREDEFINED_QUIZ_MODES — this causes questionCount to inherit from previous session`
      ).toContain(id)
    }
  })

  it('should have unique ids', () => {
    const ids = PREDEFINED_QUIZ_MODES.map((m) => m.id)
    const uniqueIds = [...new Set(ids)]

    expect(ids.length).toBe(uniqueIds.length)
  })

  describe('full mode', () => {
    it('should have correct configuration', () => {
      const mode = getQuizModeById('full')

      expect(mode?.timeLimit).toBe(60)
      expect(mode?.questionCount).toBe(100)
      expect(mode?.shuffleQuestions).toBe(true)
    })
  })

  describe('random mode', () => {
    it('should have correct configuration', () => {
      const mode = getQuizModeById('random')

      expect(mode?.questionCount).toBe(20)
      expect(mode?.timeLimit).toBeNull()
    })
  })

  describe('weak mode', () => {
    it('should have correct configuration', () => {
      const mode = getQuizModeById('weak')

      expect(mode?.questionCount).toBe(20)
      expect(mode?.shuffleQuestions).toBe(true)
    })
  })

  describe('bookmark mode', () => {
    it('should have correct configuration', () => {
      const mode = getQuizModeById('bookmark')

      expect(mode?.questionCount).toBeNull()
      expect(mode?.shuffleQuestions).toBe(true)
      expect(mode?.shuffleOptions).toBe(false)
    })
  })

  describe('review mode', () => {
    it('should have correct configuration', () => {
      const mode = getQuizModeById('review')

      expect(mode?.questionCount).toBeNull()
      expect(mode?.shuffleQuestions).toBe(false)
      expect(mode?.shuffleOptions).toBe(false)
    })
  })

  describe('overview mode', () => {
    it('should have correct configuration', () => {
      const mode = getQuizModeById('overview')

      expect(mode?.questionCount).toBeNull()
      expect(mode?.timeLimit).toBeNull()
      expect(mode?.shuffleQuestions).toBe(false)
      expect(mode?.shuffleOptions).toBe(false)
    })
  })
})

describe('getQuizModeById()', () => {
  it('should find existing mode', () => {
    const mode = getQuizModeById('category')

    expect(mode).toBeDefined()
    expect(mode?.id).toBe('category')
  })

  it('should return undefined for non-existent mode', () => {
    const mode = getQuizModeById('nonexistent' as any)

    expect(mode).toBeUndefined()
  })
})
