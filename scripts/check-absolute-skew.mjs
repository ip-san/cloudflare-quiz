#!/usr/bin/env node
/**
 * 誤答だけに「常に」「一切」「必ず」のような絶対表現が偏っている設問を見つける。
 *
 * 2026-09-15 に hw-018 で見つかった。誤答3つが「常に」「一切」「完全に同じ」という極端な断定で、
 * **「絶対表現の肢は誤答」という受験テクニックだけで解けてしまう。** 出題の主題を知らなくてよい。
 *
 * 全756問で測ると偏りは大きい:
 *
 *   正解肢に絶対表現   37/756  ( 4%)
 *   誤答に絶対表現    625/2268 (27%)   ← 7倍
 *
 * **誤答3つすべてに絶対表現があり、正解には無い設問が26問ある。** それが本チェックの対象。
 * ct-010 と as-008 で実際に確かめたところ、どちらも絶対表現を避けるだけで正解に到達できた。

2026-09-15 に19問すべてを直し、**0件にした**。正解肢に絶対表現が無いまま誤答3つだけが
断定する形は、以後1件でも増えたらこのチェックが落ちる。
 *
 * 意味の型（H-4 / H-5）は語では測れないと 09-14 に実測で確かめた（否定的結果11件目）。
 * **これは語で測れる数少ない型なので規則にしておく。** 設問の外を参照するヒント（HINT_CROSS_REF）に次ぐ2件目。
 *
 *   node scripts/check-absolute-skew.mjs [--list]
 */
import { readFileSync } from 'node:fs'

const FILE = 'src/data/quizzes.json'
const ABSOLUTE = /(常に|一切|必ず|決して|すべての|全て|完全に|例外なく|どんな|いかなる|無制限)/

export function findAbsoluteSkew(quizzes) {
  const flagged = []
  for (const q of quizzes) {
    const ci = q.correctIndex
    const correctHas = ABSOLUTE.test(q.options[ci]?.text ?? '')
    if (correctHas) continue
    const wrong = q.options.filter((_, i) => i !== ci)
    if (wrong.length > 0 && wrong.every((o) => ABSOLUTE.test(o.text))) {
      flagged.push({ id: q.id, difficulty: q.difficulty, category: q.category })
    }
  }
  return flagged
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const quizzes = JSON.parse(readFileSync(FILE, 'utf8')).quizzes
  const flagged = findAbsoluteSkew(quizzes)
  if (flagged.length === 0) {
    console.log('OK: 誤答だけに絶対表現が偏っている設問はありません')
    process.exit(0)
  }
  console.error(`⚠️  誤答3つすべてに絶対表現があり、正解には無い設問: ${flagged.length} 問\n`)
  const byTier = {}
  for (const f of flagged) {
    if (!byTier[f.difficulty]) byTier[f.difficulty] = []
    byTier[f.difficulty].push(f.id)
  }
  for (const [tier, ids] of Object.entries(byTier)) {
    console.error(`  ${tier}: ${ids.length} 問`)
    if (process.argv.includes('--list')) console.error(`    ${ids.join(' ')}`)
  }
  console.error('\n「絶対表現の肢は誤答」という受験テクニックだけで解けてしまう。')
  console.error('誤答から絶対表現を外すか、正解肢にも同じ強さの断定を入れて偏りを消すこと。')
  console.error('語が主張そのものを担っている場合は、外すのではなく実質のある誤りに組み直すこと。')
  console.error('外した結果その誤答が真になると二重正解になる。必ず「外しても誤りのままか」を確かめる。')
  // 2026-09-15 に残り19問を直して0件にした。以後は増えたら落とす。
  process.exit(1)
}
