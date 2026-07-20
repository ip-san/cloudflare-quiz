/**
 * theme.ts からカテゴリ別 weight（実務価値プロキシ 5/10/15）を抽出する純粋関数。
 *
 * レコメンド集計(aggregate-classifications.mjs)が価値 tie-break に使う。
 * テスト可能性のため独立モジュールに分離（scripts/__tests__/theme-weights.test.mjs）。
 *
 * パースは「フラットな {...} ブロックごと」に行い、その中から id と weight を個別抽出する。
 * これにより theme.ts 内での id 行と weight 行の前後順に依存しない（将来の並べ替えに頑健）。
 * 取得失敗時は空オブジェクトを返し、呼び出し側は既定 10 にフォールバックする。
 */

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const DEFAULT_THEME_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'config', 'theme.ts')

export function loadCategoryWeights(themeFile = DEFAULT_THEME_FILE) {
  try {
    const src = readFileSync(themeFile, 'utf8')
    const weights = {}
    // ネストを含まないフラットなオブジェクトブロックを走査（category 定義はすべてフラット）。
    for (const block of src.matchAll(/\{[^{}]*\}/g)) {
      const text = block[0]
      const idMatch = text.match(/id:\s*'([^']+)'/)
      const weightMatch = text.match(/weight:\s*(\d+)/)
      // id と weight を両方持つブロックのみカテゴリ定義とみなす。
      if (idMatch && weightMatch) {
        weights[idMatch[1]] = Number(weightMatch[1])
      }
    }
    return weights
  } catch {
    return {}
  }
}
