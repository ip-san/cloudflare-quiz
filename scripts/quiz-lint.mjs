#!/usr/bin/env node

/**
 * Quiz Lint & Auto-Fix Scripts
 *
 * LLM/人手レビューの前に実行する機械的チェック＆自動修正。
 * バッククォート不足、URL不整合、用語ゆれ、distractor(誤答選択肢)品質、
 * difficulty ラベル妥当性を正規表現ベースで検出・修正し、レビュー負荷を削減する。
 *
 * Usage:
 *   node scripts/quiz-lint.mjs backtick             # バッククォート lint + 自動修正
 *   node scripts/quiz-lint.mjs backtick --dry-run   # 修正せずレポートのみ
 *   node scripts/quiz-lint.mjs url                  # referenceUrl アンカー検証（要 docs:fetch）
 *   node scripts/quiz-lint.mjs terminology          # 用語辞書チェック
 *   node scripts/quiz-lint.mjs quality               # wrongFeedback品質・暗記問題チェック
 *   node scripts/quiz-lint.mjs distractor            # 誤答選択肢の質チェック
 *   node scripts/quiz-lint.mjs difficulty            # difficulty ラベル妥当性チェック
 *   node scripts/quiz-lint.mjs all                   # 全チェック実行
 *   node scripts/quiz-lint.mjs all --dry-run         # 全チェック（修正なし。CI/pre-commit 向け）
 *
 * 全チェックは非破壊（backtick 以外は自動修正しない）で、CI をブロックしない
 * アドバイザリレポート。exit code は常に 0 — 構造的な検証は
 * `node scripts/quiz-utils.mjs check` が担う。
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import {
  ADDITIONAL_DOC_PREFIXES,
  BACKTICK_TERMS,
  DOC_URL_PREFIX,
  filenameToDocPage,
  NEGATION_MARKERS,
  TERMINOLOGY_DICT,
  WRANGLER_COMMAND_TAG_SOURCE,
} from './topic-config.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const QUIZ_PATH = resolve(ROOT, 'src/data/quizzes.json')
const DOCS_DIR = resolve(ROOT, '.claude/tmp/docs')

function loadQuizzes() {
  return JSON.parse(readFileSync(QUIZ_PATH, 'utf8'))
}

function saveQuizzes(data) {
  writeFileSync(QUIZ_PATH, JSON.stringify(data, null, 2) + '\n')
}

// ============================================================
// 1. Backtick Auto-Lint
// ============================================================

const FILE_PATH_TERMS = BACKTICK_TERMS.filePaths
const SLASH_CMD_PATTERN = BACKTICK_TERMS.slashCommands
const HOOK_EVENTS = BACKTICK_TERMS.hookEvents
const TOOL_NAMES = BACKTICK_TERMS.toolNames
const CONFIG_KEYS = BACKTICK_TERMS.configKeys
const CLI_COMMANDS = BACKTICK_TERMS.cliCommands

// Environment variables: Cloudflare/Wrangler-prefixed UPPER_SNAKE_CASE.
const ENV_VAR_PATTERN = /(?<!`)\b(CLOUDFLARE_[A-Z_]+|CF_[A-Z_]+|WRANGLER_[A-Z_]+)\b(?!`)/g

// CLI flags: --flag-name or --flag=value
const FLAG_PATTERN = /(?<!`|[-\w])(--[a-z][-a-z0-9]*(?:=\S+)?)(?!`|[-\w])/g

/**
 * Check if a position is inside an existing backtick span.
 */
function isInsideBackticks(text, matchIndex) {
  let inBacktick = false
  for (let i = 0; i < matchIndex; i++) {
    if (text[i] === '`') inBacktick = !inBacktick
  }
  return inBacktick
}

/**
 * Wrap a term in backticks if not already wrapped.
 */
function wrapInBackticks(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(?<!\`)${escaped}(?!\`)`, 'g')

  return text.replace(pattern, (match, offset) => {
    if (isInsideBackticks(text, offset)) return match
    return `\`${match}\``
  })
}

