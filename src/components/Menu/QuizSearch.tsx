import { Bookmark, ChevronDown, ChevronUp, ExternalLink, Filter, Play, Search, X } from 'lucide-react'
import { QuizText } from '@/components/Quiz/QuizText'
import { locale } from '@/config/locale'
import { getCategoryById, PREDEFINED_CATEGORIES } from '@/domain/valueObjects/Category'
import { useQuizSearch } from './useQuizSearch'

/**
 * クイズ検索コンポーネント
 *
 * 2つの使い方を提供：
 * 1. クイズモード: 検索結果の問題に挑戦する
 * 2. リファレンスモード: 解説をその場で読む（業務中のクイックリファレンス）
 *
 * カテゴリフィルタでテキスト検索を絞り込める。
 */
export function QuizSearch() {
  const {
    query,
    isOpen,
    expandedId,
    showAll,
    categoryFilter,
    showFilters,
    allResults,
    displayResults,
    userProgress,
    setQuery,
    setExpandedId,
    setShowAll,
    setCategoryFilter,
    setShowFilters,
    openSearch,
    closeSearch,
    launchSession,
    launchSessionAndClose,
    handleToggleBookmark,
  } = useQuizSearch()

  // Full-screen view for all results
  if (showAll) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-cf-surface dark:bg-stone-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
          <div>
            <h2 className="text-sm font-bold text-cf-ink dark:text-stone-200">
              {locale.search.searchResultsTitle(query)}
            </h2>
            <p className="text-xs text-stone-500">
              {allResults.length}
              {locale.search.resultsSuffix}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                launchSession(
                  allResults.map((r) => r.id),
                  query
                )
              }
              className="tap-highlight inline-flex items-center gap-1.5 rounded-xl bg-cf-accent px-3 py-1.5 text-xs font-medium text-white"
            >
              <Play className="h-3 w-3 fill-white" />
              {locale.search.challengeQuestions(allResults.length)}
            </button>
            <button
              onClick={() => {
                setShowAll(false)
                setExpandedId(null)
              }}
              className="tap-highlight rounded-full p-2 text-stone-400"
              aria-label={locale.common.back}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {/* All results */}
        <div className="flex-1 overflow-y-auto">
          {allResults.map((r) => {
            const cat = getCategoryById(r.category)
            const isExpanded = expandedId === r.id
            return (
              <div key={r.id} className="border-b border-stone-100 dark:border-stone-800">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="tap-highlight flex w-full items-start gap-2 px-4 py-3 text-left"
                >
                  <span className="mt-0.5 shrink-0 text-sm">{cat?.icon}</span>
                  <span className="flex-1 text-sm leading-snug text-cf-ink dark:text-stone-200">{r.question}</span>
                  {isExpanded ? (
                    <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  ) : (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                  )}
                </button>
                {isExpanded && (
                  <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3 dark:border-stone-700 dark:bg-stone-900/50">
                    <p className="mb-2 text-xs font-medium text-green-600 dark:text-green-400">
                      &#10003; {r.options[r.correctIndex]?.text}
                    </p>
                    <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                      <QuizText text={r.explanation} />
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      {r.referenceUrl && (
                        <a
                          href={r.referenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-cf-accent"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {locale.feedback.officialDocs}
                        </a>
                      )}
                      <button
                        onClick={() => handleToggleBookmark(r.id)}
                        className="inline-flex items-center gap-1 text-xs text-stone-500"
                      >
                        <Bookmark
                          className={`h-3 w-3 ${userProgress.isBookmarked(r.id) ? 'fill-yellow-500 text-yellow-500' : ''}`}
                        />
                        {userProgress.isBookmarked(r.id) ? locale.search.saved : locale.search.learnLater}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <button
        onClick={openSearch}
        className="tap-highlight mb-5 flex w-full items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-400 dark:border-stone-700 dark:bg-stone-800"
      >
        <Search className="h-4 w-4" />
        {locale.search.searchReference}
      </button>
    )
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 rounded-2xl border border-cf-accent bg-white px-4 py-2.5 dark:bg-stone-800">
        <Search className="h-4 w-4 text-cf-accent" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setExpandedId(null)
          }}
          placeholder={locale.search.inputPlaceholder}
          className="flex-1 bg-transparent text-sm text-cf-ink outline-hidden placeholder:text-stone-400 dark:text-stone-200"
          autoFocus
          aria-label={locale.search.label}
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`tap-highlight rounded-full p-2 ${categoryFilter ? 'text-cf-accent' : 'text-stone-400'}`}
          aria-label={locale.search.categoryFilterLabel}
        >
          <Filter className="h-4 w-4" />
        </button>
        <button
          onClick={closeSearch}
          className="tap-highlight rounded-full p-2 text-stone-400"
          aria-label={locale.search.closeLabel}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Category filter pills */}
      {showFilters && (
        <div className="-mx-1 mt-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`tap-highlight rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              categoryFilter === null
                ? 'bg-cf-accent text-white'
                : 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
            }`}
          >
            {locale.search.allCategories}
          </button>
          {PREDEFINED_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
              className={`tap-highlight rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                categoryFilter === cat.id
                  ? 'bg-cf-accent text-white'
                  : 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      )}

      {(query.length >= 2 || categoryFilter) && (
        <div className="mt-2 rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
          {allResults.length === 0 ? (
            <p className="p-4 text-center text-sm text-stone-400">{locale.search.noResults}</p>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5 dark:border-stone-700">
                <span className="text-xs text-stone-500">
                  {allResults.length}
                  {locale.search.resultsSuffix}
                </span>
                <button
                  onClick={() =>
                    launchSessionAndClose(
                      allResults.map((r) => r.id),
                      query
                    )
                  }
                  className="tap-highlight inline-flex items-center gap-1.5 rounded-lg bg-cf-accent px-3 py-1.5 text-xs font-medium text-white"
                >
                  <Play className="h-3 w-3 fill-white" />
                  {locale.search.challengeQuestions(allResults.length)}
                </button>
              </div>

              {/* Results — tap to expand explanation */}
              <div className="max-h-80 overflow-y-auto">
                {displayResults.map((r) => {
                  const cat = getCategoryById(r.category)
                  const isExpanded = expandedId === r.id
                  return (
                    <div key={r.id} className="border-b border-stone-50 last:border-0 dark:border-stone-700/50">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        className="tap-highlight flex w-full items-start gap-2 px-4 py-2.5 text-left"
                      >
                        <span className="mt-0.5 shrink-0 text-sm">{cat?.icon}</span>
                        <span className="flex-1 text-sm leading-snug text-cf-ink dark:text-stone-200">
                          {r.question.length > 80 ? r.question.slice(0, 80) + '...' : r.question}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                        ) : (
                          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                        )}
                      </button>
                      {/* Expanded: answer + explanation */}
                      {isExpanded && (
                        <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3 dark:border-stone-700 dark:bg-stone-900/50">
                          <p className="mb-2 text-xs font-medium text-green-600 dark:text-green-400">
                            &#10003; {r.options[r.correctIndex]?.text}
                          </p>
                          <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                            <QuizText text={r.explanation} />
                          </p>
                          <div className="mt-2 flex items-center gap-3">
                            {r.referenceUrl && (
                              <a
                                href={r.referenceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-cf-accent"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {locale.feedback.officialDocs}
                              </a>
                            )}
                            <button
                              onClick={() => handleToggleBookmark(r.id)}
                              className="inline-flex items-center gap-1 text-xs text-stone-500"
                            >
                              <Bookmark
                                className={`h-3 w-3 ${userProgress.isBookmarked(r.id) ? 'fill-yellow-500 text-yellow-500' : ''}`}
                              />
                              {userProgress.isBookmarked(r.id) ? locale.search.saved : locale.search.learnLater}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {allResults.length > 10 && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="tap-highlight w-full border-t border-stone-100 px-4 py-2.5 text-center text-xs font-medium text-cf-accent dark:border-stone-700"
                  >
                    {locale.search.showAllRemaining(allResults.length - 10)}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
