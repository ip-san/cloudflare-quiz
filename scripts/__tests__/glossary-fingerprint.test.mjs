import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { hasTerm } from '../../src/domain/valueObjects/Glossary'
import { glossaryTermsAt } from '../playtest-coverage.mjs'

/**
 * 用語の照合規則は TS↔mjs の境界で複製されている:
 *
 *   src/domain/valueObjects/Glossary.ts   … hasTerm。画面の描画とチップが使う
 *   scripts/playtest-coverage.mjs         … hasTermMjs。カバレッジの用語指紋が使う
 *
 * ずれると、**画面に出ている語と、カバレッジが「出ている」と思っている語が食い違う。**
 * 再テストが必要な問題を取りこぼしても、数字は正常に見えるので気づけない。
 * `doc-pages-sync.test.mjs` と同じ理由で見張る。
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** mjs 側の実装を、コメントではなく実物から取り出して照合する */
function hasTermMjsFromSource() {
  const src = readFileSync(resolve(ROOT, 'scripts/playtest-coverage.mjs'), 'utf8')
  const fn = src.match(/function hasTermMjs\(text, term\) \{[\s\S]*?\n\}/)
  if (!fn) throw new Error('hasTermMjs が見つからない')
  const WORDISH = /[A-Za-z0-9_]/
  // biome-ignore lint/security/noGlobalEval: 実装のずれを見張るのが目的なので、実物を評価する
  return new Function('WORDISH', `${fn[0]}; return hasTermMjs`)(WORDISH)
}

describe('用語の照合規則が TS と mjs で一致する', () => {
  const hasTermMjs = hasTermMjsFromSource()
  const cases = [
    ['CREATE INDEX で作成する', 'DEX'],
    ['DEX のテスト結果', 'DEX'],
    ['PERFORMANCE の指標', 'ORM'],
    ['ORMをそのまま使える', 'ORM'],
    ['GREEDYな正規表現', 'GRE'],
    ['GREトンネル', 'GRE'],
    ['オリジンサーバー', 'オリジン'],
    ['(DEX)', 'DEX'],
    ['mTLSの設定', 'mTLS'],
  ]

  for (const [text, term] of cases) {
    it(`「${text}」に「${term}」— 両実装が同じ判定を返す`, () => {
      expect(hasTermMjs(text, term)).toBe(hasTerm(text, term))
    })
  }

  it('コーパス全体でも一致する（2,268肢すべて）', () => {
    const quizzes = JSON.parse(readFileSync(resolve(ROOT, 'src/data/quizzes.json'), 'utf8')).quizzes
    const terms = glossaryTermsAt(null)
    const mismatches = []
    for (const q of quizzes) {
      const text = [q.question, q.hint, q.explanation, ...q.options.flatMap((o) => [o.text, o.wrongFeedback])]
        .filter((t) => typeof t === 'string')
        .join(' ')
      for (const t of terms) {
        if (hasTermMjs(text, t) !== hasTerm(text, t)) mismatches.push(`${q.id}: ${t}`)
      }
    }
    expect(mismatches, `判定が食い違う組み合わせ:\n${mismatches.join('\n')}`).toEqual([])
  })
})
