#!/usr/bin/env node

/**
 * Cloudflare Docs Fetcher
 *
 * developers.cloudflare.com の各ページの Markdown ソースを、公開されている
 * cloudflare/cloudflare-docs リポジトリ（GitHub, production ブランチ）から
 * 取得してローカルにキャッシュする。quiz-lint.mjs の url チェック（見出しアンカー
 * 検証）と quiz-fact-check.mjs の用語照合が、このキャッシュを参照する。
 *
 * ネットワークアクセスが必要なため CI では実行しない。開発者がローカルで
 * 手動実行し、キャッシュ（.claude/tmp/docs、gitignore 済み）を更新する想定。
 *
 * Usage:
 *   node scripts/fetch-docs.mjs              # DOC_PAGES 全ページ取得
 *   node scripts/fetch-docs.mjs --status     # キャッシュ状態を表示（取得はしない）
 *   node scripts/fetch-docs.mjs workers d1   # 指定ページのみ取得（name で指定）
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { DOC_PAGE_OVERRIDES, DOC_PAGES, docPageToFilename, WRANGLER_COMMAND_TAG_SOURCE } from './topic-config.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS_DIR = resolve(ROOT, '.claude/tmp/docs')
const CONTENT_BASE = 'https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content'
const MAX_AGE_HOURS = 24 * 14 // 2 weeks

/**
 * The docs repo is inconsistent about whether a page is a directory index
 * (`<path>/index.mdx`) or a leaf file (`<path>.mdx`) — try both. A page
 * listed in DOC_PAGE_OVERRIDES fetches its explicit content-relative path
 * instead (see topic-config.mjs for why: some docs/ pages are navigation
 * stubs whose real text lives under src/content/partials/).
 */
async function fetchMarkdown(name) {
  const override = DOC_PAGE_OVERRIDES[name]
  // override は「優先」であって「排他」ではない。上流がパーシャルを移動すると
  // override 先が 404 になり、そのページだけ取得が恒常的に失敗して
  // キャッシュが古い内容のまま凍りつく（実際に18件中11件がこの状態だった。
  // しかも --status では [OK] に見えるため気づけない）。通常パスへ落ちるようにして
  // 自己修復させる。<Render> 展開が入った今、多くの override は本来不要でもある。
  const defaults = [`${CONTENT_BASE}/docs/${name}/index.mdx`, `${CONTENT_BASE}/docs/${name}.mdx`]
  const candidates = override ? [`${CONTENT_BASE}/${override}`, ...defaults] : defaults
  for (const url of candidates) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const raw = normalizeWranglerComponents(await res.text())
        return await expandPartials(raw, name.split('/')[0])
      }
    } catch {
      // try next candidate
    }
  }
  return null
}

/**
 * `<Render file="..." product="..." />` を実体に展開する。
 *
 * docs は本文のかなりの部分を src/content/partials/ に切り出しており、
 * `.mdx` ソースをそのまま保存すると、その部分がタグのままキャッシュされる。
 * するとキャッシュを grep した検証は「その記述は docs に存在しない」と
 * 誤って結論しうる（実測で 535ページ中187ページ・756問中265問が該当した）。
 * 「参照先を確認したが無かった」と「そもそも見えていなかった」は
 * 区別できないので、取得時に展開して穴を無くす。
 *
 * DOC_PAGE_OVERRIDES はこの問題をページ単位で回避してきた仕組みで、
 * 展開が入っても引き続き有効（ナビゲーションスタブ対策として別の役割を持つ）。
 */
