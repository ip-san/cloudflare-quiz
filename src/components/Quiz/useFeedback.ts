import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Question } from '@/domain/entities/Question'
import { platformAPI } from '@/lib/platformAPI'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'
import { useQuizStore } from '@/stores/quizStore'

export type PromptType = 'explain' | 'practical' | 'compare'

export interface UseFeedbackReturn {
  // Store state
  sessionState: ReturnType<typeof useQuizStore.getState>['sessionState']
  userProgress: ReturnType<typeof useQuizStore.getState>['userProgress']
  // Derived from sessionState + quiz
  selectedAnswer: number | null
  selectedAnswers: readonly number[]
  selectedOption: Question['options'][number] | null
  isReviewMode: boolean
  isMultiSelect: boolean | undefined
  // Animation state
  animate: boolean
  noMotion: boolean
  // UI state
  copied: boolean
  markdownCopied: boolean
  showPrompts: boolean
  setShowPrompts: (value: boolean | ((prev: boolean) => boolean)) => void
  // Handlers
  handleOpenReference: () => Promise<void>
  handleCopyAIPrompt: (type: PromptType) => Promise<void>
  handleCopyMarkdown: () => Promise<void>
}

export function useFeedback(quiz: Question): UseFeedbackReturn {
  const { sessionState, userProgress } = useQuizStore(
    useShallow((state) => ({ sessionState: state.sessionState, userProgress: state.userProgress }))
  )

  const [copied, setCopied] = useState(false)
  const [markdownCopied, setMarkdownCopied] = useState(false)
  const [animate, setAnimate] = useState(false)
  const [showPrompts, setShowPrompts] = useState(false)

  const selectedAnswer = sessionState?.selectedAnswer ?? null
  const selectedAnswers = sessionState?.selectedAnswers ?? []
  const selectedOption = selectedAnswer !== null ? quiz.options[selectedAnswer] : null
  const isReviewMode = sessionState?.isReviewMode ?? false
  const isMultiSelect = quiz.isMultiSelect

  const noMotion = usePrefersReducedMotion()

  // Trigger animations after mount
  useEffect(() => {
    if (noMotion) {
      setAnimate(true)
      return
    }
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [noMotion])

  const handleOpenReference = async () => {
    if (!quiz.referenceUrl) return

    try {
      const success = await platformAPI.openExternal(quiz.referenceUrl)
      if (!success) {
        console.warn('Failed to open reference URL')
      }
    } catch (error) {
      console.error('Error opening reference URL:', error)
    }
  }

  const handleCopyAIPrompt = async (type: PromptType) => {
    try {
      const prompt = quiz.generateAIPromptByType(type)

      const success = await platformAPI.copyToClipboard(prompt)
      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        console.warn('Failed to copy to clipboard')
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error)
    }
  }

  const handleCopyMarkdown = async () => {
    try {
      const markdown = quiz.toMarkdown()

      const success = await platformAPI.copyToClipboard(markdown)
      if (success) {
        setMarkdownCopied(true)
        setTimeout(() => setMarkdownCopied(false), 2000)
      } else {
        console.warn('Failed to copy to clipboard')
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error)
    }
  }

  return {
    sessionState,
    userProgress,
    selectedAnswer,
    selectedAnswers,
    selectedOption,
    isReviewMode,
    isMultiSelect,
    animate,
    noMotion,
    copied,
    markdownCopied,
    showPrompts,
    setShowPrompts,
    handleOpenReference,
    handleCopyAIPrompt,
    handleCopyMarkdown,
  }
}
