import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Question } from '../entities/Question'
import { UserProgress } from '../entities/UserProgress'
import { type QuizSessionConfig, QuizSessionService } from './QuizSessionService'

describe('QuizSessionService', () => {
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

  const createDefaultConfig = (overrides: Partial<QuizSessionConfig> = {}): QuizSessionConfig => ({
    mode: 'random',
    categoryFilter: null,
    difficultyFilter: null,
    questionCount: null,
    timeLimit: null,
    shuffleQuestions: false,
    shuffleOptions: false,
    ...overrides,
  })

  describe('shuffleArray()', () => {
    it('should return array with same elements', () => {
      const original = [1, 2, 3, 4, 5]

      const shuffled = QuizSessionService.shuffleArray(original)

      expect(shuffled.sort()).toEqual(original.sort())
    })

    it('should not modify original array', () => {
      const original = [1, 2, 3, 4, 5]
      const originalCopy = [...original]

      QuizSessionService.shuffleArray(original)

      expect(original).toEqual(originalCopy)
    })

    it('should handle empty array', () => {
      const empty: number[] = []

      const result = QuizSessionService.shuffleArray(empty)

      expect(result).toEqual([])
    })
  })

  describe('engagement gate (動機曲線)', () => {
    it('treats learners below the attempt threshold as early-stage', () => {
      expect(QuizSessionService.isEarlyStage(UserProgress.create({ totalAttempts: 0 }))).toBe(true)
      expect(QuizSessionService.isEarlyStage(UserProgress.create({ totalAttempts: 19 }))).toBe(true)
      expect(QuizSessionService.isEarlyStage(UserProgress.create({ totalAttempts: 20 }))).toBe(false)
    })

    it('pushes SDK questions to the back for a new learner (random mode)', () => {
      const questions = [
        createTestQuestion('sdk-1', 'sdk'),
        createTestQuestion('tools-1', 'tools'),
        createTestQuestion('tools-2', 'tools'),
      ]
      const config = createDefaultConfig({ mode: 'random', shuffleQuestions: false })
      const result = QuizSessionService.prepareSessionQuestions(questions, config, UserProgress.empty())
      expect(result[result.length - 1].id).toBe('sdk-1')
    })

    it('pushes advanced-trivia to the back but keeps advanced-practical up front', () => {
      const advTrivia = Question.create({
        id: 'adv-trivia',
        question: 'q',
        options: [{ text: 'A' }, { text: 'B' }],
        correctIndex: 0,
        explanation: 'e',
        category: 'tools',
        difficulty: 'advanced',
        tags: ['trivia'],
      })
      const beginnerPractical = createTestQuestion('beg-1', 'tools', 'beginner')
      const config = createDefaultConfig({ mode: 'random', shuffleQuestions: false })
      const result = QuizSessionService.prepareSessionQuestions(
        [advTrivia, beginnerPractical],
        config,
        UserProgress.empty()
      )
      expect(result[result.length - 1].id).toBe('adv-trivia')
    })

    it('does not lose SDK questions when a beginner explicitly picks the SDK category', () => {
      const questions = [createTestQuestion('sdk-1', 'sdk'), createTestQuestion('sdk-2', 'sdk')]
      const config = createDefaultConfig({ mode: 'category', categoryFilter: 'sdk', shuffleQuestions: false })
      const result = QuizSessionService.prepareSessionQuestions(questions, config, UserProgress.empty())
      expect(result.map((q) => q.id).sort()).toEqual(['sdk-1', 'sdk-2'])
    })
  })

  describe('prepareSessionQuestions()', () => {
    it('should return all questions when no filters', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2'), createTestQuestion('q3')]
      const config = createDefaultConfig()
      const progress = UserProgress.empty()

      const result = QuizSessionService.prepareSessionQuestions(questions, config, progress)

      expect(result).toHaveLength(3)
    })

    it('should filter by category', () => {
      const questions = [
        createTestQuestion('q1', 'tools'),
        createTestQuestion('q2', 'memory'),
        createTestQuestion('q3', 'tools'),
      ]
      const config = createDefaultConfig({ categoryFilter: 'tools' })
      const progress = UserProgress.empty()

      const result = QuizSessionService.prepareSessionQuestions(questions, config, progress)

      expect(result).toHaveLength(2)
      expect(result.every((q) => q.category === 'tools')).toBe(true)
    })

    it('should filter by difficulty', () => {
      const questions = [
        createTestQuestion('q1', 'tools', 'beginner'),
        createTestQuestion('q2', 'tools', 'advanced'),
        createTestQuestion('q3', 'tools', 'beginner'),
      ]
      const config = createDefaultConfig({ difficultyFilter: 'beginner' })
      const progress = UserProgress.empty()

      const result = QuizSessionService.prepareSessionQuestions(questions, config, progress)

      expect(result).toHaveLength(2)
      expect(result.every((q) => q.difficulty === 'beginner')).toBe(true)
    })

    it('should limit question count', () => {
      const questions = [
        createTestQuestion('q1'),
        createTestQuestion('q2'),
        createTestQuestion('q3'),
        createTestQuestion('q4'),
        createTestQuestion('q5'),
      ]
      const config = createDefaultConfig({ questionCount: 3 })
      const progress = UserProgress.empty()

      const result = QuizSessionService.prepareSessionQuestions(questions, config, progress)

      expect(result).toHaveLength(3)
    })

    it('should prioritize weak questions in weak mode', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2'), createTestQuestion('q3')]
      const config = createDefaultConfig({ mode: 'weak' })

      // Create progress with q2 as weak (0% accuracy)
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q2', 'tools', false)
      progress = progress.recordAnswer('q2', 'tools', false)

      const result = QuizSessionService.prepareSessionQuestions(questions, config, progress, 50, 1)

      // Weak mode now includes prerequisites (unmastered beginner questions in same category)
      // q2 is weak, q1 and q3 are unmastered beginners in same category → all included
      expect(result.length).toBeGreaterThanOrEqual(1)
      // Weak question must be included
      expect(result.some((q) => q.id === 'q2')).toBe(true)
    })

    it('should fallback to unanswered questions when no weak questions', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2'), createTestQuestion('q3')]
      const config = createDefaultConfig({ mode: 'weak' })

      // Create progress where q1 has been answered correctly (not weak)
      let progress = UserProgress.empty()
      progress = progress.recordAnswer('q1', 'tools', true)

      const result = QuizSessionService.prepareSessionQuestions(questions, config, progress, 50, 1)

      // Should return unanswered questions (q2, q3)
      expect(result).toHaveLength(2)
      expect(result.map((q) => q.id)).not.toContain('q1')
    })
  })

  describe('createInitialState()', () => {
    it('should create initial state with correct defaults', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2')]
      const config = createDefaultConfig()

      const state = QuizSessionService.createInitialState(questions, config)

      expect(state.config).toEqual(config)
      expect(state.questions).toHaveLength(2)
      expect(state.currentIndex).toBe(0)
      expect(state.selectedAnswer).toBeNull()
      expect(state.isAnswered).toBe(false)
      expect(state.isCorrect).toBeNull()
      expect(state.score).toBe(0)
      expect(state.answeredCount).toBe(0)
      expect(state.isCompleted).toBe(false)
      expect(state.startedAt).toBe(mockNow)
      expect(state.timeRemaining).toBeNull()
    })

    it('should set timeRemaining when timeLimit is set', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig({ timeLimit: 5 }) // 5 minutes

      const state = QuizSessionService.createInitialState(questions, config)

      expect(state.timeRemaining).toBe(300) // 5 * 60 seconds
    })

    it('should freeze questions array', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()

      const state = QuizSessionService.createInitialState(questions, config)

      expect(Object.isFrozen(state.questions)).toBe(true)
    })
  })

  describe('createDefaultConfig()', () => {
    it('should create config with default values', () => {
      const config = QuizSessionService.createDefaultConfig()

      expect(config.mode).toBe('random')
      expect(config.categoryFilter).toBeNull()
      expect(config.difficultyFilter).toBeNull()
      expect(config.questionCount).toBe(20)
      expect(config.timeLimit).toBeNull()
      expect(config.shuffleQuestions).toBe(true)
      expect(config.shuffleOptions).toBe(false)
    })
  })

  describe('selectAnswer()', () => {
    it('should update selectedAnswer', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      const state = QuizSessionService.createInitialState(questions, config)

      const newState = QuizSessionService.selectAnswer(state, 1)

      expect(newState.selectedAnswer).toBe(1)
    })

    it('should not change if already answered', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, isAnswered: true, selectedAnswer: 0 }

      const newState = QuizSessionService.selectAnswer(state, 2)

      expect(newState.selectedAnswer).toBe(0) // Unchanged
    })
  })

  describe('submitAnswer()', () => {
    it('should return null if no answer selected', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      const state = QuizSessionService.createInitialState(questions, config)

      const result = QuizSessionService.submitAnswer(state)

      expect(result).toBeNull()
    })

    it('should return null if already answered', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, selectedAnswer: 0, isAnswered: true }

      const result = QuizSessionService.submitAnswer(state)

      expect(result).toBeNull()
    })

    it('should mark correct answer and update score', () => {
      const questions = [createTestQuestion('q1')] // correctIndex is 0
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = QuizSessionService.selectAnswer(state, 0)

      const result = QuizSessionService.submitAnswer(state)

      expect(result).not.toBeNull()
      expect(result?.isCorrect).toBe(true)
      expect(result?.newState.isAnswered).toBe(true)
      expect(result?.newState.isCorrect).toBe(true)
      expect(result?.newState.score).toBe(1)
      expect(result?.newState.answeredCount).toBe(1)
    })

    it('should mark incorrect answer', () => {
      const questions = [createTestQuestion('q1')] // correctIndex is 0
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = QuizSessionService.selectAnswer(state, 1) // Wrong answer

      const result = QuizSessionService.submitAnswer(state)

      expect(result?.isCorrect).toBe(false)
      expect(result?.newState.score).toBe(0)
    })
  })

  describe('nextQuestion()', () => {
    it('should advance to next question', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, isAnswered: true, selectedAnswer: 0 }

      const newState = QuizSessionService.nextQuestion(state)

      expect(newState.currentIndex).toBe(1)
      expect(newState.selectedAnswer).toBeNull()
      expect(newState.isAnswered).toBe(false)
      expect(newState.isCorrect).toBeNull()
    })

    it('should mark as completed when no more questions', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, isAnswered: true, selectedAnswer: 0 }

      const newState = QuizSessionService.nextQuestion(state)

      expect(newState.isCompleted).toBe(true)
    })
  })

  describe('updateTimer()', () => {
    it('should decrement timeRemaining', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig({ timeLimit: 1 }) // 1 minute = 60 seconds
      const state = QuizSessionService.createInitialState(questions, config)

      const newState = QuizSessionService.updateTimer(state)

      expect(newState.timeRemaining).toBe(59)
    })

    it('should not change if no time limit', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      const state = QuizSessionService.createInitialState(questions, config)

      const newState = QuizSessionService.updateTimer(state)

      expect(newState.timeRemaining).toBeNull()
    })

    it('should mark as completed when time runs out', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig({ timeLimit: 1 })
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, timeRemaining: 1 }

      const newState = QuizSessionService.updateTimer(state)

      expect(newState.timeRemaining).toBe(0)
      expect(newState.isCompleted).toBe(true)
    })

    it('should not update if time is already 0', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig({ timeLimit: 1 })
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, timeRemaining: 0 }

      const newState = QuizSessionService.updateTimer(state)

      expect(newState).toEqual(state)
    })
  })

  describe('getCurrentQuestion()', () => {
    it('should return current question', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2')]
      const config = createDefaultConfig()
      const state = QuizSessionService.createInitialState(questions, config)

      const current = QuizSessionService.getCurrentQuestion(state)

      expect(current?.id).toBe('q1')
    })

    it('should return null for invalid index', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, currentIndex: 99 }

      const current = QuizSessionService.getCurrentQuestion(state)

      expect(current).toBeNull()
    })
  })

  describe('getProgress()', () => {
    it('should return correct progress', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2'), createTestQuestion('q3')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, currentIndex: 1 }

      const progress = QuizSessionService.getProgress(state)

      expect(progress.current).toBe(2) // 1-indexed
      expect(progress.total).toBe(3)
    })
  })

  describe('calculateScorePercentage()', () => {
    it('should return 0 when no answers', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      const state = QuizSessionService.createInitialState(questions, config)

      const percentage = QuizSessionService.calculateScorePercentage(state)

      expect(percentage).toBe(0)
    })

    it('should calculate correct percentage', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, score: 3, answeredCount: 4 }

      const percentage = QuizSessionService.calculateScorePercentage(state)

      expect(percentage).toBe(75)
    })

    it('should round percentage', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, score: 1, answeredCount: 3 }

      const percentage = QuizSessionService.calculateScorePercentage(state)

      expect(percentage).toBe(33) // 33.33% rounds to 33%
    })
  })

  describe('bookmark mode filtering', () => {
    it('should filter to bookmarked questions in bookmark mode', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2'), createTestQuestion('q3')]
      const config = createDefaultConfig({ mode: 'bookmark' })
      let progress = UserProgress.empty()
      progress = progress.toggleBookmark('q2')

      const result = QuizSessionService.prepareSessionQuestions(questions, config, progress)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('q2')
    })

    it('should return all questions if no bookmarks in bookmark mode', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2')]
      const config = createDefaultConfig({ mode: 'bookmark' })
      const progress = UserProgress.empty()

      const result = QuizSessionService.prepareSessionQuestions(questions, config, progress)

      expect(result).toHaveLength(2)
    })
  })

  describe('review mode', () => {
    it('should create review mode initial state', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2')]
      const config = createDefaultConfig({ mode: 'review' })

      const state = QuizSessionService.createInitialState(questions, config, {
        isReviewMode: true,
        reviewUserAnswers: [1, 2],
      })

      expect(state.isReviewMode).toBe(true)
      expect(state.reviewUserAnswers).toEqual([1, 2])
      expect(state.isAnswered).toBe(true)
      expect(state.isCorrect).toBe(false)
    })

    it('should show pre-answered state for review mode nextQuestion', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2')]
      const config = createDefaultConfig({ mode: 'review' })

      const state = QuizSessionService.createInitialState(questions, config, {
        isReviewMode: true,
        reviewUserAnswers: [1, 2],
      })

      const nextState = QuizSessionService.nextQuestion(state)

      expect(nextState.currentIndex).toBe(1)
      expect(nextState.isAnswered).toBe(true)
      expect(nextState.selectedAnswer).toBe(2)
    })
  })

  describe('useHint()', () => {
    it('should set hintUsed to true', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      const state = QuizSessionService.createInitialState(questions, config)

      const newState = QuizSessionService.useHint(state)

      expect(newState.hintUsed).toBe(true)
      expect(newState.hintsUsedCount).toBe(1)
    })

    it('should not change if already answered', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, isAnswered: true }

      const newState = QuizSessionService.useHint(state)

      expect(newState.hintUsed).toBe(false)
    })

    it('should not change if hint already used', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = QuizSessionService.useHint(state)

      const newState = QuizSessionService.useHint(state)

      expect(newState.hintsUsedCount).toBe(1)
    })

    it('should accumulate hints across questions', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)

      state = QuizSessionService.useHint(state)
      expect(state.hintsUsedCount).toBe(1)

      // Simulate answering and moving to next question
      state = { ...state, isAnswered: true, selectedAnswer: 0 }
      state = QuizSessionService.nextQuestion(state)

      expect(state.hintUsed).toBe(false) // Reset for new question

      state = QuizSessionService.useHint(state)
      expect(state.hintsUsedCount).toBe(2)
    })
  })

  describe('retryQuestion()', () => {
    it('should reset answered state for incorrect answer', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = QuizSessionService.selectAnswer(state, 1) // wrong answer
      const submitted = QuizSessionService.submitAnswer(state)!
      state = submitted.newState

      expect(state.isAnswered).toBe(true)
      expect(state.isCorrect).toBe(false)

      const retried = QuizSessionService.retryQuestion(state)
      expect(retried.selectedAnswer).toBeNull()
      expect(retried.selectedAnswers).toEqual([])
      expect(retried.isAnswered).toBe(false)
      expect(retried.isCorrect).toBeNull()
      expect(retried.hintUsed).toBe(false)
    })

    it('should not allow retry for correct answer', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = QuizSessionService.selectAnswer(state, 0) // correct answer
      const submitted = QuizSessionService.submitAnswer(state)!
      state = submitted.newState

      const retried = QuizSessionService.retryQuestion(state)
      expect(retried).toBe(state) // unchanged
    })

    it('should allow retry in review mode for wrong answers', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      const state = QuizSessionService.createInitialState(questions, config, {
        isReviewMode: true,
        reviewUserAnswers: [1], // wrong answer (correct is 0)
      })

      const retried = QuizSessionService.retryQuestion(state)
      expect(retried).not.toBe(state)
      expect(retried.isAnswered).toBe(false)
      expect(retried.selectedAnswer).toBeNull()
      expect(retried.isCorrect).toBeNull()
    })

    it('should not allow retry when not yet answered', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      const state = QuizSessionService.createInitialState(questions, config)

      const retried = QuizSessionService.retryQuestion(state)
      expect(retried).toBe(state) // unchanged
    })

    it('should preserve score and answeredCount', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = QuizSessionService.selectAnswer(state, 1) // wrong
      const submitted = QuizSessionService.submitAnswer(state)!
      state = submitted.newState

      const retried = QuizSessionService.retryQuestion(state)
      // retryQuestion keeps score/answeredCount and answerHistory (submitAnswer handles re-answer delta)
      expect(retried.score).toBe(state.score)
      expect(retried.answeredCount).toBe(state.answeredCount)
      expect(retried.answerHistory.has(0)).toBe(true)
      expect(retried.isAnswered).toBe(false)
      expect(retried.selectedAnswer).toBe(null)
      expect(retried.currentIndex).toBe(state.currentIndex)
    })
  })

  describe('hasPassed()', () => {
    it('should return true when score >= passing score', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, score: 7, answeredCount: 10 }

      expect(QuizSessionService.hasPassed(state, 70)).toBe(true)
    })

    it('should return false when score < passing score', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, score: 6, answeredCount: 10 }

      expect(QuizSessionService.hasPassed(state, 70)).toBe(false)
    })

    it('should use default passing score of 70', () => {
      const questions = [createTestQuestion('q1')]
      const config = createDefaultConfig()
      let state = QuizSessionService.createInitialState(questions, config)
      state = { ...state, score: 70, answeredCount: 100 }

      expect(QuizSessionService.hasPassed(state)).toBe(true)
    })
  })

  describe('overview mode filtering', () => {
    const createTaggedQuestion = (id: string, tags: string[], category = 'bestpractices'): Question => {
      return Question.create({
        id,
        question: `Test question ${id}`,
        options: [{ text: 'Option A' }, { text: 'Option B' }, { text: 'Option C' }],
        correctIndex: 0,
        explanation: 'Test explanation',
        category,
        difficulty: 'beginner',
        tags,
      })
    }

    it('should filter to overview tagged questions', () => {
      const questions = [
        createTaggedQuestion('ov-1', ['overview', 'overview-010']),
        createTestQuestion('q1'),
        createTaggedQuestion('ov-2', ['overview', 'overview-020']),
      ]
      const config = createDefaultConfig({ mode: 'overview', shuffleQuestions: false })
      const progress = UserProgress.empty()

      const result = QuizSessionService.prepareSessionQuestions(questions, config, progress)

      expect(result).toHaveLength(2)
      expect(result.every((q) => q.tags.includes('overview'))).toBe(true)
    })

    it('should sort by overview-NNN order tag', () => {
      const questions = [
        createTaggedQuestion('ov-3', ['overview', 'overview-030']),
        createTaggedQuestion('ov-1', ['overview', 'overview-010']),
        createTaggedQuestion('ov-2', ['overview', 'overview-020']),
      ]
      const config = createDefaultConfig({ mode: 'overview', shuffleQuestions: false })
      const progress = UserProgress.empty()

      const result = QuizSessionService.prepareSessionQuestions(questions, config, progress)

      expect(result.map((q) => q.id)).toEqual(['ov-1', 'ov-2', 'ov-3'])
    })

    it('should place questions without order tag at the end', () => {
      const questions = [
        createTaggedQuestion('ov-2', ['overview', 'overview-020']),
        createTaggedQuestion('ov-x', ['overview']),
        createTaggedQuestion('ov-1', ['overview', 'overview-010']),
      ]
      const config = createDefaultConfig({ mode: 'overview', shuffleQuestions: false })
      const progress = UserProgress.empty()

      const result = QuizSessionService.prepareSessionQuestions(questions, config, progress)

      expect(result.map((q) => q.id)).toEqual(['ov-1', 'ov-2', 'ov-x'])
    })

    it('should return empty array when no tagged questions exist', () => {
      const questions = [createTestQuestion('q1'), createTestQuestion('q2')]
      const config = createDefaultConfig({ mode: 'overview', shuffleQuestions: false })
      const progress = UserProgress.empty()

      const result = QuizSessionService.prepareSessionQuestions(questions, config, progress)

      expect(result).toHaveLength(0)
    })
  })

  // ================================================
  // Multi-select question tests
  // ================================================

  describe('Multi-select questions', () => {
    const createMultiQuestion = (id: string): Question => {
      return Question.create({
        id,
        question: `Multi-select question ${id}`,
        options: [
          { text: 'Correct A' },
          { text: 'Correct B' },
          { text: 'Wrong C', wrongFeedback: 'C is wrong' },
          { text: 'Wrong D', wrongFeedback: 'D is wrong' },
        ],
        correctIndex: 0,
        correctIndices: [0, 1],
        explanation: 'A and B are correct',
        category: 'tools',
        difficulty: 'beginner',
        type: 'multi',
      })
    }

    describe('toggleAnswer()', () => {
      it('should add answer to selectedAnswers', () => {
        const questions = [createMultiQuestion('mq1')]
        const config = createDefaultConfig()
        let state = QuizSessionService.createInitialState(questions, config)

        state = QuizSessionService.toggleAnswer(state, 0)
        expect([...state.selectedAnswers]).toEqual([0])

        state = QuizSessionService.toggleAnswer(state, 2)
        expect([...state.selectedAnswers]).toEqual([0, 2])
      })

      it('should remove answer if already selected', () => {
        const questions = [createMultiQuestion('mq1')]
        const config = createDefaultConfig()
        let state = QuizSessionService.createInitialState(questions, config)

        state = QuizSessionService.toggleAnswer(state, 0)
        state = QuizSessionService.toggleAnswer(state, 1)
        expect([...state.selectedAnswers]).toEqual([0, 1])

        state = QuizSessionService.toggleAnswer(state, 0)
        expect([...state.selectedAnswers]).toEqual([1])
      })

      it('should not change if already answered', () => {
        const questions = [createMultiQuestion('mq1')]
        const config = createDefaultConfig()
        let state = QuizSessionService.createInitialState(questions, config)
        state = { ...state, isAnswered: true }

        const newState = QuizSessionService.toggleAnswer(state, 0)
        expect(newState).toBe(state)
      })
    })

    describe('submitAnswer() - multi-select', () => {
      it('should mark correct for exact match', () => {
        const questions = [createMultiQuestion('mq1')]
        const config = createDefaultConfig()
        let state = QuizSessionService.createInitialState(questions, config)

        state = QuizSessionService.toggleAnswer(state, 0)
        state = QuizSessionService.toggleAnswer(state, 1)

        const result = QuizSessionService.submitAnswer(state)
        expect(result).not.toBeNull()
        expect(result?.isCorrect).toBe(true)
        expect(result?.newState.score).toBe(1)
      })

      it('should mark incorrect for partial selection', () => {
        const questions = [createMultiQuestion('mq1')]
        const config = createDefaultConfig()
        let state = QuizSessionService.createInitialState(questions, config)

        state = QuizSessionService.toggleAnswer(state, 0) // only 1 of 2 correct

        const result = QuizSessionService.submitAnswer(state)
        expect(result?.isCorrect).toBe(false)
        expect(result?.newState.score).toBe(0)
      })

      it('should mark incorrect when wrong option included', () => {
        const questions = [createMultiQuestion('mq1')]
        const config = createDefaultConfig()
        let state = QuizSessionService.createInitialState(questions, config)

        state = QuizSessionService.toggleAnswer(state, 0)
        state = QuizSessionService.toggleAnswer(state, 1)
        state = QuizSessionService.toggleAnswer(state, 2) // wrong option added

        const result = QuizSessionService.submitAnswer(state)
        expect(result?.isCorrect).toBe(false)
      })

      it('should return null if no answers selected', () => {
        const questions = [createMultiQuestion('mq1')]
        const config = createDefaultConfig()
        const state = QuizSessionService.createInitialState(questions, config)

        const result = QuizSessionService.submitAnswer(state)
        expect(result).toBeNull()
      })
    })

    describe('nextQuestion() - multi-select reset', () => {
      it('should reset selectedAnswers for next question', () => {
        const questions = [createMultiQuestion('mq1'), createTestQuestion('q2')]
        const config = createDefaultConfig()
        let state = QuizSessionService.createInitialState(questions, config)
        state = QuizSessionService.toggleAnswer(state, 0)
        state = QuizSessionService.toggleAnswer(state, 1)
        state = { ...state, isAnswered: true }

        const newState = QuizSessionService.nextQuestion(state)
        expect([...newState.selectedAnswers]).toEqual([])
        expect(newState.selectedAnswer).toBeNull()
      })
    })

    describe('createInitialState() - multi-select', () => {
      it('should initialize selectedAnswers as empty', () => {
        const questions = [createMultiQuestion('mq1')]
        const config = createDefaultConfig()
        const state = QuizSessionService.createInitialState(questions, config)

        expect([...state.selectedAnswers]).toEqual([])
      })
    })

    describe('review mode - multi-select', () => {
      it('should pre-populate selectedAnswers in review mode', () => {
        const questions = [createMultiQuestion('mq1')]
        const config = createDefaultConfig({ mode: 'review' })

        const state = QuizSessionService.createInitialState(questions, config, {
          isReviewMode: true,
          reviewUserAnswers: [],
          reviewUserMultiAnswers: [[0, 2]], // selected 0 and 2 (partial correct)
        })

        expect(state.isReviewMode).toBe(true)
        expect(state.isAnswered).toBe(true)
        expect([...state.selectedAnswers]).toEqual([0, 2])
        expect(state.isCorrect).toBe(false) // 0,2 != 0,1
      })

      it('should show correct in review mode for exact match', () => {
        const questions = [createMultiQuestion('mq1')]
        const config = createDefaultConfig({ mode: 'review' })

        const state = QuizSessionService.createInitialState(questions, config, {
          isReviewMode: true,
          reviewUserAnswers: [],
          reviewUserMultiAnswers: [[0, 1]],
        })

        expect(state.isCorrect).toBe(true)
      })
    })
  })
})

