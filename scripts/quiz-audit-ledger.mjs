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
 * ### 層の定義（既存の3台帳と1対1、＋ヒント）
 *
 *   distractors  正解以外の肢の text と wrongFeedback（ソートして順序に依存しない）
 *   correct      設問文・正解の肢の text・解説（correctIndex は randomize で動くので使わない）
 *   diagrams     図の配列そのもの
 *   hint         ヒント。全数掃引の台帳は無い（09-01 に 0/28 で静的掃引は割に合わないと判断）が、
 *                差分駆動の再照合では 19 問中 2 問で指摘が出た（09-02）。「変わった分だけ見る」
 *                ためには層として持つ必要がある。基準点の記録は `baseline: true` を持つ
 *
 * referenceUrl は入れない（アンカーの検証は quiz:lint:url の担当。URL の付け替えを
 * 「内容の変更」に数えると 2026-09-02 の 14 件のような偽陽性になる）。
 *
 * ### 記録は必ずコミットから取る
 *
 * `mark` は `--at <ref>` を必須にし、その時点の quizzes.json から指紋を計算する。
 * 作業ツリーから取ると「直したあとの値」を「検証した値」として記録してしまう
 * （playtest-coverage で 2026-08-29 に実際に起きた）。検証した状態は常にコミットなので、
 * それを渡させる。コミットしてから `--at HEAD` でよい。
 *
 * 逆に、quizzes.json に未コミットの変更が残ったまま `--at HEAD` すると、HEAD は
 * 修正前の内容なので「修正前の内容を検証した」という嘘の記録になる。
 * quizzes.json が dirty なら mark は拒否する（2026-09-06 の設計レビューで指摘）。
 *
 * ### ID を省いた一括 mark は `--bulk` を要る
 *
 * mark は「記録と今の内容が違うか」しか見ない。検証したかどうかは知らない。
 * ID を省くと、迷ってスキップした設問や dry-run で指摘だけ出した設問まで
 * 「検証済み」になる。普段は検証した ID を明示して渡す。層を文字どおり全数検証した回だけ
 * `--bulk` を付けて省略する。
 *
 * Usage:
 *   node scripts/quiz-audit-ledger.mjs [status]
 *   node scripts/quiz-audit-ledger.mjs changed [layer]                  # JSON。次の検証バッチの入力
 *   node scripts/quiz-audit-ledger.mjs mark <layer|all> --at HEAD --note "..." <id...>
 *   node scripts/quiz-audit-ledger.mjs mark <layer|all> --at <ref> --bulk [--baseline] --note "..."  # 全数検証した回だけ
 *   node scripts/quiz-audit-ledger.mjs prune                            # 設問が消えた / 層の対象外になった記録を落とす
 */

import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUIZ_REL = 'src/data/quizzes.json'
const LEDGER = resolve(ROOT, '.claude/quiz-audit-ledger.json')

export const LAYERS = ['distractors', 'correct', 'diagrams', 'hint']

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
    case 'hint':
      return quiz.hint ?? null
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

/**
 * 層の対象になる設問か。
 * 誤答・正解の台帳は multi を数えていない（quiz-status と同じ）。
 * hint は選択肢の数え方と無関係なので、multi でも対象にする（2026-09-06 の QA で指摘）。
 */
