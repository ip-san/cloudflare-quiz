#!/usr/bin/env node

/**
 * エージェントが提案した選択肢編集を一括適用する。
 *
 * 選択肢長バイアス（正解が一番長いので文体だけで選べてしまう）の是正では
 * 数百問を触る。エージェントに直接 quizzes.json を書かせると並列書き込みで
 * 壊れるため、提案は JSON で受け取り、適用はここだけで行う。
 *
 * Usage: node scripts/apply-quiz-edits.mjs <proposals.json> [--dry-run]
 *
 * proposals.json の形:
 *   [{ "id": "wk-004",
 *      "edits": [{ "field": "option.3", "value": "新しい本文" }],
 *      "skipped": false }]
 *
 * field: option.N | wrongFeedback.N | explanation | question | referenceUrl
 */

import { readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUIZ_PATH = resolve(ROOT, 'src/data/quizzes.json')

const [proposalPath, ...flags] = process.argv.slice(2)
const dryRun = flags.includes('--dry-run')

if (!proposalPath) {
  console.error('Usage: node scripts/apply-quiz-edits.mjs <proposals.json> [--dry-run]')
  process.exit(1)
}

const proposals = JSON.parse(readFileSync(resolve(proposalPath), 'utf8'))
const data = JSON.parse(readFileSync(QUIZ_PATH, 'utf8'))
const byId = new Map(data.quizzes.map((q) => [q.id, q]))

/**
 * 選択肢を長さの降順に並べたときの正解の順位（0 = 最長）。
 *
 * 2026-08-26 の反転作業では margin（正解が2位よりどれだけ長いか）だけを見ており、
 * 正解が1位から2位へ移ったことは分かっても「正解は相変わらず長い方の2つに入る」
 * ことが見えなかった。順位も一緒に出す。
 */
function lengthRank(quiz) {
  const lens = quiz.options.map((o) => o.text.length)
  return lens
    .map((l, i) => ({ l, i }))
    .sort((a, b) => b.l - a.l)
    .findIndex((x) => x.i === quiz.correctIndex)
}

/** 正解が2位の選択肢よりどれだけ長いか（悪用のしやすさ） */
function margin(quiz) {
  const lens = quiz.options.map((o) => o.text.length)
  const c = lens[quiz.correctIndex]
  const second = Math.max(...lens.filter((_, i) => i !== quiz.correctIndex))
  return { correct: c, second, pct: Math.round(((c - second) / second) * 100) }
}

let applied = 0
let skipped = 0
const errors = []
const results = []

for (const p of proposals) {
  const quiz = byId.get(p.id)
  if (!quiz) {
    errors.push(`${p.id}: quizzes.json に存在しない`)
    continue
  }
  if (p.skipped || !p.edits || p.edits.length === 0) {
    skipped++
    continue
  }

  const before = margin(quiz)
  const rankBefore = lengthRank(quiz)

  for (const edit of p.edits) {
    const { field, value } = edit
    if (typeof value !== 'string' || value.length === 0) {
      errors.push(`${p.id}: ${field} の value が空`)
      continue
    }
    const optMatch = field.match(/^(option|wrongFeedback)\.(\d+)$/)
    if (optMatch) {
      const [, kind, idxRaw] = optMatch
      const idx = Number(idxRaw)
      if (!quiz.options[idx]) {
        errors.push(`${p.id}: ${field} — 選択肢 ${idx} が存在しない`)
        continue
      }
      if (kind === 'option') quiz.options[idx].text = value
      else quiz.options[idx].wrongFeedback = value
    } else if (field === 'referenceUrl') {
      // 出典ページの差し替え。2026-08-28 の正解層監査で、tn-012 の referenceUrl が
      // 答えを含まないナビゲーション用ページを指していた（実体は下位ページにあった）。
      if (!/^https:\/\/developers\.cloudflare\.com\//.test(value)) {
        errors.push(`${p.id}: referenceUrl が developers.cloudflare.com 以外を指している`)
        continue
      }
      quiz.referenceUrl = value
    } else if (field === 'explanation' || field === 'question') {
      // 図マーカーの扱い:
      // - 既存マーカーの削除は拒否する（解説の途中にあった図が消えてしまう）
      // - 追加は許可する（未参照だった図を本文の該当箇所へ結び付ける作業がある）
      // - 存在しない図を指すマーカーは拒否する（何も描画されない死んだ参照になる）
      if (field === 'explanation') {
        const markersOf = (text) => (text.match(/\{\{diagram:(\d+)\}\}/g) ?? []).map((m) => m.match(/\d+/)[0])
        const oldMarkers = markersOf(quiz.explanation)
        const newMarkers = new Set(markersOf(value))
        const dropped = oldMarkers.filter((m) => !newMarkers.has(m))
        if (dropped.length > 0) {
          errors.push(`${p.id}: explanation から図マーカーが消えている (${[...new Set(dropped)].join(', ')})`)
          continue
        }
        const diagramCount = (quiz.diagrams ?? []).length
        const dangling = [...newMarkers].filter((m) => Number(m) >= diagramCount)
        if (dangling.length > 0) {
          errors.push(`${p.id}: 存在しない図を指すマーカー (${dangling.join(', ')} / 図は${diagramCount}個)`)
          continue
        }
      }
      quiz[field] = value
    } else {
      errors.push(`${p.id}: 未知の field "${field}"`)
      continue
    }
    applied++
  }

  // 正解の選択肢に wrongFeedback が付いていたら外す（正解に不正解フィードバックは不要）
  if (quiz.options[quiz.correctIndex]?.wrongFeedback) {
    delete quiz.options[quiz.correctIndex].wrongFeedback
  }

  const after = margin(quiz)
  // 選択肢本文に触っていない提案（wrongFeedback だけ直したものなど）で
  // 「順位が動かなかった」と報告しても意味がないので、対象を分けて数える
  const touchedOptionText = p.edits.some((e) => /^option\.\d+$/.test(e.field))
  results.push({ id: p.id, before, after, rankBefore, rankAfter: lengthRank(quiz), touchedOptionText })
}

console.log(`適用: ${applied}件の編集 / ${results.length}問  (skipped: ${skipped})`)
if (errors.length > 0) {
  console.log(`\n⚠️  ${errors.length}件のエラー:`)
  for (const e of errors) console.log(`  - ${e}`)
}

const lengthWork = results.filter((r) => r.touchedOptionText)
const moved = lengthWork.filter((r) => r.rankAfter !== r.rankBefore)
if (lengthWork.length > 0) {
  console.log(`\n正解の長さ順位が動いた: ${moved.length}問 / ${lengthWork.length}問（選択肢本文を触ったもの）`)
}
const unmoved = lengthWork.filter((r) => r.rankAfter === r.rankBefore)
if (unmoved.length > 0) {
  console.log(`  動かなかった ${unmoved.length}問（伸ばし足りない可能性）:`)
  for (const r of unmoved) console.log(`    - ${r.id}: rank${r.rankBefore} のまま`)
}

const stillBad = results.filter((r) => r.after.pct >= 50)
console.log(`\n閾値(+50%)を超えたまま: ${stillBad.length}問`)
for (const r of stillBad) {
  console.log(`  - ${r.id}: +${r.before.pct}% → +${r.after.pct}% (正解${r.after.correct}字 / 2位${r.after.second}字)`)
}

if (dryRun) {
  console.log('\n--dry-run のためファイルは変更していません')
} else {
  writeFileSync(QUIZ_PATH, `${JSON.stringify(data, null, 2)}\n`)
  console.log('\nsrc/data/quizzes.json を更新しました')
}

if (errors.length > 0) process.exitCode = 1
