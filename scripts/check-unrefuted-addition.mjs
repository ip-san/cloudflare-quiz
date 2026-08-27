#!/usr/bin/env node

/**
 * 誤答を厚くする作業で「反駁されない誤りが増える」のを検出する。
 *
 * 誤答を長くするとき、いま述べている誤りを詳しくするのではなく
 * **独立した2つめの誤りを継ぎ足す**と、既存の wrongFeedback は
 * 1つめしか反駁しないまま残る。反駁されなかった主張だけが
 * 誤解として学習者に残る——2026-08-26 の監査で12件見つけて潰した欠陥
 * （bt-015 / dl-013 / ct-008 型）と同じものを、こちらから作ってしまう形になる。
 *
 * `check-orphaned-refutation.mjs` はこれを捕まえない。あちらは
 * 「消えた主張をまだ反駁している」方向で、こちらは「増えた主張を反駁していない」方向。
 *
 * 検出方法（2つの兆候）:
 *   1. 誤答に**追加の主張を接続する語**（かつ / また / さらに / 加えて 等）が
 *      新しく現れたのに、wrongFeedback が変わっていない
 *   2. 誤答に新しく現れた特徴語（識別子・数値・製品名）が、wrongFeedback のどこにも無い
 *
 * どちらも「必ず欠陥」ではない。仕組みの説明を足せば特徴語は自然に増える。
 * 1件ずつ「増えた分を反駁できているか」を見るための triage 用。
 *
 * Usage:
 *   node scripts/check-unrefuted-addition.mjs <baseline-git-ref>
 */

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUIZ_REL = 'src/data/quizzes.json'

const baseRef = process.argv[2]
if (!baseRef) {
  console.error('Usage: node scripts/check-unrefuted-addition.mjs <baseline-git-ref>')
  process.exit(1)
}

const current = JSON.parse(readFileSync(resolve(ROOT, QUIZ_REL), 'utf8'))
const baseRaw = execFileSync('git', ['show', `${baseRef}:${QUIZ_REL}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
const base = JSON.parse(baseRaw.toString('utf8'))
const baseById = new Map(base.quizzes.map((q) => [q.id, q]))

/** 主張を継ぎ足すときに使われる接続表現 */
const ADDITIVE = /(?:かつ、?|また、|さらに、?|加えて、?|そのうえ、?|同時に、?|うえに、?|とともに)/g

/** 反駁の対象になりうる具体語だけを見る（一般的な日本語は対象外） */
function features(text) {
  const out = new Set()
  for (const m of (text ?? '').matchAll(/`([^`]+)`/g)) out.add(m[1].trim())
  for (const m of (text ?? '').matchAll(/\b[A-Za-z][A-Za-z0-9._-]{2,}\b/g)) out.add(m[0])
  for (const m of (text ?? '').matchAll(/\d[\d,._]*\s*(?:%|GB|MB|KB|MiB|GiB|TB|秒|分|時間|日|件|個|本|回|倍)/g)) {
    out.add(m[0].replace(/\s+/g, ''))
  }
  return out
}

const findings = []

for (const quiz of current.quizzes) {
  const old = baseById.get(quiz.id)
  if (!old) continue

  for (let i = 0; i < quiz.options.length; i++) {
    if (i === quiz.correctIndex) continue
    const nowOpt = quiz.options[i]?.text
    const oldOpt = old.options[i]?.text
    if (!nowOpt || !oldOpt || nowOpt === oldOpt) continue

    const nowFb = quiz.options[i]?.wrongFeedback ?? ''
    const oldFb = old.options[i]?.wrongFeedback ?? ''
    const fbUnchanged = nowFb === oldFb

    const addedConnectives = (nowOpt.match(ADDITIVE) ?? []).length - (oldOpt.match(ADDITIVE) ?? []).length
    const oldFeat = features(oldOpt)
    const fbFeat = features(nowFb)
    let newUnrefuted = [...features(nowOpt)].filter((t) => !oldFeat.has(t) && !fbFeat.has(t))
    // `put()` と `put` のように一方が他方の一部なら、長いほうだけを数える。
    // 同じ1語を2回数えると件数が水増しされ、しきい値が意味を失う。
    newUnrefuted = newUnrefuted.filter((t) => !newUnrefuted.some((u) => u !== t && u.includes(t)))

    const reasons = []
    if (addedConnectives > 0 && fbUnchanged) {
      reasons.push(`追加接続語が${addedConnectives}個増えたが wrongFeedback は変わっていない`)
    }
    if (newUnrefuted.length >= 3) {
      reasons.push(`反駁に現れない新語が${newUnrefuted.length}個: ${newUnrefuted.slice(0, 6).join(' / ')}`)
    }
    if (reasons.length) findings.push({ id: quiz.id, optionIndex: i, reasons })
  }
}

console.log('=== 反駁されない主張が増えていないかのチェック ===')
console.log(`baseline: ${baseRef}`)
console.log('')

if (findings.length === 0) {
  console.log('OK: 誤答に反駁されない主張が増えた兆候はありません。')
  process.exit(0)
}

console.log(`⚠️  ${findings.length}件の要確認:`)
for (const f of findings) {
  console.log(`  ${f.id} [option.${f.optionIndex}]`)
  for (const r of f.reasons) console.log(`      - ${r}`)
}
console.log('')
console.log('※ 仕組みの説明を足せば語は自然に増えるので、これ自体は欠陥ではない。')
console.log('   「増えた分まで wrongFeedback が反駁できているか」を1件ずつ見ること。')
process.exitCode = 1
