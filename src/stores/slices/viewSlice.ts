/**
 * View Slice - ViewState management
 */

import { trackReaderOpen } from '@/lib/analytics'
import type { StoreGet, StoreSet, ViewState } from '../utils'

export interface ViewSlice {
  viewState: ViewState
  readerInitialFilter: string | null
  setViewState: (state: ViewState) => void
  openReaderWithFilter: (filter: string) => void
}

export const createViewSlice = (_set: StoreSet, _get: StoreGet): ViewSlice => ({
  viewState: 'menu',
  readerInitialFilter: null,
  setViewState: (state) => {
    if (state === 'reader') trackReaderOpen()
    _set({ viewState: state, readerInitialFilter: null })
  },
  openReaderWithFilter: (filter) => {
    trackReaderOpen()
    _set({ viewState: 'reader', readerInitialFilter: filter })
  },
})
