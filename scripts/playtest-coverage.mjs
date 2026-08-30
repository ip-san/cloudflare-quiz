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
import { pathToFileURL } from 'node:url'

const QUIZ = 'src/data/quizzes.json'
const STORE = '.claude/playtest-coverage.json'
/**
 * deep link の基点。**検証のたびにポートを変えること。**
 *
 * このアプリは PWA で、`dist/sw.js` が quiz データのバンドルを
 * プリキャッシュする（`registerType: 'autoUpdate'`）。
 * 同じオリジン（= 同じポート）で再テストすると、
 * **Service Worker が修正前の内容を配り続ける。**
 *
 * 2026-08-30 に実際に起きた。ac-002 だけが前回の版のまま表示され、
 * 同一セッション内で「通常リロード→旧内容 / ハードリロード→新内容」が再現した。
 * 前回のプレイでキャッシュ済みだった問題だけが古く、
 * 未キャッシュだった5問は新しい内容が出ていた。**まだら状に古くなる。**
 *
 * Service Worker のスコープはオリジン単位なので、ポートを変えれば持ち越さない。
 *   bun run preview --port 4181
 *   PLAYTEST_BASE_URL=http://localhost:4181/cloudflare-quiz/ node scripts/playtest-coverage.mjs next 12
 */
const BASE_URL = process.env.PLAYTEST_BASE_URL ?? 'http://localhost:4173/cloudflare-quiz/'
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

/**
 * その設問に**実際に表示される用語バッジ**の指紋。
 *
 * ### なぜ本文の指紋だけでは足りないか
 *
 * 用語集に語を足すと、設問を1文字も変えていないのに**画面に出るものが変わる**。
 * 本文の指紋は動かないので、カバレッジは「現行内容でテスト済み」と言い続ける。
 * 2026-08-30 に22語を足したとき、テスターが「語が分からない」と詰まった11問が
 * **再テスト対象に一つも挙がらなかった**ことで気づいた。
 * これは指紋を手計算して嘘の記録を書いたのと同じ種類の嘘で、
 * しかも自動なので誰も気づけない。
 *
 * 語の照合規則は `src/domain/valueObjects/Glossary.ts` の `hasTerm` と同じ
 * （英数字の語境界を見る）。TS↔mjs の境界で複製しているので、
 * `scripts/__tests__/glossary-fingerprint.test.mjs` が両者の一致を見張っている。
 */
const WORDISH = /[A-Za-z0-9_]/

function hasTermMjs(text, term) {
  let from = 0
  while (from <= text.length) {
    const i = text.indexOf(term, from)
    if (i === -1) return false
    const okL = !(WORDISH.test(term[0]) && i > 0 && WORDISH.test(text[i - 1]))
    const end = i + term.length
    const okR = !(WORDISH.test(term[term.length - 1]) && end < text.length && WORDISH.test(text[end]))
    if (okL && okR) return true
    from = i + 1
  }
  return false
}

/** Glossary.ts から用語の一覧を読む。ref を渡すとそのコミット時点のものを読む */
export function glossaryTermsAt(ref) {
  const path = 'src/domain/valueObjects/Glossary.ts'
  let src
  try {
    src = ref
      ? execFileSync('git', ['show', `${ref}:${path}`], { maxBuffer: 16 * 1024 * 1024 }).toString()
      : fs.readFileSync(path, 'utf8')
  } catch {
    return null // 用語集が存在しない時点のコミット
  }
  const block = src.match(/const ENTRIES: GlossaryEntry\[\] = \[([\s\S]*?)\n\]/)
  if (!block) return null
  return [...block[1].matchAll(/term: '([^']+)'/g)].map((m) => m[1])
}

/** その設問に出る用語の指紋。用語集が無い時点なら null */
function glossaryFp(quiz, terms) {
  if (!terms) return null
  const text = [quiz.question, quiz.hint, quiz.explanation, ...quiz.options.flatMap((o) => [o.text, o.wrongFeedback])]
    .filter((t) => typeof t === 'string')
    .join(' ')
  const shown = terms.filter((t) => hasTermMjs(text, t)).sort()
  return crypto.createHash('sha1').update(shown.join('\u0000')).digest('hex').slice(0, 8)
}

/**
 * 再テストが要る (id, persona) を挙げる。
 *
 * 2種類ある:
 *   changed  — テスト後に中身が変わった（指紋が現在と違う）
 *   no-fp    — 指紋が無く、**現行内容でテストされたか確かめようがない**
 *
 * 2026-08-29 まで no-fp は「判定不能」として**除いて**いた。
 * だがそれは「検証できない記録を信用する」ことと同じで、
 * 台帳に静かな盲点を残す。検証できないなら再テストが要る、として扱う。
 * （実際 ac-001 / ac-002 の2件は、playtest 機能を別リポジトリから移植した
 *   コミットで持ち込まれた記録で、この リポジトリの履歴にプレイ時点の内容が
 *   存在しない。指紋を後から作れば嘘になる。）
 */
