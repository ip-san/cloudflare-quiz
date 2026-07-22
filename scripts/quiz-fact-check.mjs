#!/usr/bin/env node

/**
 * Quiz Fact-Check Script
 *
 * クイズデータから技術用語（環境変数、CLIフラグ、Workersハンドラ名、設定キー、
 * wrangler サブコマンド）を抽出し、キャッシュ済みの公式ドキュメント
 * （`npm run docs:fetch` で取得、.claude/tmp/docs 配下）と照合して
 * 未検証の用語を検出する。ネットワーク不要（キャッシュ必須）。
 *
 * Usage:
 *   node scripts/quiz-fact-check.mjs              # 全チェック
 *   node scripts/quiz-fact-check.mjs env           # 環境変数のみ
 *   node scripts/quiz-fact-check.mjs flags         # CLIフラグのみ
 *   node scripts/quiz-fact-check.mjs handlers      # Workersハンドラ名のみ
 *   node scripts/quiz-fact-check.mjs config        # 設定キーのみ
 *   node scripts/quiz-fact-check.mjs commands      # wrangler サブコマンドのみ
 *   node scripts/quiz-fact-check.mjs known         # 既知の非実在用語のみ
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { HISTORICAL_MARKERS, KNOWN_NONEXISTENT_TERMS, NEGATION_MARKERS } from './topic-config.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const QUIZ_PATH = resolve(ROOT, 'src/data/quizzes.json')
const DOCS_DIR = resolve(ROOT, '.claude/tmp/docs')

// ============================================================
// Extract terms from quiz data
// ============================================================

function loadQuizzes() {
  return JSON.parse(readFileSync(QUIZ_PATH, 'utf8'))
}

function getAllTextFields(quiz) {
  const fields = []
  fields.push({ key: 'question', value: quiz.question })
  fields.push({ key: 'explanation', value: quiz.explanation })
  quiz.options.forEach((opt, i) => {
    fields.push({ key: `options[${i}].text`, value: opt.text })
    if (opt.wrongFeedback) {
      fields.push({ key: `options[${i}].wrongFeedback`, value: opt.wrongFeedback })
    }
  })
  return fields
}

function extractTermsFromQuizzes(quizzes) {
  const terms = {
    envVars: new Map(), // term → Set of question IDs
    cliFlags: new Map(),
    handlers: new Map(),
    configKeys: new Map(),
    commands: new Map(),
  }

  const ENV_RE = /`(CLOUDFLARE_[A-Z_]+|CF_[A-Z_]+|WRANGLER_[A-Z_]+)`/g
  const FLAG_RE = /`(--[\w-]+(?:=\S+)?)`/g
  const HANDLER_RE = /`(fetch|scheduled|queue|email|alarm|tail)`/g
  const CONFIG_RE =
    /`(compatibility_date|compatibility_flags|account_id|workers_dev|kv_namespaces|d1_databases|r2_buckets|durable_objects(?:\.bindings)?|queues\.producers|queues\.consumers|vars|routes|triggers\.crons|migrations|assets|placement\.mode|observability\.enabled|limits\.cpu_ms)`/g
  const COMMAND_RE = /`(wrangler(?: [\w-]+)+)`/g

  function addTerm(map, term, quizId) {
    if (!map.has(term)) map.set(term, new Set())
    map.get(term).add(quizId)
  }

  for (const quiz of quizzes) {
    const fields = getAllTextFields(quiz)
    for (const field of fields) {
      if (!field.value) continue
      const text = field.value

      let match
      ENV_RE.lastIndex = 0
      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
      while ((match = ENV_RE.exec(text)) !== null) {
        addTerm(terms.envVars, match[1], quiz.id)
      }

      FLAG_RE.lastIndex = 0
      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
      while ((match = FLAG_RE.exec(text)) !== null) {
        addTerm(terms.cliFlags, match[1], quiz.id)
      }

      HANDLER_RE.lastIndex = 0
      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
      while ((match = HANDLER_RE.exec(text)) !== null) {
        addTerm(terms.handlers, match[1], quiz.id)
      }

      CONFIG_RE.lastIndex = 0
      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
      while ((match = CONFIG_RE.exec(text)) !== null) {
        addTerm(terms.configKeys, match[1].trim(), quiz.id)
      }

      COMMAND_RE.lastIndex = 0
      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
      while ((match = COMMAND_RE.exec(text)) !== null) {
        addTerm(terms.commands, match[1].trim(), quiz.id)
      }
    }
  }

  return terms
}

// ============================================================
// Load and search documentation
// ============================================================

function loadDocContent() {
  if (!existsSync(DOCS_DIR)) {
    console.error('Error: Doc cache not found. Run `npm run docs:fetch` first.')
    process.exit(1)
  }

  const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'))
  const content = {}
  for (const file of files) {
    const page = file.replace(/\.md$/, '')
    content[page] = readFileSync(resolve(DOCS_DIR, file), 'utf8')
  }
  return content
}

function searchInDocs(docs, term) {
  const results = []
  for (const [page, content] of Object.entries(docs)) {
    if (content.includes(term)) {
      results.push(page)
    }
  }
  return results
}

function isNegatedOccurrence(text, term) {
  const idx = text.indexOf(term)
  if (idx < 0) return false
  const window = text.slice(Math.max(0, idx - 40), idx + term.length + 40)
  return NEGATION_MARKERS.test(window)
}

// 「旧`wrangler publish`」のような歴史的言及は旧名称を引用せざるを得ないため、
// 現行ドキュメントに無くても事実誤りではない(quiz-lint の skipIfHistorical と同じ規約)。
function isHistoricalOccurrence(text, term) {
  const idx = text.indexOf(term)
  if (idx < 0) return false
  const window = text.slice(Math.max(0, idx - 40), idx + term.length + 40)
  return HISTORICAL_MARKERS.test(window)
}

function allOccurrencesSuppressed(term, quizIds, allQuizzesById) {
  for (const quizId of quizIds) {
    const quiz = allQuizzesById.get(quizId)
    if (!quiz) continue
    const fields = getAllTextFields(quiz)
    for (const field of fields) {
      if (!field.value || !field.value.includes(term)) continue
      if (!isNegatedOccurrence(field.value, term) && !isHistoricalOccurrence(field.value, term)) return false
    }
  }
  return true
}

// 抽出したコマンド用語は `wrangler secret put API_KEY` のように例示引数まで
// 含むことがある。ドキュメントは同じコマンドを別の例示値(FOO 等)で載せるため、
// 末尾の引数らしきトークン(ALL_CAPS・<placeholder>・数値・my-xxx)を1つずつ
// 削りながら再検索し、コマンド本体がドキュメントに実在すれば found 扱いにする。
const EXAMPLE_ARG_RE = /^([A-Z][A-Z0-9_]*|<[^>]+>|my-[\w-]+|\d+)$/
function searchWithArgStripping(docs, term) {
  let current = term
  while (true) {
    const pages = searchInDocs(docs, current)
    if (pages.length > 0) return pages
    const tokens = current.split(' ')
    if (tokens.length <= 2 || !EXAMPLE_ARG_RE.test(tokens[tokens.length - 1])) {
      return []
    }
    current = tokens.slice(0, -1).join(' ')
  }
}

// ============================================================
// Check and report
// ============================================================

function checkTerms(termMap, docs, label, quiet = false, allQuizzesById = null) {
  const found = []
  const notFound = []
  let negationSuppressed = 0

  for (const [term, quizIds] of termMap.entries()) {
    const pages = searchWithArgStripping(docs, term)
    if (pages.length > 0) {
      found.push({ term, quizIds: [...quizIds], pages })
    } else if (allQuizzesById && allOccurrencesSuppressed(term, quizIds, allQuizzesById)) {
      negationSuppressed++
    } else {
      notFound.push({ term, quizIds: [...quizIds] })
    }
  }

  if (!quiet) {
    console.log(`\n=== ${label} ===`)
    console.log(`  Total: ${termMap.size} unique terms`)
    console.log(`  Found in docs: ${found.length}`)
    console.log(`  NOT found in docs: ${notFound.length}`)

    if (negationSuppressed > 0) {
      console.log(`  Suppressed (negation/historical context): ${negationSuppressed}`)
    }

    if (notFound.length > 0) {
      console.log(`\n  ⚠ Terms not found in cached documentation:`)
      for (const { term, quizIds } of notFound.sort((a, b) => a.term.localeCompare(b.term))) {
        console.log(`    ${term}`)
        console.log(
          `      Used in: ${quizIds.slice(0, 5).join(', ')}${quizIds.length > 5 ? ` (+${quizIds.length - 5} more)` : ''}`
        )
      }
    }
  }

  return { found: found.length, notFound: notFound.length, notFoundTerms: notFound, negationSuppressed }
}

// ============================================================
// Main
// ============================================================

const args = process.argv.slice(2)
const command = args.find((a) => !a.startsWith('--')) || 'all'
const jsonMode = args.includes('--json')
const validCommands = ['all', 'env', 'flags', 'handlers', 'config', 'commands', 'known']
if (!validCommands.includes(command)) {
  console.log('Usage: node scripts/quiz-fact-check.mjs [all|env|flags|handlers|config|commands|known] [--json]')
  process.exit(1)
}

const data = loadQuizzes()
const terms = extractTermsFromQuizzes(data.quizzes)
const docs = loadDocContent()
const allQuizzesById = new Map(data.quizzes.map((q) => [q.id, q]))

// Separate from the term-not-in-docs sweep: features confirmed NOT to exist
// (see KNOWN_NONEXISTENT_TERMS in topic-config.mjs — empty until verified
// entries are added).
function checkKnownNonexistent(quizzes, quiet = false) {
  const hits = []
  for (const entry of KNOWN_NONEXISTENT_TERMS) {
    for (const quiz of quizzes) {
      const fields = getAllTextFields(quiz)
      for (const field of fields) {
        if (!field.value || !field.value.includes(entry.term)) continue
        if (isNegatedOccurrence(field.value, entry.term)) continue
        const optMatch = field.key.match(/^options\[(\d+)\]\.text$/)
        if (optMatch) {
          const idx = Number(optMatch[1])
          if (idx !== quiz.correctIndex) continue
        }
        hits.push({ id: quiz.id, field: field.key, term: entry.term, reason: entry.reason })
      }
    }
  }
  if (!quiet) {
    console.log(`\n=== Known-Nonexistent Terms ===`)
    if (hits.length === 0) {
      console.log(`  ✓ No positive mentions of known-nonexistent features`)
    } else {
      console.log(`  ⚠ ${hits.length} positive mention(s) of features that do not exist:`)
      for (const h of hits) {
        console.log(`    ${h.id} [${h.field}]: "${h.term}" — ${h.reason}`)
      }
    }
  }
  return hits
}

if (!jsonMode) {
  console.log(`=== Quiz Fact-Check ===`)
  console.log(`Questions: ${data.quizzes.length}`)
  console.log(`Doc pages: ${Object.keys(docs).length}`)
}

let totalNotFound = 0
const jsonResults = {}

const checks = [
  ['env', terms.envVars, 'Environment Variables'],
  ['flags', terms.cliFlags, 'CLI Flags'],
  ['handlers', terms.handlers, 'Workers Handlers'],
  ['config', terms.configKeys, 'Config Keys'],
  ['commands', terms.commands, 'Wrangler Commands'],
]

for (const [key, termMap, label] of checks) {
  if (command === 'all' || command === key) {
    const r = checkTerms(termMap, docs, label, jsonMode, allQuizzesById)
    totalNotFound += r.notFound
    if (jsonMode) {
      jsonResults[key] = r.notFoundTerms.map((t) => ({
        term: t.term,
        quizIds: t.quizIds,
        status: 'flagged',
        type: 'term-not-in-docs',
      }))
    }
  }
}

let knownHits = []
if (command === 'all' || command === 'known') {
  knownHits = checkKnownNonexistent(data.quizzes, jsonMode)
  if (jsonMode) {
    jsonResults.knownNonexistent = knownHits.map((h) => ({
      term: h.term,
      quizIds: [h.id],
      status: 'error',
      type: 'positive-mention-of-nonexistent',
      reason: h.reason,
      field: h.field,
    }))
  }
}

if (jsonMode) {
  console.log(JSON.stringify(jsonResults))
  process.exit(0)
}

console.log(`\n=== Summary ===`)
if (totalNotFound === 0 && knownHits.length === 0) {
  console.log('All extracted terms found in documentation and no positive mentions of nonexistent features.')
} else {
  if (totalNotFound > 0) {
    console.log(`${totalNotFound} term(s) not found in cached docs.`)
    console.log('Note: Terms may exist in docs not yet cached, or may be internal-only terms.')
    console.log('Run `npm run docs:fetch` to refresh the cache, then re-check.')
  }
  if (knownHits.length > 0) {
    console.log(`${knownHits.length} positive mention(s) of known-nonexistent features (factual errors).`)
  }
}
