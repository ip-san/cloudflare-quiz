#!/usr/bin/env node

/**
 * 監査台帳を「設問 ID」ではなく「内容の指紋」で持つ。
 *
 * ### なぜ要るか
 *
 * 誤答・正解・図の3つの台帳（`.claude/tmp/quiz-audit/` の判定ファイル）は
 * 設問 ID と肢番号で数えている。2026-09-02 に cb-011 を全面書き換えた直後も、
 * `quiz:status` は「正解 756/756 判定済み」と言った。**「判定済み 100%」は
 * 現在の内容についての保証ではない。** 台帳確定後に内容が変わった設問は、
 * 誰かが `git log` から手で数え直すしかなかった（08-21 と 09-02 の2回、実際にそうした）。
 *
 * playtest-coverage.json が既に同じ問題を指紋で解いている（テスト時点の内容の指紋を
 * 記録し、変わったら stale として挙がる）。同じ形をここにも持ち込む。
 *
 * ### 層の定義（既存の3台帳と1対1）
 *
 *   distractors  正解以外の肢の text と wrongFeedback（ソートして順序に依存しない）
 *   correct      設問文・正解の肢の text・解説（correctIndex は randomize で動くので使わない）
 *   diagrams     図の配列そのもの
 *
 * referenceUrl は入れない（アンカーの検証は quiz:lint:url の担当。URL の付け替えを
 * 「内容の変更」に数えると 2026-09-02 の 14 件のような偽陽性になる）。
 * hint も入れない（ヒント層は静的な掃引ではなくプレイテストで覆うと 09-01 に決めた。
 * playtest-coverage の指紋が hint を含んでいる）。
 *
 * ### 記録は必ずコミットから取る
 *
 * `mark` は `--at <ref>` を必須にし、その時点の quizzes.json から指紋を計算する。
 * 作業ツリーから取ると「直したあとの値」を「検証した値」として記録してしまう
 * （playtest-coverage で 2026-08-29 に実際に起きた）。検証した状態は常にコミットなので、
 * それを渡させる。
 *
 * Usage:
 *   node scripts/quiz-audit-ledger.mjs status
 *   node scripts/quiz-audit-ledger.mjs changed [layer]                  # JSON。次の検証バッチの入力
 *   node scripts/quiz-audit-ledger.mjs mark <layer|all> --at <ref> [--note "..."] [id...]
 *   node scripts/quiz-audit-ledger.mjs prune                            # 設問が消えた記録を落とす
 */

import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUIZ_REL = 'src/data/quizzes.json'
const LEDGER = resolve(ROOT, '.claude/quiz-audit-ledger.json')

export const LAYERS = ['distractors', 'correct', 'diagrams']

/** 層ごとの内容。ここが台帳の定義そのもの */
export function layerPayload(quiz, layer) {
  const correct = quiz.options[quiz.correctIndex]?.text ?? null
  switch (layer) {
    case 'distractors':
      return quiz.options
        .filter((_, i) => i !== quiz.correctIndex)
        .map((o) => `${o.text}\u0000${o.wrongFeedback ?? ''}`)
        .sort()
    case 'correct':
      return { question: quiz.question, correct, explanation: quiz.explanation }
    case 'diagrams':
      return quiz.diagrams ?? null
    default:
      throw new Error(`unknown layer: ${layer}`)
  }
}

export function fingerprint(quiz, layer) {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(layerPayload(quiz, layer)))
    .digest('hex')
    .slice(0, 12)
}

/** 層の対象になる設問か。誤答・正解の台帳は multi を数えていない（quiz-status と同じ） */
export function inLayer(quiz, layer) {
  if (layer === 'diagrams') return (quiz.diagrams?.length ?? 0) > 0
  return quiz.type !== 'multi'
}

export function loadQuizzes() {
  return JSON.parse(fs.readFileSync(resolve(ROOT, QUIZ_REL), 'utf8')).quizzes
}

