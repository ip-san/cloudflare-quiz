import { Bookmark, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { ExplanationWithDiagrams } from '@/components/Quiz/ExplanationWithDiagrams'
import { locale } from '@/config/locale'
import type { Question } from '@/domain/entities/Question'
import type { UserProgress } from '@/domain/entities/UserProgress'
import { getCategoryById } from '@/domain/valueObjects/Category'
import { haptics } from '@/lib/haptics'

interface ReaderCardProps {
  question: Question
  isExpanded: boolean
  onToggle: () => void
  userProgress: UserProgress
  onToggleBookmark: (id: string) => void
}

export function ReaderCard({ question, isExpanded, onToggle, userProgress, onToggleBookmark }: ReaderCardProps) {
  const cat = getCategoryById(question.category)
  const isBookmarked = userProgress.isBookmarked(question.id)
  const hasAttempted = userProgress.hasAttempted(question.id)
  const isCorrect = userProgress.isCorrectlyAnswered(question.id)

  return (
    <div className="border-b border-stone-100 dark:border-stone-800">
      <button onClick={onToggle} className="tap-highlight flex w-full items-start gap-2 px-4 py-3 text-left">
        <span className="mt-0.5 shrink-0 text-sm">{cat?.icon}</span>
        <span className="flex-1 line-clamp-2 text-sm leading-snug text-cf-ink dark:text-stone-200">
          {question.question}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasAttempted && (
            <span className={`text-xs ${isCorrect ? 'text-green-500' : 'text-red-400'}`}>{isCorrect ? '✓' : '✗'}</span>
          )}
          {isBookmarked && <Bookmark className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-stone-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-stone-400" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3 dark:border-stone-700 dark:bg-stone-900/50">
          <p className="mb-2 text-xs font-medium text-green-600 dark:text-green-400">
            {locale.reader.correctAnswer}: {question.options[question.correctIndex]?.text}
          </p>
          <ExplanationWithDiagrams explanation={question.explanation} diagrams={question.diagrams} />
          <div className="mt-3 flex items-center gap-3">
            {question.referenceUrl && (
              <a
                href={question.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-cf-accent"
              >
                <ExternalLink className="h-3 w-3" />
                {locale.feedback.officialDocs}
              </a>
            )}
            <button
              onClick={() => {
                haptics.light()
                onToggleBookmark(question.id)
              }}
              className="inline-flex items-center gap-1 text-xs text-stone-500"
            >
              <Bookmark className={`h-3 w-3 ${isBookmarked ? 'fill-yellow-500 text-yellow-500' : ''}`} />
              {isBookmarked ? locale.reader.bookmarked : locale.quizCard.bookmark}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