function lintBackticks(quizzes, dryRun) {
  const fixes = []

  for (const quiz of quizzes) {
    const textFields = [
      { key: 'question', value: quiz.question },
      { key: 'explanation', value: quiz.explanation },
    ]

    quiz.options.forEach((opt, i) => {
      textFields.push({ key: `options[${i}].text`, value: opt.text })
      if (opt.wrongFeedback) {
        textFields.push({ key: `options[${i}].wrongFeedback`, value: opt.wrongFeedback })
      }
    })

    for (const field of textFields) {
      if (!field.value) continue
      let text = field.value
      let changed = false

      // 1. Environment variables
      text = text.replace(ENV_VAR_PATTERN, (match, varName, offset) => {
        if (isInsideBackticks(text, offset)) return match
        changed = true
        return `\`${varName}\``
      })

      // 2. (no slash-command concept for this topic — see topic-config.mjs)
      const slashFixed = text.replace(SLASH_CMD_PATTERN, (match) => match)
      if (slashFixed !== text) text = slashFixed

      // 3. File paths (exact match)
      for (const filePath of FILE_PATH_TERMS) {
        const before = text
        text = wrapInBackticks(text, filePath)
        if (text !== before) changed = true
      }

      // 4. Workers handler names (fetch/scheduled/queue/email/alarm/tail).
      //    Skip when immediately followed by "(" — that's a code snippet
      //    (e.g. option text like "queue(batch, env, ctx)"), not a prose
      //    mention, and partially backticking a bare word inside a raw
      //    code line would garble it rather than clarify it.
      for (const event of HOOK_EVENTS) {
        const before = text
        const pattern = new RegExp(`(?<!\`)\\b${event}\\b(?!\`|\\()`, 'g')
        text = text.replace(pattern, (match, offset) => {
          if (isInsideBackticks(text, offset)) return match
          changed = true
          return `\`${match}\``
        })
        if (text !== before) changed = true
      }

      // 5. Tool names (currently none for this topic)
      for (const tool of TOOL_NAMES) {
        const pattern = new RegExp(`(?<!\`|[A-Za-z])${tool}(?!\`|[A-Za-z])`, 'g')
        const before = text
        text = text.replace(pattern, (match, offset) => {
          if (isInsideBackticks(text, offset)) return match
          changed = true
          return `\`${match}\``
        })
        if (text !== before) changed = true
      }

      // 6. CLI commands (full invocations — longer patterns first)
      for (const cmd of CLI_COMMANDS) {
        const before = text
        text = wrapInBackticks(text, cmd)
        if (text !== before) changed = true
      }

      // 6b. CLI flags (--flag) — runs after CLI commands to avoid splitting
      //     e.g. `wrangler dev --remote` is already handled as one unit above
      const flagFixed = text.replace(FLAG_PATTERN, (match, flag, offset) => {
        if (flag === '--') return match
        if (isInsideBackticks(text, offset)) return match
        changed = true
        return `\`${flag}\``
      })
      if (flagFixed !== text) text = flagFixed

      // 7. Config keys
      for (const key of CONFIG_KEYS) {
        const before = text
        text = wrapInBackticks(text, key)
        if (text !== before) changed = true
      }

      if (changed) {
        fixes.push({
          id: quiz.id,
          field: field.key,
          before: field.value,
          after: text,
        })

        if (!dryRun) {
          if (field.key === 'question') {
            quiz.question = text
          } else if (field.key === 'explanation') {
            quiz.explanation = text
          } else if (field.key.startsWith('options[')) {
            const match = field.key.match(/options\[(\d+)\]\.(.+)/)
            if (match) {
              const idx = parseInt(match[1], 10)
              const prop = match[2]
              quiz.options[idx][prop] = text
            }
          }
        }
      }
    }
  }

  return fixes
}

// ============================================================
// 2. referenceUrl Anchor Validation
// ============================================================

/**
 * Extract all H1-H4 anchors from cached doc files (fetched via
 * `npm run docs:fetch`, gitignored under .claude/tmp/docs).
 */
