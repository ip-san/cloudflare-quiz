import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Question } from './Question'
import { QuizSet } from './QuizSet'

describe('QuizSet Entity', () => {
  let mockNow: number

  beforeEach(() => {
    mockNow = 1700000000000
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createTestQuestion = (id: string, category = 'tools', difficulty = 'beginner'): Question => {
    return Question.create({
      id,
      question: `Test question ${id}`,
      options: [{ text: 'Option A' }, { text: 'Option B' }],
      correctIndex: 0,
      explanation: 'Test explanation',
      category,
      difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
    })
  }

  describe('create()', () => {
    it('should create QuizSet with valid data', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2')]
      const quizSet = QuizSet.create({
        id: 'test-set',
        title: 'Test Quiz Set',
        description: 'A test set',
        version: '1.0.0',
        type: 'user',
        questions,
      })

      expect(quizSet.id).toBe('test-set')
      expect(quizSet.title).toBe('Test Quiz Set')
      expect(quizSet.description).toBe('A test set')
      expect(quizSet.version).toBe('1.0.0')
      expect(quizSet.type).toBe('user')
      expect(quizSet.questions).toHaveLength(2)
    })

    it('should use default values for optional fields', () => {
      const questions = [createTestQuestion('q1')]
      const quizSet = QuizSet.create({
        id: 'test-set',
        title: 'Test Quiz Set',
        type: 'user',
        questions,
      })

      expect(quizSet.description).toBe('')
      expect(quizSet.version).toBe('1.0.0')
      expect(quizSet.createdAt).toBe(mockNow)
      expect(quizSet.updatedAt).toBe(mockNow)
    })

    it('should throw error for empty id', () => {
      const questions = [createTestQuestion('q1')]
      expect(() =>
        QuizSet.create({
          id: '',
          title: 'Test',
          type: 'user',
          questions,
        })
      ).toThrow('QuizSet ID is required')
    })

    it('should throw error for empty title', () => {
      const questions = [createTestQuestion('q1')]
      expect(() =>
        QuizSet.create({
          id: 'test',
          title: '',
          type: 'user',
          questions,
        })
      ).toThrow('QuizSet title is required')
    })

    it('should throw error for empty questions', () => {
      expect(() =>
        QuizSet.create({
          id: 'test',
          title: 'Test',
          type: 'user',
          questions: [],
        })
      ).toThrow('QuizSet must have at least one question')
    })

    it('should freeze questions array', () => {
      const questions = [createTestQuestion('q1')]
      const quizSet = QuizSet.create({
        id: 'test',
        title: 'Test',
        type: 'user',
        questions,
      })

      expect(Object.isFrozen(quizSet.questions)).toBe(true)
    })
  })

  describe('createDefault()', () => {
    it('should create default quiz set', () => {
      const data = {
        title: 'Default Quiz',
        description: 'Default description',
        version: '2.0.0',
        quizzes: [
          {
            id: 'q1',
            question: 'Test question',
            options: [{ text: 'A' }, { text: 'B' }],
            correctIndex: 0,
            explanation: 'Test',
            category: 'tools',
            difficulty: 'beginner' as const,
          },
        ],
      }

      const quizSet = QuizSet.createDefault(data)

      expect(quizSet.id).toBe('default')
      expect(quizSet.title).toBe('Default Quiz')
      expect(quizSet.type).toBe('default')
      expect(quizSet.isReadOnly()).toBe(true)
    })

    it('should use default title if not provided', () => {
      const data = {
        quizzes: [
          {
            id: 'q1',
            question: 'Test',
            options: [{ text: 'A' }, { text: 'B' }],
            correctIndex: 0,
            explanation: 'Test',
            category: 'tools',
            difficulty: 'beginner' as const,
          },
        ],
      }

      const quizSet = QuizSet.createDefault(data)

      expect(quizSet.title).toBe('Cloudflare Quiz マスタークイズ')
    })

    it('should filter out invalid questions', () => {
      const data = {
        quizzes: [
          {
            id: 'q1',
            question: 'Valid question',
            options: [{ text: 'A' }, { text: 'B' }],
            correctIndex: 0,
            explanation: 'Test',
            category: 'tools',
            difficulty: 'beginner' as const,
          },
          {
            id: '', // Invalid - empty id
            question: '',
            options: [],
            correctIndex: 0,
            explanation: '',
            category: '',
            difficulty: 'beginner' as const,
          },
        ],
      }

      const quizSet = QuizSet.createDefault(data)

      expect(quizSet.questions).toHaveLength(1)
      expect(quizSet.questions[0].id).toBe('q1')
    })
  })

  describe('isReadOnly()', () => {
    it('should return true for default type', () => {
      const quizSet = QuizSet.create({
        id: 'default',
        title: 'Default',
        type: 'default',
        questions: [createTestQuestion('q1')],
      })

      expect(quizSet.isReadOnly()).toBe(true)
    })

    it('should return false for user type', () => {
      const quizSet = QuizSet.create({
        id: 'user-1',
        title: 'User',
        type: 'user',
        questions: [createTestQuestion('q1')],
      })

      expect(quizSet.isReadOnly()).toBe(false)
    })
  })

  describe('getQuestionsByCategory()', () => {
    it('should return questions matching category', () => {
      const questions = [
        createTestQuestion('q1', 'tools'),
        createTestQuestion('q2', 'memory'),
        createTestQuestion('q3', 'tools'),
      ]
      const quizSet = QuizSet.create({
        id: 'test',
        title: 'Test',
        type: 'user',
        questions,
      })

      const toolsQuestions = quizSet.getQuestionsByCategory('tools')

      expect(toolsQuestions).toHaveLength(2)
      expect(toolsQuestions.every((q) => q.category === 'tools')).toBe(true)
    })

    it('should return empty array for non-existent category', () => {
      const questions = [createTestQuestion('q1', 'tools')]
      const quizSet = QuizSet.create({
        id: 'test',
        title: 'Test',
        type: 'user',
        questions,
      })

      expect(quizSet.getQuestionsByCategory('nonexistent')).toHaveLength(0)
    })
  })

  describe('getQuestionsByDifficulty()', () => {
    it('should return questions matching difficulty', () => {
      const questions = [
        createTestQuestion('q1', 'tools', 'beginner'),
        createTestQuestion('q2', 'tools', 'advanced'),
        createTestQuestion('q3', 'tools', 'beginner'),
      ]
      const quizSet = QuizSet.create({
        id: 'test',
        title: 'Test',
        type: 'user',
        questions,
      })

      const beginnerQuestions = quizSet.getQuestionsByDifficulty('beginner')

      expect(beginnerQuestions).toHaveLength(2)
    })
  })

  describe('getQuestionCount()', () => {
    it('should return correct count', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2'), createTestQuestion('q3')]
      const quizSet = QuizSet.create({
        id: 'test',
        title: 'Test',
        type: 'user',
        questions,
      })

      expect(quizSet.getQuestionCount()).toBe(3)
    })
  })

  describe('getCategories()', () => {
    it('should return unique categories', () => {
      const questions = [
        createTestQuestion('q1', 'tools'),
        createTestQuestion('q2', 'memory'),
        createTestQuestion('q3', 'tools'),
        createTestQuestion('q4', 'skills'),
      ]
      const quizSet = QuizSet.create({
        id: 'test',
        title: 'Test',
        type: 'user',
        questions,
      })

      const categories = quizSet.getCategories()

      expect(categories).toHaveLength(3)
      expect(categories).toContain('tools')
      expect(categories).toContain('memory')
      expect(categories).toContain('skills')
    })
  })

  describe('findQuestion()', () => {
    it('should find existing question', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2')]
      const quizSet = QuizSet.create({
        id: 'test',
        title: 'Test',
        type: 'user',
        questions,
      })

      const found = quizSet.findQuestion('q1')

      expect(found).toBeDefined()
      expect(found?.id).toBe('q1')
    })

    it('should return undefined for non-existent question', () => {
      const questions = [createTestQuestion('q1')]
      const quizSet = QuizSet.create({
        id: 'test',
        title: 'Test',
        type: 'user',
        questions,
      })

      expect(quizSet.findQuestion('nonexistent')).toBeUndefined()
    })
  })

  describe('equals()', () => {
    it('should return true for same id', () => {
      const q = [createTestQuestion('q1')]
      const set1 = QuizSet.create({ id: 'test', title: 'Test 1', type: 'user', questions: q })
      const set2 = QuizSet.create({ id: 'test', title: 'Test 2', type: 'user', questions: q })

      expect(set1.equals(set2)).toBe(true)
    })

    it('should return false for different id', () => {
      const q = [createTestQuestion('q1')]
      const set1 = QuizSet.create({ id: 'test1', title: 'Test', type: 'user', questions: q })
      const set2 = QuizSet.create({ id: 'test2', title: 'Test', type: 'user', questions: q })

      expect(set1.equals(set2)).toBe(false)
    })
  })

  describe('toJSON()', () => {
    it('should return serializable object', () => {
      const questions = [createTestQuestion('q1')]
      const quizSet = QuizSet.create({
        id: 'test',
        title: 'Test',
        description: 'Description',
        version: '1.0.0',
        type: 'user',
        questions,
      })

      const json = quizSet.toJSON()

      expect(json.id).toBe('test')
      expect(json.title).toBe('Test')
      expect(json.description).toBe('Description')
      expect(json.version).toBe('1.0.0')
      expect(json.type).toBe('user')
      expect(json.quizzes).toHaveLength(1)
      expect(json.createdAt).toBe(mockNow)
      expect(json.updatedAt).toBe(mockNow)
    })
  })
})
