import { useCallback, useRef } from 'react'

interface UseSwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  /** Minimum horizontal distance to trigger swipe (px) */
  threshold?: number
  /** If true, swipe is disabled */
  disabled?: boolean
}

/**
 * Returns true if the touch target sits inside an ancestor that can scroll horizontally
 * (overflow-x: auto/scroll AND scrollWidth > clientWidth). Used to suppress swipe
 * navigation when the user's likely intent is to pan a wide diagram.
 */
function isInsideHorizontalScroller(target: EventTarget | null): boolean {
  let el = target instanceof Element ? (target as HTMLElement) : null
  while (el && el !== document.body) {
    const overflowX = getComputedStyle(el).overflowX
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
      return true
    }
    el = el.parentElement
  }
  return false
}

/**
 * Lightweight swipe gesture hook for touch devices.
 * Distinguishes horizontal swipe from vertical scroll by angle.
 * Handles touch cancel and aborts swipe if vertical scroll is detected.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 50, disabled = false }: UseSwipeOptions) {
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const aborted = useRef(false)

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return
      const touch = e.touches[0]
      touchStart.current = { x: touch.clientX, y: touch.clientY }
      aborted.current = isInsideHorizontalScroller(e.target)
    },
    [disabled]
  )

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current || aborted.current) return
    const touch = e.touches[0]
    const dy = Math.abs(touch.clientY - touchStart.current.y)
    const dx = Math.abs(touch.clientX - touchStart.current.x)
    // If vertical movement exceeds horizontal early, abort swipe (it's a scroll)
    if (dy > 10 && dy > dx) {
      aborted.current = true
    }
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || !touchStart.current || aborted.current) {
        touchStart.current = null
        return
      }
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStart.current.x
      const dy = touch.clientY - touchStart.current.y

      // Only trigger if horizontal movement is dominant
      if (Math.abs(dx) > threshold && Math.abs(dy) < Math.abs(dx) * 0.6) {
        if (dx < 0 && onSwipeLeft) {
          onSwipeLeft()
        } else if (dx > 0 && onSwipeRight) {
          onSwipeRight()
        }
      }

      touchStart.current = null
    },
    [disabled, threshold, onSwipeLeft, onSwipeRight]
  )

  const onTouchCancel = useCallback(() => {
    touchStart.current = null
    aborted.current = false
  }, [])

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel }
}