function extractDocAnchors() {
  const anchors = {} // page → Set of anchor slugs

  if (!existsSync(DOCS_DIR)) {
    console.log('  Warning: Doc cache not found. Run `npm run docs:fetch` first.')
    return anchors
  }

  const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md'))
  for (const file of files) {
    const page = filenameToDocPage(file)
    const content = readFileSync(resolve(DOCS_DIR, file), 'utf8')
    const headingAnchors = new Set()

    const headingRegex = /^#{1,4}\s+(.+)$/gm
    let match
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
    while ((match = headingRegex.exec(content)) !== null) {
      const heading = match[1].trim()
      headingAnchors.add(slugify(heading))
    }

    // Cloudflare's CLI reference pages often render a command's heading via
    // a `<WranglerCommand command="X" />` MDX component instead of literal
    // `#` markdown — the heading text/anchor exists on the live page but
    // never appears as a `#`-prefixed line in source. Treat the component's
    // `command` attribute as an implicit heading so it isn't misreported as
    // a broken anchor.
    const wranglerCmdRegex = new RegExp(WRANGLER_COMMAND_TAG_SOURCE, 'g')
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
    while ((match = wranglerCmdRegex.exec(content)) !== null) {
      headingAnchors.add(slugify(match[1]))
    }

    anchors[page] = headingAnchors
  }

  return anchors
}

