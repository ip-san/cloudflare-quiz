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

function getField(q, field) {
  const m = field.match(/^options\[(\d+)\]\.(text|wrongFeedback)$/)
  if (m) return q.options?.[Number(m[1])]?.[m[2]]
  if (field === 'diagrams') return JSON.stringify(q.diagrams)
  return q[field]
}
function setField(q, field, to) {
  const m = field.match(/^options\[(\d+)\]\.(text|wrongFeedback)$/)
  if (m) {
    q.options[Number(m[1])][m[2]] = to
    return
  }
  if (field === 'diagrams') {
    q.diagrams = typeof to === 'string' ? JSON.parse(to) : to
    return
  }
  q[field] = to
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
      // diagrams は文字列比較、それ以外は厳密一致
      const curCmp = v.change.field === 'diagrams' ? cur : cur
      if (curCmp !== v.change.from) {
        skipped.push({
          quizId: v.quizId,
          field: v.change.field,
          reason: 'from mismatch',
          cur: String(curCmp).slice(0, 60),
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
