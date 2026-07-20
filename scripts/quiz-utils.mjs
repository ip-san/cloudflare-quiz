#!/usr/bin/env node

/**
 * Quiz Utility Scripts
 *
 * クイズデータの操作・分析用ユーティリティ。
 * npm scripts から呼び出して使用する。
 *
 * Usage:
 *   node scripts/quiz-utils.mjs randomize         # correctIndex をランダム化
 *   node scripts/quiz-utils.mjs stats             # カテゴリ・難易度・参照ページの統計
 *   node scripts/quiz-utils.mjs coverage          # ドキュメントページ別カバレッジ
 *   node scripts/quiz-utils.mjs section-coverage  # セクションレベルのカバレッジギャップ分析
 *   node scripts/quiz-utils.mjs overlap           # 問題の重複・類似検出
 *   node scripts/quiz-utils.mjs check             # 品質チェック（テスト相当の簡易版）
 *   node scripts/quiz-utils.mjs edit              # ID指定でクイズフィールドを編集
 *   node scripts/quiz-utils.mjs merge-proposals   # skill-proposals → known-issues マージ
 *   node scripts/quiz-utils.mjs check-ellipsis    # ダイアグラム内の途中切れ「…」検出
 *   node scripts/quiz-utils.mjs ellipsis-report   # 修正用 triage JSON 生成
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const QUIZ_PATH = resolve(__dirname, '../src/data/quizzes.json')

function loadQuizzes() {
  return JSON.parse(readFileSync(QUIZ_PATH, 'utf8'))
}

function saveQuizzes(data) {
  writeFileSync(QUIZ_PATH, JSON.stringify(data, null, 2) + '\n')
}

// === Randomize correctIndex ===
function randomize() {
  const data = loadQuizzes()
  const seed = Date.now() % 100000
  let s = seed

  function seededRandom() {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    return s / 0x7fffffff
  }

  function shuffle(arr) {
    const result = [...arr]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  const counts = [0, 0, 0, 0]
  let multiCount = 0
  data.quizzes = data.quizzes.map((q) => {
    const optionIndices = Array.from({ length: q.options.length }, (_, i) => i)
    const shuffledIndices = shuffle(optionIndices)
    const newOptions = shuffledIndices.map((i) => q.options[i])

    if (q.type === 'multi' && q.correctIndices) {
      // Multi-select: remap correctIndices
      const oldCorrectSet = new Set(q.correctIndices)
      const newCorrectIndices = []
      shuffledIndices.forEach((oldIdx, newIdx) => {
        if (oldCorrectSet.has(oldIdx)) {
          newCorrectIndices.push(newIdx)
        }
      })
      newCorrectIndices.sort((a, b) => a - b)
      multiCount++
      return { ...q, options: newOptions, correctIndices: newCorrectIndices }
    }

    // Single-select: remap correctIndex
    const correctOption = q.options[q.correctIndex]
    const newCorrectIndex = newOptions.indexOf(correctOption)
    counts[newCorrectIndex]++
    return { ...q, options: newOptions, correctIndex: newCorrectIndex }
  })

  saveQuizzes(data)
  const singleCount = data.quizzes.length - multiCount
  console.log(`Randomized ${data.quizzes.length} questions (seed: ${seed})`)
  console.log(`  Single-select: ${singleCount}, Multi-select: ${multiCount}`)
  console.log(
    'Distribution (single):',
    counts.map((c, i) => `index${i}: ${c} (${((c / Math.max(singleCount, 1)) * 100).toFixed(1)}%)`).join(', ')
  )
}

// === Statistics ===
function stats() {
  const data = loadQuizzes()
  const quizzes = data.quizzes

  const singleQuizzes = quizzes.filter((q) => q.type !== 'multi')
  const multiQuizzes = quizzes.filter((q) => q.type === 'multi')
  console.log(`Total: ${quizzes.length} questions (single: ${singleQuizzes.length}, multi: ${multiQuizzes.length})\n`)

  // Category distribution
  const categories = {}
  quizzes.forEach((q) => {
    categories[q.category] = (categories[q.category] || 0) + 1
  })
  console.log('=== Category Distribution ===')
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  ${cat.padEnd(15)} ${String(count).padStart(3)} (${((count / quizzes.length) * 100).toFixed(1)}%)`)
    })

  // Difficulty distribution
  const difficulties = {}
  quizzes.forEach((q) => {
    difficulties[q.difficulty] = (difficulties[q.difficulty] || 0) + 1
  })
  console.log('\n=== Difficulty Distribution ===')
  Object.entries(difficulties)
    .sort((a, b) => b[1] - a[1])
    .forEach(([diff, count]) => {
      console.log(`  ${diff.padEnd(15)} ${String(count).padStart(3)} (${((count / quizzes.length) * 100).toFixed(1)}%)`)
    })

  // correctIndex distribution (single-select only)
  const indices = [0, 0, 0, 0, 0, 0]
  singleQuizzes.forEach((q) => {
    indices[q.correctIndex] = (indices[q.correctIndex] || 0) + 1
  })
  console.log('\n=== correctIndex Distribution (single-select) ===')
  indices.forEach((count, i) => {
    if (count > 0) {
      const pct = ((count / singleQuizzes.length) * 100).toFixed(1)
      const bar = '█'.repeat(Math.round((count / singleQuizzes.length) * 40))
      console.log(`  index ${i}: ${String(count).padStart(3)} (${pct}%) ${bar}`)
    }
  })
}

// === Coverage by doc page ===
async function coverage() {
  const data = loadQuizzes()
  const quizzes = data.quizzes

  // Count questions per doc page from referenceUrl
  // URL 由来スラッグと DOC_PAGES の name が異なるページは alias で同一視する
  // （例: platform.claude.com の agent-sdk/overview ↔ DOC_PAGES の agent-sdk-overview）
  const PAGE_ALIASES = { 'agent-sdk/overview': 'agent-sdk-overview' }
  const pages = {}
  quizzes.forEach((q) => {
    if (q.referenceUrl) {
      const slug = q.referenceUrl.replace(/.*docs\/(?:en|ja)\//, '').replace(/#.*/, '')
      const page = PAGE_ALIASES[slug] ?? slug
      pages[page] = (pages[page] || 0) + 1
    }
  })

  // Include all known doc pages from topic-config (show 0-coverage pages)
  try {
    const { DOC_PAGES } = await import('./topic-config.mjs')
    for (const p of DOC_PAGES) {
      if (!(p.name in pages)) {
        pages[p.name] = 0
      }
    }
  } catch {
    // topic-config not available, use referenceUrl only
  }

  const entries = Object.entries(pages).sort((a, b) => b[1] - a[1])
  const covered = entries.filter(([, c]) => c > 0).length
  const uncovered = entries.filter(([, c]) => c === 0).length

  console.log(`=== Documentation Page Coverage (${quizzes.length} questions, ${entries.length} pages) ===`)
  console.log(`    ${covered} covered, ${uncovered} uncovered (0 questions)\n`)

  entries.forEach(([page, count]) => {
    if (count > 0) {
      const bar = '█'.repeat(Math.round(count / 2))
      console.log(`  ${page.padEnd(30)} ${String(count).padStart(3)} ${bar}`)
    } else {
      console.log(`  ${page.padEnd(30)}   0 ⚠️  NO COVERAGE`)
    }
  })
}

