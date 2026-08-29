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
  ANCHOR_HEADING_TAG_SOURCE,
  BACKTICK_TERMS,
  DOC_URL_PREFIX,
  filenameToDocPage,
  HISTORICAL_MARKERS,
  NEGATION_MARKERS,
  TERMINOLOGY_DICT,
  VERIFIED_LIVE_ANCHORS,
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

    // Same rationale, for `<AnchorHeading ... slug="X" />` components (see
    // ANCHOR_HEADING_TAG_SOURCE) — the slug is already a valid anchor as-is,
    // no further slugify() needed.
    const anchorHeadingRegex = new RegExp(ANCHOR_HEADING_TAG_SOURCE, 'g')
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
    while ((match = anchorHeadingRegex.exec(content)) !== null) {
      headingAnchors.add(match[1])
    }

    // When Cloudflare renames a heading they often leave the previous anchor
    // behind as an explicit HTML target (`<span id="old-name"></span>` or
    // `<a id="old-name" />`) so existing deep links keep working. Those ids
    // are real anchors on the live page but are invisible to the `#` heading
    // scan above, so collect them too — otherwise every intentionally
    // preserved compat anchor reads as a broken link.
    const explicitIdRegex = /<(?:span|a|div)\s[^>]*\bid=["']([^"']+)["']/g
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
    while ((match = explicitIdRegex.exec(content)) !== null) {
      headingAnchors.add(match[1])
    }

    // Some pages generate all headings at build time (no markdown or
    // component source to extract from) — merge in anchors that were
    // manually verified against the live page HTML. See
    // VERIFIED_LIVE_ANCHORS in topic-config.mjs.
    for (const anchor of VERIFIED_LIVE_ANCHORS[page] ?? []) {
      headingAnchors.add(anchor)
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
          if (HISTORICAL_MARKERS.test(field.value)) {
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

/**
 * QuizText が解釈するのは改行と `code` だけで、Markdown は素通しする。
 * 本文に `**強調**` を書くとアスタリスクがそのまま画面に出る。
 *
 * 2026-08-27 に reviewer ペルソナが ag-016 で実際に発見した（4層に混入）。
 * ドキュメントの文面を引き写すときに紛れ込みやすい。強調は「」で書く。
 */
const RAW_MARKDOWN_PATTERNS = [
  { re: /\*\*[^*]+\*\*/, what: '**強調**（「」を使う）' },
  { re: /(?:^|\s)__[^_]+__(?:\s|$)/, what: '__強調__（「」を使う）' },
  { re: /\[[^\]]+\]\([^)]+\)/, what: '[表示文字](URL) 形式のリンク' },
  { re: /^#{1,6}\s/m, what: '# 見出し' },
]

/**
 * 選択肢が「これは誤解だ」と自分で名乗ってしまうのを検出する。
 *
 * 誤答を厚くする作業（2026-08-27）で、エージェントが
 * 「`$in` なら配列指定で値以外も除外できると**誤解しやすい**」のように
 * 自己申告を足して長さを稼いだ。141肢中47肢がこの形になっていた。
 * こう書かれた選択肢は読んだ瞬間に誤答と分かり、4択が成立しない。
 *
 * 原因は手順書の「なぜそう思ってしまうのか（もっともらしい理由づけ）」という
 * 言い回しで、**信念について語れ**と読まれた。誤答は
 * **学習者が信じうる主張として、正解と同じ語り口で**書かれなければならない。
 */
const SELF_LABELING =
  /誤解(され)?(が|し)?(ちで|やすい|がち)|勘違い|思われがち|考えられがち|誤認されがち|と誤って|誤りである|間違いである|と(考え|解釈し|みなし|想定し|読ん|思っ|捉え)た場合|と考える。?$|と考える[」）)]/

function lintSelfLabeling(quiz) {
  const issues = []
  quiz.options.forEach((opt, i) => {
    const m = opt.text.match(SELF_LABELING)
    if (m) {
      issues.push({
        id: quiz.id,
        type: 'option-self-labeling',
        field: `options[${i}].text`,
        value: opt.text.slice(0, 50),
        message: `選択肢が「${m[0]}」と自分で誤りだと名乗っている — 読んだ瞬間に外せるので4択が成立しない`,
      })
    }
  })
  return issues
}

