import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `quiz-lint.mjs` の「精査して正常と判断した」抑制リストが、
 * **まだ実在する組を指しているか**を確かめる。
 *
 * 抑制は放っておくと腐る。本文が書き換わって語尾が変われば、その項目は
 * 何も抑制しない死んだ行になり、リストだけが「精査済み3件」と見せ続ける。
 * さらに悪いのは、あとで同じ ID に**別の**語尾の並びが生まれたとき、
 * 読み手が「この設問は精査済み」と誤読することだ。
 *
 * 2026-08-28 に、挙がっていた5件のうち2件が実際の欠陥だったのに
 * 残り3件が正常だったせいでまとめて切り捨てて見落とした。
 * 抑制リストはその再発防止だが、抑制そのものが次の見落としの温床になる。
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const LINT = resolve(ROOT, 'scripts/quiz-lint.mjs')
const TAIL_LEN = 12

function reviewedEntries() {
  const src = readFileSync(LINT, 'utf8')
  const block = src.match(/const REVIEWED_PARALLEL_TAILS = \[([\s\S]*?)\n\]/)
  if (!block) throw new Error('REVIEWED_PARALLEL_TAILS が見つからない')
  return [...block[1].matchAll(/\{\s*id: '([^']+)',\s*tail: '([^']*)'/g)].map((m) => ({
    id: m[1],
    tail: m[2],
  }))
}

/** その設問で「誤答どうしだけ」が揃っている語尾の集合 */
function distractorOnlyTails(quiz) {
  const tails = quiz.options.map((o) => o.text.slice(-TAIL_LEN))
  const correctTail = tails[quiz.correctIndex]
  const found = new Set()
  for (let i = 0; i < tails.length; i++) {
    for (let j = i + 1; j < tails.length; j++) {
      if (i === quiz.correctIndex || j === quiz.correctIndex) continue
      if (tails[i] === tails[j] && tails[i] !== correctTail) found.add(tails[i])
    }
  }
  return found
}

describe('quiz-lint の精査済み抑制リスト', () => {
  const quizzes = JSON.parse(readFileSync(resolve(ROOT, 'src/data/quizzes.json'), 'utf8')).quizzes
  const byId = new Map(quizzes.map((q) => [q.id, q]))

  it('抑制している組がすべて実在する（死んだ抑制が残っていない）', () => {
    const dead = []
    for (const { id, tail } of reviewedEntries()) {
      const quiz = byId.get(id)
      if (!quiz) {
        dead.push(`${id}: 設問そのものが存在しない`)
        continue
      }
      if (!distractorOnlyTails(quiz).has(tail)) {
        dead.push(`${id}: 「${tail}」で揃った誤答の組はもう無い`)
      }
    }

    expect(
      dead,
      [
        '空振りしている抑制があります。',
        ...dead.map((d) => `  - ${d}`),
        '',
        '本文を書き換えたなら、その行を消してください。',
        '残しておくと「精査済み」の表示だけが生き残り、',
        '同じ設問に別の語尾の並びが生まれたとき見落とします。',
      ].join('\n')
    ).toEqual([])
  })
})
