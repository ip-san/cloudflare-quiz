#!/usr/bin/env node
/**
 * 無料枠早見表（src/data/freeTier.ts）の数値をドキュメントキャッシュと機械照合する。
 *
 * この表は手書きなので、Cloudflare 側が数値を変えても気づけない。
 * 各項目の `docValue`（ドキュメント原文の表記）が実際に該当ページへ存在するかを
 * 確認することで、静かな陳腐化を検出する。
 *
 *   node scripts/verify-free-tier.mjs
 *   node scripts/verify-free-tier.mjs --json
 *
 * キャッシュが無い場合は「検証不能」として exit 0 で抜ける（ネットワーク不要な
 * 運用を優先。quiz-lint.mjs の URL チェックと同じ方針）。
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DOCS_DIR = resolve(process.cwd(), '.claude/tmp/docs')
const SOURCE = resolve(process.cwd(), 'src/data/freeTier.ts')
const asJson = process.argv.includes('--json')

/** `foo/bar/baz` → `foo__bar__baz.md` (fetch-docs.mjs と同じ規則) */
function docPageToFilename(page) {
  return `${page.replace(/\//g, '__')}.md`
}

/**
 * freeTier.ts から検証に必要な情報だけを抜き出す。
 * TS を実行せずに済ませるため、構造が単純なうちは正規表現で読む。
 */
function parseServices(src) {
  const services = []
  // サービス単位のブロックに分割（docPage を目印にする）
  const blocks = src.split(/\n {2}\{\n/).slice(1)
  for (const block of blocks) {
    const idMatch = block.match(/id: '([^']+)'/)
    const pageMatch = block.match(/docPage: '([^']+)'/)
    if (!idMatch || !pageMatch) continue
    const docValues = [...block.matchAll(/docValue: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"))
    const labels = [...block.matchAll(/label: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"))
    services.push({ id: idMatch[1], docPage: pageMatch[1], docValues, labels })
  }
  return services
}

function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Source not found: ${SOURCE}`)
    process.exit(1)
  }
  if (!existsSync(DOCS_DIR)) {
    const msg = 'Doc cache not found — skipping. Run `bun run docs:fetch` first.'
    console.log(asJson ? JSON.stringify({ skipped: true, reason: msg }) : `  Warning: ${msg}`)
    process.exit(0)
  }

  const services = parseServices(readFileSync(SOURCE, 'utf8'))
  const issues = []
  let checked = 0

  for (const svc of services) {
    const file = resolve(DOCS_DIR, docPageToFilename(svc.docPage))
    if (!existsSync(file)) {
      issues.push({ service: svc.id, type: 'missing-page', detail: `Doc page not cached: ${svc.docPage}` })
      continue
    }
    const content = readFileSync(file, 'utf8')
    svc.docValues.forEach((value, i) => {
      checked++
      if (!content.includes(value)) {
        issues.push({
          service: svc.id,
          type: 'value-not-found',
          label: svc.labels[i] ?? `#${i}`,
          detail: `"${value}" not found in ${svc.docPage}`,
        })
      }
    })
  }

  if (asJson) {
    console.log(JSON.stringify({ checked, services: services.length, issues }, null, 2))
  } else {
    console.log('=== Free Tier Verification ===\n')
    console.log(`  ${services.length} services, ${checked} values checked against cached docs`)
    if (issues.length === 0) {
      console.log('\n  All free-tier values match the cached documentation.')
    } else {
      console.log(`\n  ${issues.length} issue(s):\n`)
      for (const it of issues) {
        console.log(`  [${it.type}] ${it.service}${it.label ? ` / ${it.label}` : ''}`)
        console.log(`    ${it.detail}`)
      }
      console.log('\n  数値が変わった可能性があります。ドキュメントを確認して freeTier.ts を更新してください。')
    }
  }

  // アドバイザリ扱い（quiz-lint と同じく常に exit 0）。CI をいきなり落とさず、
  // レポートとして人が判断する。
  process.exit(0)
}

main()
