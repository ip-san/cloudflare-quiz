import { describe, expect, it } from 'vitest'
import {
  QuizFileSchema,
  QuizItemSchema,
  validateQuizFile,
  validateQuizSetStorage,
  validateUserProgress,
} from './QuizValidator'

/** Minimal valid diagrams fixture for test quiz items */
const TEST_DIAGRAMS = [
  {
    type: 'flow' as const,
    steps: [
      { text: 'A', sub: '' },
      { text: 'B', sub: '' },
    ],
  },
  {
    type: 'comparison' as const,
    columns: [
      { heading: 'X', items: ['a'] },
      { heading: 'Y', items: ['b'] },
    ],
  },
]

describe('QuizValidator', () => {
  describe('validateQuizFile()', () => {
    it('should validate valid quiz file JSON', () => {
      const validJson = JSON.stringify({
        title: 'Test Quiz',
        description: 'A test quiz',
        version: '1.0.0',
        quizzes: [
          {
            id: 'q1',
            question: 'What is Claude Code?',
            options: [{ text: 'A CLI tool' }, { text: 'A web app' }],
            correctIndex: 0,
            explanation: 'Claude Code is a CLI tool.',
            category: 'tools',
            difficulty: 'beginner',
            diagrams: TEST_DIAGRAMS,
          },
        ],
      })

      const result = validateQuizFile(validJson)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.title).toBe('Test Quiz')
      expect(result.data?.quizzes).toHaveLength(1)
    })

    it('should accept array format (quizzes only)', () => {
      const arrayJson = JSON.stringify([
        {
          id: 'q1',
          question: 'Test question',
          options: [{ text: 'A' }, { text: 'B' }],
          correctIndex: 0,
          explanation: 'Test',
          category: 'tools',
          difficulty: 'beginner',
          diagrams: TEST_DIAGRAMS,
        },
      ])

      const result = validateQuizFile(arrayJson)

      expect(result.success).toBe(true)
      expect(result.data?.quizzes).toHaveLength(1)
    })

    it('should reject invalid JSON', () => {
      const result = validateQuizFile('not valid json')

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Invalid JSON format')
    })

    it('should reject empty quizzes array', () => {
      const json = JSON.stringify({ quizzes: [] })

      const result = validateQuizFile(json)

      expect(result.success).toBe(false)
      expect(result.errors?.some((e) => e.includes('At least one quiz'))).toBe(true)
    })

    it('should reject quiz with missing required fields', () => {
      const json = JSON.stringify({
        quizzes: [
          {
            id: 'q1',
            // missing question, options, etc.
          },
        ],
      })

      const result = validateQuizFile(json)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
    })

    it('should reject quiz with less than 2 options', () => {
      const json = JSON.stringify({
        quizzes: [
          {
            id: 'q1',
            question: 'Test',
            options: [{ text: 'Only one' }],
            correctIndex: 0,
            explanation: 'Test',
            category: 'tools',
            difficulty: 'beginner',
            diagrams: TEST_DIAGRAMS,
          },
        ],
      })

      const result = validateQuizFile(json)

      expect(result.success).toBe(false)
      expect(result.errors?.some((e) => e.includes('At least 2 options'))).toBe(true)
    })

    it('should reject quiz with more than 6 options', () => {
      const json = JSON.stringify({
        quizzes: [
          {
            id: 'q1',
            question: 'Test',
            options: Array(7).fill({ text: 'Option' }),
            correctIndex: 0,
            explanation: 'Test',
            category: 'tools',
            difficulty: 'beginner',
            diagrams: TEST_DIAGRAMS,
          },
        ],
      })

      const result = validateQuizFile(json)

      expect(result.success).toBe(false)
      expect(result.errors?.some((e) => e.includes('Maximum 6 options'))).toBe(true)
    })

    it('should reject quiz with invalid correctIndex', () => {
      const json = JSON.stringify({
        quizzes: [
          {
            id: 'q1',
            question: 'Test',
            options: [{ text: 'A' }, { text: 'B' }],
            correctIndex: 5, // Out of bounds
            explanation: 'Test',
            category: 'tools',
            difficulty: 'beginner',
            diagrams: TEST_DIAGRAMS,
          },
        ],
      })

      const result = validateQuizFile(json)

      expect(result.success).toBe(false)
      expect(result.errors?.some((e) => e.includes('must be within options array bounds'))).toBe(true)
    })

    it('should reject quiz with invalid difficulty', () => {
      const json = JSON.stringify({
        quizzes: [
          {
            id: 'q1',
            question: 'Test',
            options: [{ text: 'A' }, { text: 'B' }],
            correctIndex: 0,
            explanation: 'Test',
            category: 'tools',
            difficulty: 'expert', // Invalid
            diagrams: TEST_DIAGRAMS,
          },
        ],
      })

      const result = validateQuizFile(json)

      expect(result.success).toBe(false)
    })

    it('should reject quiz with invalid referenceUrl', () => {
      const json = JSON.stringify({
        quizzes: [
          {
            id: 'q1',
            question: 'Test',
            options: [{ text: 'A' }, { text: 'B' }],
            correctIndex: 0,
            explanation: 'Test',
            category: 'tools',
            difficulty: 'beginner',
            diagrams: TEST_DIAGRAMS,
            referenceUrl: 'not-a-url',
          },
        ],
      })

      const result = validateQuizFile(json)

      expect(result.success).toBe(false)
      expect(result.errors?.some((e) => e.includes('valid URL'))).toBe(true)
    })

    it('should accept optional fields', () => {
      const json = JSON.stringify({
        title: 'Test',
        description: 'Description',
        version: '2.0.0',
        quizzes: [
          {
            id: 'q1',
            question: 'Test',
            options: [{ text: 'A', wrongFeedback: 'Wrong!' }, { text: 'B' }],
            correctIndex: 1,
            explanation: 'Test',
            category: 'tools',
            difficulty: 'advanced',
            diagrams: TEST_DIAGRAMS,
            referenceUrl: 'https://example.com',
            aiPrompt: 'Custom prompt',
            tags: ['tag1', 'tag2'],
          },
        ],
      })

      const result = validateQuizFile(json)

      expect(result.success).toBe(true)
      expect(result.data?.quizzes[0].referenceUrl).toBe('https://example.com')
      expect(result.data?.quizzes[0].tags).toEqual(['tag1', 'tag2'])
    })
  })

  describe('validateUserProgress()', () => {
    it('should validate valid user progress JSON', () => {
      const validJson = JSON.stringify({
        modifiedAt: 1700000000000,
        questionProgress: {
          q1: {
            questionId: 'q1',
            attempts: 5,
            correctCount: 3,
            lastAttemptAt: 1700000000000,
            lastCorrect: true,
          },
        },
        categoryProgress: {
          tools: {
            categoryId: 'tools',
            totalQuestions: 10,
            attemptedQuestions: 5,
            correctAnswers: 3,
            accuracy: 60,
          },
        },
        totalAttempts: 5,
        totalCorrect: 3,
        streakDays: 2,
        lastSessionAt: 1700000000000,
      })

      const result = validateUserProgress(validJson)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.totalAttempts).toBe(5)
    })

    it('should reject invalid JSON', () => {
      const result = validateUserProgress('not json')

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Invalid JSON format')
    })

    it('should reject negative values', () => {
      const json = JSON.stringify({
        modifiedAt: 1700000000000,
        questionProgress: {},
        categoryProgress: {},
        totalAttempts: -1, // Invalid
        totalCorrect: 0,
        streakDays: 0,
        lastSessionAt: 0,
      })

      const result = validateUserProgress(json)

      expect(result.success).toBe(false)
    })

    it('should reject accuracy over 100', () => {
      const json = JSON.stringify({
        modifiedAt: 1700000000000,
        questionProgress: {},
        categoryProgress: {
          tools: {
            categoryId: 'tools',
            totalQuestions: 10,
            attemptedQuestions: 5,
            correctAnswers: 3,
            accuracy: 150, // Invalid
          },
        },
        totalAttempts: 5,
        totalCorrect: 3,
        streakDays: 0,
        lastSessionAt: 0,
      })

      const result = validateUserProgress(json)

      expect(result.success).toBe(false)
    })

    it('should validate empty progress', () => {
      const json = JSON.stringify({
        modifiedAt: 1700000000000,
        questionProgress: {},
        categoryProgress: {},
        totalAttempts: 0,
        totalCorrect: 0,
        streakDays: 0,
        lastSessionAt: 0,
      })

      const result = validateUserProgress(json)

      expect(result.success).toBe(true)
    })
  })

  describe('validateQuizSetStorage()', () => {
    it('should validate valid quiz set storage data', () => {
      const validData = {
        id: 'test-set',
        title: 'Test Set',
        description: 'A test set',
        version: '1.0.0',
        type: 'user',
        quizzes: [
          {
            id: 'q1',
            question: 'Test',
            options: [{ text: 'A' }, { text: 'B' }],
            correctIndex: 0,
            explanation: 'Test',
            category: 'tools',
            difficulty: 'beginner',
            diagrams: TEST_DIAGRAMS,
          },
        ],
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }

      const result = validateQuizSetStorage(validData)

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('test-set')
      expect(result.data?.type).toBe('user')
    })

    it('should accept default type', () => {
      const data = {
        id: 'default',
        title: 'Default Set',
        type: 'default',
        quizzes: [
          {
            id: 'q1',
            question: 'Test',
            options: [{ text: 'A' }, { text: 'B' }],
            correctIndex: 0,
            explanation: 'Test',
            category: 'tools',
            difficulty: 'beginner',
            diagrams: TEST_DIAGRAMS,
          },
        ],
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }

      const result = validateQuizSetStorage(data)

      expect(result.success).toBe(true)
      expect(result.data?.type).toBe('default')
    })

    it('should reject invalid type', () => {
      const data = {
        id: 'test',
        title: 'Test',
        type: 'invalid',
        quizzes: [
          {
            id: 'q1',
            question: 'Test',
            options: [{ text: 'A' }, { text: 'B' }],
            correctIndex: 0,
            explanation: 'Test',
            category: 'tools',
            difficulty: 'beginner',
            diagrams: TEST_DIAGRAMS,
          },
        ],
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }

      const result = validateQuizSetStorage(data)

      expect(result.success).toBe(false)
    })

    it('should reject missing required fields', () => {
      const data = {
        id: 'test',
        // missing title, type, quizzes, etc.
      }

      const result = validateQuizSetStorage(data)

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })
  })
})