// === Quick quality check ===
function check() {
  const data = loadQuizzes()
  const quizzes = data.quizzes
  let issues = 0

  // Duplicate IDs
  const ids = quizzes.map((q) => q.id)
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dupes.length > 0) {
    console.log(`FAIL: Duplicate IDs: ${dupes.join(', ')}`)
    issues++
  }

  const singleQuizzes = quizzes.filter((q) => q.type !== 'multi')
  const multiQuizzes = quizzes.filter((q) => q.type === 'multi')

  // correctIndex bias (single-select only)
  const counts = [0, 0, 0, 0]
  singleQuizzes.forEach((q) => {
    counts[q.correctIndex] = (counts[q.correctIndex] || 0) + 1
  })
  counts.forEach((c, i) => {
    const pct = c / Math.max(singleQuizzes.length, 1)
    if (pct > 0.35) {
      console.log(`FAIL: correctIndex=${i} is ${(pct * 100).toFixed(1)}% (>35%)`)
      issues++
    }
  })

  // wrongFeedback structure (single-select)
  singleQuizzes.forEach((q) => {
    const correct = q.options[q.correctIndex]
    if (correct.wrongFeedback) {
      console.log(`FAIL: ${q.id} correct answer has wrongFeedback`)
      issues++
    }
    q.options.forEach((opt, i) => {
      if (i !== q.correctIndex && !opt.wrongFeedback) {
        console.log(`FAIL: ${q.id} option[${i}] missing wrongFeedback`)
        issues++
      }
    })
  })

  // wrongFeedback structure (multi-select)
  multiQuizzes.forEach((q) => {
    if (!q.correctIndices || q.correctIndices.length < 2) {
      console.log(`FAIL: ${q.id} multi-select needs at least 2 correctIndices`)
      issues++
      return
    }
    const correctSet = new Set(q.correctIndices)
    q.options.forEach((opt, i) => {
      if (correctSet.has(i) && opt.wrongFeedback) {
        console.log(`FAIL: ${q.id} correct option[${i}] has wrongFeedback`)
        issues++
      }
      if (!correctSet.has(i) && !opt.wrongFeedback) {
        console.log(`FAIL: ${q.id} option[${i}] missing wrongFeedback`)
        issues++
      }
    })
    q.correctIndices.forEach((idx) => {
      if (idx < 0 || idx >= q.options.length) {
        console.log(`FAIL: ${q.id} correctIndices[${idx}] out of bounds`)
        issues++
      }
    })
  })

  if (issues === 0) {
    console.log(`OK: ${quizzes.length} questions passed all checks`)
  } else {
    console.log(`\n${issues} issue(s) found`)
    process.exit(1)
  }
}

// === Search existing questions ===
function search() {
  const keyword = process.argv.slice(3).join(' ')
  if (!keyword) {
    console.log('Usage: node scripts/quiz-utils.mjs search <keyword>')
    console.log('Searches question, options, explanation, and wrongFeedback fields.')
    process.exit(1)
  }

  const data = loadQuizzes()
  const lowerKeyword = keyword.toLowerCase()
  const matches = []

  for (const q of data.quizzes) {
    const searchable = [
      q.question,
      q.explanation,
      ...q.options.map((o) => o.text),
      ...q.options.filter((o) => o.wrongFeedback).map((o) => o.wrongFeedback),
    ]
      .join(' ')
      .toLowerCase()

    if (searchable.includes(lowerKeyword)) {
      matches.push(q)
    }
  }

  if (matches.length === 0) {
    console.log(`No questions found matching "${keyword}"`)
    return
  }

  console.log(`=== ${matches.length} questions matching "${keyword}" ===\n`)
  for (const q of matches) {
    const correctText =
      q.type === 'multi' ? q.correctIndices.map((i) => q.options[i].text).join(' / ') : q.options[q.correctIndex].text
    console.log(`  ${q.id.padEnd(12)} [${q.category}/${q.difficulty}]`)
    console.log(`    Q: ${q.question.slice(0, 80)}${q.question.length > 80 ? '...' : ''}`)
    console.log(`    A: ${correctText.slice(0, 80)}${correctText.length > 80 ? '...' : ''}`)
    console.log()
  }
}

