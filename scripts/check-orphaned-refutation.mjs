#!/usr/bin/env node

/**
 * 「誤答を書き換えたのに wrongFeedback が取り残された」状態を検出する。
 *
 * 誤答の本文を差し替えると、その誤答を反駁していた wrongFeedback は
 * **存在しない主張を否定する文**になる。反駁の一文が的外れに費やされる一方で、
 * 実際に残っている誤りは反駁されないまま放置される。
 *
 * 2026-08-26 に bt-016[2] で実際に起きた（bias-B1 の発見と提案による）。
 * 誤答から `robots.txt` への言及が「年次の再審査」に差し替えられたのに、
 * wrongFeedback は「`robots.txt`やクロール指示の遵守は任意ではなく…」と
 * robots.txt を反駁し続けていた。
 *
 * check-number-drift.mjs では捕まらない。**数値は動いておらず、主張が動いた**ため。
 *
 * 検出方法:
 *   基準時点の誤答にあって今の誤答から消えた特徴語のうち、
 *   今も wrongFeedback に残っているものを挙げる。
 *   = 消えた主張をまだ反駁している状態。
 *
 * Usage:
 *   node scripts/check-orphaned-refutation.mjs <baseline-git-ref>
 */

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUIZ_REL = 'src/data/quizzes.json'

const baseRef = process.argv[2]
if (!baseRef) {
  console.error('Usage: node scripts/check-orphaned-refutation.mjs <baseline-git-ref>')
  process.exit(1)
}

const current = JSON.parse(readFileSync(resolve(ROOT, QUIZ_REL), 'utf8'))
const baseRaw = execFileSync('git', ['show', `${baseRef}:${QUIZ_REL}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
const base = JSON.parse(baseRaw.toString('utf8'))
const baseById = new Map(base.quizzes.map((q) => [q.id, q]))

/**
 * 特徴語 — 反駁の対象になりうる具体的な語だけを見る。
 * 一般的な日本語は誤答にも wrongFeedback にも普通に出るので対象にしない。
 */
function features(text) {
  const out = new Set()
  for (const m of (text ?? '').matchAll(/`([^`]+)`/g)) out.add(m[1].trim())
  for (const m of (text ?? '').matchAll(/\b[A-Za-z][A-Za-z0-9._-]{2,}\b/g)) out.add(m[0])
  for (const m of (text ?? '').matchAll(/\d[\d,._]*\s*(?:%|GB|MB|KB|MiB|GiB|秒|分|時間|日|件|個|本|回)/g)) {
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
    const nowFb = quiz.options[i]?.wrongFeedback
    if (!nowOpt || !oldOpt || !nowFb || nowOpt === oldOpt) continue

    const nowFeat = features(nowOpt)
    const fbFeat = features(nowFb)
    // 誤答から消えたのに、wrongFeedback がまだ反駁している語
    const orphaned = [...features(oldOpt)].filter((t) => !nowFeat.has(t) && fbFeat.has(t))
    if (orphaned.length > 0) {
      findings.push({ id: quiz.id, optionIndex: i, orphaned })
    }
  }
}

console.log('=== 取り残された反駁のチェック ===')
console.log(`baseline: ${baseRef}`)
console.log('')

if (findings.length === 0) {
  console.log('OK: 誤答から消えた語を wrongFeedback がまだ反駁しているケースはありません。')
  process.exit(0)
}

console.log(`⚠️  ${findings.length}件の取り残し候補:`)
for (const f of findings) {
  console.log(`  ${f.id} [wrongFeedback.${f.optionIndex}] がまだ反駁している: ${f.orphaned.join(' / ')}`)
}
console.log('')
console.log('※ 誤答から消えた語でも、周辺の説明として wrongFeedback に残るのは正常な場合がある。')
console.log('   「もう存在しない主張を否定する文」になっていないかを1件ずつ確認すること。')
process.exitCode = 1
