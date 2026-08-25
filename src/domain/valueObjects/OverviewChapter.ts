/**
 * 全体像モードのチャプター定義
 *
 * overview-ch-N タグと対応する章情報を管理する。
 * チャプター区切り表示やプログレスバーの分割に使用。
 */
import { theme } from '@/config/theme'

export interface OverviewChapter {
  readonly id: number
  readonly tag: string
  readonly name: string
  readonly subtitle: string
  readonly icon: string
  /** このチャプターを学んだ人が明日の仕事でできる具体的なアクション */
  readonly actionItem: string
  /** 「読んでから解く」モードで表示する導入読み物 */
  readonly introContent?: readonly string[]
}

// quizzes.json の tags と一致するよう、id からタグ文字列を生成
export const OVERVIEW_CHAPTERS: readonly OverviewChapter[] = Object.freeze(
  theme.overviewChapters.map((ch) => ({
    ...ch,
    tag: `overview-ch-${ch.id}`,
  }))
)

/**
 * Question の tags から所属チャプターを取得
 */
export function getChapterFromTags(tags: readonly string[]): OverviewChapter | null {
  const chapterTag = tags.find((t) => t.startsWith('overview-ch-'))
  if (!chapterTag) return null
  return OVERVIEW_CHAPTERS.find((ch) => ch.tag === chapterTag) ?? null
}

/** 順序タグを持たない問題を末尾へ送るための番兵 */
const UNORDERED = Number.MAX_SAFE_INTEGER

/**
 * `tag` が付いた問題だけを、`${tag}-NNN` の順序タグ順に並べて返す共通ユーティリティ。
 *
 * overview（全体像モード）と indie（個人開発コース）のように「タグで束ねて
 * 決まった順に流す」コースは、この1つの関数で表現する。順序タグの正規表現や
 * 数値抽出をモードごとに書き分けると、`overview-ch-2` のようなチャプタータグを
 * 誤って順序として拾うといった差異が静かに生まれる。
 *
 * 順序は問題ごとに一度だけ求めてから並べ替える（比較のたびに tags を線形探索して
 * 正規表現を回さない）。
 */
export function getQuestionsOrderedByTag<T extends { tags: readonly string[] }>(
  questions: readonly T[],
  tag: string
): T[] {
  const orderPattern = new RegExp(`^${tag}-(\\d+)$`)
  return questions
    .filter((q) => q.tags.includes(tag))
    .map((q) => {
      const match = q.tags.reduce<RegExpMatchArray | null>((found, t) => found ?? t.match(orderPattern), null)
      return { q, order: match ? Number.parseInt(match[1], 10) : UNORDERED }
    })
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.q)
}

/**
 * overview タグ付き問題を出題順にソートして返す共通ユーティリティ
 */
export function getOverviewQuestionsOrdered<T extends { tags: readonly string[] }>(questions: readonly T[]): T[] {
  return getQuestionsOrderedByTag(questions, 'overview')
}
