import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Question } from '@/domain/entities/Question'
import type { UserProgress } from '@/domain/entities/UserProgress'
import { haptics } from '@/lib/haptics'
import { useQuizStore } from '@/stores/quizStore'

const DISPLAY_LIMIT = 10

export type UseQuizSearchReturn = {
  // state
  query: string
  isOpen: boolean
  expandedId: string | null
  showAll: boolean
  categoryFilter: string | null
  showFilters: boolean
  // derived
  allResults: Question[]
  displayResults: Question[]
  // store values
  userProgress: UserProgress
  // setters / actions
  setQuery: (v: string) => void
  setIsOpen: (v: boolean) => void
  setExpandedId: (v: string | null) => void
  setShowAll: (v: boolean) => void
  setCategoryFilter: (v: string | null) => void
  setShowFilters: (v: boolean) => void
  // compound actions
  openSearch: () => void
  closeSearch: () => void
  launchSession: (ids: string[], searchQuery: string) => void
  launchSessionAndClose: (ids: string[], searchQuery: string) => void
  handleToggleBookmark: (id: string) => void
}

/**
 * QuizSearch のすべての状態・ロジックを保持するカスタムフック。
 * コンポーネントは返り値を使って純粋な表示レイヤーとして機能する。
 */
export function useQuizSearch(): UseQuizSearchReturn {
  const { allQuestions, startSessionWithIds, toggleBookmark, userProgress } = useQuizStore(
    useShallow((state) => ({
      allQuestions: state.allQuestions,
      startSessionWithIds: state.startSessionWithIds,
      toggleBookmark: state.toggleBookmark,
      userProgress: state.userProgress,
    }))
  )

  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const allResults = useMemo(() => {
    if (query.length < 2 && !categoryFilter) return []
    let results = allQuestions
    if (categoryFilter) {
      results = results.filter((quiz) => quiz.category === categoryFilter)
    }
    if (query.length >= 2) {
      const q = query.toLowerCase()
      results = results.filter(
        (quiz) =>
          quiz.question.toLowerCase().includes(q) ||
          quiz.explanation.toLowerCase().includes(q) ||
          quiz.options.some((opt) => opt.text.toLowerCase().includes(q))
      )
    }
    return results
  }, [allQuestions, query, categoryFilter])

  // Display limit for the list; quiz launch always uses ALL results
  const displayResults = allResults.slice(0, DISPLAY_LIMIT)

  // ---- compound actions ----

  function openSearch() {
    setIsOpen(true)
  }

  function closeSearch() {
    setQuery('')
    setCategoryFilter(null)
    setShowFilters(false)
    setIsOpen(false)
    setExpandedId(null)
  }

  /** showAll 画面から「挑戦」ボタンを押したとき */
  function launchSession(ids: string[], searchQuery: string) {
    haptics.light()
    startSessionWithIds(ids, searchQuery)
    setShowAll(false)
    setIsOpen(false)
    setQuery('')
  }

  /** 通常のドロップダウンから「挑戦」ボタンを押したとき */
  function launchSessionAndClose(ids: string[], searchQuery: string) {
    haptics.light()
    startSessionWithIds(ids, searchQuery)
    setIsOpen(false)
    setQuery('')
  }

  function handleToggleBookmark(id: string) {
    haptics.light()
    toggleBookmark(id)
  }

  return {
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
    setIsOpen,
    setExpandedId,
    setShowAll,
    setCategoryFilter,
    setShowFilters,
    openSearch,
    closeSearch,
    launchSession,
    launchSessionAndClose,
    handleToggleBookmark,
  }
}