/**
 * 誤答どうしだけが同じ言い回しで終わっているのを検出する。
 *
 * 「2つの選択肢が同じことを言っているなら、正解は1つなのでどちらも誤り」
 * は古典的な消去法。正解も同じ形で終わっている場合（並列構造の設問）は正常で、
 * **誤答2つだけが揃っている**ときに限って手がかりになる。
 *
 * 2026-08-27 の長さ一様化で、書き手のエージェント自身が
 * dn-006[2] を書きながらこれに気づいて言い回しを変えた。
 * 誤答を厚くする作業は語尾を揃えやすいので、機械でも見る。
 *
 * ただし**挙がったものの多くは正常**だった。初回の7件を精査した結果:
 *   - `ar-012`（値と鍵のサイズの組み合わせ）のように、設問が本来
 *     並列の値を並べる形なら語尾が揃うのは当然
 *   - `cs-003` / `as-016` / `em-014` のように、2つの誤答が
 *     **鏡写し**（「AだけがX」「BだけがX」）で正解が「両方」という設計も定石
 * 実際に直すべきなのは「厚くする過程で**新しく**語尾が揃ってしまった」場合。
 * この検査は差分を見ないのでそこまでは区別できない。挙がったら判断すること。
 *
 * **判断した結果は下の REVIEWED に書き戻すこと。** 2026-08-28 に、
 * 挙がっていた5件のうち2件（`dq-002` `wa-014`）が実際に長さ一様化で作った
 * giveaway だったのに、残り3件が正常だったせいで**5件まとめて**
 * 「事前からある advisory」と切り捨てて見落とした。
 * 正常と判断したものを消し込まないと、毎回同じ数だけ並び、
 * 新しく増えた1件が古い正常3件に埋もれる。
 */
const TAIL_LEN = 12

/**
 * 精査して「正常」と判断済みの組。語尾ごと記録してあるので、
 * 本文が書き換わって別の語尾で揃った場合は**再び挙がる**。
 */
const REVIEWED_PARALLEL_TAILS = [
  { id: 'ar-012', tail: ': 1024 bytes', why: '設問が値と鍵のサイズの組み合わせを並べる形。単位で揃うのは当然' },
  { id: 'dl-012', tail: 'することが推奨されている', why: '「どう設定するのが推奨か」を問う設問。推奨形で揃うのは当然' },
  { id: 'em-014', tail: 'ションを一切利用できない', why: 'Google/Microsoft の鏡写しで正解が「どちらも使える」。定石' },
]

function lintParallelDistractorTails(quiz) {
  if (quiz.type === 'multi') return []
  const tails = quiz.options.map((o) => o.text.slice(-TAIL_LEN))
  const correctTail = tails[quiz.correctIndex]
  const issues = []
  for (let i = 0; i < tails.length; i++) {
    for (let j = i + 1; j < tails.length; j++) {
      if (i === quiz.correctIndex || j === quiz.correctIndex) continue
      if (tails[i] !== tails[j] || tails[i] === correctTail) continue
      if (REVIEWED_PARALLEL_TAILS.some((r) => r.id === quiz.id && r.tail === tails[i])) continue
      issues.push({
        id: quiz.id,
        type: 'parallel-distractor-tails',
        field: `options[${i}].text / options[${j}].text`,
        value: tails[i],
        message: `誤答${i}と誤答${j}だけが「${tails[i]}」で終わっている — 厚くする過程で揃えてしまった場合のみ要修正（鏡写しの誤答や値の並列は正常）`,
      })
    }
  }
  return issues
}

