import { ArrowRight, BookOpen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { QuizCard } from '@/components/Quiz/QuizCard'
import { locale } from '@/config/locale'
import { SCENARIOS, type ScenarioData } from '@/data/scenarios'
import { useQuizStore } from '@/stores/quizStore'

/** Narrative interstitial between questions */
function ScenarioNarrative({ text, onNext, stepLabel }: { text: string; onNext: () => void; stepLabel: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl bg-linear-to-br from-blue-50 to-indigo-50 p-6 shadow-xs dark:from-stone-800 dark:to-stone-800">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
          <BookOpen className="h-4 w-4" />
          {stepLabel}
        </div>
        <p className="mb-6 text-base leading-relaxed text-stone-700 dark:text-stone-300">{text}</p>
        <button
          onClick={onNext}
          className="tap-highlight flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.97] dark:bg-blue-700"
        >
          {locale.scenario.nextButton}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * ScenarioView wraps QuizCard with narrative interstitials.
 *
 * Flow:
 * 1. Before each question: show narrative if present in narrativeMap
 * 2. User dismisses narrative → QuizCard shows the question
 * 3. After last question's feedback: onLastQuestionNext triggers epilogue
 * 4. User dismisses epilogue → nextQuestion() → result screen
 */
export function ScenarioView({ scenario, isModalOpen }: { scenario: ScenarioData; isModalOpen: boolean }) {
  const { sessionState, nextQuestion } = useQuizStore(
    useShallow((state) => ({ sessionState: state.sessionState, nextQuestion: state.nextQuestion }))
  )
  const currentQuestionIndex = sessionState?.currentIndex ?? 0

  const questionCount = scenario.steps.filter((s) => s.type === 'question').length

  // Build a map: questionIndex -> preceding narrative texts
  // Epilogue is stored at index = questionCount (after all questions)
  const narrativeMap = useMemo(() => {
    const map: Record<number, string[]> = {}
    let qIdx = 0
    let pending: string[] = []

    for (const step of scenario.steps) {
      if (step.type === 'narrative' && step.text) {
        pending.push(step.text)
      } else if (step.type === 'question') {
        if (pending.length > 0) {
          map[qIdx] = [...pending]
          pending = []
        }
        qIdx++
      }
    }
    if (pending.length > 0) {
      map[qIdx] = [...pending]
    }
    return map
  }, [scenario])

  // State
  const [dismissedForIndex, setDismissedForIndex] = useState<Set<number>>(new Set())
  const [narrativePageIndex, setNarrativePageIndex] = useState(0)
  const [showEpilogue, setShowEpilogue] = useState(false)

  // Reset narrative page when question changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentQuestionIndex change is the intentional trigger
  useEffect(() => {
    setNarrativePageIndex(0)
  }, [currentQuestionIndex])

  // Which narrative to show: epilogue (at questionCount) or pre-question (at currentIndex)
  const narrativeKey = showEpilogue ? questionCount : currentQuestionIndex
  const narratives = narrativeMap[narrativeKey]
  const hasNarrative = narratives && narratives.length > 0 && !dismissedForIndex.has(narrativeKey)

  const handleNarrativeNext = () => {
    if (narratives && narrativePageIndex < narratives.length - 1) {
      // Multi-page narrative: advance to next page
      setNarrativePageIndex(narrativePageIndex + 1)
    } else {
      // Last page: dismiss this narrative
      setDismissedForIndex((prev) => new Set([...prev, narrativeKey]))
      setNarrativePageIndex(0)
      // After epilogue: proceed to result screen
      if (showEpilogue) {
        nextQuestion()
      }
    }
  }

  // Show narrative if available
  if (hasNarrative) {
    const text = narratives[narrativePageIndex]
    const isEpilogue = narrativeKey === questionCount
    return (
      <ScenarioNarrative
        text={text}
        onNext={handleNarrativeNext}
        stepLabel={
          isEpilogue
            ? `${scenario.title} — ${locale.scenario.epilogue}`
            : `${scenario.title} — ${locale.scenario.beforeQuestion(currentQuestionIndex + 1, questionCount)}`
        }
      />
    )
  }

  // Determine if we should intercept the "next" button on the last question
  const isLastQuestionAnswered = currentQuestionIndex === questionCount - 1 && sessionState?.isAnswered === true
  const hasEpilogue = !!narrativeMap[questionCount] && !dismissedForIndex.has(questionCount)

  return (
    <QuizCard
      isModalOpen={isModalOpen}
      onLastQuestionNext={
        isLastQuestionAnswered && hasEpilogue
          ? () => {
              setShowEpilogue(true)
              setNarrativePageIndex(0)
            }
          : undefined
      }
    />
  )
}

/** Scenario selection list for menu */
export function ScenarioList({ onSelect }: { onSelect: (scenarioId: string) => void }) {
  const { userProgress, allQuestions } = useQuizStore(
    useShallow((state) => ({ userProgress: state.userProgress, allQuestions: state.allQuestions }))
  )

  return (
    <div className="space-y-3">
      {SCENARIOS.map((sc) => {
        const questionIds = sc.steps.flatMap((s) => (s.type === 'question' && s.questionId ? [s.questionId] : []))
        const validIds = questionIds.filter((id) => allQuestions.some((q) => q.id === id))
        const answeredCount = validIds.filter((id) => userProgress.hasAttempted(id)).length
        const difficultyColors = {
          beginner: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
          intermediate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          advanced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        }
        const isCompleted = answeredCount === validIds.length && validIds.length > 0

        return (
          <button
            key={sc.id}
            onClick={() => onSelect(sc.id)}
            className="tap-highlight flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-xs transition-transform active:scale-[0.98] dark:bg-stone-800"
          >
            <span className="mt-0.5 text-2xl">{sc.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-claude-dark">{sc.title}</h3>
                {isCompleted && <span className="text-emerald-500">✓</span>}
              </div>
              <p className="mt-0.5 text-sm text-stone-500">{sc.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColors[sc.difficulty]}`}>
                  {locale.scenario.difficultyLabels[sc.difficulty]}
                </span>
                <span className="text-xs text-stone-500">
                  {locale.scenario.questionStats(validIds.length, answeredCount)}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
