import { GLOSSARY, type GlossaryEntry } from '../../domain/valueObjects/Glossary'
import { GlossaryTerm } from './GlossaryTerm'

interface GlossaryChipsProps {
  /** その設問で学習者の目に入る文字列すべて（設問文・ヒント・選択肢） */
  texts: readonly (string | undefined | null)[]
  label: string
}

/**
 * その設問に出てくる用語を、まとめてタップできる形で並べる。
 *
 * ### なぜ本文の下線だけでは足りないか（実測）
 *
 * 2026-08-30 の実機テストで、初学者が2回同じことを言った:
 *
 * > 選択肢Aの『エッジキャッシュ』が何なのか分からなかった。
 * > **選ぶとそのまま回答になっちゃうから、確認しようがなくて困った**
 *
 * 選択肢は `<button>` なので、その中に用語のボタンを置くと
 * タップした時点で回答が確定してしまう。そのため選択肢の中では
 * 下線を出していない。だが**分からない語は選択肢の中にも出る。**
 *
 * さらにもう1点:
 *
 * > どの語に説明が用意されているか予測できず、結局
 * > 『気になったら片っ端からタップしてみる』しかない感じがした
 *
 * この2つは同じ形で解ける。**選択肢の外に、その設問で説明できる語を並べる。**
 * 学習者は「説明がある語の一覧」を先に見られ、選択肢の中の語も確認できる。
 */
export function GlossaryChips({ texts, label }: GlossaryChipsProps) {
  const joined = texts.filter((t): t is string => typeof t === 'string').join(' ')
  const found: GlossaryEntry[] = GLOSSARY.filter((e) => joined.includes(e.term))
  if (found.length === 0) return null

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:mb-4">
      <span className="text-stone-500 text-xs dark:text-stone-400">{label}</span>
      {found.map((entry) => (
        <span
          key={entry.term}
          className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-stone-600 text-xs dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300"
        >
          <GlossaryTerm entry={entry} />
        </span>
      ))}
    </div>
  )
}