/**
 * ヒントが答えそのものを述べていないかを見る。
 *
 * ヒントは「どう考えるか」を示すもので、「何が答えか」を述べたら
 * 設問が成立しない。2026-08-29 に初めて機械で見たところ2件見つかった:
 *
 * ```
 * at-006  設問「validateStateChange() の用途は？」
 *         ヒント「「保存される前」に実行され、throwすると更新そのものを止められます。」
 *         → 正解肢「永続化・ブロードキャストの前に同期実行され、throwで拒否できる」
 *           ヒントを読むだけで、知識なしに正解を選べる
 * at-007  ヒント「テンプレートリテラルの`${}`部分は自動的にプレースホルダとしてバインドされます。」
 *         → 正解肢の内容そのもの。しかも誤答3「文字列連結を使う必要がある」を直接否定している
 * ```
 *
 * ### 検出規則を絞った経緯（素朴にやると使えない）
 *
 * 「ヒントに正解だけの語が出る」だけでは **23件**挙がり、大半が正常だった。
 * ヒントが正解の論点に触れるのは**当然**だからだ
 * （`ar-002` の「CPUを使い切っている処理」など）。そこで2つ足した:
 *
 * 1. **問いかけで終わるヒントは除く。** `ましょう` `ください` `でしょうか`
 *    `注目です` `ポイントです` は読み手に判断を委ねている
 * 2. **対比を示すヒントは除く。** 「AとBは別物です」「違いを意識」は
 *    論点の軸を示しているだけで、どちらが答えかを述べていない
 *
 * 23件 → 2件になり、その2件が実際の欠陥だった。
 * ただし**この2件で調整した規則**なので、正常なヒントを挙げることは今後ありうる。
 * その場合は REVIEWED_HINTS に理由つきで記録すること（空振り検知テスト付き）。
 */
const HINT_TOKEN = /`[^`]+`|\b[A-Za-z][A-Za-z0-9._-]{2,}\b|\b(?:D1|R2|KV|DO|AI)\b/g
/** 読み手に判断を委ねる形 */
const HINT_ASKS = /ましょう|ください|でしょうか|注目です|ポイントです/
/** 「どちらが答えか」ではなく「論点の軸」を示している形 */
const HINT_CONTRASTS = /別物|別の話|違い|区別|対照|分かれます|どちら/

/** 精査して「正常」と判断済みのヒント。本文が変われば再び挙がる */
const REVIEWED_HINTS = []

function hintTokens(text) {
  return new Set((text ?? '').match(HINT_TOKEN)?.map((t) => t.replace(/`/g, '')) ?? [])
}

function lintHintGiveaway(quiz) {
  if (!quiz.hint || quiz.type === 'multi') return []
  if (HINT_ASKS.test(quiz.hint) || HINT_CONTRASTS.test(quiz.hint)) return []

  const inHint = hintTokens(quiz.hint)
  if (!inHint.size) return []
  const correct = hintTokens(quiz.options[quiz.correctIndex].text)
  const question = hintTokens(quiz.question)
  const others = new Set()
  quiz.options.forEach((o, i) => {
    if (i === quiz.correctIndex) return
    for (const t of hintTokens(o.text)) others.add(t)
  })
  // 設問にも他の肢にも無く、正解にだけある語をヒントが名指ししている
  const leaked = [...inHint].filter((t) => correct.has(t) && !question.has(t) && !others.has(t))
  if (!leaked.length) return []
  if (REVIEWED_HINTS.some((r) => r.id === quiz.id && r.hint === quiz.hint)) return []

  return [
    {
      id: quiz.id,
      type: 'hint-gives-away-answer',
      field: 'hint',
      value: leaked.join(' '),
      message:
        `ヒントが正解にしか無い「${leaked.join(' ')}」を断定の形で述べている — ` +
        `ヒントは「どう考えるか」を示すもので、「何が答えか」を述べたら設問が成立しない`,
    },
  ]
}

function lintRawMarkdown(quiz) {
  const layers = { question: quiz.question, hint: quiz.hint, explanation: quiz.explanation }
  quiz.options.forEach((o, i) => {
    layers[`options[${i}].text`] = o.text
    if (o.wrongFeedback) layers[`options[${i}].wrongFeedback`] = o.wrongFeedback
  })

  const issues = []
  for (const [field, text] of Object.entries(layers)) {
    if (typeof text !== 'string') continue
    for (const { re, what } of RAW_MARKDOWN_PATTERNS) {
      if (re.test(text)) {
        issues.push({
          id: quiz.id,
          type: 'raw-markdown',
          field,
          value: text.match(re)?.[0]?.slice(0, 40) ?? '',
          message: `${what} がそのまま画面に出る — QuizText は改行と \`code\` しか解釈しない`,
        })
        break
      }
    }
  }
  return issues
}