// === Edit a quiz field by ID ===
function edit() {
  const args = process.argv.slice(3)
  if (args.length < 3) {
    console.log('Usage: node scripts/quiz-utils.mjs edit <id> <field> <value>')
    console.log('Fields: question, explanation, referenceUrl, hint, option.N, wrongFeedback.N')
    process.exit(1)
  }

  const [id, field, ...valueParts] = args
  // Shell-joined args keep backslash escapes literal ("\\n"). Unescape them so
  // CLI callers can pass explanations with newlines without needing raw LF
  // bytes, which most terminals strip before they reach argv.
  const value = valueParts.join(' ').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\')
  const data = loadQuizzes()
  const quiz = data.quizzes.find((q) => q.id === id)

  if (!quiz) {
    console.error(`ERROR: Quiz "${id}" not found`)
    process.exit(1)
  }

  let oldValue
  const optionMatch = field.match(/^(option|wrongFeedback)\.(\d+)$/)

  if (optionMatch) {
    const [, type, indexStr] = optionMatch
    const idx = parseInt(indexStr, 10)
    if (idx < 0 || idx >= quiz.options.length) {
      console.error(`ERROR: Option index ${idx} out of bounds (0-${quiz.options.length - 1})`)
      process.exit(1)
    }
    if (type === 'option') {
      oldValue = quiz.options[idx].text
      quiz.options[idx].text = value
    } else {
      oldValue = quiz.options[idx].wrongFeedback || '(none)'
      if (value === '') {
        delete quiz.options[idx].wrongFeedback
      } else {
        quiz.options[idx].wrongFeedback = value
      }
    }
  } else if (['question', 'explanation', 'referenceUrl', 'hint'].includes(field)) {
    oldValue = quiz[field] || '(none)'
    quiz[field] = value
  } else {
    console.error(
      `ERROR: Unknown field "${field}". Valid: question, explanation, referenceUrl, hint, option.N, wrongFeedback.N`
    )
    process.exit(1)
  }

  saveQuizzes(data)

  console.log(`Updated ${id} [${field}]:`)
  console.log(`  OLD: ${String(oldValue).slice(0, 120)}${String(oldValue).length > 120 ? '...' : ''}`)
  console.log(`  NEW: ${value.slice(0, 120)}${value.length > 120 ? '...' : ''}`)
}

