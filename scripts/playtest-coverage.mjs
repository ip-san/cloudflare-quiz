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
 *   node scripts/playtest-coverage.mjs retest [N] [persona]   # 内容が変わった問題を再テストへ流す
 *   node scripts/playtest-coverage.mjs stale [persona]
 *     → テスト後に中身が変わった問題を ?q= ディープリンク付きで出力（再テスト対象）
 */
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
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

/**
 * 「テストした時点の問題の中身」を表す指紋。
 *
 * covered に問題 ID だけを積むと、その後に本文や選択肢を書き換えても
 * カバレッジは「テスト済み」のまま据え置かれる。実際 2026-08-26 の
 * 選択肢長バイアス反転で、テスト済み52問のうち32問の選択肢が総取り替えになったが、
 * カバレッジの数字は1つも動かなかった。**見た内容と今の内容が違う**ことを
 * 数字の側から言えるようにする。
 *
 * `quiz:randomize` が選択肢順と correctIndex を毎回入れ替えるため、
 * 順序に依存しない形（選択肢はソートし correctIndex は含めない）で取る。
 */
function fingerprint(quiz) {
  const payload = {
    question: quiz.question,
    hint: quiz.hint,
    explanation: quiz.explanation,
    difficulty: quiz.difficulty,
    diagrams: quiz.diagrams ?? null,
    options: quiz.options.map((o) => `${o.text}\u0000${o.wrongFeedback ?? ''}`).sort(),
  }
  return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex').slice(0, 12)
}

/** テスト後に中身が変わった (id, persona) を挙げる。fp 未記録のものは判定不能として除く */
function staleEntries(quizzes, store) {
  const out = []
  for (const q of quizzes) {
    const fp = fingerprint(q)
    for (const c of store.covered[q.id] ?? []) {
      if (c.fp && c.fp !== fp) out.push({ id: q.id, persona: c.persona, outcome: c.outcome, at: c.at })
    }
  }
  return out
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

  // テスト後に中身が変わった記録 —「テスト済み」の数字だけでは見えない
  const stale = staleEntries(quizzes, store)
  const noFp = Object.values(store.covered)
    .flat()
    .filter((c) => !c.fp).length
  if (stale.length) {
    console.log(`  ⚠️  テスト後に内容が変わった: ${stale.length}件（\`stale\` で一覧・再テスト対象）`)
  }
  if (noFp) {
    console.log(`  指紋なし（変更を検出できない古い記録）: ${noFp}件`)
  }
}

function cmdStale(quizzes, store, persona) {
  const all = staleEntries(quizzes, store)
  const rows = persona ? all.filter((r) => r.persona === persona) : all
  if (!rows.length) {
    console.log('テスト後に内容が変わった記録はありません。')
    return
  }
  const byPersona = {}
  for (const r of rows) {
    if (!byPersona[r.persona]) byPersona[r.persona] = []
    byPersona[r.persona].push(r.id)
  }
  console.log(
    JSON.stringify(
      {
        stale: rows.length,
        byPersona: Object.fromEntries(
          Object.entries(byPersona).map(([p, ids]) => [
            p,
            { count: ids.length, ids, deepLinks: ids.map((id) => `${BASE_URL}?q=${id}`) },
          ])
        ),
      },
      null,
      2
    )
  )
}

/**
 * 再テストが要る問題を `next` と同じ形で出す。
 *
 * `stale` は一覧するだけで、`next` は**未テスト問題しか選ばない**。
 * そのため「テスト済みだが内容が変わった」問題は、
 * 一覧に出続けるのに**プレイテストへ流す手段が無かった**（2026-08-29 に判明）。
 * SKILL.md が言う「1周したら維持モードへ移行する」の維持モードが、
 * コマンドとして存在していなかった。
 *
 * 出力を `next` と同じ形にしてあるのは、
 * user-simulator へ渡すプロンプトの組み立てを変えずに済ませるため。
 */
