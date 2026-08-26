#!/usr/bin/env node

/**
 * 誤答に「正解が持つ事実」が混入していないかを検出する。
 *
 * 誤答を長くする作業（選択肢長バイアスの反転）で最も起きやすい失敗は、
 * もっともらしくしようとして**正解が述べている事実をそのまま書いてしまう**こと。
 * こうなると誤答が半分正しくなり、消去法で選ぶ根拠が壊れるうえ、
 * 誤答を読むだけで正解が確定してしまう。
 *
 * 実際 4エージェント全員が独立にこの失敗を踏みかけ、自力で回避している
 * （as-016 / dx-010 / sp-004 / em-006 / cs-006 / bt-015 / sp-017 / wk-016）。
 * 全員が踏みかけた以上、すり抜けを人手で探すのは頼りない。機械で照合する。
 *
 * 照合ロジック（bias-B3 の考案）:
 *   誤答の新テキストに現れる事実トークンのうち、
 *   「旧テキストには無く」かつ「正解の選択肢に存在する」ものを列挙する。
 *
 * Usage:
 *   node scripts/check-truth-leak.mjs <baseline-git-ref>
 *   例: node scripts/check-truth-leak.mjs cf98392
 */

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUIZ_REL = 'src/data/quizzes.json'

const baseRef = process.argv[2]
if (!baseRef) {
  console.error('Usage: node scripts/check-truth-leak.mjs <baseline-git-ref>')
  process.exit(1)
}

const current = JSON.parse(readFileSync(resolve(ROOT, QUIZ_REL), 'utf8'))
const baseRaw = execFileSync('git', ['show', `${baseRef}:${QUIZ_REL}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
const base = JSON.parse(baseRaw.toString('utf8'))
const baseById = new Map(base.quizzes.map((q) => [q.id, q]))

/**
 * 「事実トークン」— 具体的で検証可能な断片だけを見る。
 * 一般的な日本語は正解にも誤答にも出るので対象にしない。
 */
function factTokens(text) {
  const tokens = new Set()
  // バッククォートで囲まれた識別子・コード片
  for (const m of text.matchAll(/`([^`]+)`/g)) tokens.add(m[1].trim())
  // 数値（単位や記号を伴うものに限る。裸の1桁などはノイズになる）
  for (const m of text.matchAll(
    /\d[\d,._]*\s*(?:%|GB|MB|KB|MiB|KiB|TB|秒|分|時間|日|ヶ月|回|件|個|本|倍|文字|バイト)/g
  )) {
    tokens.add(m[0].replace(/\s+/g, ''))
  }
  // 英大文字で始まる固有名詞らしき連なり（製品名・設定値）
  for (const m of text.matchAll(/\b[A-Z][A-Za-z0-9]*(?:[ -][A-Z][A-Za-z0-9]*)*\b/g)) {
    if (m[0].length >= 3) tokens.add(m[0])
  }
  return tokens
}

/**
 * コーパス全体で頻出するトークンは除外する。
 * `Workers` `Cloudflare` `Docker` のような語は、同じ機能を論じる以上
 * 誤答にも当然出てくる。問題になるのは「その問題の答えとして固有の値・名前」
 * なので、広く使われる語彙を落とさないと本命が埋もれる。
 */
const GENERIC_THRESHOLD = 15
const tokenFrequency = new Map()
for (const quiz of current.quizzes) {
  const seen = new Set()
  for (const opt of quiz.options) for (const t of factTokens(opt.text)) seen.add(t)
  for (const t of seen) tokenFrequency.set(t, (tokenFrequency.get(t) ?? 0) + 1)
}
const isGeneric = (t) => (tokenFrequency.get(t) ?? 0) > GENERIC_THRESHOLD

const findings = []

for (const quiz of current.quizzes) {
  const old = baseById.get(quiz.id)
  if (!old || old.correctIndex !== quiz.correctIndex) continue

  const correctText = quiz.options[quiz.correctIndex]?.text ?? ''
  const correctTokens = factTokens(correctText)
  if (correctTokens.size === 0) continue

  for (let i = 0; i < quiz.options.length; i++) {
    if (i === quiz.correctIndex) continue
    const newText = quiz.options[i]?.text ?? ''
    const oldText = old.options[i]?.text ?? ''
    if (newText === oldText) continue // 触っていない誤答は対象外

    const oldTokens = factTokens(oldText)
    const leaked = [...factTokens(newText)].filter((t) => !oldTokens.has(t) && correctTokens.has(t) && !isGeneric(t))
    if (leaked.length > 0) {
      findings.push({ id: quiz.id, optionIndex: i, leaked })
    }
  }
}

console.log('=== 誤答への「正解の事実」混入チェック ===')
console.log(`baseline: ${baseRef}`)
console.log('')

if (findings.length === 0) {
  console.log('OK: 変更された誤答に、正解由来の事実トークンの新規混入はありません。')
  process.exit(0)
}

console.log(`⚠️  ${findings.length}件の混入候補:`)
for (const f of findings) {
  console.log(`  ${f.id} [option.${f.optionIndex}] ← ${f.leaked.join(' / ')}`)
}
console.log('')
console.log('※ 誤答が正解と同じ用語を含むこと自体は正常な場合もある（同じ機能を論じる以上）。')
console.log('   問題になるのは「正解が答えとして挙げている値・名前」を誤答が再掲している場合。')
console.log('   1件ずつ中身を見て判断すること。')
process.exitCode = 1
