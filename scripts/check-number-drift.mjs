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

/**
 * 固有語（製品名・指標名・識別子）。改定で置き換わるのは数値だけではない。
 * `sp-002` の FID → INP のように**名前ごと入れ替わる**ことがある。
 */
const TERM = /\b[A-Za-z][A-Za-z0-9._-]{2,}\b/g

function numbersOf(text) {
  return new Set((text ?? '').match(NUMBER)?.map((s) => s.replace(/\s+/g, '')) ?? [])
}

function termsOf(text) {
  return new Set((text ?? '').match(TERM) ?? [])
}

function tokensOf(text) {
  return new Set([...numbersOf(text), ...termsOf(text)])
}

/**
 * 1つの設問を層ごとに分解する。
 *
 * **図（`diagrams`）とヒントも層である。** 2026-08-28 に `sp-002` で露見した:
 * Core Web Vitals の改定で FID が INP に置き換わったため、正解肢・反駁と
 * 順に直したが、**図の中に「FID(First Input Delay)」が残り続けた**。
 * 図は画面に出るのに、この検査の対象外だったので3回とも見落とした。
 */
function layers(quiz) {
  const out = { question: quiz.question, explanation: quiz.explanation, hint: quiz.hint }
  quiz.options.forEach((o, i) => {
    out[`option.${i}`] = o.text
    if (o.wrongFeedback) out[`wrongFeedback.${i}`] = o.wrongFeedback
  })
  // 図は入れ子の構造体なので、表示される文字列だけを集めて1層として扱う
  if (Array.isArray(quiz.diagrams) && quiz.diagrams.length) {
    out.diagrams = collectText(quiz.diagrams).join(' ')
  }
  return out
}

/** 構造体から表示される文字列だけを再帰的に集める */
function collectText(node, out = []) {
  if (typeof node === 'string') out.push(node)
  else if (Array.isArray(node)) for (const n of node) collectText(n, out)
  else if (node && typeof node === 'object') for (const v of Object.values(node)) collectText(v, out)
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
    for (const n of tokensOf(text)) {
      if (!stillPresent.has(n)) stillPresent.set(n, [])
      stillPresent.get(n).push(name)
    }
  }

  // 設問文に現れる語＝この設問の主題
  const subject = tokensOf(nowLayers.question)

  for (const [name, oldText] of Object.entries(oldLayers)) {
    const nowText = nowLayers[name]
    if (nowText === undefined || nowText === oldText) continue // 触っていない層

    const removed = [...tokensOf(oldText)].filter((n) => !tokensOf(nowText).has(n))
    for (const n of removed) {
      const survivors = stillPresent.get(n)
      if (!survivors || survivors.length === 0) continue
      // **設問文に出てくる語は主題であってドリフトではない。**
      // 「Verified bot の条件は」という設問で反駁から "Verified" が消えても、
      // それは言い換えであって取り残しではない。
      if (name !== 'question' && subject.has(n)) continue
      // 3層以上に残っている語も、その設問全体で使われている語＝主題側。
      // 改定で置き換わった語は、直し忘れた1〜2箇所にしか残らない。
      if (survivors.length >= 3) continue
      findings.push({ id: quiz.id, value: n, fixedIn: name, remainsIn: survivors })
    }
  }
}

console.log('=== 層をまたいだ取り残しチェック（数値・固有語） ===')
console.log(`baseline: ${baseRef}`)
console.log('')

if (findings.length === 0) {
  console.log('OK: ある層から消した数値や固有語が、同じ設問の別の層に残っているケースはありません。')
  process.exit(0)
}

console.log(`⚠️  ${findings.length}件の取り残し候補:`)
for (const f of findings) {
  console.log(`  ${f.id}: "${f.value}" を ${f.fixedIn} から消したが、${f.remainsIn.join(' / ')} に残っている`)
}
console.log('')
console.log('※ 同じ数値が別の意味で使われている場合は正常（例: 5分間の窓と5分ごとの計測）。')
console.log('   直した数値や名称が他の層で古いまま残っていないかを1件ずつ確認すること。')
process.exitCode = 1
