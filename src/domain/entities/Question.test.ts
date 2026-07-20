import { describe, expect, it } from 'vitest'
import { Question } from './Question'

describe('Question Entity', () => {
  const createTestQuestion = (overrides = {}): Question => {
    return Question.create({
      id: 'test-001',
      question: 'What is Claude Code?',
      options: [{ text: 'A CLI tool' }, { text: 'A web app' }, { text: 'A mobile app' }, { text: 'A desktop app' }],
      correctIndex: 0,
      explanation: 'Claude Code is an agentic coding tool from Anthropic.',
      category: 'tools',
      difficulty: 'beginner',
      ...overrides,
    })
  }

  describe('create()', () => {
    it('should create a Question with valid data', () => {
      const question = createTestQuestion()

      expect(question.id).toBe('test-001')
      expect(question.question).toBe('What is Claude Code?')
      expect(question.options).toHaveLength(4)
      expect(question.correctIndex).toBe(0)
      expect(question.category).toBe('tools')
      expect(question.difficulty).toBe('beginner')
    })

    it('should create immutable options', () => {
      const question = createTestQuestion()

      // Options should be readonly (frozen)
      expect(Object.isFrozen(question.options)).toBe(true)
    })

    it('should throw error for empty id', () => {
      expect(() => createTestQuestion({ id: '' })).toThrow('Question ID is required')
    })

    it('should throw error for empty question text', () => {
      expect(() => createTestQuestion({ question: '' })).toThrow('Question text is required')
    })

    it('should throw error for less than 2 options', () => {
      expect(() => createTestQuestion({ options: [{ text: 'Only one' }] })).toThrow('At least 2 options are required')
    })

    it('should throw error for more than 6 options', () => {
      const manyOptions = Array(7)
        .fill(null)
        .map((_, i) => ({ text: `Option ${i}` }))
      expect(() => createTestQuestion({ options: manyOptions })).toThrow('Maximum 6 options allowed')
    })

    it('should throw error for invalid correctIndex', () => {
      expect(() => createTestQuestion({ correctIndex: -1 })).toThrow('correctIndex must be within options array bounds')
      expect(() => createTestQuestion({ correctIndex: 10 })).toThrow('correctIndex must be within options array bounds')
    })

    it('should throw error for empty explanation', () => {
      expect(() => createTestQuestion({ explanation: '' })).toThrow('Explanation is required')
    })

    it('should throw error for invalid referenceUrl', () => {
      expect(() => createTestQuestion({ referenceUrl: 'not-a-url' })).toThrow(
        'Reference URL must be a valid HTTP/HTTPS URL'
      )
    })

    it('should accept valid referenceUrl', () => {
      const question = createTestQuestion({ referenceUrl: 'https://docs.anthropic.com' })
      expect(question.referenceUrl).toBe('https://docs.anthropic.com')
    })
  })

  describe('fromData()', () => {
    it('should create Question from valid raw data', () => {
      const rawData = {
        id: 'raw-001',
        question: 'Test question',
        options: [{ text: 'Option 1' }, { text: 'Option 2' }],
        correctIndex: 0,
        explanation: 'Test explanation',
        category: 'memory',
        difficulty: 'intermediate',
      }

      const question = Question.fromData(rawData)

      expect(question).not.toBeNull()
      expect(question?.id).toBe('raw-001')
    })

    it('should return null for invalid data', () => {
      expect(Question.fromData(null)).toBeNull()
      expect(Question.fromData(undefined)).toBeNull()
      expect(Question.fromData('string')).toBeNull()
    })

    it('should return null for data that fails validation', () => {
      const invalidData = {
        id: '',
        question: '',
        options: [],
        correctIndex: 0,
        explanation: '',
        category: '',
        difficulty: 'beginner',
      }

      expect(Question.fromData(invalidData)).toBeNull()
    })
  })

  describe('isCorrectAnswer()', () => {
    it('should return true for correct answer index', () => {
      const question = createTestQuestion()

      expect(question.isCorrectAnswer(0)).toBe(true)
    })

    it('should return false for incorrect answer index', () => {
      const question = createTestQuestion()

      expect(question.isCorrectAnswer(1)).toBe(false)
      expect(question.isCorrectAnswer(2)).toBe(false)
      expect(question.isCorrectAnswer(3)).toBe(false)
    })
  })

  describe('getCorrectOption()', () => {
    it('should return the correct option', () => {
      const question = createTestQuestion()

      const correctOption = question.getCorrectOption()

      expect(correctOption.text).toBe('A CLI tool')
    })
  })

  describe('getWrongFeedback()', () => {
    it('should return undefined for correct answer', () => {
      const question = createTestQuestion()

      expect(question.getWrongFeedback(0)).toBeUndefined()
    })

    it('should return wrongFeedback if defined', () => {
      const question = createTestQuestion({
        options: [{ text: 'Correct answer' }, { text: 'Wrong answer', wrongFeedback: "This is why it's wrong" }],
        correctIndex: 0,
      })

      expect(question.getWrongFeedback(1)).toBe("This is why it's wrong")
    })

    it('should return undefined if wrongFeedback not defined', () => {
      const question = createTestQuestion()

      expect(question.getWrongFeedback(1)).toBeUndefined()
    })
  })

  describe('generateAIPrompt()', () => {
    it('should return custom aiPrompt if defined', () => {
      const customPrompt = 'Custom AI prompt for learning'
      const question = createTestQuestion({ aiPrompt: customPrompt })

      expect(question.generateAIPrompt()).toBe(customPrompt)
    })

    it('should generate default prompt if aiPrompt not defined', () => {
      const question = createTestQuestion()

      const prompt = question.generateAIPrompt()

      expect(prompt).toContain('What is Claude Code?')
      expect(prompt).toContain('A CLI tool')
      expect(prompt).toContain('Claude Code is an agentic coding tool')
    })
  })

  describe('toMarkdown()', () => {
    it('should generate valid markdown format', () => {
      const question = createTestQuestion()

      const markdown = question.toMarkdown()

      expect(markdown).toContain('## Cloudflare Quiz')
      expect(markdown).toContain('**問題:**')
      expect(markdown).toContain('What is Claude Code?')
      expect(markdown).toContain('**正解:**')
      expect(markdown).toContain('A CLI tool')
      expect(markdown).toContain('**解説:**')
    })

    it('should include referenceUrl if defined', () => {
      const question = createTestQuestion({ referenceUrl: 'https://docs.anthropic.com' })

      const markdown = question.toMarkdown()

      expect(markdown).toContain('**参考:**')
      expect(markdown).toContain('https://docs.anthropic.com')
    })
  })

  describe('hint', () => {
    it('should create question with hint', () => {
      const question = createTestQuestion({ hint: 'This is a hint' })
      expect(question.hint).toBe('This is a hint')
    })

    it('should create question without hint', () => {
      const question = createTestQuestion()
      expect(question.hint).toBeUndefined()
    })

    it('should include hint in toJSON', () => {
      const question = createTestQuestion({ hint: 'Test hint' })
      const json = question.toJSON()
      expect(json.hint).toBe('Test hint')
    })

    it('should restore hint from fromData', () => {
      const rawData = {
        id: 'hint-001',
        question: 'Test question',
        options: [{ text: 'Option 1' }, { text: 'Option 2' }],
        correctIndex: 0,
        explanation: 'Test explanation',
        category: 'memory',
        difficulty: 'intermediate',
        hint: 'A helpful hint',
      }

      const question = Question.fromData(rawData)
      expect(question?.hint).toBe('A helpful hint')
    })
  })

  describe('equals()', () => {
    it('should return true for same id', () => {
      const question1 = createTestQuestion()
      const question2 = createTestQuestion({ question: 'Different question text' })

      expect(question1.equals(question2)).toBe(true)
    })

    it('should return false for different id', () => {
      const question1 = createTestQuestion()
      const question2 = createTestQuestion({ id: 'test-002' })

      expect(question1.equals(question2)).toBe(false)
    })
  })

  describe('toJSON()', () => {
    it('should return serializable object', () => {
      const question = createTestQuestion()

      const json = question.toJSON()

      expect(json.id).toBe('test-001')
      expect(json.question).toBe('What is Claude Code?')
      expect(json.options).toHaveLength(4)
      expect(Array.isArray(json.options)).toBe(true)
      expect(Array.isArray(json.tags)).toBe(true)
    })
  })

  // ================================================
  // Multi-select question tests
  // ================================================

  describe('Multi-select questions', () => {
    const createMultiQuestion = (overrides = {}): Question => {
      return Question.create({
        id: 'multi-001',
        question: 'Which of these are valid ways to switch models?',
        options: [
          { text: '/model command' },
          { text: 'Settings file' },
          { text: 'Restart the app', wrongFeedback: 'Restarting does not switch models' },
          { text: 'CLI flag --model', wrongFeedback: 'This flag does not exist' },
        ],
        correctIndices: [0, 1],
        explanation: 'You can switch models via /model command or settings file.',
        category: 'commands',
        difficulty: 'intermediate',
        type: 'multi',
        ...overrides,
      })
    }

    describe('create() - multi-select validation', () => {
      it('should create a multi-select question with valid data', () => {
        const q = createMultiQuestion()
        expect(q.type).toBe('multi')
        expect(q.isMultiSelect).toBe(true)
        expect(q.correctIndices).toEqual([0, 1])
      })

      it('should throw if correctIndices has less than 2 items', () => {
        expect(() => createMultiQuestion({ correctIndices: [0] })).toThrow(
          'Multi-select questions require at least 2 correct indices'
        )
      })

      it('should throw if correctIndices is missing for multi type', () => {
        expect(() => createMultiQuestion({ correctIndices: undefined })).toThrow(
          'Multi-select questions require at least 2 correct indices'
        )
      })

      it('should throw if correctIndices has duplicates', () => {
        expect(() => createMultiQuestion({ correctIndices: [0, 0] })).toThrow(
          'correctIndices must not contain duplicates'
        )
      })

      it('should throw if correctIndices is out of bounds', () => {
        expect(() => createMultiQuestion({ correctIndices: [0, 10] })).toThrow(
          'All correctIndices must be within options array bounds'
        )
      })
    })

    describe('isCorrectMultiAnswer()', () => {
      it('should return true for exact match', () => {
        const q = createMultiQuestion()
        expect(q.isCorrectMultiAnswer([0, 1])).toBe(true)
        expect(q.isCorrectMultiAnswer([1, 0])).toBe(true) // Order doesn't matter
      })

      it('should return false for partial selection', () => {
        const q = createMultiQuestion()
        expect(q.isCorrectMultiAnswer([0])).toBe(false)
      })

      it('should return false for extra selection', () => {
        const q = createMultiQuestion()
        expect(q.isCorrectMultiAnswer([0, 1, 2])).toBe(false)
      })

      it('should return false for wrong selection', () => {
        const q = createMultiQuestion()
        expect(q.isCorrectMultiAnswer([2, 3])).toBe(false)
      })

      it('should return false for single-select question', () => {
        const q = createTestQuestion()
        expect(q.isCorrectMultiAnswer([0])).toBe(false)
      })
    })

    describe('isCorrectIndex()', () => {
      it('should identify correct indices in multi-select', () => {
        const q = createMultiQuestion()
        expect(q.isCorrectIndex(0)).toBe(true)
        expect(q.isCorrectIndex(1)).toBe(true)
        expect(q.isCorrectIndex(2)).toBe(false)
        expect(q.isCorrectIndex(3)).toBe(false)
      })

      it('should work for single-select', () => {
        const q = createTestQuestion()
        expect(q.isCorrectIndex(0)).toBe(true)
        expect(q.isCorrectIndex(1)).toBe(false)
      })
    })

    describe('getCorrectOptions()', () => {
      it('should return all correct options for multi-select', () => {
        const q = createMultiQuestion()
        const opts = q.getCorrectOptions()
        expect(opts).toHaveLength(2)
        expect(opts[0].text).toBe('/model command')
        expect(opts[1].text).toBe('Settings file')
      })
    })

    describe('getWrongFeedback() for multi-select', () => {
      it('should return undefined for correct indices', () => {
        const q = createMultiQuestion()
        expect(q.getWrongFeedback(0)).toBeUndefined()
        expect(q.getWrongFeedback(1)).toBeUndefined()
      })

      it('should return feedback for wrong indices', () => {
        const q = createMultiQuestion()
        expect(q.getWrongFeedback(2)).toBe('Restarting does not switch models')
        expect(q.getWrongFeedback(3)).toBe('This flag does not exist')
      })
    })

    describe('fromData() - multi-select', () => {
      it('should parse multi-select question from raw data', () => {
        const rawData = {
          id: 'multi-raw-001',
          question: 'Select all correct answers',
          options: [{ text: 'A' }, { text: 'B' }, { text: 'C', wrongFeedback: 'Wrong' }],
          correctIndices: [0, 1],
          explanation: 'A and B are correct',
          category: 'tools',
          difficulty: 'beginner',
          type: 'multi',
        }

        const q = Question.fromData(rawData)
        expect(q).not.toBeNull()
        expect(q!.type).toBe('multi')
        expect(q!.isMultiSelect).toBe(true)
        expect(q!.correctIndices).toEqual([0, 1])
      })
    })

    describe('toJSON() - multi-select', () => {
      it('should include type and correctIndices but not correctIndex', () => {
        const q = createMultiQuestion()
        const json = q.toJSON()
        expect(json.type).toBe('multi')
        expect(json.correctIndices).toEqual([0, 1])
        expect(json.correctIndex).toBeUndefined()
      })

      it('should not include correctIndices for single-select', () => {
        const q = createTestQuestion()
        const json = q.toJSON()
        expect(json.type).toBe('single')
        expect(json.correctIndices).toBeUndefined()
        expect(json.correctIndex).toBeDefined()
      })
    })

    describe('toMarkdown() - multi-select', () => {
      it('should list all correct answers', () => {
        const q = createMultiQuestion()
        const md = q.toMarkdown()
        expect(md).toContain('正解（複数）')
        expect(md).toContain('/model command')
        expect(md).toContain('Settings file')
      })
    })

    describe('generateAIPrompt() - multi-select', () => {
      it('should list all correct answers', () => {
        const q = createMultiQuestion()
        const prompt = q.generateAIPrompt()
        expect(prompt).toContain('正解（複数）')
        expect(prompt).toContain('/model command')
        expect(prompt).toContain('Settings file')
      })
    })

    describe('default type for existing questions', () => {
      it('should default to single type', () => {
        const q = createTestQuestion()
        expect(q.type).toBe('single')
        expect(q.isMultiSelect).toBe(false)
        expect(q.correctIndices).toEqual([0])
      })
    })
  })
})