describe('QuizItemSchema', () => {
  it('should validate complete quiz item', () => {
    const item = {
      id: 'q1',
      question: 'What is Claude?',
      options: [
        { text: 'An AI assistant', wrongFeedback: 'Correct!' },
        { text: 'A car', wrongFeedback: "No, that's wrong" },
      ],
      correctIndex: 0,
      explanation: 'Claude is an AI assistant by Anthropic.',
      referenceUrl: 'https://anthropic.com',
      aiPrompt: 'Explain Claude in detail.',
      category: 'tools',
      difficulty: 'beginner',
      diagrams: TEST_DIAGRAMS,
      tags: ['ai', 'assistant'],
    }

    const result = QuizItemSchema.safeParse(item)

    expect(result.success).toBe(true)
  })

  it('should allow empty wrongFeedback', () => {
    const item = {
      id: 'q1',
      question: 'Test',
      options: [{ text: 'A' }, { text: 'B' }],
      correctIndex: 0,
      explanation: 'Test',
      category: 'tools',
      difficulty: 'beginner',
      diagrams: TEST_DIAGRAMS,
    }

    const result = QuizItemSchema.safeParse(item)

    expect(result.success).toBe(true)
  })
})

describe('QuizFileSchema', () => {
  it('should allow optional metadata', () => {
    const file = {
      quizzes: [
        {
          id: 'q1',
          question: 'Test',
          options: [{ text: 'A' }, { text: 'B' }],
          correctIndex: 0,
          explanation: 'Test',
          category: 'tools',
          difficulty: 'beginner',
          diagrams: TEST_DIAGRAMS,
        },
      ],
    }

    const result = QuizFileSchema.safeParse(file)

    expect(result.success).toBe(true)
  })

  it('should accept full metadata', () => {
    const file = {
      title: 'My Quiz',
      description: 'A great quiz',
      version: '2.0.0',
      quizzes: [
        {
          id: 'q1',
          question: 'Test',
          options: [{ text: 'A' }, { text: 'B' }],
          correctIndex: 0,
          explanation: 'Test',
          category: 'tools',
          difficulty: 'intermediate',
          diagrams: TEST_DIAGRAMS,
        },
      ],
    }

    const result = QuizFileSchema.safeParse(file)

    expect(result.success).toBe(true)
    expect(result.data?.title).toBe('My Quiz')
  })
})
