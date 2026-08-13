#!/usr/bin/env node
/**
 * playtest-coverage.mjs — プログレッシブ playtest カバレッジ追跡
 *
 * 全クイズを「ユーザー視点で1問ずつ」playtest し切るためのカバレッジ管理。
 * どの問題を・どのペルソナで・いつテストし・詰まりが出たかを永続記録し、
 * 次のバッチで「まだテストしていない問題」を狙って選ぶ。
 *
 * 記録: .claude/playtest-coverage.json（git追跡。進捗が永続する）
 *
 * 使い方:
 *   node scripts/playtest-coverage.mjs status
 *     → 全体/ペルソナ別の進捗サマリ
 *   node scripts/playtest-coverage.mjs next [N] [persona]
 *     → 未テストの問題を N 件選び、?q= ディープリンク付きで出力（既定 N=5）
 *        persona 省略時は残数最多のペルソナを自動選択（ローテーション）
 *   node scripts/playtest-coverage.mjs mark <id> <persona> <clean|friction>
 *     → 1問をテスト済みに記録
 *   node scripts/playtest-coverage.mjs mark-batch <file.json>
 *     → [{id, persona, outcome}] の配列をまとめて記録
 */
import fs from 'node:fs'

const QUIZ = 'src/data/quizzes.json'
const STORE = '.claude/playtest-coverage.json'
const BASE_URL = 'http://localhost:4173/cloudflare-quiz/'
const PERSONAS = ['beginner', 'busy-intermediate', 'reviewer']

// ペルソナ → 担当する難易度（personas.md のセッション方針に対応）。
// 各難易度を1ペルソナに割当て（disjoint）し、全問を「1問1回」で1周できるようにする。
const PERSONA_DIFFICULTY = {
  beginner: ['beginner'],
  'busy-intermediate': ['intermediate'],
  reviewer: ['advanced'],
}

function loadQuizzes() {
  return JSON.parse(fs.readFileSync(QUIZ, 'utf8')).quizzes
}
function loadStore() {
  if (!fs.existsSync(STORE)) return { covered: {} }
  return JSON.parse(fs.readFileSync(STORE, 'utf8'))
}
function saveStore(s) {
  fs.writeFileSync(STORE, JSON.stringify(s, null, 2) + '\n')
}

// ペルソナにマッチし、かつそのペルソナでまだテストしていない問題を選ぶ。
// 1問は複数ペルソナでテストし得る（covered は per-persona 記録）。
function uncoveredFor(quizzes, store, persona) {
  const diffs = PERSONA_DIFFICULTY[persona] || ['beginner']
  return quizzes
    .filter((q) => diffs.includes(q.difficulty))
    .filter((q) => !(store.covered[q.id] && store.covered[q.id].some((c) => c.persona === persona)))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function pickPersona(quizzes, store) {
  // 残数が最も多いペルソナを選ぶ（均等にローテーション）
  let best = PERSONAS[0]
  let bestN = -1
  for (const p of PERSONAS) {
    const n = uncoveredFor(quizzes, store, p).length
    if (n > bestN) {
      bestN = n
      best = p
    }
  }
  return best
}

function cmdStatus(quizzes, store) {
  console.log('=== Progressive Playtest Coverage ===')
  for (const p of PERSONAS) {
    const diffs = PERSONA_DIFFICULTY[p]
    const pool = quizzes.filter((q) => diffs.includes(q.difficulty)).length
    const done = quizzes.filter(
      (q) => diffs.includes(q.difficulty) && store.covered[q.id]?.some((c) => c.persona === p)
    ).length
    const pct = pool ? ((done / pool) * 100).toFixed(0) : '0'
    console.log(`  ${p.padEnd(18)} ${String(done).padStart(3)}/${String(pool).padEnd(3)} (${pct}%)`)
  }
  // ユニーク問題カバレッジ（いずれかのペルソナでテスト済み）
  const uniqDone = quizzes.filter((q) => store.covered[q.id]?.length).length
  console.log(`  ${'(unique questions)'.padEnd(18)} ${uniqDone}/${quizzes.length}`)
  // 詰まりが出た問題数
  const friction = Object.values(store.covered)
    .flat()
    .filter((c) => c.outcome === 'friction').length
  console.log(`  friction recorded: ${friction}`)
}

function cmdNext(quizzes, store, n, persona) {
  const p = persona && PERSONAS.includes(persona) ? persona : pickPersona(quizzes, store)
  const ids = uncoveredFor(quizzes, store, p)
    .slice(0, n)
    .map((q) => q.id)
  const out = {
    persona: p,
    count: ids.length,
    ids,
    deepLinks: ids.map((id) => `${BASE_URL}?q=${id}`),
    remainingForPersona: uncoveredFor(quizzes, store, p).length,
  }
  console.log(JSON.stringify(out, null, 2))
}

function recordOne(store, id, persona, outcome) {
  if (!PERSONAS.includes(persona)) throw new Error(`unknown persona: ${persona}`)
  if (!['clean', 'friction'].includes(outcome)) throw new Error(`outcome must be clean|friction`)
  store.covered[id] = (store.covered[id] || []).filter((c) => c.persona !== persona)
  store.covered[id].push({ persona, outcome, at: process.env.PLAYTEST_STAMP || 'unstamped' })
}

function main() {
  const [cmd, a, b, c] = process.argv.slice(2)
  const quizzes = loadQuizzes()
  const store = loadStore()

  switch (cmd) {
    case 'status':
      cmdStatus(quizzes, store)
      break
    case 'next':
      cmdNext(quizzes, store, Number(a) || 5, b)
      break
    case 'mark':
      recordOne(store, a, b, c)
      saveStore(store)
      console.log(`marked ${a} [${b}] ${c}`)
      break
    case 'mark-batch': {
      const items = JSON.parse(fs.readFileSync(a, 'utf8'))
      for (const it of items) recordOne(store, it.id, it.persona, it.outcome)
      saveStore(store)
      console.log(`marked ${items.length} items`)
      break
    }
    default:
      console.log(
        'Usage: playtest-coverage.mjs <status|next [N] [persona]|mark <id> <persona> <clean|friction>|mark-batch <file>>'
      )
      process.exit(1)
  }
}

main()
