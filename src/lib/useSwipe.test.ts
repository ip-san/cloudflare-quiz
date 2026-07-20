import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSwipe } from './useSwipe'

type Point = { x: number; y: number }

function makeTouchEvent(type: 'touches' | 'changedTouches', point: Point, target: EventTarget) {
  const touch = { clientX: point.x, clientY: point.y } as Touch
  return {
    target,
    touches: type === 'touches' ? [touch] : [],
    changedTouches: type === 'changedTouches' ? [touch] : [],
  } as unknown as React.TouchEvent
}

function fireSwipe(
  handlers: ReturnType<typeof useSwipe>,
  start: Point,
  end: Point,
  target: EventTarget = document.createElement('div')
) {
  handlers.onTouchStart(makeTouchEvent('touches', start, target))
  handlers.onTouchMove(makeTouchEvent('touches', end, target))
  handlers.onTouchEnd(makeTouchEvent('changedTouches', end, target))
}

function makeScrollableTarget({
  overflowX,
  scrollWidth,
  clientWidth,
}: {
  overflowX: string
  scrollWidth: number
  clientWidth: number
}) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true })
  el.style.overflowX = overflowX
  return el
}

describe('useSwipe', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('triggers onSwipeLeft for a horizontal swipe past the threshold', () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useSwipe({ onSwipeLeft }))
    fireSwipe(result.current, { x: 200, y: 100 }, { x: 100, y: 105 })
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
  })

  it('does not trigger when vertical movement dominates', () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useSwipe({ onSwipeLeft }))
    fireSwipe(result.current, { x: 200, y: 100 }, { x: 195, y: 200 })
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('aborts when the touch starts inside a horizontally scrollable ancestor', () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useSwipe({ onSwipeLeft }))
    const scroller = makeScrollableTarget({ overflowX: 'auto', scrollWidth: 800, clientWidth: 320 })
    const inner = document.createElement('span')
    scroller.appendChild(inner)

    fireSwipe(result.current, { x: 250, y: 100 }, { x: 100, y: 100 }, inner)
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('still triggers when overflow-x is auto but the content does not actually overflow', () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useSwipe({ onSwipeLeft }))
    const fakeScroller = makeScrollableTarget({ overflowX: 'auto', scrollWidth: 320, clientWidth: 320 })
    const inner = document.createElement('span')
    fakeScroller.appendChild(inner)

    fireSwipe(result.current, { x: 250, y: 100 }, { x: 100, y: 100 }, inner)
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
  })
})
