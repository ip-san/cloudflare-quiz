#!/usr/bin/env node

/**
 * 監査エージェントが「担当を本当に全部見たか」を機械で検証する。
 *
 * 2026-08-28 の全数掃引で、2体が **143肢の担当に対して空配列 `[]` を書き、
 * 報告もせずに終了**した。開始1分での出力で、読んだとは考えられない。
 *
 * 手順書には「何肢中いくつ読んだか必ず報告せよ」と書いてあったが、
 * **報告しないという形で破られると検出できない**。自己申告に頼る検査は、
 * 申告しない相手には効かない。
 *
 * そこで契約を変えた: **問題のあった肢だけでなく、担当した全肢について
 * 1エントリずつ verdict を返させる。** ファイルの中身そのものが被覆の証拠になる。
 *
 * Usage:
 *   node scripts/check-audit-coverage.mjs <input.json> <verdicts.json>
 *   node scripts/check-audit-coverage.mjs --dir .claude/tmp/quiz-audit   # 一括
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)

const VALID = new Set(['H1', 'H2', 'H3', 'M2', 'ok', 'unclear'])

function checkOne(inputPath, verdictPath) {
  const label = inputPath.replace(/.*\//, '')
  if (!existsSync(verdictPath)) {
    return { label, status: 'missing', message: '判定ファイルが無い' }
  }
  const input = JSON.parse(readFileSync(inputPath, 'utf8'))
  const expected = new Set()
  for (const item of input) for (const t of item.targets) expected.add(`${item.id}:${t.optionIndex}`)

  let verdicts
  try {
    verdicts = JSON.parse(readFileSync(verdictPath, 'utf8'))
  } catch {
    return { label, status: 'broken', message: '判定ファイルが JSON として読めない' }
  }
  if (!Array.isArray(verdicts)) return { label, status: 'broken', message: '判定ファイルが配列でない' }

  const seen = new Set()
  const badVerdict = []
  for (const v of verdicts) {
    seen.add(`${v.id}:${v.optionIndex}`)
    if (!VALID.has(v.verdict)) badVerdict.push(`${v.id}[${v.optionIndex}]=${v.verdict}`)
  }

  const missing = [...expected].filter((k) => !seen.has(k))
  const extra = [...seen].filter((k) => !expected.has(k))
  const counts = {}
  for (const v of verdicts) counts[v.verdict] = (counts[v.verdict] ?? 0) + 1

  return {
    label,
    status: missing.length === 0 && extra.length === 0 && badVerdict.length === 0 ? 'ok' : 'incomplete',
    expected: expected.size,
    seen: seen.size,
    missing,
    extra,
    badVerdict,
    counts,
  }
}

const results = []
if (args[0] === '--dir') {
  const dir = resolve(ROOT, args[1] ?? '.claude/tmp/quiz-audit')
  const inputs = readdirSync(dir)
    .filter((f) => /^sweep-part\d+\.json$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  for (const f of inputs) {
    const n = f.match(/\d+/)[0]
    results.push(checkOne(resolve(dir, f), resolve(dir, `sweep-verdicts${n}.json`)))
  }
} else {
  if (args.length < 2) {
    console.error('Usage: node scripts/check-audit-coverage.mjs <input.json> <verdicts.json>')
    console.error('       node scripts/check-audit-coverage.mjs --dir <dir>')
    process.exit(1)
  }
  results.push(checkOne(resolve(args[0]), resolve(args[1])))
}

console.log('=== 監査の被覆チェック ===')
console.log('「問題が無かった」と「見ていない」を区別するため、全肢に verdict を要求する')
console.log('')

let bad = 0
let totalExpected = 0
let totalSeen = 0
for (const r of results) {
  if (r.status === 'missing' || r.status === 'broken') {
    console.log(`  ✗ ${r.label}: ${r.message}`)
    bad++
    continue
  }
  totalExpected += r.expected
  totalSeen += r.seen
  const summary = Object.entries(r.counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  if (r.status === 'ok') {
    console.log(`  ✓ ${r.label}: ${r.seen}/${r.expected}肢  ${summary}`)
  } else {
    bad++
    console.log(`  ✗ ${r.label}: ${r.seen}/${r.expected}肢  ${summary}`)
    if (r.missing.length)
      console.log(
        `      未判定 ${r.missing.length}肢: ${r.missing.slice(0, 8).join(' ')}${r.missing.length > 8 ? ' …' : ''}`
      )
    if (r.extra.length) console.log(`      担当外 ${r.extra.length}肢: ${r.extra.slice(0, 5).join(' ')}`)
    if (r.badVerdict.length) console.log(`      不正な verdict: ${r.badVerdict.slice(0, 5).join(' ')}`)
  }
}

console.log('')
console.log(`合計 ${totalSeen}/${totalExpected}肢が判定済み`)
if (bad > 0) {
  console.log('')
  console.log(`⚠️  ${bad}件のバッチが未完了。**担当を割り直すこと。**`)
  console.log('   「検出ゼロ」と「見ていない」は別物で、空の結果を成果として扱わないこと。')
  process.exitCode = 1
}
