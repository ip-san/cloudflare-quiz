import { useEffect, useRef, useState } from 'react'

interface UseDiagramAnimationOptions {
  itemCount: number
  staggerMs?: number
  initialDelayMs?: number
}

/** Check if element is actually visible (including ancestor opacity) */
function isElementVisible(el: HTMLElement): boolean {
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ opacityProperty: true })
  }
  // Fallback: walk ancestors checking computed opacity
  let current: HTMLElement | null = el
  while (current) {
    if (getComputedStyle(current).opacity === '0') return false
    current = current.parentElement
  }
  return true
}

export function useDiagramAnimation({ itemCount, staggerMs = 120, initialDelayMs = 200 }: UseDiagramAnimationOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Check prefers-reduced-motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionQuery.matches) {
      setIsVisible(true)
      return
    }

    let rafId = 0
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect()
          // Wait until element is actually visible (parent opacity animation may still be running)
          const waitForVisible = () => {
            if (isElementVisible(el)) {
              setIsVisible(true)
            } else {
              rafId = requestAnimationFrame(waitForVisible)
            }
          }
          waitForVisible()
        }
      },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [])

  const getItemDelay = (index: number): string => `${initialDelayMs + index * staggerMs}ms`

  return { containerRef, isVisible, getItemDelay, itemCount }
}
