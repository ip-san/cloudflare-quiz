import { useCallback, useEffect } from 'react'
import type { Question } from '@/domain/entities/Question'

interface UseQuizKeyboardOptions {
  quiz: Question | null
  selectedAnswer: number | null
  selectedAnswers: readonly number[]
  isAnswered: boolean
  isCorrect: boolean | null
  isReviewMode: boolean
  isMultiSelect: boolean
  isModalOpen: boolean
  selectAnswer: (index: number) => void
  toggleAnswer: (index: number) => void
  submitAnswer: () => void
  nextQuestion: () => void
  retryQuestion: () => void
}

/**
 * QuizCard のキーボードナビゲーションロジックを分離
 */
export function useQuizKeyboard({
  quiz,
  selectedAnswer,
  selectedAnswers,
  isAnswered,
  isCorrect,
  isReviewMode,
  isMultiSelect,
  isModalOpen,
  selectAnswer,
  toggleAnswer,
  submitAnswer,
  nextQuestion,
  retryQuestion,
}: UseQuizKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!quiz) return
      if (isModalOpen) return

      const optionCount = quiz.options.length

      // Retry shortcut (r key) - not available in review mode
      if (e.key === 'r' && isAnswered && isCorrect === false && !isReviewMode) {
        e.preventDefault()
        retryQuestion()
        return
      }

      if (isMultiSelect) {
        switch (e.key) {
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
            if (!isAnswered) {
              const index = parseInt(e.key) - 1
              if (index < optionCount) toggleAnswer(index)
            }
            break
          case 'Enter':
            e.preventDefault()
            if (!isAnswered && selectedAnswers.length > 0) submitAnswer()
            else if (isAnswered) nextQuestion()
            break
          case ' ':
            e.preventDefault()
            if (isAnswered) nextQuestion()
            break
        }
      } else {
        switch (e.key) {
          case 'ArrowUp':
          case 'ArrowLeft':
            e.preventDefault()
            if (!isAnswered) {
              const prevIndex =
                selectedAnswer === null ? optionCount - 1 : (selectedAnswer - 1 + optionCount) % optionCount
              selectAnswer(prevIndex)
            }
            break
          case 'ArrowDown':
          case 'ArrowRight':
            e.preventDefault()
            if (!isAnswered) {
              const nextIdx = selectedAnswer === null ? 0 : (selectedAnswer + 1) % optionCount
              selectAnswer(nextIdx)
            }
            break
          case 'Enter':
          case ' ':
            e.preventDefault()
            if (!isAnswered && selectedAnswer !== null) submitAnswer()
            else if (isAnswered) nextQuestion()
            break
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
            if (!isAnswered) {
              const index = parseInt(e.key) - 1
              if (index < optionCount) selectAnswer(index)
            }
            break
        }
      }
    },
    [
      quiz,
      selectedAnswer,
      selectedAnswers,
      isAnswered,
      isCorrect,
      isReviewMode,
      isMultiSelect,
      isModalOpen,
      selectAnswer,
      toggleAnswer,
      submitAnswer,
      nextQuestion,
      retryQuestion,
    ]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
