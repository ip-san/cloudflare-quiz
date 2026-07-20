import { type RefObject, useEffect } from 'react'

/**
 * ダイアログ内のフォーカストラップ
 *
 * Tab/Shift+Tab でフォーカスをダイアログ内に閉じ込め、
 * Escape キーで onClose を呼ぶ。
 */
export function useFocusTrap(
  dialogRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
  options?: { extraCloseKeys?: string[] }
) {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || options?.extraCloseKeys?.includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button, [tabindex]')
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, onClose, dialogRef, options?.extraCloseKeys])
}
