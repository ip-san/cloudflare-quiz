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

/**
 * overview タグ付き問題を出題順にソートして返す共通ユーティリティ
 */
export function getOverviewQuestionsOrdered<T extends { tags: readonly string[] }>(questions: readonly T[]): T[] {
  return [...questions]
    .filter((q) => q.tags.includes('overview'))
    .sort((a, b) => {
      const getOrder = (q: T): number => {
        const tag = q.tags.find((t) => /^overview-\d/.test(t))
        return tag ? Number.parseInt(tag.replace('overview-', ''), 10) : 999
      }
      return getOrder(a) - getOrder(b)
    })
}
