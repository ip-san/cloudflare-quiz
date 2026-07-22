import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import { locale } from '@/config/locale'
import type { QuizSessionState } from '@/domain/services/QuizSessionService'
import { haptics } from '@/lib/haptics'

interface QuizBottomBarProps {
  sessionState: QuizSessionState | null
  currentIndex: number
  isAnswered: boolean
  isMultiSelect: boolean
  selectedAnswer: number | null
  selectedAnswers: readonly number[]
  deferFeedback: boolean
  canGoBack: boolean
  previousQuestion: () => void
  nextQuestion: () => void
  submitAnswer: () => void
  goToQuestion: (index: number) => void
  finishTest: () => void
}

/**
 * クイズ画面のボトムナビゲーションバー
 * deferFeedback（実力テスト）と通常モードで異なるUIを表示
 */
export function QuizBottomBar({
  sessionState,
  currentIndex,
  isAnswered,
  isMultiSelect,
  selectedAnswer,
  selectedAnswers,
  deferFeedback,
  canGoBack,
  previousQuestion,
  nextQuestion,
  submitAnswer,
  goToQuestion,
  finishTest,
}: QuizBottomBarProps) {
  const questionsLength = sessionState?.questions.length ?? 0
  const isLastQuestion = currentIndex >= questionsLength - 1

  if (deferFeedback) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-stone-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-2 dark:border-stone-700 dark:bg-stone-900 sm:relative sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0 sm:pt-0 sm:dark:bg-transparent">
        {/* Question dots indicator */}
        <div className="mb-2 flex max-h-14 flex-wrap justify-center gap-1 overflow-hidden sm:mb-3 sm:max-h-none">
          {(sessionState?.questions ?? []).map((_, i) => {
            const answered = sessionState?.answerHistory?.has(i)
            const isCurrent = i === currentIndex
            return (
              <button
                key={i}
                onClick={() => goToQuestion(i)}
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  isCurrent ? 'scale-125 bg-cf-accent' : answered ? 'bg-green-400' : 'bg-stone-300'
                }`}
                aria-label={locale.quizCard.questionLabel(i + 1, !!answered)}
              />
            )
          })}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              haptics.light()
              previousQuestion()
            }}
            disabled={currentIndex <= 0}
            className="tap-highlight rounded-2xl border-2 border-stone-300 px-3 py-3 text-stone-500 disabled:opacity-40 dark:border-stone-600 dark:text-stone-400"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {(() => {
            const alreadyAnswered = sessionState?.answerHistory?.has(currentIndex)
            if (!isAnswered && !alreadyAnswered) {
              return (
                <SubmitButton
                  isMultiSelect={isMultiSelect}
                  selectedAnswer={selectedAnswer}
                  selectedAnswers={selectedAnswers}
                  submitAnswer={submitAnswer}
                />
              )
            }
            return (
              <button
                onClick={() => finishTest()}
                className="tap-highlight flex flex-1 items-center justify-center gap-2 rounded-2xl bg-green-600 py-3 text-base font-semibold text-white"
              >
                <Send className="h-4 w-4" />
                {locale.quizCard.finishTest(sessionState?.answerHistory?.size ?? 0, questionsLength)}
              </button>
            )
          })()}
          <button
            onClick={() => {
              haptics.light()
              nextQuestion()
            }}
            disabled={isLastQuestion}
            className="tap-highlight rounded-2xl border-2 border-stone-300 px-3 py-3 text-stone-500 disabled:opacity-40 dark:border-stone-600 dark:text-stone-400"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    )
  }

  // Normal mode
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-stone-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-2 dark:border-stone-700 dark:bg-stone-900 sm:relative sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0 sm:pt-0 sm:dark:bg-transparent">
      <div className="flex gap-2">
        <button
          onClick={() => {
            haptics.light()
            previousQuestion()
          }}
          disabled={!canGoBack}
          className="tap-highlight flex items-center justify-center rounded-2xl border-2 border-stone-300 px-3 py-3 text-stone-500 disabled:opacity-40 dark:border-stone-600 dark:text-stone-400"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        {isAnswered ? (
          <button
            onClick={() => {
              haptics.light()
              nextQuestion()
            }}
            className="tap-highlight flex-1 rounded-2xl bg-cf-accent py-3.5 text-base font-semibold text-white sm:py-3"
          >
            {locale.quizCard.nextQuestion}
          </button>
        ) : (
          <>
            <SubmitButton
              isMultiSelect={isMultiSelect}
              selectedAnswer={selectedAnswer}
              selectedAnswers={selectedAnswers}
              submitAnswer={submitAnswer}
            />
            <button
              onClick={() => {
                haptics.light()
                nextQuestion()
              }}
              disabled={isLastQuestion}
              className="tap-highlight flex items-center justify-center rounded-2xl border-2 border-stone-300 px-3 py-3 text-stone-500 disabled:opacity-40 dark:border-stone-600 dark:text-stone-400"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** 回答ボタン（共通） */
function SubmitButton({
  isMultiSelect,
  selectedAnswer,
  selectedAnswers,
  submitAnswer,
}: {
  isMultiSelect: boolean
  selectedAnswer: number | null
  selectedAnswers: readonly number[]
  submitAnswer: () => void
}) {
  const hasSelection = isMultiSelect ? selectedAnswers.length > 0 : selectedAnswer !== null
  return (
    <button
      onClick={() => {
        haptics.medium()
        submitAnswer()
      }}
      disabled={!hasSelection}
      className={`flex-1 rounded-2xl py-3 text-base font-semibold ${
        hasSelection ? 'tap-highlight bg-cf-accent text-white' : 'bg-stone-200 text-stone-400'
      }`}
    >
      {hasSelection ? locale.quizCard.submitAnswer : locale.quizCard.selectOption}
    </button>
  )
}