const PARTIAL_CACHE = new Map()
const RENDER_TAG = /<Render\s+file="([^"]+)"(?:\s+product="([^"]+)")?[^>]*\/>/g
const MAX_PARTIAL_DEPTH = 3

async function fetchPartial(product, file) {
  const key = `${product}/${file}`
  if (PARTIAL_CACHE.has(key)) return PARTIAL_CACHE.get(key)
  let text = null
  try {
    const res = await fetch(`${CONTENT_BASE}/partials/${key}.mdx`)
    if (res.ok) text = await res.text()
  } catch {
    // 取得できないパーシャルはタグのまま残す（黙って消さない）
  }
  PARTIAL_CACHE.set(key, text)
  return text
}

/** パーシャル冒頭の frontmatter と import 行を落とす（本文だけを埋め込む） */
function partialBody(text) {
  return text
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/^import\s+\{[^}]*\}\s+from\s+["'][^"']*["'];?\s*$/gm, '')
    .trim()
}

async function expandPartials(markdown, fallbackProduct, depth = 0, seen = new Set()) {
  if (depth >= MAX_PARTIAL_DEPTH) return markdown
  const tags = [...markdown.matchAll(RENDER_TAG)]
  if (tags.length === 0) return markdown

  let out = markdown
  for (const [raw, file, product] of tags) {
    const prod = product ?? fallbackProduct
    if (!prod) continue
    const key = `${prod}/${file}`
    if (seen.has(key)) continue // 自己参照・循環でも止まるようにする
    const body = await fetchPartial(prod, file)
    if (body == null) continue
    const expanded = await expandPartials(partialBody(body), prod, depth + 1, new Set([...seen, key]))
    // 置換文字列の `$&` などが特殊解釈されないよう関数形式で渡す
    out = out.replace(raw, () => expanded)
  }
  return out
}

/**
 * Cloudflare's docs render CLI command references via custom MDX components
 * (`<WranglerCommand command="r2 bucket create" />`) rather than literal
 * text, so a plain substring search for "wrangler r2 bucket create" never
 * matches even though the command is fully documented. Insert a plain-text
 * line after each component tag so quiz-lint's anchor extraction and
 * quiz-fact-check's term search can find it like any other doc content.
 */
function normalizeWranglerComponents(markdown) {
  const pattern = new RegExp(`${WRANGLER_COMMAND_TAG_SOURCE}[^>]*\\/?>`, 'g')
  return markdown.replace(pattern, (tag, command) => `${tag}\n\nwrangler ${command}\n`)
}

async function fetchAll(filterNames) {
  mkdirSync(DOCS_DIR, { recursive: true })
  const targets =
    filterNames && filterNames.length > 0 ? DOC_PAGES.filter((p) => filterNames.includes(p.name)) : DOC_PAGES

  if (filterNames && filterNames.length > 0 && targets.length === 0) {
    console.error(`No matching pages for: ${filterNames.join(', ')}`)
    console.error(`Available names: ${DOC_PAGES.map((p) => p.name).join(', ')}`)
    process.exit(1)
  }

  let ok = 0
  let fail = 0
  const failed = []

  for (const page of targets) {
    const md = await fetchMarkdown(page.name)
    if (md) {
      writeFileSync(resolve(DOCS_DIR, docPageToFilename(page.name)), md)
      console.log(`  [OK]   ${page.name}`)
      ok++
    } else {
      console.log(`  [FAIL] ${page.name}`)
      failed.push(page.name)
      fail++
    }
  }

  console.log(`\n${ok} fetched, ${fail} failed (of ${targets.length})`)
  if (failed.length > 0) {
    console.log(`Failed pages (check the path in topic-config.mjs DOC_PAGES): ${failed.join(', ')}`)
  }
}

