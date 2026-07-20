import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

type ToastPhase = 'hidden' | 'enter' | 'visible' | 'exit'

/**
 * トースト表示のフェーズ管理フック
 * enter(50ms) → visible(holdMs) → exit(500ms) → hidden
 *
 * @param holdMs - visible 状態を維持する時間
 * @param onComplete - hidden に遷移した時のコールバック（キュー管理用）
 */
export function useToastPhase(holdMs = 2000, onComplete?: () => void) {
  const [phase, setPhase] = useState<ToastPhase>('hidden')
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const cleanupRef = useRef<(() => void) | null>(null)

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  const trigger = useCallback(() => {
    // Clear any running timers from previous trigger
    cleanupRef.current?.()

    setPhase('enter')
    const t1 = setTimeout(() => setPhase('visible'), 50)
    const t2 = setTimeout(() => setPhase('exit'), holdMs)
    const t3 = setTimeout(() => {
      setPhase('hidden')
      onCompleteRef.current?.()
    }, holdMs + 500)
    const cleanup = () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
    cleanupRef.current = cleanup
    return cleanup
  }, [holdMs])

  const style: CSSProperties = {
    opacity: phase === 'exit' ? 0 : 1,
    transform: phase === 'enter' ? 'scale(0.8) translateY(-10px)' : 'scale(1) translateY(0)',
    transition: 'opacity 0.4s ease, transform 0.3s ease',
  }

  return { phase, trigger, style } as const
}

/**
 * トーストの外側コンテナの共通 props
 * position: fixed, 画面上部, safe-area 対応
 */
export const toastContainerProps = {
  className: 'pointer-events-none fixed left-0 right-0 z-40 flex justify-center',
  role: 'status' as const,
  'aria-live': 'polite' as const,
  style: { top: 'calc(5rem + env(safe-area-inset-top, 0px))' },
}
