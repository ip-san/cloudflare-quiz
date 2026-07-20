/**
 * ResumeSlice unit tests — suspend, resume, discard, review session
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { UserProgress } from '@/domain/entities/UserProgress'
import { useQuizStore } from '../quizStore'

/** シングルセレクト問題のIDをN個取得 */
function getSingleSelectIds(count: number): string[] {
  const all = useQuizStore.getState().allQuestions
  return all
    .filter((q) => !Array.isArray(q.correctIndex))
    .slice(0, count)
    .map((q) => q.id)
}

// Helper: answer the current question (handles both single and multi-select)
function answerCurrentQuestion(correct: boolean) {
  const state = useQuizStore.getState()
  const session = state.sessionState!
  const q = session.questions[session.currentIndex]
  const ci = q.correctIndex
  const isMulti = Array.isArray(ci)

  if (correct) {
    if (isMulti) {
      for (const idx of ci as number[]) state.toggleAnswer(idx)
    } else {
      state.selectAnswer(ci)
    }
  } else {
    const correctSet = new Set(isMulti ? ci : [ci])
    const wrongIndex = q.options.findIndex((_, i) => !correctSet.has(i))
    if (isMulti) {
      state.toggleAnswer(wrongIndex)
    } else {
      state.selectAnswer(wrongIndex)
    }
  }
  state.submitAnswer()
}

describe('resumeSlice', () => {
  beforeEach(async () => {
    localStorage.clear()
    useQuizStore.setState({
      viewState: 'menu',
      sessionState: null,
      sessionWrongAnswers: [],
      savedSession: null,
      activeScenarioId: null,
      sessionLabel: null,
      userProgress: UserProgress.empty(),
    })
    await useQuizStore.getState().initialize()
  })

  describe('suspendSession', () => {
    it('saves session to localStorage and returns to menu', () => {
      // Requests 5 but the pool sizes with whatever is bundled (>=1 in tmp data,
      // 100+ once Phase 6 lands) — assert against the actual ids used, not a magic number.
      const ids = getSingleSelectIds(5)
      useQuizStore.getState().startSessionWithIds(ids)
      answerCurrentQuestion(true)

      useQuizStore.getState().suspendSession()

      const state = useQuizStore.getState()
      expect(state.viewState).toBe('menu')
      expect(state.sessionState).toBeNull()
      expect(state.savedSession).not.toBeNull()
      expect(state.savedSession!.questionIds.length).toBe(ids.length)
      expect(state.savedSession!.score).toBe(1)
    })

    it('does not save completed session', () => {
      useQuizStore.getState().startSessionWithIds(getSingleSelectIds(1))
      answerCurrentQuestion(true)
      useQuizStore.getState().finishTest()

      // Session is completed, suspendSession should just go to menu
      useQuizStore.getState().suspendSession()
      const state = useQuizStore.getState()
      expect(state.viewState).toBe('menu')
    })
  })

  describe('resumeSession', () => {
    it('restores session state from savedSession', () => {
      const ids = getSingleSelectIds(5)
      useQuizStore.getState().startSessionWithIds(ids)

      // Answer 2 questions
      answerCurrentQuestion(true)
      useQuizStore.getState().nextQuestion()
      answerCurrentQuestion(false)

      // Suspend
      useQuizStore.getState().suspendSession()
      expect(useQuizStore.getState().savedSession).not.toBeNull()

      // Resume
      useQuizStore.getState().resumeSession()
      const state = useQuizStore.getState()
      expect(state.viewState).toBe('quiz')
      expect(state.sessionState).not.toBeNull()
      expect(state.sessionState!.score).toBe(1)
      expect(state.sessionState!.answeredCount).toBe(2)
      expect(state.sessionState!.questions.length).toBe(ids.length)
      expect(state.savedSession).toBeNull()
    })

    it('restores answerHistory as Map with correct entries', () => {
      useQuizStore.getState().startSessionWithIds(getSingleSelectIds(3))
      answerCurrentQuestion(true)
      useQuizStore.getState().nextQuestion()
      answerCurrentQuestion(false)

      useQuizStore.getState().suspendSession()
      useQuizStore.getState().resumeSession()

      const session = useQuizStore.getState().sessionState!
      expect(session.answerHistory.size).toBe(2)
      expect(session.answerHistory.get(0)?.isCorrect).toBe(true)
      expect(session.answerHistory.get(1)?.isCorrect).toBe(false)
    })

    it('does nothing when no savedSession', () => {
      useQuizStore.getState().resumeSession()
      expect(useQuizStore.getState().viewState).toBe('menu')
    })

    it('falls back currentChapterId to 0 when saved chapter no longer exists', () => {
      // Start overview session which creates overviewChapterState
      useQuizStore.getState().startSession({ mode: 'overview' })
      const session = useQuizStore.getState().sessionState
      if (!session || !session.overviewChapterState) return // skip if no overview-tagged questions

      // Suspend to create savedSession
      useQuizStore.getState().suspendSession()
      const saved = useQuizStore.getState().savedSession!

      // Tamper with saved data: set currentChapterId to non-existent chapter
      const tampered = {
        ...saved,
        overviewChapterState: {
          ...saved.overviewChapterState!,
          currentChapterId: 999,
        },
      }
      useQuizStore.setState({ savedSession: tampered })

      // Resume — should fall back to chapter 0
      useQuizStore.getState().resumeSession()
      const resumed = useQuizStore.getState().sessionState!
      expect(resumed.overviewChapterState?.currentChapterId).toBe(0)
    })
  })

  describe('discardSavedSession', () => {
    it('clears savedSession and localStorage', () => {
      useQuizStore.getState().startSessionWithIds(getSingleSelectIds(3))
      answerCurrentQuestion(true)
      useQuizStore.getState().suspendSession()

      expect(useQuizStore.getState().savedSession).not.toBeNull()

      useQuizStore.getState().discardSavedSession()
      expect(useQuizStore.getState().savedSession).toBeNull()
    })
  })

  describe('startReviewSession', () => {
    it('creates review session from wrong answers', () => {
      useQuizStore.getState().startSessionWithIds(getSingleSelectIds(3))

      // Answer all wrong
      for (let i = 0; i < 3; i++) {
        answerCurrentQuestion(false)
        if (i < 2) useQuizStore.getState().nextQuestion()
      }
      useQuizStore.getState().finishTest()

      const wrongCount = useQuizStore.getState().sessionWrongAnswers.length
      expect(wrongCount).toBe(3)

      useQuizStore.getState().startReviewSession()
      const session = useQuizStore.getState().sessionState!
      expect(session.isReviewMode).toBe(true)
      expect(session.questions.length).toBe(wrongCount)
    })

    it('does nothing when no wrong answers', () => {
      useQuizStore.getState().startSessionWithIds(getSingleSelectIds(1))
      answerCurrentQuestion(true)
      useQuizStore.getState().finishTest()

      // No wrong answers
      expect(useQuizStore.getState().sessionWrongAnswers.length).toBe(0)
      useQuizStore.getState().startReviewSession()
      // Should not start a new session (viewState stays result)
      expect(useQuizStore.getState().viewState).toBe('result')
    })
  })
})
