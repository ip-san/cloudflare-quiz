/**
 * 共通スタイル定数
 *
 * ダークモード対応のクラス名パターンを1箇所で管理。
 * コンポーネントで直接 className を書く代わりにこの定数を使うことで、
 * ダークモードの漏れを防ぐ。
 *
 * 使い方:
 * import { cardStyles, buttonStyles } from '@/lib/styles'
 * <div className={cardStyles.base}>
 */

/** カード（白背景 + ボーダー） */
export const cardStyles = {
  /** 標準カード: 白背景 + stone-200 ボーダー */
  base: 'rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800',
  /** shadow 付き */
  elevated: 'rounded-2xl border border-stone-200 bg-white shadow-xs dark:border-stone-700 dark:bg-stone-800',
  /** パディング込み */
  padded: 'rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800',
} as const

/** ボタン */
export const buttonStyles = {
  /** プライマリ（オレンジ） */
  primary: 'tap-highlight rounded-2xl bg-cf-accent px-6 py-3.5 text-base font-semibold text-white',
  /** セカンダリ（ボーダー） */
  secondary:
    'tap-highlight rounded-2xl border border-stone-300 px-6 py-3.5 text-base font-semibold text-stone-600 dark:border-stone-600 dark:text-stone-300',
  /** ゴースト（テキストのみ） */
  ghost: 'tap-highlight rounded-full p-2 text-stone-500',
} as const

/** ページ背景 */
export const pageStyles = {
  /** メニュー画面背景 */
  cream: 'bg-cf-surface dark:bg-stone-900',
  /** クイズ画面背景 */
  quiz: 'bg-stone-100 dark:bg-stone-900 sm:bg-cf-surface',
} as const

/** ヘッダー */
export const headerStyles = {
  sticky:
    'sticky top-0 z-10 border-b border-stone-200 bg-cf-surface/95 backdrop-blur-xs dark:border-stone-700 dark:bg-stone-900/95',
} as const
