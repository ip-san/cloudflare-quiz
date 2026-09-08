#!/usr/bin/env node
/**
 * playtest-apply.mjs
 * 専門家レビュー判定（verdicts-content.json / verdicts-learning.json）の accept/modify を
 * quizzes.json へ適用する。`from` が現行値と不一致なら安全側でスキップしログする。
 * ux ドメインは report-only のため対象外。適用後は別途 quiz:randomize/quiz:check/test と quiz:lint/quiz:fact-check を実行すること。
 *
 * `field: "glossary"` は用語集（src/domain/valueObjects/Glossary.ts）への追加提案で、
 * `change.additions: [{term, description}]` を持つ。2026-09-07 と 09-08 のレビューで
 * **2 体が独立に「apply できない」と報告した**（スキーマにもスクリプトにも無く、毎回手作業になっていた）ので受ける。
 * ただし用語集は該当する全問に出るので、**docs の裏取りと「設問が問うている語ではない」確認は
 * 提案側の責任**。ここは重複と表記の機械的な検査だけを行う。
 *
 *   node scripts/playtest-apply.mjs            # 適用
 *   node scripts/playtest-apply.mjs --dry-run  # 適用せず差分のみ表示
 */
import fs from 'node:fs'

const TMP = '.claude/tmp/playtest'
const QUIZ = 'src/data/quizzes.json'
const GLOSSARY = 'src/domain/valueObjects/Glossary.ts'
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

/** Glossary.ts の ENTRIES に用語を足す。既にある term は足さない */
function addGlossaryTerms(additions, note) {
  const src = fs.readFileSync(GLOSSARY, 'utf8')
  const existing = new Set([...src.matchAll(/term: '([^']+)'/g)].map((m) => m[1]))
  const fresh = additions.filter((a) => a.term && a.description && !existing.has(a.term))
  const dup = additions.filter((a) => existing.has(a.term)).map((a) => a.term)
  if (!fresh.length) return { added: [], dup }
  const anchor = src.lastIndexOf('\n]')
  if (anchor === -1) throw new Error('Glossary.ts の ENTRIES 配列が見つからない')
  const block = fresh
    .map((a) => `  // ${note}\n  { term: '${a.term}', description: '${a.description.replace(/'/g, "\\'")}' },`)
    .join('\n')
  if (!DRY) fs.writeFileSync(GLOSSARY, src.slice(0, anchor) + '\n' + block + src.slice(anchor))
  return { added: fresh.map((a) => a.term), dup }
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
      if (v.change.field === 'glossary') {
        const additions = v.change.additions ?? []
        if (!additions.length) {
          skipped.push({ quizId: v.quizId, field: 'glossary', reason: 'additions が空' })
          continue
        }
        const note = `${new Date().toISOString().slice(0, 10)} プレイテスト（${v.quizId}）から。docs の裏取りは判定ファイルの docRef`
        const { added, dup } = addGlossaryTerms(additions, note)
        if (added.length) applied.push({ quizId: v.quizId, domain, field: `glossary(+${added.join(', ')})` })
        if (dup.length) skipped.push({ quizId: v.quizId, field: 'glossary', reason: `既にある語: ${dup.join(', ')}` })
        continue
      }
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

  if (!DRY && applied.some((a) => !a.field.startsWith('glossary'))) {
    fs.writeFileSync(QUIZ, JSON.stringify(data, null, 2) + '\n')
  }

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
