#!/usr/bin/env node

/**
 * 誤答を「H1 / H2 の疑いが濃い順」に並べる。
 *
 * 差分検査（`quiz-audit.mjs`）は**今回変えた肢**しか見ない。
 * 2026-08-27 のプレイテストで、書き換え作業より前から存在していた自己矛盾
 * （`ar-016[0]`「結果整合性のおかげで常に正確な合計値が得られる」）が
 * 学習者に見つかった。差分検査だけを回していると、既存の欠陥は永久に射程外になる。
 *
 * かといって 1,233肢を全部エージェントに読ませるのは重い。
 * **疑わしい順に並べて上から潰す**ための足切りを機械で用意する。
 *
 * これは検出器ではなく**優先度づけ**。スコアが高いから欠陥とは限らないし、
 * **低いから安全でもない**。
 *
 * 再現率は不明で、おそらく低い。411問・1,233肢から挙がるのは十数肢しかなく、
 * 「別製品名を名指ししている」「定義と量化が衝突している」という
 * 表面に出た指紋しか見ていないため。**全数を見たことにはならない。**
 * 上から潰したあと、残りをどうするかは別の判断が要る。
 *
 * **実測の再現率は 10%**（`node scripts/screen-recall.mjs`）。
 * 既知の陽性30件のうち3件しか挙がらない。理由ははっきりしている:
 * H1 の本体は「別製品の振る舞いを**名前を出さずに**説明している」ことで、
 * ここが見ているのはその逆（名前が出ている場合）だけだから。
 *
 *   dq-001[2]「各レプリカが非同期に同期する結果整合性モデルのため…」← KV を名指ししない
 *   wf-001[1]「応答しなくなったオリジンを自動的に切り離す」← Load Balancing を名指ししない
 *
 * **H1 は語彙では拾えない。読み手が要る。**
 * この道具が実際に役立つのは H2（定義と量化の衝突）で、`ar-016[0]` を検出できた。
 *
 * 適合率も測った: 2026-08-28 に上位15肢を独立監査に回した結果、
 * **真の陽性は0件**（H1 判定が1件出たが、主語を書き換えて作った「真の一文」に
 * 基づくもので採らなかった。`defect-taxonomy.md` の「H1 の境界」）。
 * 再現率10% / この回の適合率0% で、H1 の道具としては成立していない。
 *
 * 見ている指紋:
 *   - 誤答が、設問文にも正解にも出てこない別の製品名に言及している（弱い）
 *   - 「できない/存在しない」と言いながらその能力を前提にした動作を述べている
 *   - 定義と量化が衝突している（`結果整合性` × `常に正確` など）
 *
 * Usage:
 *   node scripts/screen-distractor-risk.mjs                  # 上位30件
 *   node scripts/screen-distractor-risk.mjs --top 60
 *   node scripts/screen-distractor-risk.mjs --exclude <ref>  # そのrefから変わった問題を除く
 *   node scripts/screen-distractor-risk.mjs --json <path>    # 監査エージェント用の入力
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOC_PAGES } from './topic-config.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const top = Number(args[args.indexOf('--top') + 1]) || 30
const excludeRef = args.includes('--exclude') ? args[args.indexOf('--exclude') + 1] : null
const jsonPath = args.includes('--json') ? args[args.indexOf('--json') + 1] : null

const quizzes = JSON.parse(readFileSync(resolve(ROOT, 'src/data/quizzes.json'), 'utf8')).quizzes

/**
 * 製品・機能名の語彙を DOC_PAGES のパスから作る。
 * `ai-gateway/features/caching` → `AI Gateway` / `Caching` のような表記に直す。
 * 手で並べたリストは必ず古くなるので、既にあるものから引く。
 */
