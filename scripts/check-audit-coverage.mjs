#!/usr/bin/env node

/**
 * 監査エージェントが「担当を本当に全部見たか」を機械で検証する。
 *
 * 2026-08-28 の全数掃引で、2体が143肢の担当に対して空配列 `[]` を書いた。
 * **私は「読んでいない」と決めつけたが、これは誤りだった。**
 * 問い合わせたところ2体とも全肢を読んでおり、空だったのは
 * 「問題があった肢だけを出力する」という**当時の契約に従った結果**だった。
 *
 * それでも空ファイルは「見ていない」と「問題が無かった」を区別できない。
 * そこで契約を変えた: **担当した全肢について1エントリずつ verdict を返させる。**
 *
 * さらに、問い合わせで**本当の弱点**が出た。1体が正直に申告した:
 *
 *   「143肢中、docs で裏を取ったのは約20肢。残り123肢は同じ JSON 内の
 *     `explanation` との整合性チェックのみ。`explanation` は `wrongFeedback` と
 *     同じ書き手が書いている可能性があるので、独立検証になっていない」
 *
 * 読んだかどうかより、**何を根拠に ok としたか**のほうが重要だった。
 * そこで `verifiedBy` を必須にし、`docs`（外部で裏を取った）と
 * `internal`（設問内の整合性のみ）を分けて数える。
 * 「143肢を監査した」ではなく「143肢を読み、うち20肢を docs で裏取りした」と
 * 言えるようにする。
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

// 誤答の掃引(H系・M2)、正解・解説の掃引(C系)、図の掃引(D系)、
// 初級解説の掃引(B系) を受ける。
// 2026-08-29 に D 系を足し忘れて、正常な提出を「被覆不足」と誤判定した
const VALID = new Set([
  'H1',
  'H2',
  'H3',
  'M2',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'D1',
  'D2',
  'D3',
  'D4',
  'B1',
  'B2',
  'B3',
  'B4',
  'B5',
  'gloss',
  'ok',
  'unclear',
])

/** 「見つからなかった」系の記述は理由として認めない */
const NON_REASONS = [/見つからな/, /記載が?な(い|かった)/, /確認できな/, /該当.*な(い|し)/, /探した/]

function hasReason(rationale) {
  if (typeof rationale !== 'string' || rationale.trim().length < 20) return false
  // 「〜が見つからなかった」だけで終わっているものを弾く。
  // 「存在しない機能の主張なので docs に否定形では書かれない」のような
  // **構造的な理由**が書かれていれば、その語を含んでいても通す。
  const isOnlyNotFound = NON_REASONS.some((re) => re.test(rationale)) && rationale.trim().length < 60
  return !isOnlyNotFound
}

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
  const noVerifiedBy = []
  const thinInternal = []
  const byVerification = { docs: 0, internal: 0, standard: 0 }
  for (const v of verdicts) {
    seen.add(`${v.id}:${v.optionIndex}`)
    if (!VALID.has(v.verdict)) badVerdict.push(`${v.id}[${v.optionIndex}]=${v.verdict}`)
    if (v.verifiedBy === 'docs' || v.verifiedBy === 'internal' || v.verifiedBy === 'standard') {
      byVerification[v.verifiedBy]++
      // `internal` を選ぶなら「なぜ docs に載り得ないのか」を書かせる。
      // 書かせるだけでは守られないので、ここで機械的に見る。
      // 「探したが見つからなかった」は理由ではない — docs にあるのに
      // 見落とした場合と区別がつかず、ag-002 はまさにそれで起きた。
      if (v.verifiedBy === 'internal' && !hasReason(v.rationale)) {
        thinInternal.push(`${v.id}[${v.optionIndex}]`)
      }
    } else noVerifiedBy.push(`${v.id}[${v.optionIndex}]`)
  }

  const missing = [...expected].filter((k) => !seen.has(k))
  const extra = [...seen].filter((k) => !expected.has(k))
  const counts = {}
  for (const v of verdicts) counts[v.verdict] = (counts[v.verdict] ?? 0) + 1

  return {
    label,
    // 被覆（全肢に verdict があるか）と、裏取り根拠の記入は別物として扱う。
    // 被覆が欠けていれば担当の割り直しが要るが、verifiedBy の未記入は
    // 「どこまで裏を取ったかが台帳に残らない」問題で、対処が違う。
    status:
      missing.length > 0 || extra.length > 0 || badVerdict.length > 0
        ? 'incomplete'
        : noVerifiedBy.length > 0
          ? 'unverified-basis'
          : 'ok',
    expected: expected.size,
    seen: seen.size,
    missing,
    extra,
    badVerdict,
    noVerifiedBy,
    thinInternal,
    byVerification,
    counts,
  }
}