// === Merge skill-proposals into known-issues ===
function mergeProposals() {
  const proposalsPath = resolve(__dirname, '../.claude/tmp/skill-proposals.md')
  const knownIssuesPath = resolve(__dirname, '../.claude/skills/quiz-refine/known-issues.md')

  let proposalsContent
  try {
    proposalsContent = readFileSync(proposalsPath, 'utf8')
  } catch {
    console.log('No skill-proposals.md found. Nothing to merge.')
    return
  }

  const knownIssues = readFileSync(knownIssuesPath, 'utf8')

  // Extract proposals with 汎用性: 高 or 中
  const proposalBlocks = proposalsContent.split(/^### Proposal \d+:/m).slice(1)
  const eligible = proposalBlocks.filter((block) => /汎用性.*[：:]\s*\[?(高|中)\]?/m.test(block))

  if (eligible.length === 0) {
    console.log('No high/medium generalizability proposals found. Nothing to merge.')
    return
  }

  // Extract existing H2 section titles from known-issues
  const existingSections = [...knownIssues.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())

  let additions = []
  for (const block of eligible) {
    const titleMatch = block.match(/^\s*\[?([^\]\n]+)\]?/m)
    const title = titleMatch ? titleMatch[1].trim() : 'Unknown Pattern'
    const observationMatch = block.match(/\*\*観察\*\*[：:]\s*(.+)/m)
    const observation = observationMatch ? observationMatch[1].trim() : ''
    const proposalMatch = block.match(/\*\*提案\*\*[：:]\s*(.+)/m)
    const proposal = proposalMatch ? proposalMatch[1].trim() : ''

    if (!observation && !proposal) continue

    // Check if a similar section exists (fuzzy match on key terms)
    const content = `- ${observation}${proposal ? ' → ' + proposal : ''}`
    const matched = existingSections.find((s) => title.split(/\s+/).some((word) => word.length > 3 && s.includes(word)))

    if (matched) {
      additions.push({ type: 'append', section: matched, content })
    } else {
      additions.push({ type: 'new', title, content })
    }
  }

  if (additions.length === 0) {
    console.log('Proposals parsed but no actionable content found.')
    return
  }

  let updated = knownIssues
  const appended = []
  const newSections = []

  // Process appends to existing sections
  for (const add of additions.filter((a) => a.type === 'append')) {
    const sectionHeader = `## ${add.section}`
    const startIdx = updated.indexOf(sectionHeader)
    if (startIdx === -1) continue

    // Find the end of this section (next ## or end of file)
    const afterHeader = startIdx + sectionHeader.length
    const nextSectionMatch = updated.slice(afterHeader).match(/\n## /)
    const endIdx = nextSectionMatch ? afterHeader + nextSectionMatch.index : updated.length

    const sectionContent = updated.slice(startIdx, endIdx).trimEnd()
    updated = updated.slice(0, startIdx) + sectionContent + '\n' + add.content + '\n' + updated.slice(endIdx)
    appended.push(`  + Appended to "${add.section}"`)
  }

  // Add new sections at end
  for (const add of additions.filter((a) => a.type === 'new')) {
    updated = updated.trimEnd() + `\n\n## ${add.title}\n\n${add.content}\n`
    newSections.push(`  + New section: "${add.title}"`)
  }

  if (appended.length === 0 && newSections.length === 0) {
    console.log('No changes to apply.')
    return
  }

  writeFileSync(knownIssuesPath, updated)
  console.log(`Merged ${appended.length + newSections.length} proposals into known-issues.md:`)
  for (const line of [...appended, ...newSections]) console.log(line)
}

// === Section-Level Coverage ===
function sectionCoverage() {
  const data = loadQuizzes()
  const quizzes = data.quizzes
  const sectionsDir = resolve(__dirname, '../.claude/tmp/docs/sections')

  if (!existsSync(sectionsDir)) {
    console.log('Error: Section metadata not found. Run `npm run docs:fetch` first.')
    process.exit(1)
  }

  const sectionPages = readdirSync(sectionsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  // Sections to exclude from gap analysis
  const EXCLUDE_SLUGS = new Set(['related-resources', 'see-also', 'next-steps', 'further-reading'])

  const results = []

  for (const page of sectionPages) {
    const indexPath = resolve(sectionsDir, page, '_index.json')
    if (!existsSync(indexPath)) continue

    const sections = JSON.parse(readFileSync(indexPath, 'utf8'))

    // Questions referencing this page
    const pageQuestions = quizzes.filter((q) => {
      if (!q.referenceUrl) return false
      const m = q.referenceUrl.match(/\/docs\/en\/([^#?]+)/)
      return m && m[1] === page
    })

    // Anchor-based coverage
    const anchoredSlugs = new Set()
    pageQuestions.forEach((q) => {
      const m = q.referenceUrl.match(/#(.+)/)
      if (m) anchoredSlugs.add(m[1])
    })

    // Content-match fallback for non-anchored questions
    const noAnchorQuestions = pageQuestions.filter((q) => !q.referenceUrl.includes('#'))

    const sectionResults = sections
      .filter((s) => !EXCLUDE_SLUGS.has(s.slug))
      .map((section) => {
        const hasAnchoredQ = anchoredSlugs.has(section.slug)

        const titleWords = section.title
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3)
        const contentMatched = noAnchorQuestions.filter((q) => {
          const text = (q.question + ' ' + q.explanation).toLowerCase()
          return titleWords.some((w) => text.includes(w))
        }).length

        return {
          slug: section.slug,
          title: section.title,
          chars: section.chars,
          covered: hasAnchoredQ || contentMatched > 0,
        }
      })

    const uncovered = sectionResults.filter((s) => !s.covered)

    results.push({
      page,
      totalSections: sectionResults.length,
      totalQuestions: pageQuestions.length,
      uncoveredSections: uncovered,
      coveredCount: sectionResults.length - uncovered.length,
    })
  }

  // Output
  console.log('=== Section-Level Coverage ===\n')

  let totalUncovered = 0
  for (const r of results.sort((a, b) => b.uncoveredSections.length - a.uncoveredSections.length)) {
    if (r.uncoveredSections.length === 0) {
      console.log(
        `  ${r.page.padEnd(25)} ${r.coveredCount}/${r.totalSections} covered (${r.totalQuestions} questions) OK`
      )
      continue
    }

    totalUncovered += r.uncoveredSections.length
    console.log(`\n  ${r.page} — ${r.coveredCount}/${r.totalSections} covered (${r.totalQuestions} questions)`)
    console.log('  Uncovered:')
    for (const s of r.uncoveredSections) {
      console.log(`    #${s.slug} "${s.title}" (${s.chars} chars)`)
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Total uncovered sections: ${totalUncovered}`)
}

// === Question Overlap Detection ===
function overlap() {
  const data = loadQuizzes()
  const quizzes = data.quizzes.filter((q) => q.type !== 'multi')

  function tokenize(text) {
    return new Set(
      text
        .toLowerCase()
        .replace(/`/g, '')
        .split(/[\s、。,.()[\]「」：:]+/)
        .filter((w) => w.length > 2)
    )
  }

  function jaccard(a, b) {
    const intersection = [...a].filter((x) => b.has(x)).length
    const union = new Set([...a, ...b]).size
    return union === 0 ? 0 : intersection / union
  }

  // Strategy 1: Same anchored URL clusters
  const byAnchoredUrl = {}
  quizzes.forEach((q) => {
    if (!q.referenceUrl || !q.referenceUrl.includes('#')) return
    if (!byAnchoredUrl[q.referenceUrl]) byAnchoredUrl[q.referenceUrl] = []
    byAnchoredUrl[q.referenceUrl].push(q)
  })

  const urlClusters = Object.entries(byAnchoredUrl)
    .filter(([, qs]) => qs.length >= 2)
    .map(([url, qs]) => ({ url, questions: qs }))

  // Strategy 2: Similar knowledge point (Jaccard on same page)
  const byPage = {}
  quizzes.forEach((q) => {
    if (!q.referenceUrl) return
    const page = q.referenceUrl.replace(/#.*/, '').replace(/.*\/docs\/en\//, '')
    if (!byPage[page]) byPage[page] = []
    byPage[page].push(q)
  })

  const similarPairs = []
  for (const [page, qs] of Object.entries(byPage)) {
    for (let i = 0; i < qs.length; i++) {
      for (let j = i + 1; j < qs.length; j++) {
        const a = qs[i],
          b = qs[j]

        const aTokens = tokenize(a.options[a.correctIndex].text)
        const bTokens = tokenize(b.options[b.correctIndex].text)
        const answerSim = jaccard(aTokens, bTokens)

        const qTokens1 = tokenize(a.question)
        const qTokens2 = tokenize(b.question)
        const questionSim = jaccard(qTokens1, qTokens2)

        if (answerSim > 0.5 && questionSim > 0.3) {
          similarPairs.push({
            page,
            ids: [a.id, b.id],
            answerSim: answerSim.toFixed(2),
            questionSim: questionSim.toFixed(2),
            q1: a.question.slice(0, 60),
            q2: b.question.slice(0, 60),
          })
        }
      }
    }
  }

  // Output
  console.log('=== Question Overlap Detection ===\n')

  if (urlClusters.length > 0) {
    console.log(`[Same Anchored URL] ${urlClusters.length} clusters:\n`)
    for (const c of urlClusters.sort((a, b) => b.questions.length - a.questions.length)) {
      console.log(`  ${c.url} (${c.questions.length})`)
      for (const q of c.questions) {
        console.log(`    ${q.id}: ${q.question.slice(0, 70)}`)
      }
    }
  }

  if (similarPairs.length > 0) {
    console.log(`\n[Similar Knowledge Point] ${similarPairs.length} pairs:\n`)
    for (const p of similarPairs.sort((a, b) => parseFloat(b.answerSim) - parseFloat(a.answerSim))) {
      console.log(`  ${p.ids.join(' <> ')} [page: ${p.page}]`)
      console.log(`    Q1: ${p.q1}`)
      console.log(`    Q2: ${p.q2}`)
      console.log(`    A-sim: ${p.answerSim}  Q-sim: ${p.questionSim}`)
    }
  }

  if (urlClusters.length === 0 && similarPairs.length === 0) {
    console.log('No significant overlap detected.')
  }

  console.log(`\n=== Summary ===`)
  console.log(`URL clusters: ${urlClusters.length}, Similar pairs: ${similarPairs.length}`)
}

// === Diagram traversal ===
// ダイアグラム内のテキストフィールドを順に visitor へ渡す。
// path はメッセージ用の人間可読パス（"comparison.columns[0].items[2]"）。
function walkDiagramText(diagram, visit) {
  if (!diagram || typeof diagram !== 'object') return
  const t = diagram.type
  switch (t) {
    case 'comparison':
      ;(diagram.columns || []).forEach((col, ci) => {
        ;(col.items || []).forEach((item, ii) => {
          if (typeof item === 'string') visit(item, `comparison.columns[${ci}].items[${ii}]`)
        })
      })
      break
    case 'terminal':
      ;(diagram.lines || []).forEach((line, li) => {
        if (line && typeof line.text === 'string') visit(line.text, `terminal.lines[${li}].text`)
      })
      break
    case 'config':
      ;(diagram.lines || []).forEach((line, li) => {
        if (line && typeof line.text === 'string') visit(line.text, `config.lines[${li}].text`)
      })
      break
    case 'flow':
      ;(diagram.steps || []).forEach((s, si) => {
        if (s && typeof s.text === 'string') visit(s.text, `flow.steps[${si}].text`)
        if (s && typeof s.sub === 'string') visit(s.sub, `flow.steps[${si}].sub`)
      })
      break
    case 'hierarchy':
      ;(diagram.items || []).forEach((it, ii) => {
        if (it && typeof it.text === 'string') visit(it.text, `hierarchy.items[${ii}].text`)
        if (it && typeof it.sub === 'string') visit(it.sub, `hierarchy.items[${ii}].sub`)
      })
      break
    case 'layer':
      ;(diagram.layers || []).forEach((l, li) => {
        if (l && typeof l.text === 'string') visit(l.text, `layer.layers[${li}].text`)
        if (l && typeof l.sub === 'string') visit(l.sub, `layer.layers[${li}].sub`)
      })
      break
    case 'cycle':
      ;(diagram.states || []).forEach((s, si) => {
        if (s && typeof s.text === 'string') visit(s.text, `cycle.states[${si}].text`)
        if (s && typeof s.sub === 'string') visit(s.sub, `cycle.states[${si}].sub`)
      })
      if (typeof diagram.trigger === 'string') visit(diagram.trigger, 'cycle.trigger')
      break
    case 'sequence':
      ;(diagram.actors || []).forEach((a, ai) => {
        if (typeof a === 'string') visit(a, `sequence.actors[${ai}]`)
      })
      ;(diagram.messages || []).forEach((m, mi) => {
        if (m && typeof m.text === 'string') visit(m.text, `sequence.messages[${mi}].text`)
      })
      break
    case 'swimlane':
      ;(diagram.lanes || []).forEach((lane, li) => {
        if (lane && typeof lane.name === 'string') visit(lane.name, `swimlane.lanes[${li}].name`)
        ;(lane.segments || []).forEach((seg, si) => {
          if (seg && typeof seg.text === 'string') visit(seg.text, `swimlane.lanes[${li}].segments[${si}].text`)
        })
      })
      break
    case 'venn':
      ;(diagram.sets || []).forEach((set, si) => {
        if (set && typeof set.text === 'string') visit(set.text, `venn.sets[${si}].text`)
        ;(set.items || []).forEach((it, ii) => {
          if (typeof it === 'string') visit(it, `venn.sets[${si}].items[${ii}]`)
        })
      })
      if (typeof diagram.intersectionLabel === 'string') visit(diagram.intersectionLabel, 'venn.intersectionLabel')
      break
    case 'matrix':
      ;(diagram.rows || []).forEach((r, ri) => {
        if (typeof r === 'string') visit(r, `matrix.rows[${ri}]`)
      })
      ;(diagram.cols || []).forEach((c, ci) => {
        if (typeof c === 'string') visit(c, `matrix.cols[${ci}]`)
      })
      ;(diagram.cells || []).forEach((row, ri) => {
        ;(row || []).forEach((cell, ci) => {
          if (typeof cell === 'string') visit(cell, `matrix.cells[${ri}][${ci}]`)
        })
      })
      break
    case 'tree': {
      const walk = (node, path) => {
        if (!node) return
        if (typeof node.text === 'string') visit(node.text, `${path}.text`)
        if (typeof node.sub === 'string') visit(node.sub, `${path}.sub`)
        ;(node.children || []).forEach((child, ci) => walk(child, `${path}.children[${ci}]`))
      }
      walk(diagram.root, 'tree.root')
      break
    }
    case 'network':
      ;(diagram.nodes || []).forEach((n, ni) => {
        if (n && typeof n.text === 'string') visit(n.text, `network.nodes[${ni}].text`)
        if (n && typeof n.sub === 'string') visit(n.sub, `network.nodes[${ni}].sub`)
      })
      ;(diagram.edges || []).forEach((e, ei) => {
        if (e && typeof e.label === 'string') visit(e.label, `network.edges[${ei}].label`)
      })
      break
    case 'formula':
      if (typeof diagram.result === 'string') visit(diagram.result, 'formula.result')
      ;(diagram.components || []).forEach((c, ci) => {
        if (c && typeof c.text === 'string') visit(c.text, `formula.components[${ci}].text`)
        if (c && typeof c.sub === 'string') visit(c.sub, `formula.components[${ci}].sub`)
      })
      if (typeof diagram.operator === 'string') visit(diagram.operator, 'formula.operator')
      break
    case 'keyboard':
      ;(diagram.combos || []).forEach((c, ci) => {
        if (c && typeof c.caption === 'string') visit(c.caption, `keyboard.combos[${ci}].caption`)
        ;(c?.keys || []).forEach((k, ki) => {
          if (k && typeof k.label === 'string') visit(k.label, `keyboard.combos[${ci}].keys[${ki}].label`)
        })
      })
      if (typeof diagram.caption === 'string') visit(diagram.caption, 'keyboard.caption')
      break
  }
  if (typeof diagram.label === 'string') visit(diagram.label, `${t || 'diagram'}.label`)
}

function getQuestionDiagrams(q) {
  const diagrams = []
  if (Array.isArray(q.diagrams)) diagrams.push(...q.diagrams)
  if (q.diagram) diagrams.push(q.diagram)
  return diagrams
}

// 進捗表示を許容する terminal/config の判定。
// 主要ルール: terminal/config の末尾 `...` は UI/状態表示として許容する。
// ただし JSON 値プレースホルダ（`"...": ...`、`{ ... }`）や URL 省略
// （`https://.../path`）は学習妨害なので flag する。
function isAllowedProgressIndicator(text, fieldPath) {
  if (typeof text !== 'string') return false
  if (!/^(terminal|config)\./.test(fieldPath)) return false
  if (text.includes('…')) return false
  // JSON プレースホルダ系: `{...}`, `{ ... }`, `[...]`, `,...}`, `:...,`
  if (/[{[]\s*\.\.\.\s*[}\]]/.test(text)) return false
  if (/[,:]\s*\.\.\.\s*[,}\]]/.test(text)) return false
  // 値/URL/パス省略系: `=...`, `:"..."`, `/...`、`\...`、`...|`
  if (/["'=]\s*\.\.\.\s*["']/.test(text)) return false
  if (/[=][^\s]*\.\.\./.test(text)) return false // ex: `KEY=sk-...`
  if (/\.\.\.\s*\|/.test(text)) return false // ex: `curl ... | sh`
  if (/[/\\]\.{3}/.test(text)) return false // ex: `/Library/.../`, `C:\Program Files\...`
  // 末尾 `...` は許容（任意の閉じ括弧・記号を最大2文字まで挟む）
  return /\.\.\.[\s)\]」｝>✓✗⏳→]{0,3}$/.test(text)
}

// terminal/config 末尾の `…` も進捗表示と同等と見なして許容する。
function isAllowedJpEllipsis(text, fieldPath) {
  if (!/^(terminal|config)\./.test(fieldPath)) return false
  // 末尾 `…` のみ。途中の `…` は学習妨害なので flag を維持。
  return /…[\s)\]」｝>✓✗⏳→]{0,3}$/.test(text) && (text.match(/…/g) || []).length === 1
}

function findEllipsisIssues(text, fieldPath) {
  const issues = []
  if (typeof text !== 'string') return issues
  if (text.includes('…') && !isAllowedJpEllipsis(text, fieldPath)) {
    issues.push({ kind: 'jp-ellipsis', char: '…' })
  }
  if (/\.\.\./.test(text)) {
    // `[args...]` のような CLI 可変長引数記法はテキスト全体から取り除いて再判定。
    const stripped = text.replace(/\[[A-Za-z_][A-Za-z0-9_-]*\.\.\.\]/g, '')
    if (/\.\.\./.test(stripped) && !isAllowedProgressIndicator(text, fieldPath)) {
      issues.push({ kind: 'ascii-ellipsis', char: '...' })
    }
  }
  return issues
}

function collectEllipsisHits({ category } = {}) {
  const data = loadQuizzes()
  const hits = []
  for (const q of data.quizzes) {
    if (category && q.category !== category) continue
    const diagrams = getQuestionDiagrams(q)
    diagrams.forEach((diagram, di) => {
      walkDiagramText(diagram, (text, path) => {
        const issues = findEllipsisIssues(text, path)
        for (const issue of issues) {
          hits.push({
            id: q.id,
            category: q.category,
            diagramIndex: di,
            diagramType: diagram?.type || 'unknown',
            fieldPath: path,
            kind: issue.kind,
            text,
          })
        }
      })
    })
  }
  return { hits, totalQuestions: data.quizzes.length }
}

// === Check ellipsis ===
function checkEllipsis() {
  const args = process.argv.slice(3)
  const reportOnly = args.includes('--report-only')
  const categoryArg = args.find((a) => a.startsWith('--category='))
  const category = categoryArg ? categoryArg.split('=')[1] : null

  const { hits, totalQuestions } = collectEllipsisHits({ category })
  const byCategory = {}
  const byKind = { 'jp-ellipsis': 0, 'ascii-ellipsis': 0 }
  const affectedIds = new Set()
  for (const h of hits) {
    byCategory[h.category] = (byCategory[h.category] || 0) + 1
    byKind[h.kind] = (byKind[h.kind] || 0) + 1
    affectedIds.add(h.id)
  }

  console.log('=== Diagram Ellipsis Check ===')
  console.log(`Total questions scanned: ${totalQuestions}${category ? ` (filtered: ${category})` : ''}`)
  console.log(`Truncations detected:    ${hits.length} across ${affectedIds.size} questions`)
  console.log(`  Japanese "…":          ${byKind['jp-ellipsis']}`)
  console.log(`  Disallowed "...":      ${byKind['ascii-ellipsis']}`)

  if (Object.keys(byCategory).length > 0) {
    console.log('\nBy category:')
    for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cat.padEnd(14)} ${count}`)
    }
  }

  if (hits.length > 0 && !reportOnly) {
    console.log('\nFirst 20 hits:')
    for (const h of hits.slice(0, 20)) {
      console.log(`  ${h.id} [${h.fieldPath}] ${JSON.stringify(h.text).slice(0, 100)}`)
    }
    if (hits.length > 20) console.log(`  ... and ${hits.length - 20} more`)
  }

  if (reportOnly) {
    console.log('\n(--report-only: exit 0 regardless of hits)')
    return
  }

  if (hits.length > 0) {
    console.log('\nFAIL: diagram text contains truncated content. Fix and re-run.')
    process.exit(1)
  }
  console.log('\nOK: no diagram truncation detected.')
}

// === Ellipsis triage report ===
function ellipsisReport() {
  const args = process.argv.slice(3)
  const categoryArg = args.find((a) => a.startsWith('--category='))
  const category = categoryArg ? categoryArg.split('=')[1] : null

  const data = loadQuizzes()
  const quizMap = new Map(data.quizzes.map((q) => [q.id, q]))
  const { hits } = collectEllipsisHits({ category })

  // group by question id
  const byQuestion = new Map()
  for (const h of hits) {
    if (!byQuestion.has(h.id)) {
      byQuestion.set(h.id, { id: h.id, category: h.category, hits: [] })
    }
    byQuestion.get(h.id).hits.push({
      diagramIndex: h.diagramIndex,
      diagramType: h.diagramType,
      fieldPath: h.fieldPath,
      kind: h.kind,
      text: h.text,
    })
  }

  const entries = Array.from(byQuestion.values()).map((entry) => {
    const q = quizMap.get(entry.id)
    return {
      ...entry,
      question: q?.question,
      options: q?.options,
      correctIndex: q?.correctIndex,
      correctIndices: q?.correctIndices,
      explanation: q?.explanation,
      referenceUrl: q?.referenceUrl,
      diagrams: getQuestionDiagrams(q || {}),
    }
  })

  const summary = {
    generatedAt: new Date().toISOString(),
    filter: { category },
    totalAffectedQuestions: entries.length,
    totalHits: hits.length,
    byCategory: entries.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + 1
      return acc
    }, {}),
  }

  const out = { summary, entries }
  const outDir = resolve(__dirname, '../.claude/tmp')
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true })
  }
  const outPath = resolve(outDir, 'ellipsis-report.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')

  console.log('=== Ellipsis Triage Report ===')
  console.log(`Affected questions: ${entries.length}`)
  console.log(`Total hits:         ${hits.length}`)
  console.log(`Filter:             ${category || '(none)'}`)
  console.log(`\nWritten to: ${outPath}`)
  console.log('\nBy category:')
  for (const [cat, count] of Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(14)} ${count}`)
  }
}