export function inLayer(quiz, layer) {
  if (layer === 'diagrams') return (quiz.diagrams?.length ?? 0) > 0
  if (layer === 'hint') return true
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
  data.layers ??= {}
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
 * 層ごとに分けて出す:
 *   changed     記録と今の内容が違う
 *   unrecorded  記録が無い（足したばかりの設問。検証されるまで無いのが正しい）
 *   outOfLayer  記録はあるが層の対象から外れた（図を全部消した / multi になった）。設問は存在する
 *   dead        記録はあるが設問そのものが quizzes.json に無い
 *   baseline    記録のうち「基準点」（検証済みではない）の数
 * outOfLayer と dead を分けるのは、prune のログが「quizzes.json に無い」と言いながら
 * 存在する設問の記録を消していたから（2026-09-06 の QA で発覚）。
 */
export function diffLedger(quizzes, ledger, layers = LAYERS) {
  const result = {}
  const allIds = new Set(quizzes.map((q) => q.id))
  for (const layer of layers) {
    const rec = ledger.layers[layer] ?? {}
    const changed = []
    const unrecorded = []
    const ids = new Set()
    let baseline = 0
    for (const q of quizzes) {
      if (!inLayer(q, layer)) continue
      ids.add(q.id)
      const r = rec[q.id]
      if (!r) unrecorded.push(q.id)
      else {
        if (r.fp !== fingerprint(q, layer)) changed.push(q.id)
        if (r.baseline) baseline++
      }
    }
    const dead = Object.keys(rec).filter((id) => !allIds.has(id))
    const outOfLayer = Object.keys(rec).filter((id) => allIds.has(id) && !ids.has(id))
    result[layer] = {
      total: ids.size,
      recorded: Object.keys(rec).length - dead.length - outOfLayer.length,
      baseline,
      changed,
      unrecorded,
      outOfLayer,
      dead,
    }
  }
  return result
}

/** status の行。quiz-status.mjs も同じものを出すので、ここに一本化する */
export function statusLines(quizzes, ledger) {
  const d = diffLedger(quizzes, ledger)
  const lines = []
  for (const layer of LAYERS) {
    const r = d[layer]
    // ◐ = 変わってはいないが、記録の大半が基準点（検証済みではない）
    const flag = r.changed.length || r.unrecorded.length ? '⚠️ ' : r.baseline > 0 ? '◐ ' : '✓ '
    const recorded =
      r.baseline > 0
        ? `記録 ${String(r.recorded).padStart(4)}/${r.total}（基準点 ${r.baseline} / 検証 ${r.recorded - r.baseline}）`
        : `記録 ${String(r.recorded).padStart(4)}/${r.total}`
    lines.push(
      `${flag}${layer.padEnd(12)} ${recorded}` +
        `  変わった ${String(r.changed.length).padStart(3)} 問  記録なし ${String(r.unrecorded.length).padStart(3)} 問` +
        (r.outOfLayer.length ? `  対象外になった記録 ${r.outOfLayer.length} 件` : '') +
        (r.dead.length ? `  設問が消えた記録 ${r.dead.length} 件` : '')
    )
  }
  lines.push('※ ◐ の層は記録の大半が「基準点」。検証済みではなく、変わった分を差分で見るための出発点（hint 層）')
  lines.push(
    '   一覧: `node scripts/quiz-audit-ledger.mjs changed`。検証したら `mark <layer> --at HEAD --note "..." <id...>`'
  )
  return lines
}

function cmdStatus(quizzes, ledger) {
  console.log('=== 監査台帳（内容の指紋） ===')
  for (const l of statusLines(quizzes, ledger)) console.log(`  ${l}`)
}

function cmdChanged(quizzes, ledger, layer) {
  const layers = layer ? [layer] : LAYERS
  if (layer && !LAYERS.includes(layer)) throw new Error(`layer は ${LAYERS.join(' | ')} のどれか: ${layer}`)
  console.log(JSON.stringify(diffLedger(quizzes, ledger, layers), null, 2))
}

/**
 * mark の引数を解釈する。テストから直接叩けるよう純粋関数にしてある。
 * 2026-09-06 のレビューで `--note --bulk` が note="--bulk" として通っていた。
 * オプションの値がオプションに見えたら弾く。
 */
export function parseMarkArgs(argv) {
  const [target, ...rest] = argv
  const layers = target === 'all' ? LAYERS : [target]
  if (!target || !layers.every((l) => LAYERS.includes(l))) {
    throw new Error(`mark <${LAYERS.join('|')}|all> --at <ref> --note "..." (<id...> | --bulk)`)
  }
  let ref = null
  let note = null
  let bulk = false
  let baseline = false
  const ids = []
  const takeValue = (name, i) => {
    const v = rest[i]
    if (v === undefined || v.startsWith('--')) throw new Error(`${name} の値が無い（次の語: ${v ?? '(末尾)'}）`)
    return v
  }
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a === '--at') {
      if (ref !== null) throw new Error('--at が 2 回指定されている')
      ref = takeValue('--at', ++i)
    } else if (a === '--note') {
      if (note !== null) throw new Error('--note が 2 回指定されている')
      note = takeValue('--note', ++i)
    } else if (a === '--bulk') bulk = true
    else if (a === '--baseline') baseline = true
    else if (a.startsWith('--')) throw new Error(`unknown option: ${a}`)
    else ids.push(a)
  }
  if (!ref) {
    throw new Error(
      '--at <ref> は必須。検証した状態は常にコミットなので、その ref から指紋を取る（作業ツリーから取ると直したあとの値を記録してしまう）。コミットしてから --at HEAD でよい'
    )
  }
  if (ref.startsWith('-')) throw new Error(`ref がオプションに見える: ${ref}`)
  if (ids.length === 0 && !bulk) {
    throw new Error(
      'ID を省くには --bulk が要る。mark は検証したかどうかを知らないので、ID を省くと迷ってスキップした設問まで「検証済み」になる。普段は検証した ID を渡すこと'
    )
  }
  if (baseline && !bulk) throw new Error('--baseline は --bulk と一緒にしか使えない（基準点は層全体に置くもの）')
  if (bulk && ids.length) throw new Error('--bulk と ID は同時に指定できない（--bulk は ID を省くためのもの）')
  for (const id of ids) {
    if (/\s/.test(id)) {
      throw new Error(`ID に空白が入っている: "${id}"。zsh は $VAR を単語分割しないので、xargs か \${=VAR} で渡すこと`)
    }
  }
  // note は null（指定なし）と ''（--note "" で明示的に空）を区別する。前者だけ前の note を引き継ぐ
  return { layers, ref, note, bulk, baseline, ids }
}

