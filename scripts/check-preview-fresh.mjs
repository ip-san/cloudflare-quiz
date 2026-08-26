#!/usr/bin/env node

/**
 * プレビューが配信しているビルドが、いまの作業ツリーより古くないかを確認する。
 *
 * プレイテストは `bun run preview`(= dist/ の配信) に対して実行される。
 * dist/ が古いと、模擬ユーザーは**修正済みの問題を修正前の状態でプレイ**し、
 * 既に直した指摘を再び上げてくる。実際に 2026-08-26 のセッションで、
 * ac-008 / ac-009 / ag-001 の3件が「修正済みなのに再指摘」として戻ってきた。
 *
 * 「古いビルドを見ていた」と「本当にまだ直っていない」は結果から区別できないので、
 * 走らせる前に落とす。
 *
 * Usage: node scripts/check-preview-fresh.mjs
 * exit 0 = 最新 / exit 1 = 再ビルドが必要
 */

import { existsSync, readdirSync, statSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** dist より新しければプレイテスト結果が信用できなくなる入力 */
const SOURCES = ['src', 'index.html', 'vite.config.ts']
const DIST = resolve(ROOT, 'dist')

function newestMtime(path) {
  const full = resolve(ROOT, path)
  if (!existsSync(full)) return 0
  const stat = statSync(full)
  if (!stat.isDirectory()) return stat.mtimeMs
  // ディレクトリは再帰的に最新の mtime を取る
  let newest = stat.mtimeMs
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    newest = Math.max(newest, newestMtime(resolve(full, entry.name)))
  }
  return newest
}

if (!existsSync(DIST)) {
  console.error('✗ dist/ がありません。`bun run build` を実行してください。')
  process.exit(1)
}

const distTime = statSync(resolve(DIST, 'index.html')).mtimeMs
let staleSource = null
let staleTime = 0
for (const src of SOURCES) {
  const t = newestMtime(src)
  if (t > distTime && t > staleTime) {
    staleSource = src
    staleTime = t
  }
}

if (staleSource) {
  const ageMin = Math.round((staleTime - distTime) / 60000)
  console.error(`✗ dist/ が古いです（${staleSource} の方が ${ageMin} 分新しい）`)
  console.error('  このまま playtest を走らせると、修正済みの問題を修正前の状態でプレイします。')
  console.error('  `bun run build` してから preview を再起動してください。')
  process.exit(1)
}

console.log('✓ preview が配信するビルドは最新です')
