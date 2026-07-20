import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTerminalAnimation } from './useTerminalAnimation'

/** Stub `window.matchMedia` so `prefers-reduced-motion: reduce` evaluates to the given value. */
function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

const LINES = [
  { type: 'command' as const, text: 'echo hi' },
  { type: 'response' as const, text: 'hi' },
]

describe('useTerminalAnimation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('with prefers-reduced-motion: reduce', () => {
    it('starts in a completed, static state (no auto-play)', () => {
      mockReducedMotion(true)
      const { result } = renderHook(() => useTerminalAnimation(LINES, true))
      expect(result.current.isComplete).toBe(true)
      expect(result.current.isPlaying).toBe(false)
    })

    it('renders every line as fully visible while idle', () => {
      mockReducedMotion(true)
      const { result } = renderHook(() => useTerminalAnimation(LINES, true))
      for (let i = 0; i < LINES.length; i++) {
        const state = result.current.getLineState(i)
        expect(state.visible).toBe(true)
        expect(state.typingChars).toBeNull()
      }
    })

    it('replay force-starts the animation (regression: button was inert on iOS "Reduce Motion")', () => {
      mockReducedMotion(true)
      const { result } = renderHook(() => useTerminalAnimation(LINES, true))
      // Pre-condition: auto-play did not actually play
      expect(result.current.isPlaying).toBe(false)

      act(() => {
        result.current.replayAnimation()
      })

      // Animation is now running even though reduced-motion is set
      expect(result.current.isPlaying).toBe(true)
      expect(result.current.isComplete).toBe(false)
    })
  })

  describe('without prefers-reduced-motion', () => {
    it('auto-plays when the element becomes visible', () => {
      mockReducedMotion(false)
      const { result } = renderHook(() => useTerminalAnimation(LINES, true))
      expect(result.current.isPlaying).toBe(true)
      expect(result.current.isComplete).toBe(false)
    })

    it('does not start until isVisible becomes true', () => {
      mockReducedMotion(false)
      const { result, rerender } = renderHook(({ v }) => useTerminalAnimation(LINES, v), {
        initialProps: { v: false },
      })
      expect(result.current.isPlaying).toBe(false)
      rerender({ v: true })
      expect(result.current.isPlaying).toBe(true)
    })

    it('skipAnimation marks the flow complete', () => {
      mockReducedMotion(false)
      const { result } = renderHook(() => useTerminalAnimation(LINES, true))
      act(() => {
        result.current.skipAnimation()
      })
      expect(result.current.isComplete).toBe(true)
      expect(result.current.isPlaying).toBe(false)
    })

    it('replay resets and restarts after skip', () => {
      mockReducedMotion(false)
      const { result } = renderHook(() => useTerminalAnimation(LINES, true))
      act(() => {
        result.current.skipAnimation()
      })
      expect(result.current.isComplete).toBe(true)

      act(() => {
        result.current.replayAnimation()
      })
      expect(result.current.isPlaying).toBe(true)
      expect(result.current.isComplete).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('empty lines array stays complete and idle', () => {
      mockReducedMotion(false)
      const { result } = renderHook(() => useTerminalAnimation([], true))
      // An empty list is inert — no animation happens regardless of visibility
      expect(result.current.isPlaying).toBe(false)
    })

    it('replay on empty lines is safe (no throw, no play)', () => {
      mockReducedMotion(true)
      const { result } = renderHook(() => useTerminalAnimation([], true))
      expect(() => act(() => result.current.replayAnimation())).not.toThrow()
      expect(result.current.isPlaying).toBe(false)
    })
  })
})