describe('Re-answer score handling', () => {
  const questions = [
    Question.create({
      id: 'q1',
      category: 'tools',
      difficulty: 'beginner',
      question: 'Q1',
      options: [{ text: 'A' }, { text: 'B', wrongFeedback: 'wrong' }],
      correctIndex: 0,
      explanation: 'E1',
    }),
    Question.create({
      id: 'q2',
      category: 'tools',
      difficulty: 'beginner',
      question: 'Q2',
      options: [{ text: 'A' }, { text: 'B', wrongFeedback: 'wrong' }],
      correctIndex: 0,
      explanation: 'E2',
    }),
  ]

  const config: QuizSessionConfig = {
    mode: 'random',
    questionCount: 2,
    timeLimit: null,
    shuffleQuestions: false,
    shuffleOptions: false,
    categoryFilter: null,
    difficultyFilter: null,
  }

  it('should not double-count score on re-answer', () => {
    let state = QuizSessionService.createInitialState(questions, config)

    // Answer Q1 correctly
    state = { ...state, selectedAnswer: 0 }
    const r1 = QuizSessionService.submitAnswer(state)!
    expect(r1.newState.score).toBe(1)
    expect(r1.newState.answeredCount).toBe(1)

    // Go to Q2 and back to Q1 (simulate re-visit)
    const q2State = QuizSessionService.nextQuestion(r1.newState)
    const backState: typeof q2State = {
      ...q2State,
      currentIndex: 0,
      selectedAnswer: 1,
      isAnswered: false,
      isCorrect: null,
    }

    // Re-answer Q1 wrongly
    const r2 = QuizSessionService.submitAnswer(backState)!
    expect(r2.newState.score).toBe(0) // was 1, now wrong = 0
    expect(r2.newState.answeredCount).toBe(1) // not incremented
  })

  it('should correctly track answerHistory on re-answer', () => {
    let state = QuizSessionService.createInitialState(questions, config)

    // Answer Q1 wrongly
    state = { ...state, selectedAnswer: 1 }
    const r1 = QuizSessionService.submitAnswer(state)!
    expect(r1.newState.answerHistory.get(0)?.isCorrect).toBe(false)

    // Re-answer Q1 correctly
    const retry: typeof r1.newState = { ...r1.newState, selectedAnswer: 0, isAnswered: false, isCorrect: null }
    const r2 = QuizSessionService.submitAnswer(retry)!
    expect(r2.newState.answerHistory.get(0)?.isCorrect).toBe(true)
    expect(r2.newState.score).toBe(1)
    expect(r2.newState.answeredCount).toBe(1)
  })
})

