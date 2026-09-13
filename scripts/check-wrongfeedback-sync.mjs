#!/usr/bin/env node
/**
 * 誤答の本文を書き換えたのに wrongFeedback を据え置いた箇所を見つける。
 *
 * 2026-09-13 に実際にやった。誤答層の作り直しで5問の誤答本文を差し替えたが、
 * 肢ごとの wrongFeedback（「なぜこの回答が誤りか」）を更新し忘れ、16件が
 * 別の話をしたまま残った。うち wr-005 の1件は
 * 「そのようなサブコマンドは存在しません」が実在するコマンド（`wrangler init --from-dash`）に
 * 付いてしまい、**同じ画面の解説文と矛盾する事実誤りが利用者に見えていた**。
 *
 * 内容の照合（本文と feedback が同じ語を含むか）では見つからない。実測で誤検知 49%。
 * 見るべきは git の差分である。**新しい本文に、古い feedback がそのまま乗っている**のが欠陥。
 *
 *   node scripts/check-wrongfeedback-sync.mjs [baseRef]   既定 HEAD（作業ツリーとの比較）
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const FILE = 'src/data/quizzes.json'

function loadAt(ref) {
  const raw = execFileSync('git', ['show', `${ref}:${FILE}`], { encoding: 'utf8', maxBuffer: 1 << 28 })
  return JSON.parse(raw)
}

export function findStaleFeedback(baseQuizzes, headQuizzes) {
  const base = new Map(baseQuizzes.map((q) => [q.id, q]))
  const stale = []
  for (const q of headQuizzes) {
    const before = base.get(q.id)
    if (!before) continue
    const oldTexts = new Set(before.options.map((o) => o.text))
    const oldFeedback = new Set(before.options.map((o) => o.wrongFeedback).filter(Boolean))
    q.options.forEach((o, i) => {
      if (i === q.correctIndex) return
      if (!o.wrongFeedback) return
      // 本文は変わった（旧版のどの肢の本文とも一致しない）のに、feedback は旧版のまま
      if (!oldTexts.has(o.text) && oldFeedback.has(o.wrongFeedback)) {
        stale.push({ id: q.id, index: i, text: o.text, wrongFeedback: o.wrongFeedback })
      }
    })
  }
  return stale
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const baseRef = process.argv[2] ?? 'HEAD'
  // 比較先はつねに作業ツリー。基準を渡したときだけ committed HEAD を見る、という作りにすると
  // 「直したのに落ちる」ことになり、実際に一度混乱した（2026-09-13）。
  const head = JSON.parse(readFileSync(FILE, 'utf8'))
  const stale = findStaleFeedback(loadAt(baseRef).quizzes, head.quizzes)
  if (stale.length === 0) {
    console.log(`OK: 本文を書き換えた誤答で wrongFeedback が据え置きのものはありません（基準 ${baseRef}）`)
    process.exit(0)
  }
  console.error(`✖ 誤答の本文を書き換えたのに wrongFeedback が古いまま: ${stale.length} 件（基準 ${baseRef}）\n`)
  for (const s of stale) {
    console.error(`  ${s.id} 肢${s.index}`)
    console.error(`    新しい本文 : ${s.text.slice(0, 78)}`)
    console.error(`    古い feedback: ${s.wrongFeedback.slice(0, 78)}`)
  }
  console.error('\n本文を替えたら、その肢の wrongFeedback も書き直すこと。')
  console.error('据え置くと、利用者には「選んでいない話への反論」か、最悪の場合は事実誤りが表示される。')
  process.exit(1)
}
