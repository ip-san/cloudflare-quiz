import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QuizSessionState } from '@/domain/services/QuizSessionService'
import { recordRecommendFeedback } from './utils'

vi.mock('@/lib/analytics', () => ({
  trackRecommendFeedback: vi.fn(),
  trackQuizComplete: vi.fn(),
  trackScenarioComplete: vi.fn(),
  setUserProperties: vi.fn(),
}))

import { trackRecommendFeedback as trackMock } from '@/lib/analytics'

function makeSessionState(
  entries: Array<{ idx: number; isCorrect: boolean; id: string; category: string }>
): QuizSessionState {
  const questions = entries.map((e) => ({
    id: e.id,
    category: e.category,
    difficulty: 'beginner' as const,
    question: 'Q',
    options: [{ text: 'A' }, { text: 'B' }],
    correctIndex: 0,
    explanation: '',
    referenceUrl: '',
  }))

  const answerHistory = new Map(
    entries.map((e) => [e.idx, { selectedAnswer: e.isCorrect ? 0 : 1, selectedAnswers: [], isCorrect: e.isCorrect }])
  )

  return {
    questions,
    answerHistory,
    config: { questionCount: entries.length, timeLimit: null, mode: 'normal' },
    currentIndex: 0,
    selectedAnswer: null,
    selectedAnswers: [],
    isAnswered: false,
    isCorrect: null,
    score: 0,
    answeredCount: entries.length,
    isCompleted: true,
    startedAt: Date.now(),
    timeRemaining: null,
    isReviewMode: false,
    reviewUserAnswers: [],
    reviewUserMultiAnswers: [],
  } as unknown as QuizSessionState
}

describe('recordRecommendFeedback', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('saves feedback entry to localStorage', () => {
    const state = makeSessionState([
      { idx: 0, isCorrect: true, id: 'mem-001', category: 'memory' },
      { idx: 1, isCorrect: false, id: 'tool-001', category: 'tools' },
    ])

    recordRecommendFeedback(state)

    const stored = JSON.parse(localStorage.getItem('recommend-feedback')!)
    expect(stored).toHaveLength(1)
    expect(stored[0].total).toBe(2)
    expect(stored[0].correct).toBe(1)
    expect(stored[0].accuracy).toBe(50)
    expect(stored[0].results).toEqual([
      { id: 'mem-001', correct: true, category: 'memory' },
      { id: 'tool-001', correct: false, category: 'tools' },
    ])
  })

  it('does nothing when answerHistory is empty', () => {
    const state = makeSessionState([])

    recordRecommendFeedback(state)

    expect(localStorage.getItem('recommend-feedback')).toBeNull()
    expect(trackMock).not.toHaveBeenCalled()
  })

  it('calls trackRecommendFeedback with correct values', () => {
    const state = makeSessionState([
      { idx: 0, isCorrect: true, id: 'mem-001', category: 'memory' },
      { idx: 1, isCorrect: true, id: 'mem-002', category: 'memory' },
      { idx: 2, isCorrect: false, id: 'tool-001', category: 'tools' },
    ])

    recordRecommendFeedback(state)

    expect(trackMock).toHaveBeenCalledWith(3, 2, 67)
  })

  it('appends to existing localStorage data', () => {
    localStorage.setItem('recommend-feedback', JSON.stringify([{ date: '2026-04-10', total: 5, correct: 3 }]))

    const state = makeSessionState([{ idx: 0, isCorrect: true, id: 'mem-001', category: 'memory' }])

    recordRecommendFeedback(state)

    const stored = JSON.parse(localStorage.getItem('recommend-feedback')!)
    expect(stored).toHaveLength(2)
    expect(stored[0].date).toBe('2026-04-10')
    expect(stored[1].total).toBe(1)
  })

  it('keeps only last 30 entries', () => {
    const existing = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      total: 1,
      correct: 1,
    }))
    localStorage.setItem('recommend-feedback', JSON.stringify(existing))

    const state = makeSessionState([{ idx: 0, isCorrect: true, id: 'mem-001', category: 'memory' }])

    recordRecommendFeedback(state)

    const stored = JSON.parse(localStorage.getItem('recommend-feedback')!)
    expect(stored).toHaveLength(30)
    expect(stored[0].date).toBe('2026-03-02') // first entry dropped
  })

  it('falls back on localStorage parse error', () => {
    localStorage.setItem('recommend-feedback', 'INVALID JSON')

    const state = makeSessionState([{ idx: 0, isCorrect: false, id: 'tool-001', category: 'tools' }])

    recordRecommendFeedback(state)

    const stored = JSON.parse(localStorage.getItem('recommend-feedback')!)
    expect(stored).toHaveLength(1)
    expect(stored[0].accuracy).toBe(0)
  })

  it('skips questions not found in session', () => {
    const state = makeSessionState([{ idx: 0, isCorrect: true, id: 'mem-001', category: 'memory' }])
    // Add an answerHistory entry pointing to a non-existent question index
    ;(state.answerHistory as Map<number, unknown>).set(99, {
      selectedAnswer: 0,
      selectedAnswers: [],
      isCorrect: true,
    })

    recordRecommendFeedback(state)

    const stored = JSON.parse(localStorage.getItem('recommend-feedback')!)
    expect(stored[0].results).toHaveLength(1) // only the valid one
  })
})
