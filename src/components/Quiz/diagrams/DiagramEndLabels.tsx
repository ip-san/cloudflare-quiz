/**
 * 図の下に添える両端ラベル（凡例）。
 *
 * hierarchy の `ranked` と layer の `overrides` は、どちらも
 * 「この図の並びには方向の意味がある」とデータ側が明示的に宣言したときだけ
 * 凡例を出す、という同じ仕組み。マークアップを2箇所に写すと、
 * 余白・文字サイズ・dark時の色・aria-hidden の扱いが片方だけ古くなる。
 *
 * 装飾なので `aria-hidden`。方向の意味は図の aria-label と本文の解説側で伝える。
 */
export function DiagramEndLabels({ left, right }: { left: string; right: string }) {
  return (
    <div
      className="mt-1.5 flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-500"
      aria-hidden="true"
    >
      <span>{left}</span>
      <span>{right}</span>
    </div>
  )
}