function lintQuality(quizzes) {
  const issues = []

  for (const quiz of quizzes) {
    issues.push(...lintRawMarkdown(quiz))
    issues.push(...lintSelfLabeling(quiz))
    issues.push(...lintParallelDistractorTails(quiz))
    issues.push(...lintHintGiveaway(quiz))
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

/**
 * 「一番長い選択肢を選ぶ」戦略の正答率を見る、コーパス全体のゲート。
 *
 * これは1問ずつ見ても分からない、分布そのものの性質である。
 * 実際 2026-08-26 に correct-longest-by-margin（差の大きさ）だけを見て
 * 367問を是正し検査をゼロにしたが、この割合は 85.7% → 85.2% と
 * ほとんど動いていなかった。差の露骨さは消えても、方向が残っていれば
 * 「長い方を選ぶ」は変わらず当たる。マージンだけを見る検査では
 * ここを取りこぼす。
 *
 * 偶然なら約25%（4択）。許容は 15%〜40% の**両側**とする。
 *
 * 下限がある理由: 反転させすぎると今度は「最長の選択肢は誤答」が手がかりになる。
 * 例えば 10% まで下げると、最長を避けて残り3つから選ぶだけで 33% 当たり、
 * 当てずっぽう（25%）より有利になってしまう。手がかりを消すのが目的であって、
 * 逆向きの手がかりを作るのが目的ではない。
 */
const LONGEST_IS_CORRECT_MAX = 0.4
const LONGEST_IS_CORRECT_MIN = 0.15

/**
 * 【2026-08-27 追加】rank0 だけを見るのは、またしても指標が狭すぎた。
 *
 * 2026-08-26 の反転作業で rank0（正解が最長）は 84.0% → 28.6% まで落ちたが、
 * **正解が「長い方の半分」に入る割合は 95.5% のまま1ポイントも動かなかった**。
 * 誤答を1つだけ正解より長くしたので、正解が1位から2位へ移っただけで、
 * 下位2つ（rank2/rank3）は 2.1% / 2.4% と作業前から変化なし。
 *
 *   cf98392（反転前） rank0=84.0% rank1=11.5% rank2=2.1% rank3=2.4%  top-half=95.5%
 *   0b75eec（反転後） rank0=28.6% rank1=66.9% rank2=2.1% rank3=2.4%  top-half=95.5%
 *
 * 受験者から見れば「長い方の2つに絞る」だけで 95.5%（偶然なら50%）— 4択が2択になる。
 * rank0 だけを合格判定にすると、この状態が「目標帯に着地」と表示されてしまう。
 * 分布そのものを見る。
 */
const CORRECT_IN_LONGER_HALF_MAX = 0.7
// 下限も要る。行き過ぎると今度は「短い方の2つに絞る」が手がかりになる。
// 反転作業では rank0 の下限を置き忘れかけたので、こちらは最初から両側で見る。
const CORRECT_IN_LONGER_HALF_MIN = 0.3

/** 選択肢を長さの降順に並べたときの正解の順位（0 = 最長） */
function correctLengthRank(quiz) {
  const lens = quiz.options.map((o) => o.text.length)
  return lens
    .map((l, i) => ({ l, i }))
    .sort((a, b) => b.l - a.l)
    .findIndex((x) => x.i === quiz.correctIndex)
}

function lintLengthCue(quizzes) {
  const singles = quizzes.filter((q) => q.type !== 'multi')
  const n = singles.length
  const rankCounts = []
  let longerHalf = 0
  for (const quiz of singles) {
    const rank = correctLengthRank(quiz)
    rankCounts[rank] = (rankCounts[rank] ?? 0) + 1
    if (rank < quiz.options.length / 2) longerHalf++
  }
  const longest = rankCounts[0] ?? 0
  const rate = longest / n
  const halfRate = longerHalf / n
  const shown = `${(rate * 100).toFixed(1)}% (${longest}/${n})`
  const band = `偶然なら約25%、許容は${LONGEST_IS_CORRECT_MIN * 100}%〜${LONGEST_IS_CORRECT_MAX * 100}%`
  const dist = rankCounts.map((c, i) => `rank${i}=${(((c ?? 0) / n) * 100).toFixed(1)}%`).join(' ')

  const issues = []
  if (rate > LONGEST_IS_CORRECT_MAX) {
    issues.push({
      id: '(corpus)',
      type: 'longest-option-is-correct',
      message: `正解が最長の選択肢である割合が ${shown} — 「一番長い選択肢を選ぶ」だけでこの割合の問題に正解できる。${band}`,
    })
  } else if (rate < LONGEST_IS_CORRECT_MIN) {
    issues.push({
      id: '(corpus)',
      type: 'longest-option-is-wrong',
      message: `正解が最長の選択肢である割合が ${shown} と低すぎる — 「最長を避けて残りから選ぶ」が当てずっぽうより有利になり、逆向きの手がかりになる。${band}`,
    })
  }

  const halfShown = `${(halfRate * 100).toFixed(1)}% (${longerHalf}/${n})`
  const halfBand =
    `偶然なら50%、許容は${CORRECT_IN_LONGER_HALF_MIN * 100}%〜${CORRECT_IN_LONGER_HALF_MAX * 100}%。` +
    `長さ順位の分布: ${dist}（一様なら各25%）`
  if (halfRate > CORRECT_IN_LONGER_HALF_MAX) {
    issues.push({
      id: '(corpus)',
      type: 'correct-in-longer-half',
      message: `正解が「長い方の半分」に入る割合が ${halfShown} — 「長い方の2つに絞る」だけで4択が2択になる。${halfBand}`,
    })
  } else if (halfRate < CORRECT_IN_LONGER_HALF_MIN) {
    issues.push({
      id: '(corpus)',
      type: 'correct-in-shorter-half',
      message: `正解が「長い方の半分」に入る割合が ${halfShown} と低すぎる — 今度は「短い方の2つに絞る」が手がかりになる。${halfBand}`,
    })
  }
  return issues
}

/**
 * 絶対語（一切・必ず・常に…）が誤答に偏ることで生まれる手がかりを測る。
 *
 * 長さバイアスと同じ「内容を読まずに当てられるか」の指標だが、**性質が違う**。
 * 長さの水増しは真偽に中立なので一様まで潰せた。絶対語はそうではない:
 * 誤答は「正しい記述を過度に一般化して偽にする」のが定石なので、
 * 誤答に絶対語が多いこと自体が**書き方として正常**であり、
 * 弱めると誤答が真になる（H1）。逆に正解へ絶対語を足すのは、
 * docs がその絶対性を支持している場合しかできない。
 * **一様化は原理的に届かない。**
 *
 * 実測（2026-08-28）:
 *   セッション開始時 32.6% / 長さ一様化の直前 32.6% / 一様化後 33.4%（偶然 25.0%）
 *
 * つまり +7.6pt は元から在った構造的な残差で、長さ一様化が足したのは +0.8pt。
 * 長さバイアス（+59pt）とは桁が違う。**目標は0ではなく、悪化させないこと。**
 *
 * 一文の中で同じ絶対語を繰り返す形（「一切影響しない…一切ない」）だけは
 * 真偽を変えずに直せる水増しなので、見つけたら直すこと。
 * ただし `wa-004` の「Passthroughは常に拒否し、Rejectは常に素通り」のような
 * 鏡写しや、`ch-005` の3モード列挙は並列構造として正常。
 */
const ABSOLUTE_WORDS = /一切|必ず|常に|すべて|全て|全く|決して|唯一|いかなる|絶対に|例外なく|一つも/g
// 「のみ」は「Enterprise限定」のような正確な限定表現に多用され、
// 入れると該当が64問へ膨らんで大半が誤検出になる。意図的に外している。

const ABSOLUTE_TELL_MAX = 0.38

function lintAbsoluteWordTell(quizzes) {
  const singles = quizzes.filter((q) => q.type !== 'multi')
  let expected = 0
  for (const quiz of singles) {
    const counts = quiz.options.map((o) => (o.text.match(ABSOLUTE_WORDS) ?? []).length)
    const min = Math.min(...counts)
    // 「絶対語が最も少ない肢を選ぶ」戦略。同数なら等確率で当たるとみなす
    if (counts[quiz.correctIndex] === min) expected += 1 / counts.filter((c) => c === min).length
  }
  const rate = expected / singles.length
  if (rate <= ABSOLUTE_TELL_MAX) return []
  return [
    {
      id: '(corpus)',
      type: 'absolute-word-tell',
      message:
        `「絶対語が最も少ない選択肢を選ぶ」だけで期待正答率が ${(rate * 100).toFixed(1)}% になる ` +
        `— 偶然は25%、許容上限は${ABSOLUTE_TELL_MAX * 100}%。誤答から絶対語を削ると真になりやすい(H1)ので、` +
        `直すなら「正解側に docs が支持する絶対性を書く」か「一文内で重ねた絶対語を1つに減らす」で。`,
    },
  ]
}

function lintDistractors(quizzes) {
  const issues = [...lintLengthCue(quizzes), ...lintAbsoluteWordTell(quizzes)]

  for (const quiz of quizzes) {
    if (quiz.type === 'multi') continue
    const ci = quiz.correctIndex

    const correctLen = quiz.options[ci].text.length
    const wrongOpts = quiz.options.filter((_, i) => i !== ci)
    const wrongLens = wrongOpts.map((o) => o.text.length)

    // 【2026-07-22 の判断を 2026-08-26 に改訂】
    // 旧実装は「正解 vs 不正解の“平均”」を 2.5倍/60字 で見ており、756問中17問しか
    // 挙がらなかった。そのため「この非対称は正確さの代償で修正不能」と結論していた。
    //
    // しかし平均との比較は、悪用のしやすさを測る指標として間違っている。
    // 受験者は平均と比べない——**一番長いものを選ぶ**。2位の選択肢と比べ直すと:
    //   正解が単独最長          636/756 (84.1%)   ※偶然なら約25%
    //   2位より50%以上長い      367/756 (48.5%)   ← 見ただけで分かる
    // 模擬ユーザー(busy-intermediate)も「内容を知らなくても文体だけで正解できた」と
    // 5問中3問で報告しており、実際に悪用可能であることが裏付けられた。
    //
    // また「不正解の水増しは質を下げる」という前提も、実例を見ると強すぎた。
    // 実際には (1)正解にだけ付いた補足の丸括弧を解説へ移す、
    // (2)正解が4項目の列挙で不正解が「〜のみ」の2項目 → 不正解も同じ形にする、
    // といった、内容を薄めずに差を消せる型が多い。
    const secondLongest = Math.max(...wrongLens)
    const margin = (correctLen - secondLongest) / secondLongest
    if (margin >= 0.5) {
      issues.push({
        id: quiz.id,
        type: 'correct-longest-by-margin',
        message: `正解(${correctLen}文字)が2番目に長い選択肢(${secondLongest}文字)より${Math.round(margin * 100)}%長い — 文体だけで選べてしまう`,
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

/**
 * 精査して「ラベルのほうが正しい」と判断済みの設問。
 *
 * assessComplexity() は**設問文の言い回ししか見ない**。文の長さ、
 * 「場合」「シナリオ」の有無、バッククォートの数で採点しているので、
 * 「Cloudflareの Cache Reserve について正しい説明はどれですか？」のような
 * 短く平易に書かれた設問は、扱っている概念がどれだけ高度でも beginner に落ちる。
 * **話題の難しさは測っていない。**
 *
 * このコーパスの difficulty は話題基準で付いている（定義想起型23問は
 * beginner 4 / intermediate 11 / advanced 8 に散らばっており、
 * 設問の形ではなく扱う機能の高度さで分かれている）。
 * したがってこの型の食い違いは構造的に出続ける。
 *
 * ラベル込みで記録してあるので、**難易度を付け替えれば再び挙がる**。
 *
 * 2026-08-28: parallel-distractor-tails で「正常3件に紛れて実害2件を
 * まとめて切り捨てる」をやったので、こちらも同じ形で消し込む。
 */
const REVIEWED_DIFFICULTY = [
  { id: 'dq-011', labeled: 'advanced', why: 'idFromName と newUniqueId の使い分けは DO の設計判断そのもの' },
  { id: 'dq-012', labeled: 'advanced', why: 'バッチ内 ack の再配信セマンティクスは Queues の上級論点' },
  { id: 'kv-017', labeled: 'advanced', why: 'Tiered Cache は階層構成を理解していないと答えられない' },
  { id: 'kv-018', labeled: 'advanced', why: 'Cache Reserve は R2 上の永続層という実装まで問うている' },
]

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
      if (REVIEWED_DIFFICULTY.some((r) => r.id === quiz.id && r.labeled === labeled)) continue
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
