#!/usr/bin/env node

/**
 * `screen-distractor-risk.mjs` の再現率を、既知の陽性で測る。
 *
 * スクリーニングは「疑わしい順に並べる」道具で、**どれだけ取りこぼすか**を
 * 言えないと「上から潰したから安全」と誤読される。
 * 実際、初版は再現率10%だった（30件中3件しか挙がらない）。
 *
 * 既知の陽性は、2026-08-27 の独立監査とプレイテストが H1/H2 と判定して
 * 実際に直した肢。各肢について「その肢が最後に変更されたコミットの**親**」＝
 * 欠陥が存在していた状態を取り出して採点する。
 * 固定のスナップショットを使うと、まだ欠陥が入っていない肢まで
 * 見逃しに数えてしまうので、履歴を辿る。
 *
 * スクリーニングの指標を変えたら**必ずこれを流し直す**こと。
 *
 * Usage: node scripts/screen-recall.mjs
 */

import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scoreOption } from './screen-distractor-risk.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 独立監査・プレイテストが H1/H2 と判定して直した肢。
 * 新しく見つかったら追記すること（これが減ることはない）。
 */
const KNOWN_POSITIVES = [
  // 第1波監査（2026-08-27）
  ['wr-004', 3],
  ['dq-001', 2],
  ['wf-015', 0],
  ['bt-012', 1],
  ['lb-009', 3],
  ['ch-013', 2],
  ['sl-009', 1],
  ['bi-004', 1],
  ['em-017', 2],
  ['kv-008', 0],
  ['pl-002', 0],
  ['pl-002', 2],
  ['wf-001', 1],
  ['wf-001', 3],
  ['d1-010', 0],
  ['ai-007', 2],
  ['r2-016', 2],
  ['ob-007', 1],
  ['rt-005', 3],
  ['sl-002', 0],
  ['sl-002', 2],
  // 第2波監査（2026-08-27）
  ['wp-001', 3],
  ['vp-001', 2],
  ['lb-016', 0],
  ['ob-011', 3],
  ['wp-011', 2],
  ['sl-016', 3],
  ['dx-016', 0],
  // プレイテストで学習者が発見（2026-08-27）
  ['ar-016', 0],
  ['ac-008', 2],
]

const cache = new Map()
function snapshot(ref) {
  if (!cache.has(ref)) {
    cache.set(
      ref,
      new Map(
        JSON.parse(
          execFileSync('git', ['show', `${ref}:src/data/quizzes.json`], {
            cwd: ROOT,
            maxBuffer: 64 * 1024 * 1024,
          }).toString()
        ).quizzes.map((q) => [q.id, q])
      )
    )
  }
  return cache.get(ref)
}

const commits = execFileSync('git', ['log', '--format=%h', '--', 'src/data/quizzes.json'], { cwd: ROOT })
  .toString()
  .trim()
  .split('\n')

/** その肢が最後に変わったコミットの親＝直される直前の状態 */
function preFixState(id, i) {
  for (let k = 0; k < commits.length - 1; k++) {
    const now = snapshot(commits[k]).get(id)
    const prev = snapshot(commits[k + 1]).get(id)
    if (!now?.options[i] || !prev?.options[i]) continue
    if (now.options[i].text !== prev.options[i].text) return prev
  }
  return null
}

console.log('=== スクリーニングの再現率 ===')
console.log(`既知の陽性: ${KNOWN_POSITIVES.length}件`)
console.log('')

let hit = 0
let miss = 0
let unmeasurable = 0
const missed = []

for (const [id, i] of KNOWN_POSITIVES) {
  const quiz = preFixState(id, i)
  if (!quiz) {
    unmeasurable++
    console.log(`  ? ${id}[${i}] 修正コミットを特定できず`)
    continue
  }
  const { score, signals } = scoreOption(quiz, i)
  if (score > 0) {
    hit++
    console.log(`  ✓ ${id}[${i}] score=${score} — ${signals.join(' / ')}`)
  } else {
    miss++
    missed.push(`${id}[${i}]`)
  }
}

const measured = hit + miss
const rate = measured ? ((hit / measured) * 100).toFixed(0) : '—'
console.log('')
console.log(`測定できた ${measured}件中 ${hit}件を検出 — **再現率 ${rate}%**`)
if (unmeasurable) console.log(`測定不能: ${unmeasurable}件`)
console.log('')
console.log('見逃した肢:')
for (const m of missed) console.log(`  ${m}`)
console.log('')
console.log('※ 再現率が低い場合、スクリーニングは「全数を見た」根拠にならない。')
console.log('   上から潰したあと、残りをどう扱うかを別途決めること。')
