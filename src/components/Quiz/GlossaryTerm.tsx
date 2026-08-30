import { useEffect, useId, useRef, useState } from 'react'
import type { GlossaryEntry } from '../../domain/valueObjects/Glossary'

interface GlossaryTermProps {
  entry: GlossaryEntry
}

/**
 * 本文中の語を、その場で説明を開ける形にする。
 *
 * 本文を書き換えずに済ませるための仕組み。詳しい経緯は
 * `src/domain/valueObjects/Glossary.ts` を参照。
 *
 * 設計の決めごと:
 * - **タップで開く。** PWAでスマートフォンから使われるので hover は当てにしない
 * - 開いている説明は1つだけ。別の語を開くと前のは閉じる（画面が説明で埋まらない）
 * - **説明は下に出す。** 上に出すと、設問見出しのように画面上端に近い語で
 *   説明が画面外へ押し出される（2026-08-30 に実機で確認した）
 * - `Escape` と外側のタップで閉じる
 * - 読み上げには `aria-describedby` ではなく `aria-expanded` + 実体の表示で伝える。
 *   説明が閉じているときは DOM に無いほうが、読み上げの流れが素直になる
 */
export function GlossaryTerm({ entry }: GlossaryTermProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="cursor-help border-stone-400 border-b border-dotted text-inherit dark:border-stone-500"
      >
        {entry.term}
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="absolute top-full left-0 z-20 mt-1 block w-64 max-w-[80vw] rounded-lg border border-stone-200 bg-white p-2.5 text-left text-stone-700 text-xs leading-relaxed shadow-lg dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
        >
          <span className="mb-0.5 block font-medium text-stone-900 dark:text-stone-100">{entry.term}</span>
          {entry.description}
        </span>
      )}
    </span>
  )
}