function status() {
  console.log(`Cache dir: ${DOCS_DIR}`)

  if (!existsSync(DOCS_DIR)) {
    console.log('Cache not initialized. Run `npm run docs:fetch`.')
    return
  }

  const cachedFiles = new Set(readdirSync(DOCS_DIR).filter((f) => f.endsWith('.md')))
  let missing = 0
  let expired = 0
  let ok = 0

  for (const page of DOC_PAGES) {
    const filename = docPageToFilename(page.name)
    if (!cachedFiles.has(filename)) {
      console.log(`  [MISSING] ${page.name}`)
      missing++
      continue
    }
    const filePath = resolve(DOCS_DIR, filename)
    const stat = statSync(filePath)
    const ageHours = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60)
    const sizeKB = (stat.size / 1024).toFixed(1)
    if (stat.size < 100) {
      console.log(`  [EMPTY]   ${page.name} -- ${sizeKB}KB (likely a failed fetch, refetch needed)`)
      expired++
    } else if (ageHours > MAX_AGE_HOURS) {
      console.log(`  [EXPIRED] ${page.name} -- ${sizeKB}KB, ${(ageHours / 24).toFixed(1)}d ago`)
      expired++
    } else {
      ok++
    }
  }

  console.log(`\n${ok} OK, ${expired} expired/empty, ${missing} missing (of ${DOC_PAGES.length})`)
  reportUnexpandedPartials(cachedFiles)
}

/**
 * 展開されずに残った `<Render>` を報告する。
 *
 * ここを黙って通すと、キャッシュを grep した検証が「記述が無い」と誤判定し、
 * 正しいクイズを「ドリフト」として書き換えてしまう。見えていない範囲は
 * 見えていないと明示する。
 */
function reportUnexpandedPartials(cachedFiles) {
  const affected = []
  for (const filename of cachedFiles) {
    const text = readFileSync(resolve(DOCS_DIR, filename), 'utf8')
    const count = (text.match(RENDER_TAG) ?? []).length
    if (count > 0) affected.push({ filename, count })
  }
  if (affected.length === 0) {
    console.log('\nUnexpanded partials: none (全ページの本文が grep 可能)')
    return
  }
  const total = affected.reduce((n, a) => n + a.count, 0)
  console.log(`\n⚠️  Unexpanded <Render> partials: ${affected.length} pages, ${total} occurrences`)
  console.log('   これらのページは本文の一部がキャッシュに入っていない。')
  console.log('   該当ページを referenceUrl にする問題の「記述なし」判定は信用しないこと。')
  for (const a of affected.slice(0, 10)) {
    console.log(`   - ${a.filename} (${a.count})`)
  }
  if (affected.length > 10) console.log(`   ... and ${affected.length - 10} more`)
  reportUnexpandedNamespaces(cachedFiles)
}

/**
 * `<WranglerNamespace namespace="d1" />` の未展開を報告する。
 *
 * これは `<Render>` とは別の盲点で、サブコマンド一覧が Wrangler 自身の
 * CLI スキーマからビルド時に生成されるため、ソースにテキストが存在しない。
 * 取りに行っても実体が無いので展開できない——`<Render>` と違い
 * 「取得漏れ」ではなく「原理的に不在」である。
 *
 * 2026-08-26 に d1-013 の監査で発覚した。「`backup` サブコマンドは存在しない」
 * という記述の裏が取れず、キャッシュだけでは判断できなかった。
 * 同種の `<WranglerCommand>` は normalizeWranglerComponents が
 * プレーンテキストを挿入して救っているが、こちらは救えない。
 */
function reportUnexpandedNamespaces(cachedFiles) {
  const affected = []
  for (const filename of cachedFiles) {
    const text = readFileSync(resolve(DOCS_DIR, filename), 'utf8')
    const m = text.match(/<WranglerNamespace[^>]*\/>/g)
    if (m) affected.push({ filename, count: m.length })
  }
  if (affected.length === 0) return
  console.log(`\n⚠️  Unexpanded <WranglerNamespace>: ${affected.length} pages`)
  console.log('   サブコマンド一覧がビルド時生成のため、ソースに実体が無い（取得しても救えない）。')
  console.log('   これらのページを referenceUrl にする問題で「そのサブコマンドは無い」と')
  console.log('   判定する場合は、キャッシュではなくライブのドキュメントを見ること。')
  for (const a of affected) console.log(`   - ${a.filename}`)
}

const args = process.argv.slice(2)
if (args[0] === '--status') {
  status()
} else {
  await fetchAll(args.length > 0 ? args : null)
}
