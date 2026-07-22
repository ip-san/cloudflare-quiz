import { Bookmark, ExternalLink, Lightbulb, RotateCcw } from 'lucide-react'
import { locale } from '@/config/locale'
import { getCategoryById } from '@/domain/valueObjects/Category'
import { OVERVIEW_CHAPTERS } from '@/domain/valueObjects/OverviewChapter'
import { getDifficultyLabel, getDifficultyStyle } from '@/lib/badgeStyles'
import { getColorHex } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import { useQuizStore } from '@/stores/quizStore'
import { ChapterComplete } from './chapter/ChapterComplete'
import { ChapterIndicator } from './chapter/ChapterIndicator'
import { ChapterIntro } from './chapter/ChapterIntro'
import { Feedback } from './Feedback'
import { useQuizKeyboard } from './hooks/useQuizKeyboard'
import { OptionButton } from './OptionButton'
import { CorrectOverlay } from './overlays/CorrectOverlay'
import { EncouragementToast } from './overlays/EncouragementToast'
import { StreakToast } from './overlays/StreakToast'
import { XpToast } from './overlays/XpToast'
import { QuizBottomBar } from './QuizBottomBar'
import { QuizText } from './QuizText'
import { RelatedQuestions } from './result/RelatedQuestions'
import { useQuizCard } from './useQuizCard'

