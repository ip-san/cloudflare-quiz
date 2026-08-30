#!/usr/bin/env node

/**
 * コーパスの監査状況を1コマンドで出す。
 *
 * 2026-08-29 時点で、この知識は台帳(SKILL.md)と複数の判定ファイルに散っていて、
 * 新しいセッションが「どこまで終わっているか」を再構成する必要があった。
 * 実際このセッションでも、判定ファイルの集計を書くたびに
 * 優先順位のバグ（古い判定が新しい判定に勝つ）を作っている。
 *
 * 集計の規則は1箇所にまとめる。後から回した監査ほど優先される:
 *   sweep < recheck < internal/unjudged
 *
 * Usage: bun run quiz:status
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIT = resolve(ROOT, '.claude/tmp/quiz-audit')
const quizzes = JSON.parse(readFileSync(resolve(ROOT, 'src/data/quizzes.json'), 'utf8')).quizzes

/** 判定ファイルを優先順位つきで読み、(id, index) ごとに最新の判定を残す */
function collect(sources) {
  const byKey = new Map()
  for (const [path] of sources.sort((a, b) => a[1] - b[1])) {
    try {
      for (const v of JSON.parse(readFileSync(path, 'utf8'))) {
        byKey.set(`${v.id}[${v.optionIndex}]`, v)
      }
    } catch {
      /* 読めないファイルは無視する。存在しない監査は 0 として出る */
    }
  }
  return byKey
}

function tally(byKey) {
  const basis = {}
  const verdicts = {}
  for (const v of byKey.values()) {
    basis[v.verifiedBy ?? '(なし)'] = (basis[v.verifiedBy ?? '(なし)'] ?? 0) + 1
    verdicts[v.verdict ?? '(なし)'] = (verdicts[v.verdict ?? '(なし)'] ?? 0) + 1
  }
  return { basis, verdicts }
}

function line(label, done, total, extra = '') {
  const pct = total ? ((done / total) * 100).toFixed(1) : '0.0'
  const bar = done === total ? '✓' : '·'
  console.log(
    `  ${bar} ${label.padEnd(22)} ${String(done).padStart(5)}/${String(total).padEnd(5)} (${pct.padStart(5)}%) ${extra}`
  )
}

console.log('=== コーパスの監査状況 ===\n')

// --- 誤答 ---
const distractorSources = []
if (existsSync(AUDIT)) {
  for (const f of readdirSync(AUDIT).filter((f) => /^sweep-verdicts\d+\.json$/.test(f))) {
    distractorSources.push([resolve(AUDIT, f), 0])
  }
  for (const f of readdirSync(AUDIT).filter((f) => /^recheck-verdicts\d+\.json$/.test(f))) {
    distractorSources.push([resolve(AUDIT, f), 1])
  }
  for (const sub of ['internal', 'unjudged']) {
    const dir = resolve(AUDIT, sub)
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).filter((f) => /^verdicts\d+\.json$/.test(f))) {
      distractorSources.push([resolve(dir, f), 2])
    }
  }
}
const distractors = collect(distractorSources)
let distractorTotal = 0
for (const q of quizzes) if (q.type !== 'multi') distractorTotal += q.options.length - 1
const dt = tally(distractors)
console.log('【誤答】')
line('判定済み', distractors.size, distractorTotal)
console.log(
  `    裏取り: ${Object.entries(dt.basis)
    .map(([k, v]) => `${k}=${v}`)
    .join(' / ')}`
)

// --- 図 ---
const diagramSources = []
for (const sub of ['diagram', 'diagram2']) {
  const dir = resolve(AUDIT, sub)
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir).filter((f) => /^verdicts\d+\.json$/.test(f))) {
    diagramSources.push([resolve(dir, f), 0])
  }
}
const diagrams = collect(diagramSources)
const diagramTotal = quizzes.reduce((n, q) => n + (q.diagrams?.length ?? 0), 0)
const gt = tally(diagrams)
console.log('\n【図】')
line('判定済み', diagrams.size, diagramTotal)
console.log(
  `    裏取り: ${Object.entries(gt.basis)
    .map(([k, v]) => `${k}=${v}`)
    .join(' / ')}`
)

// --- 正解・解説・設問文 ---
const correctSources = []
if (existsSync(AUDIT)) {
  for (const f of readdirSync(AUDIT).filter((f) => /^correct-verdicts\d+\.json$/.test(f))) {
    correctSources.push([resolve(AUDIT, f), 0])
  }
}
const correct = collect(correctSources)
console.log('\n【正解・解説・設問文】')
line('判定済み', correct.size, quizzes.filter((q) => q.type !== 'multi').length)

// --- プレイテスト ---
console.log('\n【プレイテスト】')
try {
  const out = execFileSync('node', [resolve(ROOT, 'scripts/playtest-coverage.mjs'), 'status'], { cwd: ROOT }).toString()
  for (const l of out.split('\n').slice(1)) if (l.trim()) console.log(`  ${l.trim()}`)
} catch {
  console.log('  (playtest-coverage が読めない)')
}

// --- 機械検査 ---
console.log('\n【機械検査】')
try {
  const out = execFileSync('node', [resolve(ROOT, 'scripts/quiz-lint.mjs'), 'all', '--dry-run'], {
    cwd: ROOT,
  }).toString()
  console.log(
    out.includes('All checks passed')
      ? '  ✓ quiz:lint 全項目クリーン'
      : '  ⚠️  quiz:lint に指摘あり（`bun run quiz:lint:dry` で確認）'
  )
} catch {
  console.log('  ⚠️  quiz:lint が非ゼロ終了（`bun run quiz:lint:dry` で確認）')
}

console.log('\n※ 各層の台帳と、そこから学んだことは .claude/skills/quiz-audit/SKILL.md にある')
