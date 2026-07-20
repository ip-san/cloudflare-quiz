import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  GitCompare,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { locale } from '@/config/locale'
import type { Question } from '@/domain/entities/Question'
import { ExplanationWithDiagrams } from './ExplanationWithDiagrams'
import { MemoryRetentionBar } from './MemoryRetentionBar'
import { QuizText } from './QuizText'
import { type PromptType, useFeedback } from './useFeedback'

const PROMPT_TYPES: Array<{ type: PromptType; label: string; icon: typeof BookOpen; description: string }> = [
  {
    type: 'explain',
    label: locale.feedback.prompts.explain.label,
    icon: BookOpen,
    description: locale.feedback.prompts.explain.description,
  },
  {
    type: 'practical',
    label: locale.feedback.prompts.practical.label,
    icon: Briefcase,
    description: locale.feedback.prompts.practical.description,
  },
  {
    type: 'compare',
    label: locale.feedback.prompts.compare.label,
    icon: GitCompare,
    description: locale.feedback.prompts.compare.description,
  },
]

interface FeedbackProps {
  quiz: Question
  isCorrect: boolean
}

/**
 * Animated section wrapper — renders children with a staggered fade-up.
 * `order` determines the animation delay (0-based).
 */
function AnimatedSection({
  order,
  animate,
  noMotion,
  className = '',
  children,
}: {
  order: number
  animate: boolean
  noMotion: boolean
  className?: string
  children: React.ReactNode
}) {
  const style = noMotion ? undefined : { opacity: animate ? undefined : 0, animationDelay: `${150 + order * 120}ms` }
  const animClass = noMotion || !animate ? '' : 'animate-feedback-section'
  return (
    <div className={`${className} ${animClass}`} style={style}>
      {children}
    </div>
  )
}

