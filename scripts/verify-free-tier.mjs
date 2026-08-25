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
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { docPageToFilename } from './topic-config.mjs'

// スクリプト位置を基準にする（quiz-lint.mjs / fetch-docs.mjs と同じ方式）。
// process.cwd() 基準にすると、リポジトリルート以外から実行したときに壊れる。
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS_DIR = resolve(ROOT, '.claude/tmp/docs')
const SOURCE = resolve(ROOT, 'src/data/freeTier.ts')
const asJson = process.argv.includes('--json')

const DOC_VALUE_RE = /docValue: '((?:[^'\\]|\\.)*)'/g
const LABEL_RE = /label: '((?:[^'\\]|\\.)*)'/g

/**
 * freeTier.ts から検証に必要な情報だけを抜き出す。
 * TS を実行せずに済ませるため、構造が単純なうちは正規表現で読む。
 *
 * ブロック分割はインデント（サービスオブジェクトが2スペース）に依存するので、
 * 整形ルールが変わると静かに壊れうる。そうなると「0件検証して全部OK」という
 * 一番気づきにくい失敗をするため、ファイル全体から独立に数えた件数と突き合わせて
 * パース自体の健全性を検査する（`parsed` が全件を拾えているか）。
 */
function parseServices(src) {
  const services = []
  // サービス単位のブロックに分割（docPage を目印にする）
  const blocks = src.split(/\n {2}\{\n/).slice(1)
  for (const block of blocks) {
    const idMatch = block.match(/id: '([^']+)'/)
    const pageMatch = block.match(/docPage: '([^']+)'/)
    if (!idMatch || !pageMatch) continue
    const docValues = [...block.matchAll(DOC_VALUE_RE)].map((m) => m[1].replace(/\\'/g, "'"))
    const labels = [...block.matchAll(LABEL_RE)].map((m) => m[1].replace(/\\'/g, "'"))
    services.push({ id: idMatch[1], docPage: pageMatch[1], docValues, labels })
  }

  // ブロック構造に依存しない実数（ファイル全体を素直に数えたもの）
  const expectedServices = [...src.matchAll(/docPage: '/g)].length
  const expectedValues = [...src.matchAll(DOC_VALUE_RE)].length
  const parsedValues = services.reduce((n, s) => n + s.docValues.length, 0)

  return {
    services,
    parseOk: services.length === expectedServices && parsedValues === expectedValues,
    expectedServices,
    expectedValues,
  }
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

  const { services, parseOk, expectedServices, expectedValues } = parseServices(readFileSync(SOURCE, 'utf8'))
  const issues = []
  let checked = 0

  if (!parseOk) {
    issues.push({
      service: '(parser)',
      type: 'parse-incomplete',
      detail:
        `freeTier.ts を読み切れていません（services ${services.length}/${expectedServices}、` +
        `docValue ${services.reduce((n, s) => n + s.docValues.length, 0)}/${expectedValues}）。` +
        'このスクリプトの正規表現がファイルの整形に追従できていない可能性があります。',
    })
  }

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
