#!/usr/bin/env node

/**
 * 選択肢の長さ順位を一様に近づけるための作業計画を作る。
 *
 * 2026-08-26 の反転作業は「誤答を1つだけ正解より長くする」直し方だったため、
 * 正解が1位から2位へ移っただけで、**正解が「長い方の半分」に入る割合は
 * 95.5% のまま変わらなかった**（下位2つは一度も動いていない）。
 * 受験者から見れば「長い方の2つに絞る」だけで4択が2択になる。
 *
 * ここでは各問題に目標順位を割り当て、そこへ到達するために
 * 「どの誤答を何文字以上にすればよいか」を出す。
 *
 * 割り当ては **作業量が最小になるよう貪欲に**決める。
 * すでに目標分布に必要な席が埋まっている順位はそのまま据え置き、
 * 動かす必要がある問題だけを、**伸ばす文字数が少なくて済む順に**選ぶ。
 * 無闇に全問へ手を入れると、選択肢が総じて長くなって
 * 「読み切れない」という別の劣化を招く。
 *
 * Usage:
 *   node scripts/plan-length-uniform.mjs             # サマリ
 *   node scripts/plan-length-uniform.mjs --json      # 作業対象を JSON で出力
 *   node scripts/plan-length-uniform.mjs --json 2 4  # 4分割したうちの2番目
 *   node scripts/plan-length-uniform.mjs --verify    # 現在の分布だけを表示
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const quizzes = JSON.parse(readFileSync(resolve(ROOT, 'src/data/quizzes.json'), 'utf8')).quizzes

/** 誤答を伸ばすとき、目標長に対してどれだけ余裕を持たせるか（文字） */
const MARGIN = 6

function ranked(quiz) {
  const correctLen = quiz.options[quiz.correctIndex].text.length
  const wrongs = quiz.options
    .map((o, i) => ({ i, len: o.text.length, text: o.text }))
    .filter((o) => o.i !== quiz.correctIndex)
    .sort((a, b) => b.len - a.len)
  return { correctLen, wrongs, rank: wrongs.filter((w) => w.len > correctLen).length }
}

/** 順位 want へ動かすために伸ばす必要のある誤答と、その追加文字数 */
function costTo(quiz, want) {
  const { correctLen, wrongs } = ranked(quiz)
  const longer = wrongs.filter((w) => w.len > correctLen)
  if (longer.length === want) return { cost: 0, targets: [] }
  if (longer.length > want) return null // 縮める方向は使わない（下記参照）
  const need = want - longer.length
  const candidates = wrongs.filter((w) => w.len <= correctLen).slice(0, need)
  if (candidates.length < need) return null
  const targets = candidates.map((c) => ({
    optionIndex: c.i,
    currentLen: c.len,
    minLen: correctLen + MARGIN,
    addChars: correctLen + MARGIN - c.len,
  }))
  return { cost: targets.reduce((n, t) => n + t.addChars, 0), targets }
}

/**
 * 選択肢が短い値・コード片の列挙になっている問題は対象外にする。
 *
 * `$eq` / `$ne` / `$in` のように選択肢が演算子や設定値そのものである問題では、
 * 散文を足すと選択肢の形が壊れる（2026-08-27 に ai-015 / kv-015 で実際に起きた:
 * 「`$in` なら配列指定で値以外も除外できると誤解しやすい」という自己申告文が
 * コード片の代わりに入り、読んだ瞬間に誤答と分かる状態になった）。
 * そもそもこの形の問題では、誰も長さで選ばないので手がかりにもならない。
 */
const SHORT_ENUM_MAX = 30
const isShortEnum = (q) => q.options.every((o) => o.text.length <= SHORT_ENUM_MAX)

const singles = quizzes.filter((q) => q.type !== 'multi' && !isShortEnum(q))
const N = singles.length
const NUM_RANKS = 4
const quota = Math.round(N / NUM_RANKS)

// 現状の順位ごとに問題をまとめる
const buckets = [[], [], [], []]
for (const q of singles) buckets[ranked(q).rank].push(q)

// 目標に足りない順位（受け入れ側）と、余っている順位（送り出し側）
const deficit = buckets.map((b) => Math.max(0, quota - b.length))
const plan = []
const assigned = new Set()