describe('weightedSampleByCategory', () => {
  it('should sample questions proportional to category weights', () => {
    // Create test questions: 50 each for 3 categories with different weights
    const questions: Question[] = []
    const cats = [
      { id: 'workers', weight: 15 }, // should get ~15/35 * 30 ≈ 13
      { id: 'kv-cache', weight: 10 }, // should get ~10/35 * 30 ≈ 9
      { id: 'd1', weight: 10 }, // should get ~10/35 * 30 ≈ 9
    ]
    for (const cat of cats) {
      for (let i = 0; i < 50; i++) {
        questions.push(
          Question.create({
            id: `${cat.id}-${i}`,
            category: cat.id,
            difficulty: 'beginner',
            question: `Q ${cat.id} ${i}`,
            options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }],
            correctIndex: 0,
            explanation: 'test',
          })
        )
      }
    }

    const result = QuizSessionService.weightedSampleByCategory(questions, 30)
    expect(result).toHaveLength(30)

    // Count by category
    const counts: Record<string, number> = {}
    for (const q of result) {
      counts[q.category] = (counts[q.category] ?? 0) + 1
    }

    // workers (weight 15) should get more than kv-cache/d1 (weight 10)
    expect(counts.workers).toBeGreaterThan(counts['kv-cache'] ?? 0)
    expect(counts.workers).toBeGreaterThan(counts.d1 ?? 0)
    // All categories should be represented
    expect(Object.keys(counts)).toHaveLength(3)
  })

  it('should handle category with fewer questions than target', () => {
    const questions: Question[] = []
    // memory: only 3 questions but high weight
    for (let i = 0; i < 3; i++) {
      questions.push(
        Question.create({
          id: `mem-${i}`,
          category: 'memory',
          difficulty: 'beginner',
          question: `Q mem ${i}`,
          options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }],
          correctIndex: 0,
          explanation: 'test',
        })
      )
    }
    // session: 50 questions
    for (let i = 0; i < 50; i++) {
      questions.push(
        Question.create({
          id: `ses-${i}`,
          category: 'session',
          difficulty: 'beginner',
          question: `Q ses ${i}`,
          options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }],
          correctIndex: 0,
          explanation: 'test',
        })
      )
    }

    const result = QuizSessionService.weightedSampleByCategory(questions, 20)
    expect(result).toHaveLength(20)

    const counts: Record<string, number> = {}
    for (const q of result) {
      counts[q.category] = (counts[q.category] ?? 0) + 1
    }
    // memory should use all 3 available, rest goes to session
    expect(counts.memory).toBe(3)
    expect(counts.session).toBe(17)
  })
})

