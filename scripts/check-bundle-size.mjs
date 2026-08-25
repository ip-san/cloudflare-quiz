#!/usr/bin/env node
/**
 * Bundle Size Monitor
 * `bun run build` の出力（dist/assets）から chunk サイズを検出し、閾値超過を警告する。
 *
 * 【初期ロードが大きい理由（調査済み・2026-08-25）】
 * 初期ロードの大半は quiz-data（756問のデータ本体、非圧縮1869KB / gzip約410KB）。
 * オフラインで全問解けることがこのアプリの前提なので、起動時に読むのは設計どおり。
 * かつ Service Worker がプリキャッシュするため、2回目以降の訪問では取得が発生しない。
 * 初回のみ gzip 約500KB（quiz-data 410 + index 90）で、これは許容範囲と判断した。
 * → 閾値は「理想値」ではなく「現状からの増加を検知する回帰ガード」として設定している。
 */

import { execSync } from 'child_process'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

// 閾値（KB、非圧縮）。現状値からの「増加」を検知するための回帰ガードとして置く。
// 到達不能な理想値を置くと常時赤になり、誰も見なくなる。
// 【閾値の余裕（2026-08-25 実測)】
// quiz-data は 1問あたり約2.5KB。1カテゴリ(18問)追加で約45KB増える計算なので、
// 現状の 2528KB からは 3カテゴリ程度で totalInitial に到達する。
// カテゴリ追加でここが赤くなったら、閾値を機械的に上げる前に
// 「本当に全問を起動時に読む必要があるか」を一度考えること。
const LIMITS = {
  totalInitial: 2700, // 初期ロード合計（現状 ~2528KB。大半は quiz-data の 1869KB）
  singleChunk: 400, // 単一チャンク（quiz-data は問題データ本体なので別枠）
  totalAll: 2800, // 全チャンク合計（現状 ~2611KB）
}

// quiz-data は 756 問のデータ本体で、単一チャンク上限の対象外とする
// （初期ロードには含める — 実際に modulepreload されているため）
const EXCLUDE_FROM_SINGLE_CHUNK = ['quiz-data']

const distDir = 'dist/assets'
const indexHtml = 'dist/index.html'

// Build if dist doesn't exist
try {
  readdirSync(distDir)
} catch {
  console.log('Building bundle...')
  execSync('npx vite build', { stdio: 'pipe' })
}

const files = readdirSync(distDir)
const chunks = files
  .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
  .map((f) => {
    const size = statSync(join(distDir, f)).size
    return { name: f, sizeKB: Math.round((size / 1024) * 10) / 10 }
  })
  .sort((a, b) => b.sizeKB - a.sizeKB)

const totalKB = chunks.reduce((sum, c) => sum + c.sizeKB, 0)
const jsChunks = chunks.filter((c) => c.name.endsWith('.js'))
const cssChunks = chunks.filter((c) => c.name.endsWith('.css'))
const isExcluded = (name) => EXCLUDE_FROM_SINGLE_CHUNK.some((ex) => name.includes(ex))

// 初期ロードは dist/index.html を正とする。
// 「どれが遅延チャンクか」を手書きリストで持つと、画面を足すたびに更新が漏れて
// 推定値が静かにズレる（実際、移植元のリストは FreeTierTable など新しい遅延
// チャンクを拾えていなかった）。HTML が実際に読み込む/preload するものだけが
// 初回に取得されるので、そこから機械的に導く。
const html = readFileSync(indexHtml, 'utf8')
const referenced = new Set([...html.matchAll(/(?:src|href)="[^"]*\/assets\/([^"]+\.(?:js|css))"/g)].map((m) => m[1]))
const initialChunks = chunks.filter((c) => referenced.has(c.name))
const initialKB = Math.round(initialChunks.reduce((sum, c) => sum + c.sizeKB, 0) * 10) / 10

const errors = []
const warnings = []

// Check limits
if (initialKB > LIMITS.totalInitial) {
  errors.push(`Initial load ${initialKB}KB exceeds ${LIMITS.totalInitial}KB limit`)
}
if (totalKB > LIMITS.totalAll) {
  errors.push(`Total bundle ${totalKB}KB exceeds ${LIMITS.totalAll}KB limit`)
}
for (const chunk of chunks) {
  if (!isExcluded(chunk.name) && chunk.sizeKB > LIMITS.singleChunk) {
    warnings.push(`Chunk ${chunk.name} is ${chunk.sizeKB}KB (limit: ${LIMITS.singleChunk}KB)`)
  }
}

// Report
console.log('Bundle Size Report')
console.log('─'.repeat(50))
console.log(`\nChunks (${chunks.length} files):`)
for (const c of chunks) {
  const bar = '█'.repeat(Math.ceil(c.sizeKB / 5))
  const flag = c.sizeKB > LIMITS.singleChunk ? ' ⚠️' : ''
  console.log(`  ${c.name.padEnd(40)} ${String(c.sizeKB).padStart(6)}KB ${bar}${flag}`)
}

console.log(`\n  ${'Total JS:'.padEnd(40)} ${String(jsChunks.reduce((s, c) => s + c.sizeKB, 0)).padStart(6)}KB`)
console.log(`  ${'Total CSS:'.padEnd(40)} ${String(cssChunks.reduce((s, c) => s + c.sizeKB, 0)).padStart(6)}KB`)
console.log(`  ${'Total:'.padEnd(40)} ${String(totalKB).padStart(6)}KB`)
console.log(`  ${'Initial load (est):'.padEnd(40)} ${String(initialKB).padStart(6)}KB`)

console.log(
  `\nLimits: initial < ${LIMITS.totalInitial}KB | chunk < ${LIMITS.singleChunk}KB | total < ${LIMITS.totalAll}KB`
)

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:')
  warnings.forEach((w) => console.log(`  - ${w}`))
}

if (errors.length > 0) {
  console.error('\n✗ Bundle size check FAILED:')
  errors.forEach((e) => console.error(`  - ${e}`))
  process.exit(1)
} else {
  console.log('\n✓ Bundle size check passed')
}
