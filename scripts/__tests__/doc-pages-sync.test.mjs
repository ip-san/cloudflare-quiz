import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DOC_PAGES } from '../topic-config.mjs'

/**
 * ドキュメントページの一覧は2箇所にある（TS↔mjs 境界のため複製されている）:
 *
 *   scripts/topic-config.mjs          … DOC_PAGES。fetch-docs / quiz-lint が使う
 *   src/.../quizContentQuality.test.ts … VALID_DOC_PAGES。referenceUrl の検証に使う
 *
 * 片方だけ足すと次のどちらかが起きる:
 *   - topic-config だけ足す → fetch はされるが、referenceUrl に使うとテストが落ちる
 *   - テスト側だけ足す → referenceUrl に使えるが、docs がキャッシュされず裏取りできない
 *
 * 2026-08-28 に `tunnel-virtual-networks` を topic-config だけに足してテストが落ち、
 * そこで初めて複製に気づいた。そのとき既に1件ずれていた。
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const TEST_FILE = resolve(ROOT, 'src/infrastructure/validation/quizContentQuality.test.ts')

function validDocPagesFromTest() {
  const src = readFileSync(TEST_FILE, 'utf8')
  const block = src.match(/const VALID_DOC_PAGES = \[([\s\S]*?)\n\]/)
  if (!block) throw new Error('VALID_DOC_PAGES が見つからない')
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1].replace(/\/$/, ''))
}

describe('ドキュメントページ一覧の同期', () => {
  it('topic-config.mjs の DOC_PAGES と、テストの VALID_DOC_PAGES が一致する', () => {
    const fromConfig = new Set(DOC_PAGES.map((p) => p.name))
    const fromTest = new Set(validDocPagesFromTest())

    const onlyInConfig = [...fromConfig].filter((n) => !fromTest.has(n)).sort()
    const onlyInTest = [...fromTest].filter((n) => !fromConfig.has(n)).sort()

    expect(
      { onlyInConfig, onlyInTest },
      [
        'ドキュメントページ一覧がずれています。',
        onlyInConfig.length ? `topic-config.mjs にしかない: ${onlyInConfig.join(', ')}` : '',
        onlyInTest.length ? `テストにしかない: ${onlyInTest.join(', ')}` : '',
        '両方に同じページを足してください。',
      ]
        .filter(Boolean)
        .join('\n')
    ).toEqual({ onlyInConfig: [], onlyInTest: [] })
  })
})
