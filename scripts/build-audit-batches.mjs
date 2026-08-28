#!/usr/bin/env node

/**
 * 監査エージェントに配る入力を、肢数で均等に分割して書き出す。
 *
 * `quiz-audit.mjs --json` は「基準から変わった肢」だけを出す。
 * 既存分を全数監査するときは**変わっていない肢**が対象になるので、こちらを使う。
 *
 * 分割は**問題数ではなく肢数**で均等にする。1問あたりの誤答数は
 * 2〜3とばらつくため、問題数で割ると担当量が2割ほどずれる。
 *
 * `--layer correct` は**正解・解説・設問文**を配る。誤答の掃引とは別物。
 * 2026-08-28 の誤答掃引で `cb-018`（正解が docs と逆）と
 * `as-018`（解説の数値が誤り）がレビュアーの担当外から偶然見つかった。
 * **学習者が真実として読む層**なので実害が最も大きいのに、仕組みとして見ていなかった。
 *
 * Usage:
 *   node scripts/build-audit-batches.mjs --parts 12 --out .claude/tmp/quiz-audit
 *   node scripts/build-audit-batches.mjs --parts 12 --out <dir> --exclude f7bb370
 *     → f7bb370 から変わった肢（監査済み）を除き、残りだけを配る
 *   node scripts/build-audit-batches.mjs --parts 12 --out <dir> --layer correct
 *     → 正解・解説・設問文を配る（ファイル名は correct-partN.json）
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const parts = Number(args[args.indexOf('--parts') + 1]) || 4
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : '.claude/tmp/quiz-audit'
const excludeRef = args.includes('--exclude') ? args[args.indexOf('--exclude') + 1] : null
const layer = args.includes('--layer') ? args[args.indexOf('--layer') + 1] : 'distractor'

const quizzes = JSON.parse(readFileSync(resolve(ROOT, 'src/data/quizzes.json'), 'utf8')).quizzes

let changedSince = null
if (excludeRef) {
  changedSince = new Map(
    JSON.parse(
      execFileSync('git', ['show', `${excludeRef}:src/data/quizzes.json`], {
        cwd: ROOT,
        maxBuffer: 64 * 1024 * 1024,
      }).toString()
    ).quizzes.map((q) => [q.id, q])
  )
}

const items = []
let limbTotal = 0
for (const quiz of quizzes) {
  if (quiz.type === 'multi') continue

  if (layer === 'correct') {
    // 正解・解説・設問文。1問=1単位として数える（誤答のように肢に割れない）
    limbTotal += 1
    items.push({
      id: quiz.id,
      category: quiz.category,
      difficulty: quiz.difficulty,
      referenceUrl: quiz.referenceUrl ?? null,
      targets: [
        {
          optionIndex: quiz.correctIndex,
          question: quiz.question,
          correctText: quiz.options[quiz.correctIndex].text,
          explanation: quiz.explanation ?? null,
          hint: quiz.hint ?? null,
          // 反駁は「正解と矛盾していないか」を見るために添える
          wrongFeedbacks: quiz.options
            .map((o, i) =>
              i === quiz.correctIndex ? null : { optionIndex: i, text: o.text, wrongFeedback: o.wrongFeedback ?? null }
            )
            .filter(Boolean),
        },
      ],
    })
    continue
  }

  const old = changedSince?.get(quiz.id)
  const targets = []
  quiz.options.forEach((opt, i) => {
    if (i === quiz.correctIndex) return
    // 除外指定があるとき、その基準から変わった肢は監査済みなので飛ばす
    if (old && old.options[i]?.text !== opt.text) return
    targets.push({ optionIndex: i, text: opt.text, wrongFeedback: opt.wrongFeedback ?? null })
  })
  if (targets.length === 0) continue
  limbTotal += targets.length
  items.push({
    id: quiz.id,
    category: quiz.category,
    difficulty: quiz.difficulty,
    question: quiz.question,
    correctText: quiz.options[quiz.correctIndex].text,
    explanation: quiz.explanation ?? null,
    referenceUrl: quiz.referenceUrl ?? null,
    targets,
  })
}

// 肢数で均等になるよう、多い問題から順に「いま一番軽いバケツ」へ入れる
items.sort((a, b) => b.targets.length - a.targets.length || a.id.localeCompare(b.id))
const buckets = Array.from({ length: parts }, () => ({ items: [], limbs: 0 }))
for (const it of items) {
  const lightest = buckets.reduce((min, b) => (b.limbs < min.limbs ? b : min), buckets[0])
  lightest.items.push(it)
  lightest.limbs += it.targets.length
}

mkdirSync(resolve(ROOT, outDir), { recursive: true })
const unit = layer === 'correct' ? '問' : '肢'
const prefix = layer === 'correct' ? 'correct-part' : 'sweep-part'
console.log('=== 監査バッチ ===')
console.log(`層: ${layer === 'correct' ? '正解・解説・設問文' : '誤答'}`)
if (excludeRef) console.log(`除外: ${excludeRef} から変わった肢（監査済み）`)
console.log(`対象: ${limbTotal}${unit} / ${items.length}問 → ${parts}分割`)
console.log('')
buckets.forEach((b, n) => {
  // 各バケツの中は ID 順に戻す（レビュアーが追いやすいように）
  b.items.sort((a, z) => a.id.localeCompare(z.id))
  const path = resolve(ROOT, outDir, `${prefix}${n + 1}.json`)
  writeFileSync(path, `${JSON.stringify(b.items, null, 2)}\n`)
  console.log(
    `  ${prefix}${n + 1}.json  ${String(b.limbs).padStart(4)}${unit} / ${String(b.items.length).padStart(3)}問`
  )
})