export function loadQuizzesAt(ref) {
  const out = execFileSync('git', ['show', `${ref}:${QUIZ_REL}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  return JSON.parse(out.toString()).quizzes
}

export function loadLedger(path = LEDGER) {
  if (!fs.existsSync(path)) return { layers: Object.fromEntries(LAYERS.map((l) => [l, {}])) }
  const data = JSON.parse(fs.readFileSync(path, 'utf8'))
  for (const l of LAYERS) data.layers[l] ??= {}
  return data
}

function saveLedger(data, path = LEDGER) {
  // 決定論的に並べる。差分を読めるようにするため
  const layers = {}
  for (const l of LAYERS) {
    layers[l] = Object.fromEntries(Object.entries(data.layers[l]).sort(([a], [b]) => a.localeCompare(b)))
  }
  fs.writeFileSync(path, `${JSON.stringify({ layers }, null, 2)}\n`)
}

/**
 * 層ごとに「記録と今の内容が違う設問」「記録の無い設問」「記録はあるが設問が消えた ID」を出す。
 */
export function diffLedger(quizzes, ledger, layers = LAYERS) {
  const result = {}
  for (const layer of layers) {
    const rec = ledger.layers[layer] ?? {}
    const changed = []
    const unrecorded = []
    const ids = new Set()
    for (const q of quizzes) {
      if (!inLayer(q, layer)) continue
      ids.add(q.id)
      const r = rec[q.id]
      if (!r) unrecorded.push(q.id)
      else if (r.fp !== fingerprint(q, layer)) changed.push(q.id)
    }
    const dead = Object.keys(rec).filter((id) => !ids.has(id))
    result[layer] = { recorded: Object.keys(rec).length - dead.length, changed, unrecorded, dead }
  }
  return result
}

function cmdStatus(quizzes, ledger) {
  const d = diffLedger(quizzes, ledger)
  console.log('=== 監査台帳（内容の指紋） ===')
  for (const layer of LAYERS) {
    const r = d[layer]
    const total = quizzes.filter((q) => inLayer(q, layer)).length
    const flag = r.changed.length || r.unrecorded.length ? '⚠️ ' : '✓ '
    console.log(
      `  ${flag}${layer.padEnd(12)} 記録 ${String(r.recorded).padStart(4)}/${total}` +
        `  台帳確定後に変わった ${String(r.changed.length).padStart(3)} 問` +
        `  記録なし ${String(r.unrecorded.length).padStart(3)} 問` +
        (r.dead.length ? `  設問が消えた記録 ${r.dead.length} 件` : '')
    )
  }
  console.log('  ※ 一覧は `node scripts/quiz-audit-ledger.mjs changed`。検証したら `mark <layer|all> --at <ref>`')
}

function cmdChanged(quizzes, ledger, layer) {
  const layers = layer ? [layer] : LAYERS
  if (layer && !LAYERS.includes(layer)) throw new Error(`layer は ${LAYERS.join(' | ')} のどれか: ${layer}`)
  console.log(JSON.stringify(diffLedger(quizzes, ledger, layers), null, 2))
}

function cmdMark(ledger, argv) {
  const [target, ...rest] = argv
  const layers = target === 'all' ? LAYERS : [target]
  if (!target || !layers.every((l) => LAYERS.includes(l))) {
    throw new Error(`mark <${LAYERS.join('|')}|all> --at <ref> [--note "..."] [id...]`)
  }
  let ref = null
  let note = ''
  const ids = []
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--at') ref = rest[++i]
    else if (rest[i] === '--note') note = rest[++i] ?? ''
    else if (rest[i].startsWith('--')) throw new Error(`unknown option: ${rest[i]}`)
    else ids.push(rest[i])
  }
  if (!ref) {
    throw new Error(
      '--at <ref> は必須。検証した状態は常にコミットなので、その ref から指紋を取る（作業ツリーから取ると直したあとの値を記録してしまう）'
    )
  }
  const sha = execFileSync('git', ['rev-parse', '--short', ref], { cwd: ROOT }).toString().trim()
  const quizzes = loadQuizzesAt(ref)
  const want = ids.length ? new Set(ids) : null
  const at = new Date().toISOString().slice(0, 10)
  let n = 0
  let kept = 0
  for (const layer of layers) {
    for (const q of quizzes) {
      if (!inLayer(q, layer)) continue
      if (want && !want.has(q.id)) continue
      const fp = fingerprint(q, layer)
      // ID を指定しない一括 mark では、内容が変わっていない記録の由来（いつ・どの ref で・何の検証か）を
      // 上書きしない。上書きすると「今日の再照合」が触っていない 600 問にも今日の注記が付く。
      // それは台帳の嘘で、しかも毎回 2,268 行の差分になる
      if (!want && ledger.layers[layer][q.id]?.fp === fp) {
        kept++
        continue
      }
      const entry = { fp, at, ref: sha }
      if (note) entry.note = note
      ledger.layers[layer][q.id] = entry
      n++
    }
  }
  if (want) {
    const known = new Set(quizzes.map((q) => q.id))
    const missing = [...want].filter((id) => !known.has(id))
    if (missing.length) throw new Error(`${ref} に無い ID: ${missing.join(', ')}`)
  }
  saveLedger(ledger)
  console.log(
    `記録した: ${n} 件（層: ${layers.join(', ')} / ref: ${sha}${note ? ` / ${note}` : ''}）` +
      (kept ? ` / 内容が同じで据え置き: ${kept} 件` : '')
  )
}

/** 設問が消えた記録を落とす。mark は足すだけなので、これが無いと死んだ記録が溜まる */
function cmdPrune(quizzes, ledger) {
  const d = diffLedger(quizzes, ledger)
  let n = 0
  for (const layer of LAYERS) {
    for (const id of d[layer].dead) {
      delete ledger.layers[layer][id]
      console.log(`  ${layer}: ${id} を削除（quizzes.json に無い）`)
      n++
    }
  }
  if (n) saveLedger(ledger)
  console.log(n ? `削除した: ${n} 件` : '設問が消えた記録はありません')
}

function main() {
  const [cmd, ...argv] = process.argv.slice(2)
  const ledger = loadLedger()
  switch (cmd) {
    case 'status':
      cmdStatus(loadQuizzes(), ledger)
      break
    case 'changed':
      cmdChanged(loadQuizzes(), ledger, argv[0])
      break
    case 'mark':
      cmdMark(ledger, argv)
      break
    case 'prune':
      cmdPrune(loadQuizzes(), ledger)
      break
    default:
      console.log(
        'Usage: quiz-audit-ledger.mjs <status|changed [layer]|mark <layer|all> --at <ref> [--note "..."] [id...]|prune>'
      )
      process.exit(1)
  }
}

// テストから関数だけを import できるよう、直接実行のときだけ走らせる
const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (invokedDirectly)
  try {
    main()
  } catch (err) {
    console.error(`\n✗ ${err.message}\n`)
    process.exit(1)
  }
