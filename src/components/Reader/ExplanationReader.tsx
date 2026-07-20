import { ArrowLeft, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { locale } from '@/config/locale'
import { getCategoryById } from '@/domain/valueObjects/Category'
import type { DifficultyLevel } from '@/domain/valueObjects/Difficulty'
import { headerStyles } from '@/lib/styles'
import { useQuizStore } from '@/stores/quizStore'
import { ReaderCard } from './ReaderCard'
import { ReaderFilters, type StatusFilter } from './ReaderFilters'

const INITIAL_DISPLAY_COUNT = 50
const LOAD_MORE_COUNT = 50

/** Extract doc page slug from referenceUrl */
function getDocPage(url: string | undefined): string | null {
  if (!url) return null
  const m = url.match(/\/docs\/(?:ja|en)\/(.+?)(?:#.*)?$/)
  return m ? m[1] : null
}

export function ExplanationReader() {
  const { allQuestions, userProgress, toggleBookmark, setViewState, readerInitialFilter } = useQuizStore(
    useShallow((state) => ({
      allQuestions: state.allQuestions,
      userProgress: state.userProgress,
      toggleBookmark: state.toggleBookmark,
      setViewState: state.setViewState,
      readerInitialFilter: state.readerInitialFilter,
    }))
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedDocPage, setSelectedDocPage] = useState<string | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    readerInitialFilter === 'bookmarked' ? 'bookmarked' : 'all'
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT)

  // Available doc pages for the selected category
  const docPages = useMemo(() => {
    if (!selectedCategory) return []
    const pages = new Map<string, number>()
    for (const q of allQuestions) {
      if (q.category !== selectedCategory) continue
      const page = getDocPage(q.referenceUrl)
      if (page) pages.set(page, (pages.get(page) ?? 0) + 1)
    }
    return [...pages.entries()].sort((a, b) => b[1] - a[1]).map(([page, count]) => ({ page, count }))
  }, [allQuestions, selectedCategory])

  const filteredQuestions = useMemo(() => {
    let questions = allQuestions

    if (selectedCategory) {
      questions = questions.filter((q) => q.category === selectedCategory)
    }

    if (selectedDocPage) {
      questions = questions.filter((q) => getDocPage(q.referenceUrl) === selectedDocPage)
    }

    if (selectedDifficulty) {
      questions = questions.filter((q) => q.difficulty === selectedDifficulty)
    }

    switch (statusFilter) {
      case 'bookmarked':
        questions = questions.filter((q) => userProgress.isBookmarked(q.id))
        break
      case 'wrong': {
        questions = questions.filter((q) => {
          return userProgress.hasAttempted(q.id) && !userProgress.isCorrectlyAnswered(q.id)
        })
        break
      }
      case 'weak': {
        questions = questions.filter((q) => {
          const p = userProgress.questionProgress[q.id]
          return p && p.attempts >= 2 && p.correctCount / p.attempts < 0.7
        })
        break
      }
      case 'unanswered':
        questions = questions.filter((q) => !userProgress.isCorrectlyAnswered(q.id))
        break
    }

    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase()
      questions = questions.filter(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          item.explanation.toLowerCase().includes(q) ||
          item.options.some((opt) => opt.text.toLowerCase().includes(q))
      )
    }

    return questions
  }, [allQuestions, selectedCategory, selectedDocPage, selectedDifficulty, statusFilter, searchQuery, userProgress])

  // Reset display count when filters change
  const displayQuestions = filteredQuestions.slice(0, displayCount)
  const hasMore = displayCount < filteredQuestions.length

  // Group by category for display (when no search and no specific category)
  const groupedByCategory = useMemo(() => {
    if (searchQuery.length >= 2 || selectedCategory) return null
    const groups: { categoryId: string; label: string; icon: string; questions: typeof displayQuestions }[] = []
    const seen = new Set<string>()
    for (const q of displayQuestions) {
      if (!seen.has(q.category)) {
        seen.add(q.category)
        const cat = getCategoryById(q.category)
        groups.push({
          categoryId: q.category,
          label: cat?.name ?? q.category,
          icon: cat?.icon ?? '',
          questions: displayQuestions.filter((dq) => dq.category === q.category),
        })
      }
    }
    return groups
  }, [displayQuestions, searchQuery, selectedCategory])

  return (
    <div className="flex min-h-dvh flex-col bg-claude-cream dark:bg-stone-900">
      {/* Sticky header */}
      <div className={headerStyles.sticky}>
        <div className="mx-auto max-w-3xl px-4 pb-2 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewState('menu')}
                className="tap-highlight rounded-full p-1 text-stone-500"
                aria-label={locale.common.back}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-base font-bold text-claude-dark dark:text-stone-200">{locale.reader.title}</h1>
            </div>
            <span className="text-xs text-stone-500">
              {locale.reader.countLabel(filteredQuestions.length, allQuestions.length)}
            </span>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="border-b border-stone-200 px-4 pb-2 pt-2 dark:border-stone-700">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2 dark:bg-stone-800">
            <Search className="h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setExpandedId(null)
                setDisplayCount(INITIAL_DISPLAY_COUNT)
              }}
              placeholder={locale.search.placeholder}
              className="flex-1 bg-transparent text-sm text-claude-dark outline-hidden placeholder:text-stone-400 dark:text-stone-200"
              aria-label={locale.search.label}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setDisplayCount(INITIAL_DISPLAY_COUNT)
                }}
                className="tap-highlight rounded-full p-0.5 text-stone-400"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-stone-200 py-2 dark:border-stone-700">
        <div className="mx-auto max-w-3xl">
          <ReaderFilters
            selectedCategory={selectedCategory}
            onCategoryChange={(c) => {
              setSelectedCategory(c)
              setSelectedDocPage(null)
              setExpandedId(null)
              setDisplayCount(INITIAL_DISPLAY_COUNT)
            }}
            docPages={docPages}
            selectedDocPage={selectedDocPage}
            onDocPageChange={(p) => {
              setSelectedDocPage(p)
              setExpandedId(null)
              setDisplayCount(INITIAL_DISPLAY_COUNT)
            }}
            selectedDifficulty={selectedDifficulty}
            onDifficultyChange={(d) => {
              setSelectedDifficulty(d)
              setExpandedId(null)
              setDisplayCount(INITIAL_DISPLAY_COUNT)
            }}
            statusFilter={statusFilter}
            onStatusChange={(s) => {
              setStatusFilter(s)
              setExpandedId(null)
              setDisplayCount(INITIAL_DISPLAY_COUNT)
            }}
          />
        </div>
      </div>

      {/* Question list */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl">
          {filteredQuestions.length === 0 ? (
            <p className="p-8 text-center text-sm text-stone-400">{locale.reader.noResults}</p>
          ) : groupedByCategory ? (
            groupedByCategory.map((group) => (
              <div key={group.categoryId}>
                <div className="sticky top-0 z-5 border-b border-stone-200 bg-stone-50/95 px-4 py-2 backdrop-blur-xs dark:border-stone-700 dark:bg-stone-800/95">
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                    {group.icon} {group.label} ({group.questions.length})
                  </span>
                </div>
                {group.questions.map((q) => (
                  <ReaderCard
                    key={q.id}
                    question={q}
                    isExpanded={expandedId === q.id}
                    onToggle={() => setExpandedId(expandedId === q.id ? null : q.id)}
                    userProgress={userProgress}
                    onToggleBookmark={toggleBookmark}
                  />
                ))}
              </div>
            ))
          ) : (
            displayQuestions.map((q) => (
              <ReaderCard
                key={q.id}
                question={q}
                isExpanded={expandedId === q.id}
                onToggle={() => setExpandedId(expandedId === q.id ? null : q.id)}
                userProgress={userProgress}
                onToggleBookmark={toggleBookmark}
              />
            ))
          )}

          {/* Infinite scroll sentinel */}
          {hasMore && <LoadMoreSentinel onVisible={() => setDisplayCount((c) => c + LOAD_MORE_COUNT)} />}
        </div>
      </div>
    </div>
  )
}

/** Sentinel element that triggers loading more items when scrolled into view */
function LoadMoreSentinel({ onVisible }: { onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const onVisibleRef = useRef(onVisible)
  onVisibleRef.current = onVisible

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onVisibleRef.current()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="flex justify-center py-4">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-200 border-t-claude-orange dark:border-stone-700" />
    </div>
  )
}
