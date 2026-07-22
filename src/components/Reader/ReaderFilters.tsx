import { locale } from '@/config/locale'
import { PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import { type DifficultyLevel, PREDEFINED_DIFFICULTIES } from '@/domain/valueObjects/Difficulty'

export type StatusFilter = 'all' | 'bookmarked' | 'wrong' | 'weak' | 'unanswered'

interface ReaderFiltersProps {
  selectedCategory: string | null
  onCategoryChange: (category: string | null) => void
  docPages?: { page: string; count: number }[]
  selectedDocPage?: string | null
  onDocPageChange?: (page: string | null) => void
  selectedDifficulty: DifficultyLevel | null
  onDifficultyChange: (difficulty: DifficultyLevel | null) => void
  statusFilter: StatusFilter
  onStatusChange: (status: StatusFilter) => void
}

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: locale.reader.allQuestions },
  { value: 'bookmarked', label: locale.reader.bookmarked },
  { value: 'wrong', label: locale.reader.wrongAnswers },
  { value: 'weak', label: locale.reader.weakAreas },
  { value: 'unanswered', label: locale.reader.unanswered },
]

export function ReaderFilters({
  selectedCategory,
  onCategoryChange,
  docPages,
  selectedDocPage,
  onDocPageChange,
  selectedDifficulty,
  onDifficultyChange,
  statusFilter,
  onStatusChange,
}: ReaderFiltersProps) {
  return (
    <div className="space-y-2 px-4 pb-2">
      {/* Category pills */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-hide">
        <button
          onClick={() => onCategoryChange(null)}
          className={`tap-highlight shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            selectedCategory === null
              ? 'bg-cf-accent text-white'
              : 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
          }`}
        >
          {locale.search.allCategories}
        </button>
        {PREDEFINED_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(selectedCategory === cat.id ? null : cat.id)}
            className={`tap-highlight shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedCategory === cat.id
                ? 'bg-cf-accent text-white'
                : 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Doc page sub-filter (shown when category selected) */}
      {selectedCategory && docPages && docPages.length > 1 && onDocPageChange && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-hide">
          <button
            onClick={() => onDocPageChange(null)}
            className={`tap-highlight shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
              !selectedDocPage
                ? 'bg-stone-700 text-white dark:bg-stone-300 dark:text-stone-900'
                : 'bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400'
            }`}
          >
            {locale.reader.allPages}
          </button>
          {docPages.map(({ page, count }) => (
            <button
              key={page}
              onClick={() => onDocPageChange(selectedDocPage === page ? null : page)}
              className={`tap-highlight shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                selectedDocPage === page
                  ? 'bg-stone-700 text-white dark:bg-stone-300 dark:text-stone-900'
                  : 'bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400'
              }`}
            >
              {page} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Difficulty + Status */}
      <div className="flex flex-wrap gap-1.5">
        {PREDEFINED_DIFFICULTIES.map((diff) => (
          <button
            key={diff.id}
            onClick={() => onDifficultyChange(selectedDifficulty === diff.id ? null : diff.id)}
            className={`tap-highlight rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedDifficulty === diff.id
                ? 'bg-stone-700 text-white dark:bg-stone-300 dark:text-stone-900'
                : 'bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400'
            }`}
          >
            {diff.name}
          </button>
        ))}
        <span className="mx-0.5" />
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            className={`tap-highlight rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-stone-700 text-white dark:bg-stone-300 dark:text-stone-900'
                : 'bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
