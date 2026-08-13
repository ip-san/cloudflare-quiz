#!/usr/bin/env node
/**
 * playtest-resolve.mjs
 * プレイスルー出力（requests-<persona>.json）を集約し、questionSnippet → quizId を名寄せして
 * domain 別にまとめた requests.json を出力する。LLM 不要・決定論的。
 *
 *   node scripts/playtest-resolve.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const TMP = '.claude/tmp/playtest'
const QUIZ = 'src/data/quizzes.json'

const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase()

function loadQuizzes() {
  const data = JSON.parse(fs.readFileSync(QUIZ, 'utf8'))
  return data.quizzes.map((q) => ({ id: q.id, key: norm(q.question), question: q.question }))
}

function resolveId(snippet, quizzes) {
  const n = norm(snippet)
  if (!n) return null
  // 1) 双方向 contains（スニペットが設問に含まれる / 設問がスニペットに含まれる）
  const hit = quizzes.find((q) => q.key.includes(n) || n.includes(q.key))
  return hit ? hit.id : null
}

function main() {
  if (!fs.existsSync(TMP)) {
    console.error(`No ${TMP}/ — プレイスルー出力がありません`)
    process.exit(1)
  }
  const quizzes = loadQuizzes()
  const files = fs.readdirSync(TMP).filter((f) => /^requests-.+\.json$/.test(f))
  if (!files.length) {
    console.error('requests-<persona>.json が見つかりません')
    process.exit(1)
  }

  const byDomain = { content: [], learning: [], ux: [] }
  const unresolved = []
  const byPersona = {}

  for (const file of files) {
    const session = JSON.parse(fs.readFileSync(path.join(TMP, file), 'utf8'))
    const persona = session.persona || file.replace(/^requests-|\.json$/g, '')
    byPersona[persona] = (byPersona[persona] || 0) + (session.items?.length || 0)
    for (const item of session.items || []) {
      const quizId = item.domain === 'ux' ? (item.quizId ?? null) : resolveId(item.questionSnippet, quizzes)
      const enriched = { quizId, persona, ...item }
      const domain = ['content', 'learning', 'ux'].includes(item.domain) ? item.domain : 'content'
      byDomain[domain].push(enriched)
      if (domain !== 'ux' && !quizId) unresolved.push(enriched)
    }
  }

  const out = {
    resolvedAt: process.env.PLAYTEST_STAMP || 'unstamped',
    byDomain,
    unresolved,
    stats: {
      total: byDomain.content.length + byDomain.learning.length + byDomain.ux.length,
      content: byDomain.content.length,
      learning: byDomain.learning.length,
      ux: byDomain.ux.length,
      unresolved: unresolved.length,
      byPersona,
    },
  }
  fs.writeFileSync(path.join(TMP, 'requests.json'), JSON.stringify(out, null, 2) + '\n')
  console.log(`Resolved ${out.stats.total} requests → ${TMP}/requests.json`)
  console.log(
    `  content=${out.stats.content} learning=${out.stats.learning} ux=${out.stats.ux} unresolved=${out.stats.unresolved}`
  )
  console.log(`  byPersona=${JSON.stringify(byPersona)}`)
  if (unresolved.length) {
    console.log('\n名寄せ未解決（reviewer が Grep で手動解決する対象）:')
    for (const u of unresolved.slice(0, 20))
      console.log(`  - "${(u.questionSnippet || '').slice(0, 50)}" (${u.persona})`)
  }
}

main()
