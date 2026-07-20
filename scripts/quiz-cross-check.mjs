#!/usr/bin/env node

/**
 * Quiz Cross-Check Script
 *
 * クイズデータ内のクロスカテゴリ矛盾を検出する。
 * 同じ技術用語・機能に言及する複数の問題を比較し、
 * explanation/wrongFeedback間の矛盾を検出する。
 * ネットワーク・ドキュメントキャッシュ不要（quizzes.json のみで完結）。
 *
 * Usage:
 *   node scripts/quiz-cross-check.mjs              # 全チェック
 *   node scripts/quiz-cross-check.mjs --verbose     # 詳細出力
 */

import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const QUIZ_PATH = resolve(__dirname, '../src/data/quizzes.json')

function loadQuizzes() {
  return JSON.parse(readFileSync(QUIZ_PATH, 'utf8'))
}

function getAllTextFields(quiz) {
  const parts = [quiz.question, quiz.explanation]
  quiz.options.forEach((opt) => {
    parts.push(opt.text)
    if (opt.wrongFeedback) parts.push(opt.wrongFeedback)
  })
  return parts.filter(Boolean).join(' ')
}

// ============================================================
// 1. Topic Clustering — group questions by shared terms
// ============================================================

function buildTopicClusters(quizzes) {
  const clusters = new Map() // topic → [{ id, category, text }]

  const TOPIC_PATTERNS = [
    // Environment variables
    /`(CLOUDFLARE_[A-Z_]+)`/g,
    /`(CF_[A-Z_]+)`/g,
    /`(WRANGLER_[A-Z_]+)`/g,
    // wrangler.toml / wrangler.jsonc config keys
    /`(compatibility_date|compatibility_flags|kv_namespaces|d1_databases|r2_buckets|durable_objects|queues\.producers|queues\.consumers|routes|triggers\.crons|migrations|assets|placement\.mode|observability\.enabled|limits\.cpu_ms)`/g,
    // Workers handlers
    /`(fetch|scheduled|queue|email|alarm|tail)`/g,
    // wrangler subcommands
    /`(wrangler(?: [\w-]+)+)`/g,
  ]

  for (const quiz of quizzes) {
    const fullText = getAllTextFields(quiz)

    for (const pattern of TOPIC_PATTERNS) {
      pattern.lastIndex = 0
      let match
      // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
      while ((match = pattern.exec(fullText)) !== null) {
        const topic = match[1].trim()
        if (!clusters.has(topic)) clusters.set(topic, [])
        const existing = clusters.get(topic)
        if (!existing.some((e) => e.id === quiz.id)) {
          existing.push({
            id: quiz.id,
            category: quiz.category,
            text: fullText,
          })
        }
      }
    }
  }

  return clusters
}

// ============================================================
// 2. Contradiction Detection — find conflicting claims
// ============================================================

const NUMBER_CLAIM_PATTERNS = [
  /(\d+)つの(レベル|段階|種類|タイプ|値|カテゴリ|ステップ|モード|方法|オプション)/g,
  /(\d+)(種類|個|件|つ|段階)/g,
]

const FACTUAL_CLAIM_PATTERNS = [/(デフォルト(?:値)?(?:は|が))[^。]+/g, /(正しくは|正しい(?:値|名|名前|パス)は)[^。]+/g]

function detectContradictions(clusters) {
  const issues = []

  for (const [topic, entries] of clusters.entries()) {
    if (entries.length < 2) continue

    const numericClaims = new Map()

    for (const entry of entries) {
      for (const pattern of NUMBER_CLAIM_PATTERNS) {
        pattern.lastIndex = 0
        let match
        // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
        while ((match = pattern.exec(entry.text)) !== null) {
          const topicIdx = entry.text.indexOf(topic)
          if (topicIdx !== -1 && Math.abs(match.index - topicIdx) < 200) {
            const claimKey = match[0].replace(/\d+/, 'N')
            const number = parseInt(match[1], 10)
            if (!numericClaims.has(claimKey)) {
              numericClaims.set(claimKey, [])
            }
            numericClaims.get(claimKey).push({
              number,
              id: entry.id,
              context: entry.text.slice(Math.max(0, match.index - 30), match.index + match[0].length + 30),
            })
          }
        }
      }
    }

    for (const [_claimKey, claims] of numericClaims.entries()) {
      const numbers = new Set(claims.map((c) => c.number))
      if (numbers.size > 1) {
        issues.push({
          topic,
          type: 'numeric-contradiction',
          message: `Different numeric claims: ${[...numbers].join(' vs ')}`,
          details: claims.map((c) => `  ${c.id}: "${c.context.trim()}"`),
        })
      }
    }

    const defaultClaims = []
    for (const entry of entries) {
      for (const pattern of FACTUAL_CLAIM_PATTERNS) {
        pattern.lastIndex = 0
        let match
        // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
        while ((match = pattern.exec(entry.text)) !== null) {
          const topicIdx = entry.text.indexOf(topic)
          if (topicIdx !== -1 && Math.abs(match.index - topicIdx) < 150) {
            defaultClaims.push({
              id: entry.id,
              claim: match[0].slice(0, 80),
            })
          }
        }
      }
    }

    if (defaultClaims.length >= 2) {
      const uniqueClaims = new Set(defaultClaims.map((c) => c.claim))
      if (uniqueClaims.size > 1) {
        issues.push({
          topic,
          type: 'factual-variation',
          message: `Multiple factual claims about "${topic}"`,
          details: defaultClaims.map((c) => `  ${c.id}: "${c.claim}"`),
        })
      }
    }
  }

  return issues
}

// ============================================================
// 3. Report
// ============================================================

const verbose = process.argv.includes('--verbose')
const jsonMode = process.argv.includes('--json')
const data = loadQuizzes()
const quizzes = data.quizzes

const clusters = buildTopicClusters(quizzes)
const issues = detectContradictions(clusters)

if (jsonMode) {
  const jsonResults = issues.map((issue) => {
    const quizIds = issue.details.map((d) => d.trim().match(/^([\w-]+):/)?.[1]).filter(Boolean)
    return {
      topic: issue.topic,
      type: issue.type,
      quizIds,
      status: 'flagged',
      detail: issue.message,
    }
  })
  console.log(JSON.stringify(jsonResults))
  process.exit(0)
}

console.log('=== Quiz Cross-Check ===')
console.log(`Questions: ${quizzes.length}\n`)

const multiClusters = [...clusters.entries()].filter(([, v]) => v.length >= 2)
console.log(`Topic clusters with 2+ questions: ${multiClusters.length}`)

if (verbose) {
  console.log('\n--- Topic Clusters ---')
  for (const [topic, entries] of multiClusters.sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  "${topic}" (${entries.length} questions):`)
    for (const e of entries) {
      console.log(`    ${e.id} [${e.category}]`)
    }
  }
}

console.log(`\nContradictions detected: ${issues.length}`)

if (issues.length > 0) {
  console.log('\n--- Potential Contradictions ---')
  for (const issue of issues) {
    console.log(`\n  [${issue.type}] Topic: "${issue.topic}"`)
    console.log(`  ${issue.message}`)
    for (const detail of issue.details) {
      console.log(detail)
    }
  }
}

console.log('\n=== Summary ===')
if (issues.length === 0) {
  console.log('No cross-category contradictions detected.')
} else {
  console.log(`${issues.length} potential contradiction(s) found. Review manually.`)
  console.log('Note: Some "contradictions" may be valid context-dependent differences.')
}
