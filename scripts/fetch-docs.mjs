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

import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { DOC_PAGES, docPageToFilename } from './topic-config.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS_DIR = resolve(ROOT, '.claude/tmp/docs')
const RAW_BASE = 'https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/docs'
const MAX_AGE_HOURS = 24 * 14 // 2 weeks

/**
 * The docs repo is inconsistent about whether a page is a directory index
 * (`<path>/index.mdx`) or a leaf file (`<path>.mdx`) — try both.
 */
async function fetchMarkdown(name) {
  const candidates = [`${RAW_BASE}/${name}/index.mdx`, `${RAW_BASE}/${name}.mdx`]
  for (const url of candidates) {
    try {
      const res = await fetch(url)
      if (res.ok) return await res.text()
    } catch {
      // try next candidate
    }
  }
  return null
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
}

const args = process.argv.slice(2)
if (args[0] === '--status') {
  status()
} else {
  await fetchAll(args.length > 0 ? args : null)
}