// ================================================
// Edge cases: mode fallbacks and boundary conditions
// ================================================

const createQ = (id: string, category = 'tools', difficulty: 'beginner' | 'intermediate' | 'advanced' = 'beginner') =>
  Question.create({
    id,
    question: `Test question ${id}`,
    options: [{ text: 'Option A' }, { text: 'Option B' }, { text: 'Option C' }],
    correctIndex: 0,
    explanation: 'Test explanation',
    category,
    difficulty,
  })

const defaultConfig = (overrides: Partial<QuizSessionConfig> = {}): QuizSessionConfig => ({
  mode: 'random',
  categoryFilter: null,
  difficultyFilter: null,
  questionCount: null,
  timeLimit: null,
  shuffleQuestions: false,
  shuffleOptions: false,
  ...overrides,
})

describe('prepareSessionQuestions edge cases', () => {
  it('weak mode with all questions mastered falls back to full list', () => {
    const questions = [createQ('q1'), createQ('q2'), createQ('q3')]
    const config = defaultConfig({ mode: 'weak' })

    let progress = UserProgress.empty()
    for (const q of questions) {
      progress = progress.recordAnswer(q.id, 'tools', true)
      progress = progress.recordAnswer(q.id, 'tools', true)
    }

    const result = QuizSessionService.prepareSessionQuestions(questions, config, progress, 50, 1)
    expect(result.length).toBe(questions.length)
  })

  it('quick mode with no SRS-due questions uses oldest answered', () => {
    const questions = [createQ('q1'), createQ('q2'), createQ('q3')]
    const config = defaultConfig({ mode: 'quick', questionCount: 3 })

    let progress = UserProgress.empty()
    for (const q of questions) {
      progress = progress.recordAnswer(q.id, 'tools', true)
    }

    const result = QuizSessionService.prepareSessionQuestions(questions, config, progress)
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('category filter matching 0 questions returns empty', () => {
    const questions = [createQ('q1', 'tools'), createQ('q2', 'tools')]
    const config = defaultConfig({ mode: 'category', categoryFilter: 'nonexistent' })
    const progress = UserProgress.empty()

    const result = QuizSessionService.prepareSessionQuestions(questions, config, progress)
    expect(result).toHaveLength(0)
  })
})

describe('submitAnswer diff scoring on retry', () => {
  it('wrong→retry→correct applies +1 delta', () => {
    const questions = [createQ('q1')]
    const config = defaultConfig()
    let state = QuizSessionService.createInitialState(questions, config)

    // First answer: wrong (option 1, correct is 0)
    state = { ...state, selectedAnswer: 1 }
    const result1 = QuizSessionService.submitAnswer(state)!
    expect(result1.isCorrect).toBe(false)
    state = result1.newState
    expect(state.score).toBe(0)

    // Retry
    state = QuizSessionService.retryQuestion(state)

    // Re-answer: correct
    state = { ...state, selectedAnswer: 0 }
    const result2 = QuizSessionService.submitAnswer(state)!
    expect(result2.isCorrect).toBe(true)
    // Diff score: was wrong (0) → now correct (1) = +1
    expect(result2.newState.score).toBe(1)
  })

  it('wrong→retry→wrong keeps score at 0', () => {
    const questions = [createQ('q1')]
    const config = defaultConfig()
    let state = QuizSessionService.createInitialState(questions, config)

    state = { ...state, selectedAnswer: 1 }
    const result1 = QuizSessionService.submitAnswer(state)!
    state = result1.newState
    expect(state.score).toBe(0)

    state = QuizSessionService.retryQuestion(state)
    state = { ...state, selectedAnswer: 2 }
    const result2 = QuizSessionService.submitAnswer(state)!
    expect(result2.newState.score).toBe(0)
  })
})
