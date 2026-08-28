#!/usr/bin/env node

/**
 * 誤答を書き換えたあとの検査を、1コマンドで決まった順に走らせる。
 *
 * 2026-08-27 に約540肢を書き直したとき、検査は4本が別々のコマンドで、
 * 基準コミットも実行順も人の記憶に頼っていた。その結果:
 *   - 基準を取り違えて「変更なし」と誤読する
 *   - 1本だけ流して次の作業に進む
 *   - **1つの検査を通すための修正が、別の検査に引っかかる**（4回起きた）
 * が繰り返された。順序と基準を固定して、抜けを構造的に無くす。
 *
 * ここが見るのは「基準からの差分」だけで、コーパス全体の検査は
 * `quiz:lint` の担当。両方まとめて呼ぶので、これ1本で足りる。
 *
 * Usage:
 *   node scripts/quiz-audit.mjs <baseline-git-ref>   # 一連の書き換えを始める前のコミット
 *   node scripts/quiz-audit.mjs <ref> --list         # 変更された誤答の一覧も出す
 *   node scripts/quiz-audit.mjs <ref> --json <path>  # 監査エージェント用の入力を書き出す
 *
 * exit code は常に 0（アドバイザリ）。中身を読んで判断すること。
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUIZ_REL = 'src/data/quizzes.json'

const args = process.argv.slice(2)
const baseRef = args.find((a) => !a.startsWith('--'))
if (!baseRef) {
  console.error('Usage: node scripts/quiz-audit.mjs <baseline-git-ref> [--list] [--json <path>]')
  console.error('  baseline は「一連の書き換えを始める前」のコミット。')
  console.error('  トランシェごとに走らせる場合も**毎回この基準**を渡すこと。')
  console.error('  直前のトランシェを基準にすると、前のトランシェで作った欠陥を見落とす。')
  process.exit(1)
}
const wantList = args.includes('--list')
const jsonPath = args.includes('--json') ? args[args.indexOf('--json') + 1] : null

/** 基準からの差分を見る検査。順序に意味がある（前の検査が挙げたものを次が再確認する） */
const DIFF_CHECKS = [
  {
    script: 'check-truth-leak.mjs',
    what: '誤答への「正解の事実」混入',
    why: '誤答を読むだけで正解が確定する状態を作っていないか',
  },
  {
    script: 'check-unrefuted-addition.mjs',
    what: '反駁されない主張の追加',
    why: '独立した2つめの誤りを継ぎ足して wrongFeedback が追いつかなくなっていないか',
  },
  {
    script: 'check-orphaned-refutation.mjs',
    what: '取り残された反駁',
    why: '誤答から消えた主張を wrongFeedback がまだ否定していないか',
  },
  {
    script: 'check-number-drift.mjs',
    what: '層をまたいだ取り残し（数値・固有語）',
    why: 'ある層で直した数値や名称が、別の層や図に古いまま残っていないか',
  },
  {
    script: 'check-refutation-drift.mjs',
    what: '反駁だけの書き換え',
    why: '反駁を絞り込んで、誤答がまだ主張している点を落としていないか',
  },
]

