import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

type Listener = (e: MediaQueryListEvent) => void

/** Build a `MediaQueryList` stub that we can flip at runtime. */
function installMockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>()
  const mql = {
    matches: initial,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_: string, l: Listener) => listeners.add(l)),
    removeEventListener: vi.fn((_: string, l: Listener) => listeners.delete(l)),
    dispatchEvent: vi.fn(),
  }
  window.matchMedia = vi.fn().mockReturnValue(mql)

  return {
    setMatches(next: boolean) {
      mql.matches = next
      const event = { matches: next } as MediaQueryListEvent
      for (const l of listeners) l(event)
    },
    get listenerCount() {
      return listeners.size
    },
  }
}

describe('usePrefersReducedMotion', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the initial preference value', () => {
    installMockMatchMedia(true)
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(true)
  })

  it('returns false when preference is not set', () => {
    installMockMatchMedia(false)
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
  })

  it('updates when the OS preference toggles mid-session', () => {
    const mq = installMockMatchMedia(false)
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)

    act(() => {
      mq.setMatches(true)
    })
    expect(result.current).toBe(true)

    act(() => {
      mq.setMatches(false)
    })
    expect(result.current).toBe(false)
  })

  it('registers and cleans up its change listener', () => {
    const mq = installMockMatchMedia(false)
    const { unmount } = renderHook(() => usePrefersReducedMotion())
    expect(mq.listenerCount).toBe(1)
    unmount()
    expect(mq.listenerCount).toBe(0)
  })
})