// === Diagram text shape lint ===
// flow.steps[].text+sub の中途分割と hierarchy.items[].text の長文を検出。
// 過去事例: text を機械的に N 字で切って続きを sub に逃した結果、
// "permissionMod"+"e" のような単語分断が 521 件発生（2026-04-25）。
// 過去事例: comparison→hierarchy 移行で option 全文を text に詰め、
// ピラミッド型レイアウトから文字がはみ出した（133 items 影響）。
const SENTENCE_ENDERS = new Set(['。', '、', '！', '？', '.', '!', '?', ')', '）', '】', '」', '』'])
const CONTINUATION_CHAR = /[ぁ-んァ-ヴa-zA-Z0-9々ー一-龯]/
const MID_WORD_LATIN = /[A-Za-z]$/
const HIERARCHY_TEXT_MAX = 40

function isMidSentenceSplit(text, sub) {
  if (!text || !sub) return false
  const lastChar = text.slice(-1)
  const subFirst = sub.charAt(0)
  if (SENTENCE_ENDERS.has(lastChar)) return false
  if (!CONTINUATION_CHAR.test(subFirst)) return false
  // strict: long text (>15) ending in kana/kanji and sub starting in kana/kanji = sentence cut
  // strict: text ending in latin char and sub starting in latin = word cut (e.g. "permissionMod"+"e")
  if (MID_WORD_LATIN.test(lastChar) && /^[A-Za-z]/.test(subFirst)) return true
  if (text.length > 15 && /[ぁ-んァ-ヴ一-龯]/.test(lastChar) && /[ぁ-んァ-ヴ一-龯]/.test(subFirst)) return true
  return false
}

