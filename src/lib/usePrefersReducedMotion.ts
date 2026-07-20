import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Reactive `prefers-reduced-motion: reduce` detector.
 *
 * Previously sibling hooks read `matchMedia(...).matches` at module load, which
 * never updated if the user toggled the OS setting mid-session. This hook
 * subscribes to the media query so the UI reacts immediately.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY).matches : false
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}