function productVocabulary() {
  const names = new Set()
  for (const page of DOC_PAGES) {
    for (const seg of page.name.split('/')) {
      if (seg.length < 3) continue
      // ケバブを単語に割り、各語を大文字始まりにする（docs の見出し表記に寄せる）
      const words = seg.split('-').filter((w) => w.length > 1)
      if (words.length === 0) continue
      names.add(words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' '))
    }
  }
  // 総称すぎて弁別に使えないものは落とす
  const TOO_GENERIC = new Set([
    'Reference',
    'Concepts',
    'Configuration',
    'Platform',
    'Get Started',
    'Getting Started',
    'How To',
    'Api',
    'Tutorials',
    'Examples',
    'Best Practices',
    'Limits',
    'Pricing',
    'Observability',
    'Security',
    'Features',
    'Settings',
    'Troubleshooting',
    'Glossary',
    'Changelog',
    'Faq',
    'Overview',
    'Guide',
    'Guides',
    'Learning',
    'Reference Architecture',
    'Runtime Apis',
    'Advanced Configuration',
    'Common Policies',
    'Insights',
    'Networks',
    'Integrations',
    'Diagnostics',
    'Investigation',
    'Migration',
    'Migrations',
  ])
  // 単語1つだけの名前は、他の名前の一部として無数に一致する（`Turnstile` の中の `Turn`、
  // `Durable Objects` と `Objects` の二重計上）。**2語以上**に限る。
  // 単語1つで弁別に足る製品名（KV / R2 / D1 など）はコードとして誤答に現れるので、
  // ここで拾わなくても他の指標が効く。
  return [...names].filter((n) => !TOO_GENERIC.has(n) && n.includes(' ') && n.length >= 6)
}

/**
 * 一致した名前のうち、他の名前に完全に含まれるものを落とす。
 * `Rate Limiting` と `Rate Limiting Rules` が両方一致したら長いほうだけを数える。
 */
function distinctMentions(names) {
  return names.filter((n) => !names.some((m) => m !== n && m.includes(n)))
}

const VOCAB = productVocabulary()

/** 能力の否定と、その能力を前提にした動作が同居していないか */
const CANNOT =
  /(?:できない|できません|存在しない|存在しません|対応していない|サポートされていない|使えない|提供されない|行われない|不可能)/
const THEN_DOES =
  /(?:する必要がある|すればよい|しなければならない|して[か-ん]*ら|を使って|で行[うい]|が実行される|が呼び出される|される仕組み|によって行われる)/

/** 定義と量化が衝突しやすい語の組み合わせ（ar-016 の実例から） */
const CONTRADICTION_PAIRS = [
  [/結果整合性|eventual consistency/i, /常に正確|必ず最新|即座に反映|強整合/],
  [/非同期/, /同期的に完了|即座に完了|待たずに確実/],
  [/上限が(?:ある|設定されている)/, /無制限|上限はなく/],
  [/report-only|検知のみ/i, /ブロックされる|遮断される/],
  [/キャッシュされない/, /キャッシュから返される/],
]

let excluded = new Set()
if (excludeRef) {
  const old = new Map(
    JSON.parse(
      execFileSync('git', ['show', `${excludeRef}:src/data/quizzes.json`], {
        cwd: ROOT,
        maxBuffer: 64 * 1024 * 1024,
      }).toString()
    ).quizzes.map((q) => [q.id, q])
  )
  for (const q of quizzes) {
    const o = old.get(q.id)
    if (!o) continue
    if (q.options.some((opt, i) => i !== q.correctIndex && o.options[i]?.text !== opt.text)) excluded.add(q.id)
  }
}

/**
 * 1つの誤答に点数をつける。`screen-recall.mjs` が再現率を測るのに使う。
 */
