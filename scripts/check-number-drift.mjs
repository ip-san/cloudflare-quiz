#!/usr/bin/env node

/**
 * 「1つの層だけ直して、他の層に古い数値が残った」状態を検出する。
 *
 * 1つの設問は question / options / wrongFeedback / explanation の4層に
 * 同じ事実を書く。数値の誤りを見つけて直すとき、見つけた層だけ直して
 * 他を取り残しやすい。
 *
 * 実際 2026-08-26 に起きた。rt-012 の wrongFeedback を「15秒→30秒」に
 * 直したが解説が15秒のまま残り、**解説のほうが先に読まれる**ため
 * 学習者は誤った数値を受け取る状態になっていた。監査で指摘されるまで
 * 気づけなかった（bias-B1 の発見と提案による）。
 *
 * 検出方法:
 *   ある数値トークンが「基準時点のある層にあり、今その層から消えている」のに
 *   「同じ設問の別の層には今も残っている」場合を挙げる。
 *   = 直した層と直し忘れた層が同居している状態。
 *
 * Usage:
 *   node scripts/check-number-drift.mjs <baseline-git-ref>
 *   例: node scripts/check-number-drift.mjs HEAD~1
 */

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUIZ_REL = 'src/data/quizzes.json'

const baseRef = process.argv[2] ?? 'HEAD~1'

const current = JSON.parse(readFileSync(resolve(ROOT, QUIZ_REL), 'utf8'))
const baseRaw = execFileSync('git', ['show', `${baseRef}:${QUIZ_REL}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
const base = JSON.parse(baseRaw.toString('utf8'))
const baseById = new Map(base.quizzes.map((q) => [q.id, q]))

/** 単位を伴う数値だけを見る。裸の数字は本文中に無数にあってノイズになる */
const NUMBER = /\d[\d,._]*\s*(?:%|GB|MB|KB|MiB|KiB|TB|bytes|秒|分|時間|日|ヶ月|回|件|個|本|倍|文字|バイト|コア|GiB)/g

function numbersOf(text) {
  return new Set((text ?? '').match(NUMBER)?.map((s) => s.replace(/\s+/g, '')) ?? [])
}

/** 1つの設問を層ごとに分解する */
function layers(quiz) {
  const out = { question: quiz.question, explanation: quiz.explanation }
  quiz.options.forEach((o, i) => {
    out[`option.${i}`] = o.text
    if (o.wrongFeedback) out[`wrongFeedback.${i}`] = o.wrongFeedback
  })
  return out
}

const findings = []

for (const quiz of current.quizzes) {
  const old = baseById.get(quiz.id)
  if (!old) continue

  const nowLayers = layers(quiz)
  const oldLayers = layers(old)

  // 今どこかの層に残っている数値の一覧
  const stillPresent = new Map() // 数値 -> [その数値を含む層名]
  for (const [name, text] of Object.entries(nowLayers)) {
    for (const n of numbersOf(text)) {
      if (!stillPresent.has(n)) stillPresent.set(n, [])
      stillPresent.get(n).push(name)
    }
  }

  for (const [name, oldText] of Object.entries(oldLayers)) {
    const nowText = nowLayers[name]
    if (nowText === undefined || nowText === oldText) continue // 触っていない層

    const removed = [...numbersOf(oldText)].filter((n) => !numbersOf(nowText).has(n))
    for (const n of removed) {
      const survivors = stillPresent.get(n)
      if (survivors && survivors.length > 0) {
        findings.push({ id: quiz.id, value: n, fixedIn: name, remainsIn: survivors })
      }
    }
  }
}

console.log('=== 層をまたいだ数値の取り残しチェック ===')
console.log(`baseline: ${baseRef}`)
console.log('')

if (findings.length === 0) {
  console.log('OK: ある層から消した数値が、同じ設問の別の層に残っているケースはありません。')
  process.exit(0)
}

console.log(`⚠️  ${findings.length}件の取り残し候補:`)
for (const f of findings) {
  console.log(`  ${f.id}: "${f.value}" を ${f.fixedIn} から消したが、${f.remainsIn.join(' / ')} に残っている`)
}
console.log('')
console.log('※ 同じ数値が別の意味で使われている場合は正常（例: 5分間の窓と5分ごとの計測）。')
console.log('   直した数値が他の層で古いまま残っていないかを1件ずつ確認すること。')
process.exitCode = 1