export function Feedback({ quiz, isCorrect }: FeedbackProps) {
  const {
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
  } = useFeedback(quiz)

  // Build ordered sections for staggered animation
  const sections: React.ReactNode[] = []

  // 0: Header
  sections.push(
    <AnimatedSection
      key="header"
      order={0}
      animate={animate}
      noMotion={noMotion}
      className="mb-3 flex items-center gap-2"
    >
      {isCorrect ? (
        <>
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          <span className="font-semibold text-green-400">{locale.feedback.correct}</span>
        </>
      ) : (
        <>
          <XCircle className="h-5 w-5 text-red-400" />
          <span className="font-semibold text-red-400">{locale.feedback.incorrect}</span>
        </>
      )}
    </AnimatedSection>
  )

  // 1: Review mode - user answer vs correct
  if (isReviewMode && !isCorrect && isMultiSelect && selectedAnswers.length > 0) {
    sections.push(
      <AnimatedSection
        key="review-multi"
        order={sections.length}
        animate={animate}
        noMotion={noMotion}
        className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3"
      >
        <p className="text-sm text-amber-800">
          <span className="font-medium">{locale.feedback.yourAnswer}</span>
        </p>
        <ul className="ml-4 mt-1 list-disc text-sm text-amber-800">
          {selectedAnswers.map((i) => (
            <li key={i}>
              <QuizText text={quiz.options[i]?.text ?? ''} />
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-green-700">
          <span className="font-medium">{locale.feedback.correctAnswer}</span>
        </p>
        <ul className="ml-4 mt-1 list-disc text-sm text-green-700">
          {quiz.getCorrectOptions().map((opt, i) => (
            <li key={i}>
              <QuizText text={opt.text} />
            </li>
          ))}
        </ul>
      </AnimatedSection>
    )
  }
  if (isReviewMode && !isCorrect && !isMultiSelect && selectedAnswer !== null && selectedAnswer !== quiz.correctIndex) {
    sections.push(
      <AnimatedSection
        key="review-single"
        order={sections.length}
        animate={animate}
        noMotion={noMotion}
        className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3"
      >
        <p className="text-sm text-amber-800">
          <span className="font-medium">{locale.feedback.yourAnswer}</span>{' '}
          <QuizText text={quiz.options[selectedAnswer]?.text ?? ''} />
        </p>
        <p className="mt-1 text-sm text-green-700">
          <span className="font-medium">{locale.feedback.correctAnswer}</span>{' '}
          <QuizText text={quiz.options[quiz.correctIndex]?.text ?? ''} />
        </p>
      </AnimatedSection>
    )
  }

  // 2: Wrong feedback (skip in review mode — review sections already show the comparison)
  if (!isCorrect && !isReviewMode && isMultiSelect) {
    const wrongSelected = selectedAnswers
      .filter((i) => !quiz.isCorrectIndex(i))
      .map((i) => quiz.options[i])
      .filter((opt) => opt?.wrongFeedback)
    if (wrongSelected.length > 0) {
      sections.push(
        <AnimatedSection
          key="wrong-multi"
          order={sections.length}
          animate={animate}
          noMotion={noMotion}
          className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="mb-1 font-medium text-claude-dark">{locale.feedback.whyWrong}</p>
              {wrongSelected.map((opt, i) => (
                <p key={i} className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                  <QuizText text={opt.wrongFeedback ?? ''} />
                </p>
              ))}
            </div>
          </div>
        </AnimatedSection>
      )
    }
  }
  if (!isCorrect && !isReviewMode && !isMultiSelect && selectedOption?.wrongFeedback) {
    sections.push(
      <AnimatedSection
        key="wrong-single"
        order={sections.length}
        animate={animate}
        noMotion={noMotion}
        className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="mb-1 font-medium text-claude-dark">{locale.feedback.whyWrong}</p>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
              <QuizText text={selectedOption.wrongFeedback ?? ''} />
            </p>
          </div>
        </div>
      </AnimatedSection>
    )
  }

  // 3: Multi-select correct answers (non-review)
  if (!isCorrect && isMultiSelect && !isReviewMode) {
    sections.push(
      <AnimatedSection
        key="correct-multi"
        order={sections.length}
        animate={animate}
        noMotion={noMotion}
        className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3"
      >
        <p className="text-sm font-medium text-green-700">{locale.feedback.correctAnswer}</p>
        <ul className="ml-4 mt-1 list-disc text-sm text-green-700">
          {quiz.getCorrectOptions().map((opt, i) => (
            <li key={i}>
              <QuizText text={opt.text} />
            </li>
          ))}
        </ul>
      </AnimatedSection>
    )
  }

  // 4: Explanation
  const explanationOrder = sections.length
  sections.push(
    <AnimatedSection key="explanation" order={explanationOrder} animate={animate} noMotion={noMotion} className="mb-4">
      <p className="mb-1 text-sm font-medium text-claude-dark">{locale.feedback.explanation}</p>
      <ExplanationWithDiagrams
        explanation={quiz.explanation}
        diagrams={quiz.diagrams}
        animated={animate && !noMotion}
        animationDelay={300 + explanationOrder * 120}
      />
    </AnimatedSection>
  )

  // 5: Memory retention bar (non-review mode, previously answered questions only)
  if (!isReviewMode) {
    sections.push(
      <AnimatedSection key="retention" order={sections.length} animate={animate} noMotion={noMotion} className="mb-4">
        <MemoryRetentionBar questionProgress={userProgress.questionProgress[quiz.id]} />
      </AnimatedSection>
    )
  }

  // 6: Action buttons
  sections.push(
    <AnimatedSection key="actions" order={sections.length} animate={animate} noMotion={noMotion}>
      {/* biome-ignore lint/a11y/useSemanticElements: role="group" is correct for action buttons, not <fieldset> */}
      <div
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        role="group"
        aria-label={locale.feedback.actionButtons}
      >
        {quiz.referenceUrl && (
          <button
            onClick={handleOpenReference}
            aria-label={locale.feedback.openDocs}
            className="tap-highlight flex items-center justify-center gap-1.5 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm font-medium text-stone-600 dark:bg-stone-700 dark:border-stone-600 dark:text-stone-300"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {locale.feedback.officialDocs}
          </button>
        )}

        <button
          onClick={handleCopyMarkdown}
          aria-label={markdownCopied ? locale.feedback.markdownCopied : locale.feedback.copyMarkdown}
          className="tap-highlight flex items-center justify-center gap-1.5 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-medium text-purple-400 dark:border-purple-400/30 dark:bg-purple-400/15 dark:text-purple-300"
        >
          {markdownCopied ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              {locale.common.copied}
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" aria-hidden="true" />
              {locale.feedback.copyExplanation}
            </>
          )}
        </button>
      </div>
    </AnimatedSection>
  )

  // 7: AI prompt picker — shown for both correct and incorrect
  sections.push(
    <AnimatedSection key="ai-prompts" order={sections.length} animate={animate} noMotion={noMotion} className="mt-3">
      <button
        onClick={() => setShowPrompts((v) => !v)}
        className="tap-highlight flex w-full items-center justify-between rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-500 dark:border-blue-400/30 dark:bg-blue-400/15 dark:text-blue-300"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {locale.feedback.aiLearnMore}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${showPrompts ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {showPrompts && (
        <div className="mt-2 flex flex-col gap-1.5">
          {copied && (
            <p className="text-center text-xs text-green-500">
              <Check className="mr-1 inline h-3 w-3" />
              {locale.feedback.promptCopied}
            </p>
          )}
          {PROMPT_TYPES.map(({ type, label, icon: Icon, description }) => (
            <button
              key={type}
              onClick={() => handleCopyAIPrompt(type)}
              className="tap-highlight flex items-start gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-left dark:border-stone-600 dark:bg-stone-700"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-claude-dark">{label}</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-500">{description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </AnimatedSection>
  )

  return (
    <div
      className={`mt-4 rounded-xl border p-4 sm:mt-6 sm:p-5 ${
        isCorrect
          ? 'border-green-500/30 bg-green-500/10 dark:bg-green-500/15'
          : 'border-red-500/30 bg-red-500/10 dark:bg-red-500/15'
      } ${noMotion ? '' : animate ? 'animate-feedback-enter' : 'opacity-0'}`}
    >
      {sections}
    </div>
  )
}
