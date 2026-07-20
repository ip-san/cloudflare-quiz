/**
 * Bookmark Slice - Bookmark management
 */

import { getProgressRepository } from '@/infrastructure'
import { trackBookmark } from '@/lib/analytics'
import type { StoreGet, StoreSet } from '../utils'

export interface BookmarkSlice {
  toggleBookmark: (questionId: string) => void
  getBookmarkedCount: () => number
}

export const createBookmarkSlice = (set: StoreSet, get: StoreGet): BookmarkSlice => ({
  toggleBookmark: (questionId) => {
    const state = get()
    // Check state BEFORE toggle to determine the correct analytics action
    const wasBookmarked = state.userProgress.isBookmarked(questionId)
    const updatedProgress = state.userProgress.toggleBookmark(questionId)
    set({ userProgress: updatedProgress })
    trackBookmark(wasBookmarked ? 'remove' : 'add')
    getProgressRepository()
      .save(updatedProgress)
      .catch((error) => {
        console.error('Failed to save bookmark:', error)
      })
  },

  getBookmarkedCount: () => {
    return get().userProgress.bookmarkedQuestionIds.length
  },
})
