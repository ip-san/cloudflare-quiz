#!/usr/bin/env node
/**
 * 誤答3つがすべて「できない・含まれない」と制限を述べ、正解肢だけが制限を述べていない設問を見つける。
 *
 * 2026-09-15 に初級の掃引で pl-003 / pl-004 から見つかった。
 * **内容を知らなくても「いちばんできることが多い肢」を選べば当たる。**
 * 誤答だけに絶対表現が偏る形（check-absolute-skew.mjs）と同じ構造で、向きが逆である。
 *
 * 全756問で測ると7問。うち4問を手で当て直して、いずれも本物だった:
 *
 *   sc-016  誤答は「継続時間は含まない」「APIから取得できない」「L4情報は含まれない」。
 *           正解だけが取得できるものを並べる
 *   ar-007  誤答は「外部APMが要る」「24時間バッチ」「変換処理はできない」。正解だけが機能を並べる
 *   hw-009  誤答は「MySQLは利用できない」「外部DBに接続できない」「RDBに対応していない」
 *
 * **制限そのものを問う設問では正解肢も制限を述べるので、単純な否定語の数では測れない。**
 * 「誤答3つすべてが該当し、正解肢は該当しない」という偏りの形でのみ意味を持つ。
 *
 *   node scripts/check-polarity-skew.mjs [--list]
 */
import { readFileSync } from 'node:fs'

const FILE = 'src/data/quizzes.json'
const RESTRICT =
  /(できない|されない|受け付けられない|失われる|対応していない|利用できない|使えない|含まれない|行わない|サポートしていない|反映されない|保証されない)/

export function findPolaritySkew(quizzes) {
  const flagged = []
  for (const q of quizzes) {
    const ci = q.correctIndex
    if (RESTRICT.test(q.options[ci]?.text ?? '')) continue
    const wrong = q.options.filter((_, i) => i !== ci)
    if (wrong.length > 0 && wrong.every((o) => RESTRICT.test(o.text))) {
      flagged.push({ id: q.id, difficulty: q.difficulty })
    }
  }
  return flagged
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const quizzes = JSON.parse(readFileSync(FILE, 'utf8')).quizzes
  const flagged = findPolaritySkew(quizzes)
  if (flagged.length === 0) {
    console.log('OK: 誤答だけが制限を述べている設問はありません')
    process.exit(0)
  }
  console.error(`⚠️  誤答3つすべてが制限を述べ、正解肢は述べていない設問: ${flagged.length} 問\n`)
  const byTier = {}
  for (const f of flagged) (byTier[f.difficulty] ??= []).push(f.id)
  for (const [tier, ids] of Object.entries(byTier)) {
    console.error(`  ${tier}: ${ids.length} 問`)
    if (process.argv.includes('--list')) console.error(`    ${ids.join(' ')}`)
  }
  console.error('\n「いちばんできることが多い肢」を選ぶだけで当たってしまう。')
  console.error('誤答のどれかを「別のことができる」という肯定形の誤りに変えて偏りを消すこと。')
  // 既知の7問を直すまでは落とさない。absolute-skew と同じ運用（直し終えたら exit(1) にする）
  process.exit(0)
}