// 受け入れ側を「下の順位から」埋める。rank3 は伸ばす誤答が2つ要るので
// 先に埋めておかないと安い候補を rank2 に取られる。
for (let want = NUM_RANKS - 1; want >= 0; want--) {
  let need = deficit[want]
  if (need <= 0) continue
  // 送り出せる問題 = その順位が定員超過しているバケツの中身
  const donors = []
  for (let from = 0; from < NUM_RANKS; from++) {
    if (from === want) continue
    const surplus = buckets[from].length - quota
    if (surplus <= 0) continue
    for (const q of buckets[from]) {
      if (assigned.has(q.id)) continue
      const c = costTo(q, want)
      if (c) donors.push({ quiz: q, from, ...c })
    }
  }
  // 安い順に取る。同点は ID で決める（実行するたびに同じ計画が出るように）
  donors.sort((a, b) => a.cost - b.cost || a.quiz.id.localeCompare(b.quiz.id))
  const surplusLeft = buckets.map((b) => b.length - quota)
  for (const d of donors) {
    if (need <= 0) break
    if (assigned.has(d.quiz.id)) continue
    if (surplusLeft[d.from] <= 0) continue
    assigned.add(d.quiz.id)
    surplusLeft[d.from]--
    need--
    plan.push({
      id: d.quiz.id,
      currentRank: d.from,
      targetRank: want,
      correctIndex: d.quiz.correctIndex,
      correctText: d.quiz.options[d.quiz.correctIndex].text,
      correctLen: ranked(d.quiz).correctLen,
      addChars: d.cost,
      targets: d.targets.map((t) => ({ ...t, text: d.quiz.options[t.optionIndex].text })),
    })
  }
  deficit[want] = need
}

function distribution(list) {
  const d = [0, 0, 0, 0]
  for (const q of list) d[ranked(q).rank]++
  return d
}

function projected() {
  const d = distribution(singles)
  for (const p of plan) {
    d[p.currentRank]--
    d[p.targetRank]++
  }
  return d
}

const args = process.argv.slice(2)
const pct = (x) => `${((x / N) * 100).toFixed(1)}%`

if (args.includes('--verify')) {
  const d = distribution(singles)
  const topHalf = d[0] + d[1]
  console.log(`分布: ${d.map((c, i) => `rank${i}=${pct(c)}`).join(' ')}`)
  console.log(`長い方の半分に入る割合: ${pct(topHalf)} (${topHalf}/${N})  ※偶然なら50%`)
} else if (args.includes('--json')) {
  const i = args.indexOf('--json')
  const part = Number(args[i + 1])
  const total = Number(args[i + 2]) || 4
  const out = Number.isInteger(part) ? plan.filter((_, k) => k % total === (part - 1) % total) : plan
  console.log(JSON.stringify(out, null, 2))
} else {
  const now = distribution(singles)
  const after = projected()
  const excluded = quizzes.filter((q) => q.type !== 'multi' && isShortEnum(q)).length
  console.log('=== 長さ順位の一様化 計画 ===')
  console.log(`対象: ${N}問（単一正解のみ。選択肢が${SHORT_ENUM_MAX}字以下の列挙だけの${excluded}問は除外）`)
  console.log(`1順位あたりの定員: ${quota}`)
  console.log(`現状 : ${now.map((c, i) => `rank${i}=${pct(c)}`).join(' ')}  長い方の半分=${pct(now[0] + now[1])}`)
  console.log(
    `計画後: ${after.map((c, i) => `rank${i}=${pct(c)}`).join(' ')}  長い方の半分=${pct(after[0] + after[1])}`
  )
  console.log('')
  console.log(`要作業: ${plan.length}問 / 誤答 ${plan.reduce((n, p) => n + p.targets.length, 0)}肢`)
  const byMove = {}
  for (const p of plan) {
    const k = `rank${p.currentRank}→rank${p.targetRank}`
    byMove[k] = (byMove[k] ?? 0) + 1
  }
  for (const [k, v] of Object.entries(byMove).sort()) console.log(`  ${k}: ${v}問`)
  const adds = plan.flatMap((p) => p.targets.map((t) => t.addChars)).sort((a, b) => a - b)
  const q = (x) => adds[Math.floor(adds.length * x)]
  console.log(`  1肢あたり伸ばす文字数: p25=${q(0.25)} p50=${q(0.5)} p75=${q(0.75)} 最大=${adds[adds.length - 1]}`)
  if (deficit.some((d) => d > 0)) {
    console.log(
      `\n⚠️  定員を満たせなかった順位: ${deficit
        .map((d, i) => (d > 0 ? `rank${i}(-${d})` : null))
        .filter(Boolean)
        .join(' ')}`
    )
  }
}