function staleEntries(quizzes, store) {
  const out = []
  for (const q of quizzes) {
    const fp = fingerprint(q)
    for (const c of store.covered[q.id] ?? []) {
      if (!c.fp) out.push({ id: q.id, persona: c.persona, outcome: c.outcome, at: c.at, reason: 'no-fp' })
      else if (c.fp !== fp) out.push({ id: q.id, persona: c.persona, outcome: c.outcome, at: c.at, reason: 'changed' })
      // 本文は同じでも、出る用語バッジが変わっていれば読む体験は変わっている。
      // gt を持たない古い記録は判定しようがないので黙って通す（嘘はつかないが、確認済みとも言わない）
      else if (c.gt && c.gt !== glossaryFp(q, gtSource))
        out.push({ id: q.id, persona: c.persona, outcome: c.outcome, at: c.at, reason: 'glossary' })
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
/** 用語一覧の取得元。既定は現在の Glossary.ts。--played-at で差し替わる */
let gtSource = glossaryTermsAt(null)

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
    // 用語バッジの指紋。用語集に語を足すと、設問を変えなくても画面に出るものが変わる
    gt: (() => {
      const src = fpSource ? fpSource.find((q) => q.id === id) : quiz
      return src ? glossaryFp(src, gtSource) : null
    })(),
  })
}

/**
 * 指紋の無い古い記録に、**プレイ時点のコミットの内容**から指紋を埋める。
 *
 * 手で計算し直すと区切り文字ひとつでツールと違う値になる（2026-08-29 に実際にやった）。
 * 同じ fingerprint 関数に別の入力を渡すだけにする。
 *
 * プレイ時点は「その記録が入ったコミットの**親**」が正しい。
 * プレイテストのコミットには、そのプレイから出た改善が同梱されているため。
 */
function cmdBackfillFp(store, ref, ids) {
  const played = JSON.parse(
    execFileSync('git', ['show', `${ref}:src/data/quizzes.json`], { maxBuffer: 64 * 1024 * 1024 }).toString()
  ).quizzes
  let n = 0
  for (const id of ids) {
    const quiz = played.find((q) => q.id === id)
    if (!quiz) {
      console.log(`  ! ${id}: ${ref} 時点に存在しない`)
      continue
    }
    for (const c of store.covered[id] ?? []) {
      if (c.fp) continue
      c.fp = fingerprint(quiz)
      c.fpFrom = ref
      n++
      console.log(`  ${id} [${c.persona}] ← ${ref}`)
    }
  }
  saveStore(store)
  console.log(`${n}件に指紋を埋めた`)
}

function main() {
  // `--played-at <ref>` のようなフラグを位置引数から外す。
  // 外し忘れると `a` がフラグ名になり、それをファイル名として開こうとして
  // `ENOENT: ... open '--played-at'` で落ちる（2026-08-30 に踏んだ）。
  const argv = process.argv.slice(2)
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--played-at') {
      i++ // 値も飛ばす
      continue
    }
    if (argv[i].startsWith('--')) continue
    positional.push(argv[i])
  }
  const [cmd, a, b, c] = positional
  const quizzes = loadQuizzes()
  const store = loadStore()

  switch (cmd) {
    case 'status':
      cmdStatus(quizzes, store)
      break
    case 'next':
      cmdNext(quizzes, store, Number(a) || 5, b)
      break
    case 'backfill-fp':
      cmdBackfillFp(store, process.argv[3], process.argv.slice(4))
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
    case 'backfill-gt': {
      // 用語バッジの指紋を、**そのバッチをプレイした時点の Glossary.ts** から埋める。
      // 全記録に一律で埋めるのは嘘になる（記録ごとにプレイ時点の用語集が違うため）ので、
      // mark-batch と同じバッチファイルを渡して、そこに載っている記録だけを対象にする。
      const ref = a
      const batch = b
      if (!ref || !batch) throw new Error('Usage: backfill-gt <ref> <batchfile>')
      const atQuizzes = JSON.parse(
        execFileSync('git', ['show', `${ref}:${QUIZ}`], { maxBuffer: 64 * 1024 * 1024 }).toString()
      ).quizzes
      const atTerms = glossaryTermsAt(ref)
      const raw = JSON.parse(fs.readFileSync(batch, 'utf8'))
      const items = Array.isArray(raw) ? raw : (raw.played || []).map((x) => ({ id: x.id, persona: raw.persona }))
      let n = 0
      for (const it of items) {
        const quiz = atQuizzes.find((q) => q.id === it.id)
        if (!quiz) continue
        for (const c of store.covered[it.id] ?? []) {
          if (c.persona !== it.persona || c.gt) continue
          c.gt = glossaryFp(quiz, atTerms)
          n++
        }
      }
      saveStore(store)
      console.log(`${n}件に用語指紋を埋めた（${ref} 時点 / ${atTerms ? `${atTerms.length}語` : '用語集なし'}）`)
      break
    }
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
        gtSource = glossaryTermsAt(ref)
        console.log(`指紋は ${ref} 時点の内容から取ります（用語集 ${gtSource ? `${gtSource.length}語` : '無し'}）`)
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
        'Usage: playtest-coverage.mjs <status|next [N] [persona]|retest [N] [persona]|stale [persona]|mark <id> <persona> <clean|friction>|mark-batch <file>|backfill-gt <ref> <batchfile>>'
      )
      process.exit(1)
  }
}

// テストから関数だけを import できるよう、直接実行のときだけ走らせる。
// これが無いと import しただけで usage を出して process.exit(1) する。
const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (invokedDirectly)
  try {
    main()
  } catch (err) {
    // スタックトレースより、何が壊れているかを先に読ませる
    console.error(`\n✗ ${err.message}\n`)
    process.exit(1)
  }
