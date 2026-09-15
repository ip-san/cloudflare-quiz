#!/usr/bin/env node
/**
 * 掃引の判定ファイル（`{counts, findings:[...]}`）を quizzes.json へ適用する。
 *
 * `playtest-apply.mjs` は `verdicts-content.json` / `verdicts-learning.json` の
 * `{verdicts:[...]}` 形式しか読めず、**3人の担当が独立に「適用できない」と報告した**。
 * 掃引の判定は形が違い（`findings`、`verdict: hint-only`、`proposedOptions` など）、
 * そのたびに手書きのスクリプトで当てていたので、検査を一本化する。
 *
 * **ここに集めた検査はすべて、実際に問題を捕まえた実績がある:**
 *
 *   正解肢が最長           r2-009 の作り直しを一度止めた（書き込まれずに済んだ）
 *   `change.from` の一致    提案が古くなっているのを検出する
 *   correctIndex 不変      掃引では正解の位置を動かさない約束
 *   正解肢の本文不変        同上（意図的に変える場合は correctText を渡す）
 *   絶対表現 4肢中2つまで   「絶対表現の肢は誤答」という受験テクニックを防ぐ
 *   バッククォートの偏り     正解肢だけが持つ／持たない状態を防ぐ（既存 lint はこの向きを見ない）
 *   survivingGenuine 非空   modify なら本物の対抗馬が残ることの申告を要求する
 *
 * `proposedWrongFeedback` は `proposedOptions` が無くても単独で適用できる。
 * 誤答の本文は正しいが解説だけ直したい場合に使う（担当2人が「適用できない」と報告した）。
 *
 *   node scripts/apply-sweep-verdicts.mjs <file...> [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs'

const QUIZ = 'src/data/quizzes.json'
const ABS = /(常に|一切|必ず|決して|すべての|全て|完全に|例外なく|どんな|いかなる|無制限)/

/** 1件の finding を検査する。問題があればその一覧を返す（空なら適用してよい） */
export function checkFinding(finding, quiz) {
  const problems = []
  const { quizId, verdict } = finding
  if (!quiz) return [`${quizId}: quizzes.json に見つからない`]

  if (verdict === 'modify' && !finding.survivingGenuine) {
    problems.push(`${quizId}: modify なのに survivingGenuine が空`)
  }
  if (verdict === 'hint-only' && finding.survivingGenuine !== 'deferred') {
    problems.push(`${quizId}: hint-only なら survivingGenuine は "deferred" のはず`)
  }

  const ch = finding.change
  if (ch?.field === 'hint' && ch.from != null && quiz.hint !== ch.from) {
    problems.push(`${quizId}: change.from が現行のヒントと一致しない（提案が古い可能性）`)
  }

  const opts = finding.proposedOptions
  if (opts) {
    const ci = finding.correctIndex ?? quiz.correctIndex
    if (ci !== quiz.correctIndex) problems.push(`${quizId}: correctIndex を変えようとしている`)
    if (opts.length !== 4) problems.push(`${quizId}: 選択肢が4つでない`)
    else {
      if (opts[ci] !== quiz.options[ci].text && !finding.correctText) {
        problems.push(`${quizId}: 正解肢の本文が変わっている（意図的なら correctText を立てる）`)
      }
      const len = opts.map((t) => t.length)
      if (len[ci] === Math.max(...len)) problems.push(`${quizId}: 正解肢が最長（${len.join('/')}）`)
      const nAbs = opts.filter((t) => ABS.test(t)).length
      if (nAbs > 2) problems.push(`${quizId}: 絶対表現が ${nAbs}/4 肢（上限2）`)
      const bt = opts.map((t) => t.includes('`'))
      if (bt[ci] && bt.filter(Boolean).length === 1) problems.push(`${quizId}: 正解肢だけがバッククォートを持つ`)
      if (!bt[ci] && bt.filter(Boolean).length === 3) problems.push(`${quizId}: 正解肢だけがバッククォートを持たない`)
    }
  }
  // proposedWrongFeedback は proposedOptions が無くても単独で受ける
  // （誤答本文は正しいが解説だけ直したい場合。担当2人が「適用できない」と報告した）
  const wf = finding.proposedWrongFeedback
  if (wf) {
    const ci = finding.correctIndex ?? quiz.correctIndex
    if (wf.length !== 4) problems.push(`${quizId}: proposedWrongFeedback が4要素でない`)
    else if (wf[ci] != null) problems.push(`${quizId}: 正解位置の wrongFeedback が null でない`)
  }
  return problems
}

/** finding を quiz に当てる。checkFinding を通したものだけ渡すこと */
export function applyFinding(finding, quiz) {
  const fields = []
  if (finding.proposedQuestion) {
    quiz.question = finding.proposedQuestion
    fields.push('question')
  }
  if (finding.proposedOptions) {
    const ci = quiz.correctIndex
    const wf = finding.proposedWrongFeedback
    finding.proposedOptions.forEach((text, i) => {
      quiz.options[i].text = text
      if (!wf) return
      if (i === ci) quiz.options[i].wrongFeedback = undefined
      else if (wf[i]) quiz.options[i].wrongFeedback = wf[i]
    })
    for (const o of quiz.options) if (o.wrongFeedback === undefined) delete o.wrongFeedback
    fields.push('options')
  }
  if (!finding.proposedOptions && finding.proposedWrongFeedback) {
    const ci = quiz.correctIndex
    finding.proposedWrongFeedback.forEach((text, i) => {
      if (i === ci) return
      if (text) quiz.options[i].wrongFeedback = text
    })
    fields.push('wrongFeedback')
  }
  if (finding.proposedHint) {
    quiz.hint = finding.proposedHint
    fields.push('hint')
  }
  if (finding.proposedExplanation) {
    quiz.explanation = finding.proposedExplanation
    fields.push('explanation')
  }
  return fields
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const files = args.filter((a) => !a.startsWith('--'))
  if (!files.length) {
    console.error('使い方: node scripts/apply-sweep-verdicts.mjs <判定ファイル...> [--dry-run]')
    process.exit(1)
  }
  const data = JSON.parse(readFileSync(QUIZ, 'utf8'))
  const byId = new Map(data.quizzes.map((q) => [q.id, q]))
  const allProblems = []
  const plan = []
  for (const f of files) {
    const parsed = JSON.parse(readFileSync(f, 'utf8'))
    const findings = parsed.findings ?? parsed.verdicts ?? []
    for (const finding of findings) {
      if (finding.verdict === 'ok' || finding.verdict === 'no-change-needed') continue
      const quiz = byId.get(finding.quizId)
      const problems = checkFinding(finding, quiz)
      if (problems.length) allProblems.push(...problems)
      else plan.push({ finding, quiz })
    }
  }
  if (allProblems.length) {
    console.error(`✖ 検査で ${allProblems.length} 件の問題（1件でもあれば何も適用しない）\n`)
    for (const p of allProblems) console.error(`  ${p}`)
    process.exit(1)
  }
  for (const { finding, quiz } of plan) {
    const fields = applyFinding(finding, quiz)
    console.log(`  ${finding.quizId}: ${fields.join(' / ') || '変更なし'}`)
  }
  if (dryRun) {
    console.log(`\n--dry-run のため書き込んでいない（${plan.length} 件が適用対象）`)
    process.exit(0)
  }
  writeFileSync(QUIZ, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`\n${plan.length} 件を適用した`)
}