export function scoreOption(quiz, i) {
  const text = quiz.options[i].text
  const context = `${quiz.question} ${quiz.options[quiz.correctIndex].text} ${quiz.explanation ?? ''}`
  const signals = []
  let score = 0

  // 別製品名への言及。
  //
  // **これは H1 の指紋としては弱い。** 実測の再現率は 10%（`screen-recall.mjs`）。
  // H1 の本体は「別製品の振る舞いを**名前を出さずに**説明している」ことで、
  // この指標はその逆（名前が出ている場合）しか見ていない。
  //   dq-001[2]「各レプリカが非同期に同期する結果整合性モデルのため…」← KV を名指ししない
  //   wf-001[1]「応答しなくなったオリジンを自動的に切り離す」← Load Balancing を名指ししない
  // それでも 1,233肢を十数肢に絞る足切りとしては働くので残している。
  //
  // 「どの製品を使うか」を問う設問では、誤答が別製品名なのは当然で欠陥ではない
  // （`kv-001[0]` の選択肢はそのものずばり `Durable Objects`）ため、散文に限る。
  const isProse = text.length >= 40
  const foreign = isProse ? distinctMentions(VOCAB.filter((n) => text.includes(n) && !context.includes(n))) : []
  if (foreign.length > 0) {
    score += 3 * foreign.length
    signals.push(`他製品の振る舞いを説明している疑い: ${foreign.join(' / ')}`)
  }

  // H2: 能力の否定と、その能力を前提にした動作の同居
  if (CANNOT.test(text) && THEN_DOES.test(text)) {
    score += 2
    signals.push('「できない」と「する必要がある」が同居')
  }

  // H2: 定義と量化の衝突。`ar-016[0]` を実際に検出できた指標
  for (const [a, b] of CONTRADICTION_PAIRS) {
    if (a.test(text) && b.test(text)) {
      score += 4
      signals.push(`定義と衝突する量化: ${text.match(a)?.[0]} × ${text.match(b)?.[0]}`)
    }
  }

  return { score, signals }
}

// `screen-recall.mjs` が scoreOption を import するので、
// 直接実行されたときだけレポートを出す（import の副作用で出力が混ざらないように）
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (!isMain) {
  // モジュールとして読まれた場合はここまで（scoreOption だけを提供する）
} else {
  runReport()
}

function runReport() {
  const rows = []

  for (const quiz of quizzes) {
    if (quiz.type === 'multi' || excluded.has(quiz.id)) continue

    quiz.options.forEach((opt, i) => {
      if (i === quiz.correctIndex) return
      const text = opt.text
      const { score, signals } = scoreOption(quiz, i)

      if (score > 0) {
        rows.push({
          id: quiz.id,
          optionIndex: i,
          score,
          signals,
          question: quiz.question,
          correctText: quiz.options[quiz.correctIndex].text,
          referenceUrl: quiz.referenceUrl ?? null,
          text,
          wrongFeedback: opt.wrongFeedback ?? null,
        })
      }
    })
  }

  rows.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

  console.log('=== 誤答のリスク・スクリーニング ===')
  console.log(`語彙: DOC_PAGES から ${VOCAB.length} 語`)
  if (excludeRef) console.log(`除外: ${excludeRef} から誤答が変わった ${excluded.size}問（監査済みのため）`)
  console.log(`対象: ${quizzes.filter((q) => q.type !== 'multi' && !excluded.has(q.id)).length}問`)
  console.log(`候補: ${rows.length}肢（上位${Math.min(top, rows.length)}件を表示）`)
  console.log('')
  console.log('※ これは検出器ではなく優先度づけ。高スコア＝欠陥ではない。')
  console.log('')

  for (const r of rows.slice(0, top)) {
    console.log(`[${r.score}] ${r.id} [option.${r.optionIndex}]`)
    for (const s of r.signals) console.log(`     ${s}`)
    console.log(`     ${r.text.slice(0, 100)}`)
    console.log('')
  }

  if (jsonPath) {
    const byQuiz = new Map()
    for (const r of rows.slice(0, top)) {
      if (!byQuiz.has(r.id)) {
        byQuiz.set(r.id, {
          id: r.id,
          question: r.question,
          correctText: r.correctText,
          referenceUrl: r.referenceUrl,
          changed: [],
        })
      }
      byQuiz.get(r.id).changed.push({
        optionIndex: r.optionIndex,
        before: null,
        after: r.text,
        wrongFeedback: r.wrongFeedback,
        screenSignals: r.signals,
      })
    }
    const items = [...byQuiz.values()]
    writeFileSync(resolve(jsonPath), `${JSON.stringify(items, null, 2)}\n`)
    console.log(`監査エージェント用の入力を書き出した: ${jsonPath}（${items.length}問）`)
  }
}
