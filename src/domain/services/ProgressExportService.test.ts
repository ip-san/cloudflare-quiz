import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Question } from '../entities/Question'
import { UserProgress } from '../entities/UserProgress'
import { ProgressExportService } from './ProgressExportService'

describe('ProgressExportService', () => {
  let mockNow: number

  beforeEach(() => {
    mockNow = 1700000000000
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createTestQuestion = (
    id: string,
    category = 'tools',
    difficulty: 'beginner' | 'intermediate' | 'advanced' = 'beginner'
  ): Question => {
    return Question.create({
      id,
      question: `Test question ${id}`,
      options: [{ text: 'Option A' }, { text: 'Option B' }, { text: 'Option C' }],
      correctIndex: 0,
      explanation: 'Test explanation',
      category,
      difficulty,
    })
  }

  describe('generateQuestionCsv()', () => {
    it('should generate CSV with headers', () => {
      const questions = [createTestQuestion('q1')]
      const progress = UserProgress.empty()

      const csv = ProgressExportService.generateQuestionCsv(questions, progress)
      const lines = csv.split('\r\n')

      expect(lines[0]).toBe('問題ID,カテゴリ,難易度,回答回数,正解回数,正答率(%),最終回答日時')
    })

    it('should include question data', () => {
      const questions = [createTestQuestion('q1', 'tools', 'beginner')]
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)

      const csv = ProgressExportService.generateQuestionCsv(questions, progress)
      const lines = csv.split('\r\n')

      expect(lines).toHaveLength(2) // header + 1 data row
      expect(lines[1]).toContain('q1')
      expect(lines[1]).toContain('tools')
      expect(lines[1]).toContain('beginner')
    })

    it('should show 0 for unanswered questions', () => {
      const questions = [createTestQuestion('q1')]
      const progress = UserProgress.empty()

      const csv = ProgressExportService.generateQuestionCsv(questions, progress)
      const lines = csv.split('\r\n')

      expect(lines[1]).toContain('q1,tools,beginner,0,0,0,')
    })

    it('should calculate accuracy correctly', () => {
      const questions = [createTestQuestion('q1')]
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)
      progress = progress.recordAnswer('q1', 'tools', false)

      const csv = ProgressExportService.generateQuestionCsv(questions, progress)
      const lines = csv.split('\r\n')
      const fields = lines[1].split(',')

      expect(fields[3]).toBe('2') // attempts
      expect(fields[4]).toBe('1') // correctCount
      expect(fields[5]).toBe('50') // accuracy
    })
  })

  describe('generateCategoryCsv()', () => {
    it('should generate CSV with headers', () => {
      const questions = [createTestQuestion('q1')]
      const progress = UserProgress.empty()

      const csv = ProgressExportService.generateCategoryCsv(questions, progress)
      const lines = csv.split('\r\n')

      expect(lines[0]).toBe('カテゴリ,総問題数,回答済み,正答率(%)')
    })

    it('should group questions by category', () => {
      const questions = [
        createTestQuestion('q1', 'tools'),
        createTestQuestion('q2', 'tools'),
        createTestQuestion('q3', 'memory'),
      ]
      const progress = UserProgress.empty()

      const csv = ProgressExportService.generateCategoryCsv(questions, progress)
      const lines = csv.split('\r\n')

      expect(lines).toHaveLength(3) // header + 2 categories
    })

    it('should show correct attempted count', () => {
      const questions = [createTestQuestion('q1', 'tools'), createTestQuestion('q2', 'tools')]
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)

      const csv = ProgressExportService.generateCategoryCsv(questions, progress)
      const lines = csv.split('\r\n')
      const toolsRow = lines.find((l) => l.startsWith('tools'))

      expect(toolsRow).toBeDefined()
      expect(toolsRow).toContain('tools,2,1')
    })
  })

  describe('CSV escaping', () => {
    it('should escape values containing commas', () => {
      const question = Question.create({
        id: 'q,1',
        question: 'Test question',
        options: [{ text: 'Option A' }, { text: 'Option B' }],
        correctIndex: 0,
        explanation: 'Test explanation',
        category: 'tools',
        difficulty: 'beginner',
      })
      const progress = UserProgress.empty()

      const csv = ProgressExportService.generateQuestionCsv([question], progress)

      expect(csv).toContain('"q,1"')
    })
  })
})