export function QuizCard({
  isModalOpen = false,
  onLastQuestionNext,
}: {
  isModalOpen?: boolean | undefined
  /** シナリオモードで最後の問題の後にエピローグを表示するためのコールバック */
  onLastQuestionNext?: (() => void) | undefined
}) {
  const {
    // Store state
    quiz,
    sessionState,
    selectedAnswer,
    selectedAnswers,
    isAnswered,
    isCorrect,
    isReviewMode,
    deferFeedback,
    hintUsed,
    isBookmarked,
    isAdaptive,
    totalXp,
    isMultiSelect,
    currentIndex,
    canGoBack,

    // Chapter state
    isOverviewMode: _isOverviewMode,
    currentChapter,
    showChapterIntro,
    showChapterComplete,
    chapterScore,
    showChapterIndicator,

    // Overlay state
    showCorrectOverlay,

    // Consecutive tracking
    consecutiveCorrect,
    consecutiveWrong,

    // Swipe handlers
    swipeHandlers,

    // Store actions
    selectAnswer,
    toggleAnswer,
    submitAnswer,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    finishTest,
    retryQuestion,
    endSession,
    toggleBookmark,
    useHint,
    dismissChapterIntro,
    dismissChapterComplete,
  } = useQuizCard({ isModalOpen, onLastQuestionNext })

  // Keyboard navigation (extracted to custom hook)
  useQuizKeyboard({
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
  })

  // Slide-in animation key (changes on each question)
  const questionKey = quiz?.id ?? 'empty'

  // Empty state when no quiz data
  if (!quiz) {
    return (
      <div className="rounded-2xl bg-linear-to-br from-stone-50 to-stone-100 p-8 text-center dark:from-stone-800 dark:to-stone-900">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cf-accent/10">
          <span className="text-3xl">🔍</span>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-cf-ink">{locale.quizCard.noQuestions}</h3>
        <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">{locale.quizCard.noQuestionsHint}</p>
        <button
          onClick={endSession}
          className="tap-highlight rounded-2xl bg-cf-accent px-6 py-3 text-sm font-semibold text-white"
        >
          {locale.quizCard.backToMenu}
        </button>
      </div>
    )
  }

  const category = getCategoryById(quiz.category)

  // Show full-page chapter intro before quiz content
  if (showChapterIntro && currentChapter) {
    return (
      <ChapterIntro
        chapter={currentChapter}
        onStart={() => {
          dismissChapterIntro()
          window.scrollTo(0, 0)
        }}
      />
    )
  }

  // Show chapter complete overlay (triggered by domain layer after answering last chapter question)
  if (showChapterComplete && currentChapter) {
    return (
      <ChapterComplete
        chapter={currentChapter}
        score={chapterScore.score}
        total={chapterScore.total}
        isLastChapter={currentChapter.id === OVERVIEW_CHAPTERS[OVERVIEW_CHAPTERS.length - 1]?.id}
        onContinue={() => {
          dismissChapterComplete()
          window.scrollTo(0, 0)
        }}
        onQuit={endSession}
      />
    )
  }

  return (
    <>
      {/* Correct answer overlay — big center check */}
      {showCorrectOverlay && <CorrectOverlay />}

      {/* XP gain toast (hidden in review/defer modes) */}
      {!deferFeedback && !isReviewMode && <XpToast totalXp={totalXp} />}

      {/* Consecutive correct streak toast (hidden in scenario mode) */}
      {!deferFeedback && sessionState?.config.mode !== 'scenario' && <StreakToast streak={consecutiveCorrect} />}

      {/* Encouragement toast on consecutive wrong answers (hidden in scenario mode) */}
      {!deferFeedback && sessionState?.config.mode !== 'scenario' && (
        <EncouragementToast wrongStreak={consecutiveWrong} />
      )}

      {/* Compact chapter indicator (shown after intro was dismissed) */}
      {showChapterIndicator && currentChapter && (
        <ChapterIndicator chapter={currentChapter} totalChapters={OVERVIEW_CHAPTERS.length} />
      )}

      <div
        key={questionKey}
        {...swipeHandlers}
        className={`animate-slide-in-right rounded-2xl bg-white p-4 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:bg-stone-800 dark:shadow-[0_2px_20px_rgba(0,0,0,0.3)] sm:border sm:border-stone-200 sm:p-8 ${
          isAnswered && isCorrect === false ? 'animate-shake flash-wrong' : ''
        } ${isAnswered && isCorrect === true ? 'glow-correct' : ''}`}
      >
        {/* Category & Difficulty badges + Bookmark */}
        <div className="mb-2 flex items-center justify-between sm:mb-4">
          <div className="flex gap-2">
            {category && (
              <span
                className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium"
                style={{
                  backgroundColor: `${getColorHex(category.color ?? 'gray')}15`,
                  color: getColorHex(category.color ?? 'gray'),
                }}
              >
                <span>{category.icon}</span>
                {category.name}
              </span>
            )}
            {quiz.difficulty && (
              <span className={`rounded-sm px-2 py-1 text-xs font-medium ${getDifficultyStyle(quiz.difficulty)}`}>
                {getDifficultyLabel(quiz.difficulty)}
              </span>
            )}
            {isAdaptive && currentIndex === 0 && (
              <span
                className="rounded-sm bg-indigo-500/10 px-2 py-1 text-xs font-medium text-indigo-500"
                title={locale.quizCard.adaptiveTooltip}
              >
                {locale.quizCard.adaptiveLabel}
              </span>
            )}
            {isReviewMode && (
              <span className="rounded-sm bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                {locale.quizCard.reviewBadge}
              </span>
            )}
          </div>
          <button
            onClick={() => toggleBookmark(quiz.id)}
            aria-label={isBookmarked ? locale.quizCard.unbookmark : locale.quizCard.bookmark}
            className="tap-highlight rounded-full p-3 transition-colors hover:bg-stone-100 dark:hover:bg-stone-700"
          >
            <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-yellow-500 text-yellow-500' : 'text-stone-400'}`} />
          </button>
        </div>

        {/* Question */}
        <h2 className="mb-3 max-w-prose text-lg font-semibold leading-snug text-cf-ink sm:mb-6 sm:text-xl sm:leading-relaxed">
          <QuizText text={quiz.question} />
        </h2>

        {/* Hint (hidden in 実力テスト defer mode) */}
        {!isAnswered && !deferFeedback && (
          <div className="mb-2 sm:mb-4">
            {!hintUsed ? (
              <button
                onClick={useHint}
                className="tap-highlight flex items-center gap-1.5 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
              >
                <Lightbulb className="h-4 w-4" />
                {locale.quizCard.showHint}
              </button>
            ) : (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-500/10">
                <div className="mb-1 flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{locale.quizCard.hint}</span>
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {quiz.hint ? <QuizText text={quiz.hint} /> : locale.quizCard.defaultHint}
                </p>
              </div>
            )}
          </div>
        )}
        {isAnswered && hintUsed && quiz.hint && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <div className="mb-1 flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-amber-600">{locale.quizCard.usedHint}</span>
            </div>
            <p className="text-xs text-amber-700">
              <QuizText text={quiz.hint} />
            </p>
          </div>
        )}

        {/* Reference link — shown only after using hint (not a freebie) */}
        {!isAnswered && !deferFeedback && hintUsed && quiz.referenceUrl && (
          <div className="mb-3">
            <a
              href={quiz.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-cf-accent"
            >
              <ExternalLink className="h-3 w-3" />
              {locale.quizCard.docsLink}
            </a>
          </div>
        )}

        {/* Multi-select indicator */}
        {isMultiSelect && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
            <span className="text-sm font-medium text-indigo-700">{locale.quizCard.multiSelectHint}</span>
          </div>
        )}

        {/* Options */}
        <div
          className="space-y-2 sm:space-y-3"
          role={isMultiSelect ? 'group' : 'listbox'}
          aria-label={isMultiSelect ? locale.quizCard.multiSelectGroup : locale.quizCard.singleSelectGroup}
          aria-activedescendant={!isMultiSelect && selectedAnswer !== null ? `option-${selectedAnswer}` : undefined}
        >
          {quiz.options.map((option, index) => (
            <OptionButton
              key={index}
              index={index}
              text={option.text}
              isSelected={isMultiSelect ? selectedAnswers.includes(index) : selectedAnswer === index}
              isCorrect={quiz.isCorrectIndex(index)}
              isAnswered={isAnswered}
              isMultiSelect={isMultiSelect}
              onClick={() => {
                haptics.light()
                if (isMultiSelect) {
                  toggleAnswer(index)
                } else {
                  selectAnswer(index)
                }
              }}
            />
          ))}
        </div>

        {/* Feedback (shown inline after answering, skip in defer mode) */}
        {isAnswered && !deferFeedback && (
          <div className="mt-3 sm:mt-6">
            <Feedback quiz={quiz} isCorrect={isCorrect ?? false} />
            {/* Related questions for deeper learning (correct answers only, not in scenario mode) */}
            {isCorrect === true && !isReviewMode && sessionState?.config.mode !== 'scenario' && (
              <RelatedQuestions currentQuestion={quiz} allQuestions={useQuizStore.getState().allQuestions} />
            )}
            {isCorrect === false && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    haptics.light()
                    retryQuestion()
                  }}
                  aria-label={locale.quizCard.retryLabel}
                  className="tap-highlight inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-cf-accent py-3.5 text-base font-semibold text-cf-accent sm:py-3"
                >
                  <RotateCcw className="h-4 w-4" />
                  {locale.quizCard.retryButton} <span className="text-xs opacity-60">(R)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Spacer for fixed bottom bar on mobile */}
        <div className="h-16 sm:hidden" />
      </div>

      <QuizBottomBar
        sessionState={sessionState}
        currentIndex={currentIndex}
        isAnswered={isAnswered}
        isMultiSelect={isMultiSelect}
        selectedAnswer={selectedAnswer}
        selectedAnswers={selectedAnswers}
        deferFeedback={deferFeedback}
        canGoBack={canGoBack}
        previousQuestion={previousQuestion}
        nextQuestion={onLastQuestionNext ?? nextQuestion}
        submitAnswer={submitAnswer}
        goToQuestion={goToQuestion}
        finishTest={finishTest}
      />
    </>
  )
}