function quizFileIsDirty() {
  return execFileSync('git', ['status', '--porcelain', '--', QUIZ_REL], { cwd: ROOT }).toString().trim() !== ''
}

function cmdMark(ledger, argv) {
  const { layers, ref, note, baseline, ids } = parseMarkArgs(argv)
  if (quizFileIsDirty()) {
    throw new Error(
      `${QUIZ_REL} に未コミットの変更がある。このまま mark すると HEAD（修正前）の内容を「検証した」と記録してしまう。先にコミットすること`
    )
  }
  const sha = execFileSync('git', ['rev-parse', '--short', ref], { cwd: ROOT }).toString().trim()
  const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim()
  if (sha !== head) {
    console.error(
      `⚠️  HEAD (${head}) 以外の ref (${sha}) を記録している。検証した内容がその ref に入っているか確かめること`
    )
  }
  const quizzes = loadQuizzesAt(ref)
  const want = ids.length ? new Set(ids) : null
  if (want) {
    const known = new Set(quizzes.map((q) => q.id))
    const missing = [...want].filter((id) => !known.has(id))
    if (missing.length) throw new Error(`${ref} に無い ID: ${missing.join(', ')}`)
  }
  const at = new Date().toISOString().slice(0, 10)
  let n = 0
  let kept = 0
  const carried = []
  const ignored = []
  for (const layer of layers) {
    for (const q of quizzes) {
      if (want && !want.has(q.id)) continue
      if (!inLayer(q, layer)) {
        if (want) ignored.push(`${layer}:${q.id}`)
        continue
      }
      const fp = fingerprint(q, layer)
      const prev = ledger.layers[layer][q.id]
      // ID を指定しない一括 mark では、内容が変わっていない記録の由来（いつ・どの ref で・何の検証か）を
      // 上書きしない。上書きすると「今日の再照合」が触っていない 600 問にも今日の注記が付く。
      // それは台帳の嘘で、しかも毎回 2,268 行の差分になる
      if (!want && prev?.fp === fp) {
        kept++
        continue
      }
      const entry = { fp, at, ref: sha }
      if (note) entry.note = note
      else if (note === null && prev?.note) {
        // ID 明示で --note を省いたら、前の由来を黙って捨てない（2026-09-06 に cb-011 で実際に消えた）。
        // ただし前が基準点なら、その note は「未検証」と書いてあるので引き継げない。今回の検証を書かせる
        if (prev.baseline) {
          throw new Error(
            `${layer}:${q.id} は基準点の記録。検証済みに上げるには --note で何をどう検証したかを書くこと（基準点の note は引き継げない）`
          )
        }
        entry.note = prev.note
        carried.push(`${layer}:${q.id}`)
      }
      if (baseline) entry.baseline = true
      ledger.layers[layer][q.id] = entry
      n++
    }
  }
  saveLedger(ledger)
  console.log(
    `記録した: ${n} 件（層: ${layers.join(', ')} / ref: ${sha}${note ? ` / ${note}` : ''}${baseline ? ' / 基準点' : ''}）` +
      (kept ? ` / 内容が同じで据え置き: ${kept} 件` : '')
  )
  if (carried.length) console.log(`  --note が無いので前の note を引き継いだ: ${carried.join(', ')}`)
  if (ignored.length) console.log(`  層の対象外なので無視した: ${ignored.join(', ')}`)
}

/** 設問が消えた記録・層の対象外になった記録を落とす。mark は足すだけなので、これが無いと溜まる */
function cmdPrune(quizzes, ledger) {
  const d = diffLedger(quizzes, ledger)
  let n = 0
  for (const layer of LAYERS) {
    for (const id of d[layer].dead) {
      delete ledger.layers[layer][id]
      console.log(`  ${layer}: ${id} を削除（quizzes.json に無い）`)
      n++
    }
    for (const id of d[layer].outOfLayer) {
      delete ledger.layers[layer][id]
      console.log(`  ${layer}: ${id} を削除（層の対象外になった。設問は存在する）`)
      n++
    }
  }
  if (n) saveLedger(ledger)
  console.log(n ? `削除した: ${n} 件` : '消えた設問・対象外になった記録はありません')
}

function main() {
  const [cmd = 'status', ...argv] = process.argv.slice(2)
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
        'Usage: quiz-audit-ledger.mjs [status] | changed [layer] | mark <layer|all> --at <ref> --note "..." (<id...>|--bulk [--baseline]) | prune'
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