function cmdRetest(quizzes, store, n, persona) {
  const all = staleEntries(quizzes, store)
  const rows = persona ? all.filter((r) => r.persona === persona) : all
  if (!rows.length) {
    console.log(JSON.stringify({ persona: null, count: 0, ids: [], deepLinks: [], remainingForPersona: 0 }, null, 2))
    return
  }
  // 件数の多いペルソナから片付ける（next の pickPersona と同じ考え方）
  const byPersona = {}
  const orphaned = []
  const diffOf = new Map(quizzes.map((q) => [q.id, q.difficulty]))
  for (const r of rows) {
    // 記録した後で difficulty が変わった問題は、そのペルソナで再プレイしても
    // 進捗の分母に入らない（recordOne が警告する事故と同じ）。担当替えが要る
    if (!PERSONA_DIFFICULTY[r.persona].includes(diffOf.get(r.id))) {
      orphaned.push({ id: r.id, persona: r.persona, nowDifficulty: diffOf.get(r.id) })
      continue
    }
    if (!byPersona[r.persona]) byPersona[r.persona] = []
    byPersona[r.persona].push(r.id)
  }
  if (Object.keys(byPersona).length === 0) {
    console.log(JSON.stringify({ persona: null, count: 0, ids: [], deepLinks: [], orphaned }, null, 2))
    return
  }
  const p = persona ?? Object.entries(byPersona).sort((a, b) => b[1].length - a[1].length)[0][0]
  const ids = [...new Set(byPersona[p] ?? [])].sort().slice(0, n)
  console.log(
    JSON.stringify(
      {
        persona: p,
        count: ids.length,
        ids,
        deepLinks: ids.map((id) => `${BASE_URL}?q=${id}`),
        remainingForPersona: (byPersona[p] ?? []).length,
        // difficulty が変わってそのペルソナでは進捗に入らないもの
        orphaned,
        // 再テストなので、記録は上書きになる（mark-batch が同じ persona の行を差し替える）
        mode: 'retest',
      },
      null,
      2
    )
  )
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

/** 指紋の計算元。既定は現在の内容。--played-at で差し替わる */
let fpSource = null

function recordOne(store, id, persona, outcome, quizzes) {
  if (!PERSONAS.includes(persona)) throw new Error(`unknown persona: ${persona}`)
  if (!['clean', 'friction'].includes(outcome)) throw new Error(`outcome must be clean|friction`)
  const quiz = quizzes?.find((q) => q.id === id)
  if (quizzes && !quiz) throw new Error(`unknown quiz id: ${id}`)
  // ペルソナの担当難易度から外れた問題は、記録しても cmdStatus の分母に入らないため
  // 進捗が1問も動かない。実際 2026-08-26 に beginner が ag-001 をプレイしたが、
  // その直前に ag-001 が intermediate へ変わっていて記録が無言で死んだ。
  if (quiz && !PERSONA_DIFFICULTY[persona].includes(quiz.difficulty)) {
    console.warn(
      `  [warn] ${id} は difficulty=${quiz.difficulty}、${persona} の担当は ${PERSONA_DIFFICULTY[persona].join('/')}。` +
        `記録はするが ${persona} の進捗は進まない（担当ペルソナで再プレイが要る）`
    )
  }
  store.covered[id] = (store.covered[id] || []).filter((c) => c.persona !== persona)
  store.covered[id].push({
    persona,
    outcome,
    at: process.env.PLAYTEST_STAMP || 'unstamped',
    // --played-at が指定されていれば、そのコミット時点の内容で指紋を取る
    fp: (() => {
      const src = fpSource ? fpSource.find((q) => q.id === id) : quiz
      return src ? fingerprint(src) : null
    })(),
  })
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
    case 'retest':
      cmdRetest(quizzes, store, Number(process.argv[3]) || 5, process.argv[4])
      break
    case 'stale':
      cmdStale(quizzes, store, a)
      break
    case 'mark':
      recordOne(store, a, b, c, quizzes)
      saveStore(store)
      console.log(`marked ${a} [${b}] ${c}`)
      break
    case 'mark-batch': {
      // --played-at <ref> があれば、指紋はそのコミットの内容から取る。
      //
      // プレイ後に内容を直してから記録すると、指紋が**直したあと**の値になり
      // 「現行内容でテスト済み」という嘘の記録が残る。2026-08-29 までに2回踏んだ。
      // 手で計算し直して埋めようとしたが、区切り文字を \u0000 ではなく空白にして
      // **ツールと違う指紋を書き込んでいた**（3回目の事故）。
      // 手計算をやめ、同じ関数に別の入力を渡す形にする。
      const atIdx = process.argv.indexOf('--played-at')
      if (atIdx !== -1) {
        const ref = process.argv[atIdx + 1]
        if (!ref) throw new Error('--played-at にコミット ref が要る')
        fpSource = JSON.parse(
          execFileSync('git', ['show', `${ref}:src/data/quizzes.json`], { maxBuffer: 64 * 1024 * 1024 }).toString()
        ).quizzes
        console.log(`指紋は ${ref} 時点の内容から取ります`)
      }
      const raw = JSON.parse(fs.readFileSync(a, 'utf8'))
      // Accepts either a plain [{id, persona, outcome}] array, or a
      // requests-<persona>.json file with a top-level `persona` and a
      // `played: [{id, outcome}]` array (the user-simulator's native output
      // shape). `outcome: "ok"` is normalized to "clean".
      const items = Array.isArray(raw)
        ? raw
        : (raw.played || []).map((p) => ({ id: p.id, persona: raw.persona, outcome: p.outcome }))
      // `played` を落としたセッションを黙って0件として通すと、プレイした事実が
      // 記録されないままカバレッジだけが据え置かれる。数字は正常に見えるので気づけない。
      // 実際 2026-08-26 の busy-intermediate が playedCount:5 なのに played 無しで、
      // 5問分の記録が失われかけた。落とす。
      if (!Array.isArray(raw) && (raw.playedCount ?? 0) > 0 && items.length === 0) {
        throw new Error(
          `${a}: playedCount=${raw.playedCount} だが played[] が無い。` +
            `user-simulator に played:[{id,outcome}] を出力させること（feedback-schema.md 参照）`
        )
      }
      if (!Array.isArray(raw) && raw.playedCount != null && items.length !== raw.playedCount) {
        console.warn(`  [warn] playedCount=${raw.playedCount} と played[] の件数 ${items.length} が一致しない`)
      }
      for (const it of items) {
        const outcome = it.outcome === 'ok' ? 'clean' : it.outcome
        recordOne(store, it.id, it.persona, outcome, quizzes)
      }
      saveStore(store)
      console.log(`marked ${items.length} items`)
      break
    }
    default:
      console.log(
        'Usage: playtest-coverage.mjs <status|next [N] [persona]|retest [N] [persona]|stale [persona]|mark <id> <persona> <clean|friction>|mark-batch <file>>'
      )
      process.exit(1)
  }
}

try {
  main()
} catch (err) {
  // スタックトレースより、何が壊れているかを先に読ませる
  console.error(`\n✗ ${err.message}\n`)
  process.exit(1)
}
