/**
 * Session Answer Slice - Answer submission, navigation, and computed getters
 *
 * Handles: selectAnswer, toggleAnswer, submitAnswer, nextQuestion, previousQuestion,
 * goToQuestion, retryQuestion, useHint, getCurrentQuestion, getProgress
 */

import { Question } from '@/domain/entities/Question'
import { QuizSessionService } from '@/domain/services/QuizSessionService'
import { getProgressRepository } from '@/infrastructure'
import { getSessionRepository } from '@/infrastructure/persistence/SessionRepository'
import { reportError, trackAnswer } from '@/lib/analytics'
import { recordCompletedSession, type StoreGet, type StoreSet, saveSessionSnapshot } from '../utils'

export interface SessionAnswerSlice {
  retryQuestion: () => void
  selectAnswer: (index: number) => void
  toggleAnswer: (index: number) => void
  submitAnswer: () => void
  nextQuestion: () => void
  previousQuestion: () => void
  goToQuestion: (index: number) => void
  useHint: () => void

  // Computed getters
  getCurrentQuestion: () => Question | null
  getProgress: () => { current: number; total: number }
}

export const createSessionAnswerSlice = (set: StoreSet, get: StoreGet): SessionAnswerSlice => ({
  retryQuestion: () => {
    const state = get()
    if (!state.sessionState) return

    const newSessionState = QuizSessionService.retryQuestion(state.sessionState)
    set({ sessionState: newSessionState })

    if (!newSessionState.isReviewMode) {
      saveSessionSnapshot(newSessionState, state.sessionWrongAnswers, () => ({
        activeScenarioId: get().activeScenarioId,
        sessionLabel: get().sessionLabel,
      }))
    }
  },

  selectAnswer: (index) => {
    const state = get()
    if (!state.sessionState) return

    const newSessionState = QuizSessionService.selectAnswer(state.sessionState, index)
    set({ sessionState: newSessionState })
  },

  toggleAnswer: (index) => {
    const state = get()
    if (!state.sessionState) return

    const newSessionState = QuizSessionService.toggleAnswer(state.sessionState, index)
    set({ sessionState: newSessionState })
  },

  submitAnswer: () => {
    const state = get()
    if (!state.sessionState) return

    const result = QuizSessionService.submitAnswer(state.sessionState)
    if (!result) return

    const { newState, isCorrect } = result
    const currentQuestion = QuizSessionService.getCurrentQuestion(state.sessionState)

    if (currentQuestion) {
      const quizType: 'practical' | 'trivia' | 'neutral' = currentQuestion.tags.includes('practical')
        ? 'practical'
        : currentQuestion.tags.includes('trivia')
          ? 'trivia'
          : 'neutral'
      trackAnswer(currentQuestion.id, currentQuestion.category, currentQuestion.difficulty, isCorrect, quizType)

      if (state.sessionState.isReviewMode) {
        set({ sessionState: newState })
        return
      }

      const isRetry = state.sessionState.answerHistory.has(state.sessionState.currentIndex)
      const updatedProgress = state.userProgress.recordAnswer(
        currentQuestion.id,
        currentQuestion.category,
        isCorrect,
        isRetry,
        currentQuestion.difficulty
      )

      const filteredWrongAnswers = state.sessionWrongAnswers.filter((w) => w.questionId !== currentQuestion.id)
      const newWrongAnswers = isCorrect
        ? filteredWrongAnswers
        : [
            ...filteredWrongAnswers,
            {
              questionId: currentQuestion.id,
              selectedAnswer: state.sessionState.selectedAnswer ?? -1,
              selectedAnswers: currentQuestion.isMultiSelect ? [...state.sessionState.selectedAnswers] : undefined,
            },
          ]

      // In defer mode (実力テスト), auto-advance to next unanswered question after submission
      let stateToSave = newState
      if (newState.deferFeedback) {
        let nextIdx = newState.currentIndex + 1
        while (nextIdx < newState.questions.length && newState.answerHistory.has(nextIdx)) {
          nextIdx++
        }
        if (nextIdx < newState.questions.length) {
          stateToSave = {
            ...newState,
            currentIndex: nextIdx,
            selectedAnswer: null,
            selectedAnswers: Object.freeze([]),
            isAnswered: false,
            isCorrect: null,
            hintUsed: false,
          }
        }
      }

      set({
        sessionState: stateToSave,
        userProgress: updatedProgress,
        sessionWrongAnswers: newWrongAnswers,
      })

      getProgressRepository()
        .save(updatedProgress)
        .catch((error) => reportError(error, 'progress_save_answer', 'Failed to save progress after answer'))

      saveSessionSnapshot(stateToSave, newWrongAnswers, () => ({
        activeScenarioId: get().activeScenarioId,
        sessionLabel: get().sessionLabel,
      }))
    } else {
      set({ sessionState: newState })
    }
  },

  nextQuestion: () => {
    const state = get()
    if (!state.sessionState) return

    if (state.sessionState.deferFeedback) {
      const session = state.sessionState
      if (session.currentIndex < session.questions.length - 1) {
        const nextIdx = session.currentIndex + 1
        const record = session.answerHistory.get(nextIdx)
        const newState = {
          ...session,
          currentIndex: nextIdx,
          selectedAnswer: record?.selectedAnswer ?? null,
          selectedAnswers: record?.selectedAnswers ?? Object.freeze([]),
          isAnswered: false,
          isCorrect: null,
          hintUsed: false,
        }
        set({ sessionState: newState })
        saveSessionSnapshot(newState, state.sessionWrongAnswers, () => ({
          activeScenarioId: get().activeScenarioId,
          sessionLabel: get().sessionLabel,
        }))
      }
      return
    }

    const session = state.sessionState

    if (session.currentIndex >= session.questions.length - 1 && !session.isAnswered) {
      return
    }

    const newSessionState = QuizSessionService.nextQuestion(session)

    if (newSessionState.isCompleted) {
      getSessionRepository().clear()
      recordCompletedSession(
        newSessionState,
        () => get().userProgress,
        (p) => set({ userProgress: p }),
        get().activeScenarioId
      )
      set({
        sessionState: newSessionState,
        viewState: 'result',
      })
    } else {
      set({ sessionState: newSessionState })
      if (!newSessionState.isReviewMode) {
        saveSessionSnapshot(newSessionState, get().sessionWrongAnswers, () => ({
          activeScenarioId: get().activeScenarioId,
          sessionLabel: get().sessionLabel,
        }))
      }
    }
  },

  previousQuestion: () => {
    const state = get()
    if (!state.sessionState) return
    const session = state.sessionState
    if (session.currentIndex <= 0) return

    const prevIdx = session.currentIndex - 1

    if (session.isReviewMode) {
      const question = session.questions[prevIdx]
      if (question?.isMultiSelect) {
        const userMultiAnswer = session.reviewUserMultiAnswers[prevIdx] ?? []
        set({
          sessionState: {
            ...session,
            currentIndex: prevIdx,
            selectedAnswer: null,
            selectedAnswers: Object.freeze([...userMultiAnswer]),
            isAnswered: true,
            isCorrect: question.isCorrectMultiAnswer([...userMultiAnswer]),
            hintUsed: false,
          },
        })
      } else {
        const userAnswer = session.reviewUserAnswers[prevIdx] ?? null
        set({
          sessionState: {
            ...session,
            currentIndex: prevIdx,
            selectedAnswer: userAnswer,
            selectedAnswers: Object.freeze([]),
            isAnswered: true,
            isCorrect: question && userAnswer !== null ? question.isCorrectAnswer(userAnswer) : null,
            hintUsed: false,
          },
        })
      }
      return
    }

    const record = session.answerHistory.get(prevIdx)

    set({
      sessionState: {
        ...session,
        currentIndex: prevIdx,
        selectedAnswer: record?.selectedAnswer ?? null,
        selectedAnswers: record?.selectedAnswers ?? Object.freeze([]),
        isAnswered: record !== undefined,
        isCorrect: record?.isCorrect ?? null,
        hintUsed: false,
      },
    })
  },

  goToQuestion: (index: number) => {
    const state = get()
    if (!state.sessionState) return
    const session = state.sessionState
    if (index < 0 || index >= session.questions.length) return

    const record = session.answerHistory.get(index)

    set({
      sessionState: {
        ...session,
        currentIndex: index,
        selectedAnswer: record?.selectedAnswer ?? null,
        selectedAnswers: record?.selectedAnswers ?? Object.freeze([]),
        isAnswered: record !== undefined,
        isCorrect: record?.isCorrect ?? null,
        hintUsed: false,
      },
    })
  },

  useHint: () => {
    const state = get()
    if (!state.sessionState) return
    // biome-ignore lint/correctness/useHookAtTopLevel: QuizSessionService.useHint is not a React Hook
    const newSessionState = QuizSessionService.useHint(state.sessionState)
    set({ sessionState: newSessionState })
  },

  getCurrentQuestion: () => {
    const state = get()
    if (!state.sessionState) return null
    return QuizSessionService.getCurrentQuestion(state.sessionState)
  },

  getProgress: () => {
    const state = get()
    if (!state.sessionState) {
      return { current: 0, total: 0 }
    }
    return QuizSessionService.getProgress(state.sessionState)
  },
})
