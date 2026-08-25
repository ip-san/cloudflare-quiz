#!/usr/bin/env node
/**
 * Architecture Quality Checks
 * - DDD レイヤー依存ルール違反の検出
 * - コンポーネント複雑度（行数）チェック
 * - Zustand store 肥大化チェック
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

const SRC = 'src'
const errors = []
const warnings = []

// ── 1. DDD Layer Dependency Rules ─────────────────────────────
// Allowed: components → stores → domain, infrastructure → domain
// Forbidden: domain → stores, domain → components, domain → infrastructure
const LAYER_RULES = {
  domain: { forbidden: ['stores', 'components', 'infrastructure', 'lib'] },
  infrastructure: { forbidden: ['stores', 'components'] },
  stores: { forbidden: ['components'] },
}

// Known exceptions (tech debt, tracked for future refactoring)
// Format: "exact/file/path -> forbidden_layer"
const KNOWN_VIOLATIONS = new Set([])

function getAllFiles(dir, ext) {
  const results = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        results.push(...getAllFiles(fullPath, ext))
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(fullPath)
      }
    }
  } catch {
    /* ignore */
  }
  return results
}

const tsFiles = [...getAllFiles(SRC, '.ts'), ...getAllFiles(SRC, '.tsx')]

for (const file of tsFiles) {
  const rel = relative(SRC, file)
  const layer = rel.split('/')[0]
  const rules = LAYER_RULES[layer]
  if (!rules) continue

  const content = readFileSync(file, 'utf8')
  const imports = content.match(/from ['"]\.\.?\/.+?['"]/g) || []

  for (const imp of imports) {
    const importPath = imp.replace(/from ['"]/, '').replace(/['"]$/, '')
    for (const forbidden of rules.forbidden) {
      // Check if import resolves to a forbidden layer
      if (importPath.includes(`/${forbidden}/`) || importPath.startsWith(`../${forbidden}`)) {
        const key = `${rel} -> ${forbidden}`
        if (KNOWN_VIOLATIONS.has(key)) {
          warnings.push(`Known layer violation: ${rel} imports from '${forbidden}' layer (tracked)`)
        } else {
          errors.push(`Layer violation: ${rel} imports from '${forbidden}' layer (${importPath})`)
        }
      }
    }
  }
}

// ── 2. Component Complexity ───────────────────────────────────
const COMPONENT_LINE_LIMIT = 300
const componentFiles = getAllFiles(join(SRC, 'components'), '.tsx')

const largeComponents = []
for (const file of componentFiles) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n').length
  if (lines > COMPONENT_LINE_LIMIT) {
    largeComponents.push({ file: relative('.', file), lines })
  }
}

if (largeComponents.length > 0) {
  largeComponents.sort((a, b) => b.lines - a.lines)
  for (const c of largeComponents) {
    warnings.push(`Large component: ${c.file} (${c.lines} lines, limit: ${COMPONENT_LINE_LIMIT})`)
  }
}

// ── 3. Zustand Store Bloat Check ──────────────────────────────
const STORE_ACTION_LIMIT = 35
const STORE_STATE_LIMIT = 20
const storeFiles = getAllFiles(join(SRC, 'stores'), '.ts')

for (const file of storeFiles) {
  if (file.includes('.test.')) continue
  const content = readFileSync(file, 'utf8')
  const rel = relative('.', file)

  // Count state properties (interface or type alias)
  const stateMatch = content.match(/(?:interface|type) \w+State\s*=?\s*\{([^}]+)\}/s)
  if (stateMatch) {
    const stateProps = (stateMatch[1].match(/^\s+\w+\s*[?:].*$/gm) || []).length
    if (stateProps > STORE_STATE_LIMIT) {
      warnings.push(`Store bloat: ${rel} has ${stateProps} state properties (limit: ${STORE_STATE_LIMIT})`)
    }
  }

  // Count store actions: lines matching "actionName: (" or "actionName: () =>"
  // inside the create() block (exclude interface definitions and comments)
  const createBlock =
    content.match(/create(?:<[^>]+>)?\(\s*\((?:set|get|\.\.\.)[^)]*\)\s*=>\s*\(\{([\s\S]*)\}\)\s*\)/)?.[1] ?? ''
  const actionMatches = createBlock.match(/^\s+\w+:\s*(?:async\s*)?\(/gm) || []
  if (actionMatches.length > STORE_ACTION_LIMIT) {
    warnings.push(`Store bloat: ${rel} has ${actionMatches.length} actions (limit: ${STORE_ACTION_LIMIT})`)
  }
}

// ── Report ────────────────────────────────────────────────────
console.log('Architecture Quality Report')
console.log('─'.repeat(50))

// Layer deps
const layerChecked = tsFiles.filter((f) => LAYER_RULES[relative(SRC, f).split('/')[0]]).length
console.log(`\nLayer Dependencies: checked ${layerChecked} files`)

// Components
console.log(`Components: ${componentFiles.length} files, ${largeComponents.length} over ${COMPONENT_LINE_LIMIT} lines`)
if (largeComponents.length > 0) {
  for (const c of largeComponents) {
    console.log(`  ⚠️  ${c.file}: ${c.lines} lines`)
  }
}

// Stores
console.log(`Stores: ${storeFiles.filter((f) => !f.includes('.test.')).length} files checked`)

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:')
  warnings.forEach((w) => console.log(`  - ${w}`))
}

if (errors.length > 0) {
  console.error('\n✗ Architecture check FAILED:')
  errors.forEach((e) => console.error(`  - ${e}`))
  process.exit(1)
} else {
  console.log('\n✓ Architecture check passed')
}