function run(cmd, cmdArgs) {
  try {
    return { out: execFileSync(cmd, cmdArgs, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString(), ok: true }
  } catch (err) {
    // これらの検査は「検出あり」で exit 1 を返す。出力は stdout に入っている
    return { out: (err.stdout ?? Buffer.from('')).toString() + (err.stderr ?? Buffer.from('')).toString(), ok: false }
  }
}

/** 基準と現在で、誤答の本文が変わった問題を集める */
function changedDistractors() {
  const cur = JSON.parse(readFileSync(resolve(ROOT, QUIZ_REL), 'utf8'))
  const old = new Map(
    JSON.parse(
      execFileSync('git', ['show', `${baseRef}:${QUIZ_REL}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString()
    ).quizzes.map((q) => [q.id, q])
  )
  const items = []
  for (const q of cur.quizzes) {
    const o = old.get(q.id)
    if (!o) continue
    const changed = []
    for (let i = 0; i < q.options.length; i++) {
      if (i === q.correctIndex) continue
      if (o.options[i]?.text !== q.options[i].text) {
        changed.push({
          optionIndex: i,
          before: o.options[i]?.text ?? null,
          after: q.options[i].text,
          wrongFeedback: q.options[i].wrongFeedback ?? null,
        })
      }
    }
    if (changed.length) {
      items.push({
        id: q.id,
        question: q.question,
        correctText: q.options[q.correctIndex].text,
        referenceUrl: q.referenceUrl ?? null,
        changed,
      })
    }
  }
  return items
}

/** 本文は変わらず wrongFeedback だけが変わった誤答の数 */
function countRefutationOnly() {
  const old = new Map(
    JSON.parse(
      execFileSync('git', ['show', `${baseRef}:${QUIZ_REL}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString()
    ).quizzes.map((q) => [q.id, q])
  )
  const cur = JSON.parse(readFileSync(resolve(ROOT, QUIZ_REL), 'utf8'))
  let n = 0
  for (const q of cur.quizzes) {
    const o = old.get(q.id)
    if (!o) continue
    for (let i = 0; i < q.options.length; i++) {
      if (i === q.correctIndex) continue
      const a = o.options[i]
      const b = q.options[i]
      if (!a || !b) continue
      if (a.text === b.text && (a.wrongFeedback ?? '') !== (b.wrongFeedback ?? '')) n++
    }
  }
  return n
}

console.log('=== 誤答書き換えの監査パイプライン ===')
console.log(`baseline: ${baseRef}`)
console.log('')

const items = changedDistractors()
const limbs = items.reduce((n, it) => n + it.changed.length, 0)
console.log(`変更された誤答: ${limbs}肢 / ${items.length}問`)
// 反駁だけを直した場合、本文の差分は0になる。そこで「0肢」とだけ出すと
// **何も検査せずに全項目 OK** を返しているように読める（2026-08-28 に実際に起きた。
// internal 判定の再検査で直した12件のうち11件が反駁だけの修正で、
// パイプラインは「変更された誤答: 0肢」のまま4本すべて OK と表示した）。
const refOnly = countRefutationOnly()
if (refOnly > 0) console.log(`うち反駁だけが変わった誤答: ${refOnly}肢（本文の差分には現れない）`)
console.log('')

let flagged = 0
for (const [n, check] of DIFF_CHECKS.entries()) {
  const { out, ok } = run('node', [`scripts/${check.script}`, baseRef])
  const body = out.split('\n').slice(3).join('\n').trim()
  console.log(`── ${n + 1}/${DIFF_CHECKS.length} ${check.what}`)
  console.log(`   ${check.why}`)
  for (const line of body.split('\n')) console.log(`   ${line}`)
  console.log('')
  if (!ok) flagged++
}

console.log('── コーパス全体の検査（quiz:lint）')
const lint = run('node', ['scripts/quiz-lint.mjs', 'all', '--dry-run'])
for (const line of lint.out.split('\n')) {
  if (/^\s*\[|^\s{2}\S/.test(line)) console.log(`   ${line.trim()}`)
}
console.log('')

console.log('=== 機械検査はここまで ===')
console.log('')
console.log('**この先は機械では拾えない。** 書いた本人ではないレビュアーに、')
console.log('`.claude/skills/quiz-audit/defect-taxonomy.md` の「機械で拾えない型」を当てさせること。')
console.log('2026-08-27 の実測では、上の検査を全て通過した肢から **約5%** が挙がっている。')
if (flagged > 0) {
  console.log('')
  console.log(`⚠️  差分検査 ${flagged}/${DIFF_CHECKS.length} 本が候補を挙げている。先にそちらを裁定すること。`)
}

if (wantList) {
  console.log('')
  console.log('=== 変更された誤答 ===')
  for (const it of items) {
    for (const c of it.changed) console.log(`  ${it.id} [option.${c.optionIndex}]`)
  }
}

if (jsonPath) {
  writeFileSync(resolve(jsonPath), `${JSON.stringify(items, null, 2)}\n`)
  console.log('')
  console.log(`監査エージェント用の入力を書き出した: ${jsonPath}（${items.length}問 / ${limbs}肢）`)
}