const results = []
if (args[0] === '--dir') {
  const dir = resolve(ROOT, args[1] ?? '.claude/tmp/quiz-audit')
  const prefix = args.includes('--layer') && args[args.indexOf('--layer') + 1] === 'correct' ? 'correct' : 'sweep'
  const re = new RegExp(`^${prefix}-part\\d+\\.json$`)
  const inputs = readdirSync(dir)
    .filter((f) => re.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  for (const f of inputs) {
    const n = f.match(/\d+/)[0]
    results.push(checkOne(resolve(dir, f), resolve(dir, `${prefix}-verdicts${n}.json`)))
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
let basisMissing = 0
let thinTotal = 0
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
  const std = r.byVerification.standard ? ` standard=${r.byVerification.standard}` : ''
  const verif = `docs=${r.byVerification.docs} internal=${r.byVerification.internal}${std}`
  if (r.thinInternal?.length) {
    thinTotal += r.thinInternal.length
  }
  if (r.status === 'ok') {
    console.log(`  ✓ ${r.label}: ${r.seen}/${r.expected}肢  ${summary}  [裏取り: ${verif}]`)
    if (r.thinInternal?.length) {
      console.log(
        `      ⚠ internal のうち ${r.thinInternal.length}肢に理由が書かれていない: ` +
          `${r.thinInternal.slice(0, 6).join(' ')}${r.thinInternal.length > 6 ? ' …' : ''}`
      )
    }
  } else if (r.status === 'unverified-basis') {
    basisMissing++
    console.log(`  △ ${r.label}: ${r.seen}/${r.expected}肢  ${summary}  — 被覆はOK、裏取り根拠が未記入`)
    console.log(
      `      verifiedBy 未記入 ${r.noVerifiedBy.length}肢: ${r.noVerifiedBy.slice(0, 5).join(' ')}${r.noVerifiedBy.length > 5 ? ' …' : ''}`
    )
    console.log('      → 割り直しではなく、担当者に「docs で裏を取ったのは何肢か」を聞くこと')
  } else {
    bad++
    console.log(`  ✗ ${r.label}: ${r.seen}/${r.expected}肢  ${summary}`)
    if (r.missing.length)
      console.log(
        `      未判定 ${r.missing.length}肢: ${r.missing.slice(0, 8).join(' ')}${r.missing.length > 8 ? ' …' : ''}`
      )
    if (r.extra.length) console.log(`      担当外 ${r.extra.length}肢: ${r.extra.slice(0, 5).join(' ')}`)
    if (r.badVerdict.length) console.log(`      不正な verdict: ${r.badVerdict.slice(0, 5).join(' ')}`)
    if (r.noVerifiedBy.length)
      console.log(`      verifiedBy 未記入 ${r.noVerifiedBy.length}肢: ${r.noVerifiedBy.slice(0, 5).join(' ')}`)
  }
}

const totalDocs = results.reduce((n, r) => n + (r.byVerification?.docs ?? 0), 0)
const totalInternal = results.reduce((n, r) => n + (r.byVerification?.internal ?? 0), 0)
const totalStandard = results.reduce((n, r) => n + (r.byVerification?.standard ?? 0), 0)
console.log('')
console.log(`合計 ${totalSeen}/${totalExpected}肢が判定済み`)
console.log(`  うち docs で裏取り: ${totalDocs}肢 / 設問内の整合性のみ: ${totalInternal}肢`)
if (totalStandard) console.log(`  Web標準（RFC等）で裏取り: ${totalStandard}肢`)
if (totalInternal > totalDocs) {
  console.log('')
  console.log('※ 設問内の整合性チェックは独立検証ではない。')
  console.log('   `explanation` は `wrongFeedback` と同じ書き手が書いている可能性があり、')
  console.log('   同じ誤解がそのまま両方に入っていれば整合してしまう。')
  console.log('   「N肢を監査した」ではなく「N肢を読み、うちM肢を docs で裏取りした」と報告すること。')
}
if (bad > 0) {
  console.log('')
  console.log(`⚠️  ${bad}件のバッチが被覆不足。**担当を割り直すこと。**`)
  console.log('   「検出ゼロ」と「見ていない」は別物で、空の結果を成果として扱わないこと。')
  process.exitCode = 1
}
if (basisMissing > 0) {
  console.log('')
  console.log(`△ ${basisMissing}件のバッチが裏取り根拠を書いていない。担当者に確認すること。`)
}
if (thinTotal > 0) {
  console.log('')
  console.log(`△ internal 判定のうち ${thinTotal}肢が「なぜ docs に載り得ないか」を書いていない。`)
  console.log('   「探したが見つからなかった」は理由にならない。docs にあるのに見落とした場合と')
  console.log('   区別がつかず、2026-08-28 の ag-002 はまさにそれで false を注入した。')
  console.log('   構造的な理由（存在しない機能の主張なので否定形では書かれない、等）を書かせること。')
}
