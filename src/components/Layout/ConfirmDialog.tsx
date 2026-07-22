import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** 確認ボタンのスタイル（デフォルト: primary） */
  variant?: 'primary' | 'danger'
}

/**
 * iOS スタイルのボトムシート確認ダイアログ
 *
 * App.tsx のクイズ中止ダイアログと同じデザイン。
 * window.confirm の代替として使用する。
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'primary',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  useEffect(() => {
    const btn = dialogRef.current?.querySelector('button')
    btn?.focus()
  }, [])

  const confirmColors = variant === 'danger' ? 'text-red-500' : 'bg-cf-accent text-white'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        ref={dialogRef}
        className="relative mx-2 mb-2 w-full max-w-sm animate-slide-down rounded-2xl bg-white p-6 shadow-2xl dark:bg-stone-800 sm:mx-4 sm:mb-0 sm:animate-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-center text-lg font-semibold text-cf-ink dark:text-stone-100">{title}</h3>
        <p className="mb-6 text-center text-sm text-stone-500 dark:text-stone-400">{message}</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className={`tap-highlight w-full rounded-2xl py-3.5 text-base font-semibold ${confirmColors}`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="tap-highlight w-full rounded-2xl py-3.5 text-base font-semibold text-stone-500"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
