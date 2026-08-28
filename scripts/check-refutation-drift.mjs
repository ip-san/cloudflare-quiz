#!/usr/bin/env node

/**
 * **反駁だけを書き換えたとき**に、誤答の主張を取りこぼしていないかを見る。
 *
 * 2026-08-28 に穴が露見した。`internal` 判定399肢の再検査で12件を直したが、
 * うち11件は `wrongFeedback` だけの修正だった。`quiz-audit.mjs` の差分検査は
 * **誤答の本文が変わった肢しか対象にしない**ため、
 *
 *     変更された誤答: 0肢 / 0問
 *     1/4 …OK  2/4 …OK  3/4 …OK  4/4 …OK
 *
 * と表示された。**何も検査せずに全項目 OK を返していた。**
 * 学習者は反駁を「正解の補足」として読むので、ここの誤りはそのまま知識になる。
 * 実際この12件のうち、
 *   - `ai-004[2]` は反駁が D1 に存在しないキャッシュ機能を帰属させていた
 *   - `sp-002[1]` は反駁が docs に一度も出てこない FID を挙げていた
 * と、いずれも**反駁の中だけで完結した誤り**だった。
 *
 * 検出方法:
 *   誤答の本文は変わらず `wrongFeedback` だけが変わった肢について、
 *   **旧い反駁が触れていた誤答内の特徴語**を、新しい反駁が落としていないかを見る。
 *   反駁を絞り込む修正で、誤答がまだ主張している点を取りこぼす形を捕まえる。
 *
 * 「必ず欠陥」ではない。言い換えれば語は消える。1件ずつ見るための triage。
 *
 * Usage:
 *   node scripts/check-refutation-drift.mjs <baseline-git-ref>
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUIZ_REL = 'src/data/quizzes.json'

const baseRef = process.argv[2]
if (!baseRef) {
  console.error('Usage: node scripts/check-refutation-drift.mjs <baseline-git-ref>')
  process.exit(1)
}

const current = JSON.parse(readFileSync(resolve(ROOT, QUIZ_REL), 'utf8'))
const base = JSON.parse(
  execFileSync('git', ['show', `${baseRef}:${QUIZ_REL}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString()
)
const baseById = new Map(base.quizzes.map((q) => [q.id, q]))

/** 反駁の対象になりうる具体語だけを見る（check-unrefuted-addition と同じ基準） */
function features(text) {
  const out = new Set()
  for (const m of (text ?? '').matchAll(/`([^`]+)`/g)) out.add(m[1].trim())
  for (const m of (text ?? '').matchAll(/\b[A-Za-z][A-Za-z0-9._-]{2,}\b/g)) out.add(m[0])
  // Cloudflare の製品名は2文字が多い（D1 / R2 / KV / DO / AI）。
  // 一般の英単語まで拾わないよう、`[A-Za-z]{1}[A-Za-z0-9]{1,}` を無条件に許すのではなく
  // **既知の短い製品名だけ**を明示的に足す。
  for (const m of (text ?? '').matchAll(/\b(?:D1|R2|KV|DO|AI|CA|MX|TXT|TLS|DNS|WAF|CDN)\b/g)) out.add(m[0])
  for (const m of (text ?? '').matchAll(/\d[\d,._]*\s*(?:%|GB|MB|KB|MiB|GiB|TB|秒|分|時間|日|件|個|本|回|倍)/g)) {
    out.add(m[0].replace(/\s+/g, ''))
  }
  return out
}

console.log('=== 反駁だけの書き換えの検査 ===')
console.log(`baseline: ${baseRef}`)
console.log('')

const findings = []
let refutationOnly = 0
for (const q of current.quizzes) {
  const o = baseById.get(q.id)
  if (!o) continue
  for (let i = 0; i < q.options.length; i++) {
    if (i === q.correctIndex) continue
    const cur = q.options[i]
    const old = o.options[i]
    if (!old) continue
    // 本文が変わった肢は既存の差分検査が見ている。ここは反駁だけが変わった肢を担当する
    if (old.text !== cur.text) continue
    if ((old.wrongFeedback ?? '') === (cur.wrongFeedback ?? '')) continue
    refutationOnly++

    const inOption = features(cur.text)
    const oldRef = features(old.wrongFeedback)
    const newRef = features(cur.wrongFeedback)
    // 誤答がまだ主張していて、旧い反駁は触れていたのに、新しい反駁が落とした語
    const dropped = [...inOption].filter((t) => oldRef.has(t) && !newRef.has(t))
    if (dropped.length) findings.push({ id: q.id, i, dropped })
  }
}

console.log(`反駁だけが変わった誤答: ${refutationOnly}肢`)
console.log('')
if (findings.length === 0) {
  console.log('OK: 反駁の書き換えで、誤答がまだ主張している点を落としたケースはありません。')
} else {
  console.log(`⚠️  ${findings.length}件の取りこぼし候補:`)
  for (const f of findings) {
    console.log(`  ${f.id} [wrongFeedback.${f.i}] が触れなくなった: ${f.dropped.join(' / ')}`)
  }
  console.log('')
  console.log('   ※ 言い換えれば語は消えるので、これ自体は欠陥ではない。')
  console.log('      「誤答がまだ主張している点を、新しい反駁が否定できているか」を1件ずつ見ること。')
}