function checkDiagramText() {
  const args = process.argv.slice(3)
  const reportOnly = args.includes('--report-only')
  const data = loadQuizzes()
  const splitHits = []
  const longHits = []

  for (const q of data.quizzes) {
    const diagrams = getQuestionDiagrams(q)
    diagrams.forEach((d, di) => {
      if (d.type === 'flow' && Array.isArray(d.steps)) {
        d.steps.forEach((s, si) => {
          if (isMidSentenceSplit(s.text, s.sub)) {
            splitHits.push({
              id: q.id,
              category: q.category,
              path: `diagrams[${di}].steps[${si}]`,
              text: s.text,
              sub: s.sub,
            })
          }
        })
      }
      if (d.type === 'hierarchy' && Array.isArray(d.items)) {
        d.items.forEach((it, ii) => {
          const len = (it.text || '').length
          if (len > HIERARCHY_TEXT_MAX) {
            longHits.push({
              id: q.id,
              category: q.category,
              path: `diagrams[${di}].items[${ii}]`,
              len,
              text: it.text,
            })
          }
        })
      }
    })
  }

  console.log('=== Diagram Text Shape Check ===')
  console.log(`flow.steps mid-split:        ${splitHits.length}`)
  console.log(`hierarchy.text > ${HIERARCHY_TEXT_MAX}ch:       ${longHits.length}`)

  const fail = splitHits.length + longHits.length
  if (splitHits.length > 0) {
    console.log('\nFlow text/sub split (first 15):')
    for (const h of splitHits.slice(0, 15)) {
      console.log(`  ${h.id} [${h.path}]`)
      console.log(`    text: ${JSON.stringify(h.text).slice(0, 80)}`)
      console.log(`    sub:  ${JSON.stringify(h.sub).slice(0, 80)}`)
    }
    if (splitHits.length > 15) console.log(`  ... and ${splitHits.length - 15} more`)
  }
  if (longHits.length > 0) {
    console.log('\nHierarchy long text (first 15):')
    for (const h of longHits.slice(0, 15)) {
      console.log(`  ${h.id} [${h.path}] (${h.len}ch) ${JSON.stringify(h.text).slice(0, 80)}`)
    }
    if (longHits.length > 15) console.log(`  ... and ${longHits.length - 15} more`)
  }

  if (fail > 0) {
    console.log('\n⚠️  Diagram text shape issues detected.')
    console.log('  • flow.steps[].text は完全な文断片、sub は ≤15字 の短い補足に。文の途中で text/sub に割らない')
    console.log('  • hierarchy.items[].text は ≤40字 の短いラベル。長文は comparison/hierarchy.sub を使う')
    if (reportOnly) {
      console.log('\n(--report-only: exit 0 regardless of hits)')
      return
    }
    process.exit(1)
  }
  console.log('\nOK: no diagram text shape issues.')
}

// === Main ===
const command = process.argv[2]
switch (command) {
  case 'randomize':
    randomize()
    break
  case 'stats':
    stats()
    break
  case 'coverage':
    await coverage()
    break
  case 'check':
    check()
    break
  case 'search':
    search()
    break
  case 'edit':
    edit()
    break
  case 'merge-proposals':
    mergeProposals()
    break
  case 'section-coverage':
    sectionCoverage()
    break
  case 'overlap':
    overlap()
    break
  case 'check-diagram-text':
    checkDiagramText()
    break
  case 'check-ellipsis':
    checkEllipsis()
    break
  case 'ellipsis-report':
    ellipsisReport()
    break
  default:
    console.log('Usage: node scripts/quiz-utils.mjs <command>')
    console.log(
      'Commands: randomize, stats, coverage, check, search, edit, merge-proposals, section-coverage, overlap, check-ellipsis, ellipsis-report, check-diagram-text'
    )
    process.exit(1)
}