/**
 * GitHub-style slug generation from heading text.
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function lintUrls(quizzes) {
  const docAnchors = extractDocAnchors()
  const issues = []

  if (Object.keys(docAnchors).length === 0) {
    return issues
  }

  for (const quiz of quizzes) {
    if (!quiz.referenceUrl) {
      issues.push({ id: quiz.id, type: 'missing-url', message: 'No referenceUrl' })
      continue
    }

    const isMainDocs = quiz.referenceUrl.startsWith(DOC_URL_PREFIX)
    const isAdditionalDocs = ADDITIONAL_DOC_PREFIXES.some((prefix) => quiz.referenceUrl.startsWith(prefix))
    if (!isMainDocs && !isAdditionalDocs) {
      issues.push({
        id: quiz.id,
        type: 'invalid-domain',
        message: `Unexpected domain: ${quiz.referenceUrl}`,
      })
      continue
    }

    // Additional doc prefixes are valid but we can't check anchors (no local cache)
    if (isAdditionalDocs) continue

    const urlMatch = quiz.referenceUrl.match(/^https:\/\/developers\.cloudflare\.com\/([^#?]+?)\/?(?:#(.+))?$/)
    if (!urlMatch) {
      issues.push({ id: quiz.id, type: 'malformed-url', message: `Cannot parse: ${quiz.referenceUrl}` })
      continue
    }

    const page = urlMatch[1]
    const anchor = urlMatch[2]

    if (!docAnchors[page]) {
      issues.push({
        id: quiz.id,
        type: 'unknown-page',
        message: `Page "${page}" not in doc cache`,
        url: quiz.referenceUrl,
      })
      continue
    }

    if (anchor && !docAnchors[page].has(anchor)) {
      const suggestions = [...docAnchors[page]]
        .filter((a) => a.includes(anchor.split('-')[0]) || anchor.includes(a.split('-')[0]))
        .slice(0, 3)

      issues.push({
        id: quiz.id,
        type: 'invalid-anchor',
        message: `Anchor "#${anchor}" not found in "${page}"`,
        url: quiz.referenceUrl,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      })
    }
  }

  return issues
}

// ============================================================
// 3. Terminology Dictionary Check
// ============================================================

function lintTerminology(quizzes) {
  const issues = []

  for (const quiz of quizzes) {
    const wrongOptionIndices = new Set()
    if (quiz.type === 'multi' && quiz.correctIndices) {
      quiz.options.forEach((_, i) => {
        if (!quiz.correctIndices.includes(i)) wrongOptionIndices.add(i)
      })
    } else {
      quiz.options.forEach((_, i) => {
        if (i !== quiz.correctIndex) wrongOptionIndices.add(i)
      })
    }

    const textFields = [
      { key: 'question', value: quiz.question, isWrongOption: false },
      { key: 'explanation', value: quiz.explanation, isWrongOption: false },
      ...quiz.options.map((opt, i) => ({
        key: `options[${i}].text`,
        value: opt.text,
        isWrongOption: wrongOptionIndices.has(i),
      })),
      ...quiz.options
        .map((opt, i) =>
          opt.wrongFeedback
            ? {
                key: `options[${i}].wrongFeedback`,
                value: opt.wrongFeedback,
                isWrongOption: wrongOptionIndices.has(i),
              }
            : null
        )
        .filter(Boolean),
    ]

    for (const field of textFields) {
      if (!field.value) continue

      for (const entry of TERMINOLOGY_DICT) {
        if (entry.skipWrongOptions && (field.isWrongOption || field.key.includes('wrongFeedback'))) {
          continue
        }

        let found = false
        let matchedText = ''

        if (entry.wrong instanceof RegExp) {
          const match = field.value.match(entry.wrong)
          if (match) {
            found = true
            matchedText = match[0]
          }
        } else {
          const searchText = entry.caseInsensitive === false ? field.value : field.value.toLowerCase()
          const searchTerm = entry.caseInsensitive === false ? entry.wrong : entry.wrong.toLowerCase()

          if (searchText.includes(searchTerm)) {
            found = true
            matchedText = entry.wrong
          }
        }

        if (found && entry.skipIfHistorical) {
          if (/旧称|以前は|formerly|previously|was called|renamed from/i.test(field.value)) {
            found = false
          }
        }

        if (found && entry.skipIfNegated) {
          const matchIndex = field.value.indexOf(matchedText)
          const window = field.value.slice(Math.max(0, matchIndex - 40), matchIndex + matchedText.length + 40)
          if (NEGATION_MARKERS.test(window)) {
            found = false
          }
        }

        if (found) {
          issues.push({
            id: quiz.id,
            field: field.key,
            type: entry.correct ? 'wrong-term' : 'invalid-term',
            found: matchedText,
            correct: entry.correct,
            message: entry.message || `"${matchedText}" → "${entry.correct}"`,
          })
        }
      }
    }
  }

  return issues
}

// ============================================================
// 4. Quality Checks (mechanical subset)
// ============================================================

const WEAK_WRONG_FEEDBACK_PATTERNS = [
  /^.{1,15}$/, // 15 chars or less (e.g. "正しくありません")
  /^この選択肢は正しくありません/,
  /^正解の解説を参照/,
  /^サポートされています。$/,
  /^有効な.{1,5}です。$/,
]

const MEMORIZATION_PATTERNS = [
  /デフォルト値は(何|どれ|いくつ)ですか/,
  /の環境変数名は(何|どれ)ですか/,
  /のコマンド名は(何|どれ)ですか/,
  /のパスは(何|どれ)ですか/,
  /の正式名称は(何|どれ)ですか/,
]

function lintQuality(quizzes) {
  const issues = []

  for (const quiz of quizzes) {
    const correctSet = quiz.type === 'multi' ? new Set(quiz.correctIndices || []) : new Set([quiz.correctIndex])

    quiz.options.forEach((opt, i) => {
      if (correctSet.has(i) || !opt.wrongFeedback) return

      for (const pattern of WEAK_WRONG_FEEDBACK_PATTERNS) {
        if (pattern.test(opt.wrongFeedback)) {
          issues.push({
            id: quiz.id,
            type: 'weak-wrongFeedback',
            field: `options[${i}].wrongFeedback`,
            value: opt.wrongFeedback,
            message: `wrongFeedback が短すぎるか学習効果が低い (${opt.wrongFeedback.length}文字)`,
          })
          break
        }
      }
    })

    for (const pattern of MEMORIZATION_PATTERNS) {
      if (pattern.test(quiz.question)) {
        issues.push({
          id: quiz.id,
          type: 'memorization',
          field: 'question',
          value: quiz.question.slice(0, 60),
          message: '暗記型の問題パターンが検出されました（理解・シナリオ型への書き換えを推奨）',
        })
        break
      }
    }
  }

  return issues
}

function printQualityReport(issues) {
  if (issues.length === 0) {
    console.log('  No quality issues found.')
    return
  }

  const byType = {}
  for (const issue of issues) {
    if (!byType[issue.type]) byType[issue.type] = []
    byType[issue.type].push(issue)
  }

  console.log(`  ${issues.length} quality issues:\n`)
  for (const [type, typeIssues] of Object.entries(byType)) {
    console.log(`  [${type}] (${typeIssues.length})`)
    for (const issue of typeIssues) {
      console.log(`    ${issue.id} [${issue.field}]: ${issue.message}`)
    }
  }
}

// ============================================================
// 5. Distractor Quality Lint
// ============================================================

function lintDistractors(quizzes) {
  const issues = []

  for (const quiz of quizzes) {
    if (quiz.type === 'multi') continue
    const ci = quiz.correctIndex

    const correctLen = quiz.options[ci].text.length
    const wrongOpts = quiz.options.filter((_, i) => i !== ci)
    const wrongLens = wrongOpts.map((o) => o.text.length)
    const avgWrongLen = wrongLens.reduce((s, v) => s + v, 0) / wrongLens.length

    // Ratio/length thresholds calibrated against this corpus (2026-07-22):
    // a 2x/30-char rule flagged 41 questions, but reviewing all of them
    // found the same shape every time — a precise, technically nuanced
    // correct answer next to shorter-but-specific (not lazy-filler) wrong
    // claims. That asymmetry is inherent to explaining real, nuanced
    // Cloudflare behavior accurately and isn't a fixable "giveaway"; padding
    // distractors or trimming correct answers to chase a length ratio would
    // degrade content quality rather than improve it. Raised to 2.5x/60 to
    // keep this an occasional spot-check signal instead of routine noise —
    // see known-issues.md for the full review.
    if (correctLen > avgWrongLen * 2.5 && correctLen > 60) {
      issues.push({
        id: quiz.id,
        type: 'correct-too-long',
        message: `正解(${correctLen}文字)が不正解の平均(${Math.round(avgWrongLen)}文字)の2倍以上`,
      })
    }

    // Flag a short distractor only when the correct answer is notably
    // longer — that length contrast is the actual "giveaway" risk. Product
    // names, numeric limits, and operator symbols ("D1", "1,000件", "$ne")
    // are legitimately short whenever the correct answer is too, so
    // penalizing brevity on its own produced 10 false positives across
    // kv-001/kv-010/d1-002/pg-004/ar-001/ai-015 (2026-07-22 quality-loop
    // review — see known-issues.md).
    quiz.options.forEach((opt, i) => {
      if (i === ci) return
      if (opt.text.length < 8 && correctLen >= 15) {
        issues.push({
          id: quiz.id,
          type: 'distractor-too-short',
          message: `options[${i}] が短すぎる(${opt.text.length}文字, 正解は${correctLen}文字): "${opt.text}"`,
        })
      }
    })

    const correctHasBacktick = /`[^`]+`/.test(quiz.options[ci].text)
    const wrongsWithBacktick = wrongOpts.filter((o) => /`[^`]+`/.test(o.text))
    if (correctHasBacktick && wrongsWithBacktick.length === 0) {
      issues.push({
        id: quiz.id,
        type: 'format-giveaway',
        message: '正解のみバッククォート含有、不正解は全てプレーンテキスト',
      })
    }

    if (wrongLens.length >= 3) {
      const minWrong = Math.min(...wrongLens)
      const maxWrong = Math.max(...wrongLens)
      if (maxWrong > minWrong * 4 && maxWrong > 40) {
        issues.push({
          id: quiz.id,
          type: 'distractor-variance',
          message: `不正解間の長さ差が大きい(${minWrong}〜${maxWrong}文字)`,
        })
      }
    }
  }

  return issues
}

function printDistractorReport(issues) {
  if (issues.length === 0) {
    console.log('  No distractor issues found.')
    return
  }

  const byType = {}
  for (const issue of issues) {
    if (!byType[issue.type]) byType[issue.type] = []
    byType[issue.type].push(issue)
  }

  console.log(`  ${issues.length} distractor issues:\n`)
  for (const [type, typeIssues] of Object.entries(byType)) {
    console.log(`  [${type}] (${typeIssues.length})`)
    for (const issue of typeIssues) {
      console.log(`    ${issue.id}: ${issue.message}`)
    }
  }
}

// ============================================================
// 6. Difficulty Validation Lint
// ============================================================

const BEGINNER_SIGNALS = [
  /どのファイル(に|を|で|が)/,
  /^[^。]{0,30}何ですか/,
  /どれですか$/,
  /として正しいのはどれ/,
  /特徴として/,
  /最も(基本的な|適切な)/,
]

const ADVANCED_SIGNALS = [
  /ない(もの|こと)?は(どれ|どの)/, // NOT-type questions
  /以下.*すべて/, // "all of the following"
  /組み合わせ/, // combination
  /かつ.*場合/, // multi-condition
  /(\d+)つ.*条件/, // N conditions
]

function assessComplexity(quiz) {
  const q = quiz.question
  let score = 0

  if (q.length > 120) score += 1
  if (q.length > 200) score += 1
  if (q.length < 50) score -= 1

  if (/場合|状況|シナリオ/.test(q)) score += 1

  for (const p of BEGINNER_SIGNALS) {
    if (p.test(q)) {
      score -= 1
      break
    }
  }

  for (const p of ADVANCED_SIGNALS) {
    if (p.test(q)) {
      score += 1
      break
    }
  }

  const btCount = (q.match(/`[^`]+`/g) || []).length
  if (btCount >= 3) score += 1

  return score
}

function lintDifficulty(quizzes) {
  const issues = []
  const LEVEL_MAP = { beginner: 0, intermediate: 1, advanced: 2 }
  const LEVEL_NAMES = ['beginner', 'intermediate', 'advanced']

  for (const quiz of quizzes) {
    const score = assessComplexity(quiz)
    const labeled = quiz.difficulty
    const labeledLevel = LEVEL_MAP[labeled] ?? 1

    let expectedLevel
    if (score <= -1) expectedLevel = 0
    else if (score >= 2) expectedLevel = 2
    else expectedLevel = 1

    const gap = Math.abs(labeledLevel - expectedLevel)
    if (gap >= 2) {
      issues.push({
        id: quiz.id,
        type: 'difficulty-mismatch',
        labeled,
        expected: LEVEL_NAMES[expectedLevel],
        score,
        message: `difficulty="${labeled}" だが内容は "${LEVEL_NAMES[expectedLevel]}" レベル (score=${score})`,
        question: quiz.question.slice(0, 70),
      })
    }
  }

  return issues
}

function printDifficultyReport(issues) {
  if (issues.length === 0) {
    console.log('  No difficulty mismatches found.')
    return
  }

  console.log(`  ${issues.length} difficulty mismatches:\n`)
  for (const issue of issues) {
    console.log(`  ${issue.id} [${issue.labeled} → ${issue.expected}, score=${issue.score}]`)
    console.log(`    Q: ${issue.question}`)
  }
}

// ============================================================
// Output Formatting
// ============================================================

function printBacktickReport(fixes) {
  if (fixes.length === 0) {
    console.log('  No backtick issues found.')
    return
  }

  const byId = {}
  for (const fix of fixes) {
    if (!byId[fix.id]) byId[fix.id] = []
    byId[fix.id].push(fix)
  }

  console.log(`  ${fixes.length} fixes in ${Object.keys(byId).length} questions:\n`)

  for (const [id, idFixes] of Object.entries(byId)) {
    console.log(`  ${id}:`)
    for (const fix of idFixes) {
      const beforeSnip = fix.before.length > 80 ? fix.before.slice(0, 77) + '...' : fix.before
      const afterSnip = fix.after.length > 80 ? fix.after.slice(0, 77) + '...' : fix.after
      console.log(`    ${fix.field}:`)
      console.log(`      - ${beforeSnip}`)
      console.log(`      + ${afterSnip}`)
    }
  }
}

function printUrlReport(issues) {
  if (issues.length === 0) {
    console.log('  All referenceUrls are valid (or doc cache unavailable — see warning above).')
    return
  }

  console.log(`  ${issues.length} URL issues:\n`)
  for (const issue of issues) {
    console.log(`  ${issue.id}: [${issue.type}] ${issue.message}`)
    if (issue.suggestions) {
      console.log(`    Suggestions: ${issue.suggestions.map((s) => '#' + s).join(', ')}`)
    }
  }
}

function printTerminologyReport(issues) {
  if (issues.length === 0) {
    console.log('  No terminology issues found.')
    return
  }

  console.log(`  ${issues.length} terminology issues:\n`)
  for (const issue of issues) {
    console.log(`  ${issue.id} [${issue.field}]: ${issue.message}`)
  }
}

// ============================================================
// Main
// ============================================================

const args = process.argv.slice(2)
const command = args[0] || 'all'
const dryRun = args.includes('--dry-run')
const jsonMode = args.includes('--json')

if (!['backtick', 'url', 'terminology', 'quality', 'distractor', 'difficulty', 'all'].includes(command)) {
  console.log('Usage: node scripts/quiz-lint.mjs <command> [--dry-run] [--json]')
  console.log('Commands: backtick, url, terminology, quality, distractor, difficulty, all')
  process.exit(1)
}

const data = loadQuizzes()
let totalFixes = 0
let hasIssues = false

const jsonResults = {}

if (!jsonMode) console.log('=== Quiz Lint ===\n')

if (command === 'backtick' || command === 'all') {
  if (!jsonMode) console.log(`[Backtick] ${dryRun ? '(dry-run)' : '(auto-fix)'}`)
  const fixes = lintBackticks(data.quizzes, dryRun || jsonMode)
  if (!jsonMode) printBacktickReport(fixes)
  jsonResults.backtick = fixes.map((f) => ({
    id: f.id,
    field: f.field,
    status: dryRun || jsonMode ? 'flagged' : 'fixed',
  }))
  totalFixes += fixes.length
  if (fixes.length > 0) hasIssues = true
  if (!jsonMode) console.log()
}

if (command === 'url' || command === 'all') {
  if (!jsonMode) console.log('[URL Anchors]')
  const urlIssues = lintUrls(data.quizzes)
  if (!jsonMode) printUrlReport(urlIssues)
  jsonResults.url = urlIssues.map((i) => ({ id: i.id, type: i.type, status: 'flagged', detail: i.message }))
  if (urlIssues.length > 0) hasIssues = true
  if (!jsonMode) console.log()
}

if (command === 'terminology' || command === 'all') {
  if (!jsonMode) console.log('[Terminology]')
  const termIssues = lintTerminology(data.quizzes)
  if (!jsonMode) printTerminologyReport(termIssues)
  jsonResults.terminology = termIssues.map((i) => ({
    id: i.id,
    field: i.field,
    type: i.type,
    status: 'flagged',
    detail: i.message,
  }))
  if (termIssues.length > 0) hasIssues = true
  if (!jsonMode) console.log()
}

if (command === 'quality' || command === 'all') {
  if (!jsonMode) console.log('[Quality]')
  const qualityIssues = lintQuality(data.quizzes)
  if (!jsonMode) printQualityReport(qualityIssues)
  jsonResults.quality = qualityIssues.map((i) => ({ id: i.id, type: i.type, status: 'flagged', detail: i.message }))
  if (qualityIssues.length > 0) hasIssues = true
  if (!jsonMode) console.log()
}

if (command === 'distractor' || command === 'all') {
  if (!jsonMode) console.log('[Distractor]')
  const distractorIssues = lintDistractors(data.quizzes)
  if (!jsonMode) printDistractorReport(distractorIssues)
  jsonResults.distractor = distractorIssues.map((i) => ({
    id: i.id,
    type: i.type,
    status: 'flagged',
    detail: i.message,
  }))
  if (distractorIssues.length > 0) hasIssues = true
  if (!jsonMode) console.log()
}

if (command === 'difficulty' || command === 'all') {
  if (!jsonMode) console.log('[Difficulty]')
  const difficultyIssues = lintDifficulty(data.quizzes)
  if (!jsonMode) printDifficultyReport(difficultyIssues)
  jsonResults.difficulty = difficultyIssues.map((i) => ({
    id: i.id,
    type: i.type,
    status: 'flagged',
    detail: i.message,
  }))
  if (difficultyIssues.length > 0) hasIssues = true
  if (!jsonMode) console.log()
}

if (jsonMode) {
  console.log(JSON.stringify(jsonResults))
  process.exit(0)
}

if (totalFixes > 0 && !dryRun && (command === 'backtick' || command === 'all')) {
  saveQuizzes(data)
  console.log(`Saved ${totalFixes} backtick fixes to quizzes.json`)
}

console.log('=== Summary ===')
if (hasIssues) {
  console.log(
    `Issues found (advisory — review manually). ${dryRun ? 'Run without --dry-run to auto-fix backticks.' : ''}`
  )
} else {
  console.log('All checks passed.')
}
