import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 用語集の項目が、実際にコーパスの中で使われているかを確かめる。
 *
 * 表記を1文字でも間違えた項目は**一度も一致しない**。画面には何も出ないので、
 * 「登録したのに出ない」に気づけない。逆に、設問側の書き換えで語が消えた項目も
 * 死んだまま残る。どちらも**登録数だけが増えて効果が増えない**状態を作る。
 *
 * 2026-08-30 に用語集を作ったとき、収録は
 * 「プレイテストで実際に詰まった語」からしか増やせないと分かった
 * （頻度で機械抽出すると Cloudflare / リクエスト / ファイルばかりが挙がる）。
 * 手で足す運用になるぶん、表記ゆれが入りやすい。
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function glossaryTerms() {
  const src = readFileSync(resolve(ROOT, 'src/domain/valueObjects/Glossary.ts'), 'utf8')
  const block = src.match(/const ENTRIES: GlossaryEntry\[\] = \[([\s\S]*?)\n\]/)
  if (!block) throw new Error('ENTRIES が見つからない')
  return [...block[1].matchAll(/term: '([^']+)'/g)].map((m) => m[1])
}

describe('用語集', () => {
  const quizzes = JSON.parse(readFileSync(resolve(ROOT, 'src/data/quizzes.json'), 'utf8')).quizzes
  const corpus = quizzes
    .map((q) =>
      [q.question, q.hint, q.explanation, ...q.options.flatMap((o) => [o.text, o.wrongFeedback])]
        .filter((t) => typeof t === 'string')
        .join(' ')
    )
    .join('\n')

  it('登録した語がすべてコーパスに実在する（表記ゆれで死んでいない）', () => {
    const dead = glossaryTerms().filter((t) => !corpus.includes(t))

    expect(
      dead,
      [
        'コーパスに一度も現れない用語があります:',
        ...dead.map((t) => `  - ${t}`),
        '',
        '表記を間違えているか、設問側から語が消えています。',
        '一致しない項目は画面に何も出さないので、登録数だけが増えて効果は増えません。',
      ].join('\n')
    ).toEqual([])
  })

  it('説明が1文で終わっている（長い説明はポップアップに収まらない）', () => {
    const src = readFileSync(resolve(ROOT, 'src/domain/valueObjects/Glossary.ts'), 'utf8')
    const block = src.match(/const ENTRIES: GlossaryEntry\[\] = \[([\s\S]*?)\n\]/)
    const descs = [...block[1].matchAll(/description: '([^']+)'/g)].map((m) => m[1])
    const tooLong = descs.filter((d) => d.length > 70)

    expect(tooLong, ['70字を超える説明があります:', ...tooLong.map((d) => `  - ${d}`)].join('\n')).toEqual([])
  })
})
