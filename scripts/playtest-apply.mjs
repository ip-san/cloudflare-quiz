#!/usr/bin/env node
/**
 * playtest-apply.mjs
 * 専門家レビュー判定（verdicts-content.json / verdicts-learning.json）の accept/modify を
 * quizzes.json へ適用する。`from` が現行値と不一致なら安全側でスキップしログする。
 * ux ドメインは report-only のため対象外。適用後は別途 quiz:randomize/quiz:check/test と quiz:lint/quiz:fact-check を実行すること。
 *
 *   node scripts/playtest-apply.mjs            # 適用
 *   node scripts/playtest-apply.mjs --dry-run  # 適用せず差分のみ表示
 */
import fs from 'node:fs'

const TMP = '.claude/tmp/playtest'
const QUIZ = 'src/data/quizzes.json'
const DRY = process.argv.includes('--dry-run')

/**
 * `options[2].text` / `diagrams[0].messages[1].text` のような添字つきパスを辿る。
 *
 * 以前は options[n] だけを正規表現で特別扱いしており、それ以外の添字パスは
 * 静かに `q[field]` = undefined に落ちて「from 不一致」としてスキップされていた。
 * 安全側ではあるが、レビュアーが図のラベル1箇所を直す提案を出しても
 * 理由の分からないスキップになる（2026-08-27 の ac-011 で実際に起きた）。
 */
function parsePath(field) {
  const parts = []
  for (const seg of field.split('.')) {
    const m = seg.match(/^([A-Za-z_][A-Za-z0-9_]*)((?:\[\d+\])*)$/)
    if (!m) return null
    parts.push(m[1])
    for (const idx of m[2].matchAll(/\[(\d+)\]/g)) parts.push(Number(idx[1]))
  }
  return parts
}

function getField(q, field) {
  if (field === 'diagrams') return JSON.stringify(q.diagrams)
  const parts = parsePath(field)
  if (!parts) return undefined
  return parts.reduce((cur, key) => (cur == null ? undefined : cur[key]), q)
}

function setField(q, field, to) {
  if (field === 'diagrams') {
    q.diagrams = typeof to === 'string' ? JSON.parse(to) : to
    return
  }
  const parts = parsePath(field)
  if (!parts) throw new Error(`unsupported field path: ${field}`)
  const last = parts.pop()
  const target = parts.reduce((cur, key) => (cur == null ? undefined : cur[key]), q)
  if (target == null) throw new Error(`path not found: ${field}`)
  target[last] = to
}

function main() {
  const data = JSON.parse(fs.readFileSync(QUIZ, 'utf8'))
  const byId = new Map(data.quizzes.map((q) => [q.id, q]))
  const applied = []
  const skipped = []

  for (const domain of ['content', 'learning']) {
    const f = `${TMP}/verdicts-${domain}.json`
    if (!fs.existsSync(f)) continue
    const { verdicts = [] } = JSON.parse(fs.readFileSync(f, 'utf8'))
    for (const v of verdicts) {
      if (v.verdict !== 'accept' && v.verdict !== 'modify') continue
      if (!v.change || !v.quizId) continue
      const q = byId.get(v.quizId)
      if (!q) {
        skipped.push({ ...v, reason: 'quizId not found' })
        continue
      }
      const cur = getField(q, v.change.field)
      if (cur === undefined) {
        skipped.push({ quizId: v.quizId, field: v.change.field, reason: 'field path not found' })
        continue
      }
      if (cur !== v.change.from) {
        skipped.push({
          quizId: v.quizId,
          field: v.change.field,
          reason: 'from mismatch',
          cur: String(cur).slice(0, 60),
        })
        continue
      }
      if (!DRY) setField(q, v.change.field, v.change.to)
      applied.push({ quizId: v.quizId, domain, field: v.change.field })
    }
  }

  if (!DRY && applied.length) fs.writeFileSync(QUIZ, JSON.stringify(data, null, 2) + '\n')

  console.log(`${DRY ? '[dry-run] ' : ''}Applied ${applied.length}, skipped ${skipped.length}`)
  for (const a of applied) console.log(`  ✓ ${a.quizId} [${a.domain}] ${a.field}`)
  for (const s of skipped)
    console.log(`  ⏭ ${s.quizId || '?'} ${s.field || ''} — ${s.reason}${s.cur ? ` (現行: "${s.cur}")` : ''}`)
  if (!DRY && applied.length)
    console.log(
      '\n次: bun run quiz:randomize && bun run quiz:check && bun run test、続いて quiz:lint:dry/quiz:fact-check で事実再検証'
    )
}

main()
