#!/usr/bin/env node

/**
 * 「その設問だけを読んでも意味に辿り着けない略語」を挙げる。
 *
 * ### なぜ略語なのか
 *
 * 2026-08-30 のプレイテストで、初学者を止めたのは Layer4 / FWaaS / DEX / DLQ だった。
 * 共通しているのは**非合成性** ―― 部分から意味が推測できないこと。
 * 「オブジェクトストレージサービス」は長いが語形から読めるので詰まらない。
 *
 * 用語集の候補を機械で挙げる試みは2回失敗している:
 *
 *   頻度で並べる → Cloudflare / リクエスト / ファイル が上位。
 *                  **頻度が高い語は学習者が既に知っている語**に偏る
 *   稀少さで並べる → 長いカタカナ複合語ばかり。語形から読めるので詰まらない
 *
 * 3回目でようやく当たった。ただし当て方が違う。
 * **何が難しいかを当てるのをやめた。** 難易度は主観で、私は実際に外した
 * （用語集の初期23語は頻度で選んで、学習者が既に知っている語ばかりだった）。
 *
 * 代わりに客観的な性質を見る: **その設問の中で展開されているか。**
 * 展開が無ければ、その略語を知らない読み手には解決の手立てが無い。
 * 難しいかどうかは判定していない。**解決可能かどうかだけ**を見ている。
 *
 * ### 出力の使い方
 *
 * ここに挙がった語を機械的に用語集へ入れてはいけない。
 * 「知らない読み手には解けない」は言えるが「実際に詰まる」は言えない。
 * 収録の可否はプレイテストで確かめること。
 *
 * ただし `--corpus-expanded` の分だけは別で、
 * **コーパスが別の設問で既に展開を約束している**ので判断が要らない。
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const difficulty = args.includes('--difficulty') ? args[args.indexOf('--difficulty') + 1] : 'beginner'
const onlyCorpusExpanded = args.includes('--corpus-expanded')
// docs 自身が展開している略語だけに絞る。
// 判断の根拠が「難しそうだから」ではなく「**Cloudflare の docs が技術者向けの文章で
// わざわざ展開している**」になる。読み手はそれより初学者なので、
// docs が展開する語はこちらでも要る（a fortiori）。
const onlyDocsExpanded = args.includes('--docs-expanded')

const ACR = /\b[A-Z]{3,6}\b/g

/**
 * SQL のキーワードや、ほぼ日常語として通っている略語は除く。
 * ここは**主観が入る唯一の場所**なので、外したものを明示しておく。
 * 迷ったら外さないこと（出しすぎるほうが、見落とすより害が小さい）。
 */
const SKIP = new Set([
  // SQL・コード片の一部として出るもの
  'AND',
  'NOT',
  'GET',
  'POST',
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP',
  'LIMIT',
  'JOIN',
  'BY',
  // DNS レコード型そのもの（設問の主題であって、未説明の前提知識ではない）
  'AAAA',
  'CNAME',
  'TXT',
  'SRV',
  // Web の基礎語
  'HTTP',
  'HTTPS',
  'URL',
  'URI',
  'JSON',
  'HTML',
  'CSS',
  'API',
  // 見出し語として拾ってしまうもの
  'NAME',
  'EARLY',
])

/**
 * docs の中で「展開 (略語)」の形が出ている行を、**行ごと**返す。
 *
 * 展開文字列だけを返してはいけない。2026-08-30 に正規表現の捕獲をそのまま使いかけて、
 * 2件を取り違えた:
 *
 *   SSL  「TLS (SSL)」 …… SSL は **TLS の別名**として出ているだけで、展開ではない
 *   SSH  「Infrastructure (SSH)」 …… 製品の見出し語。展開ではない
 *
 * どちらもそのまま用語集に書けば事実の捏造になっていた（em-009 と同じ型）。
 * **必ず行を読ませる**ことで、捕獲を信じる余地を無くす。
 */
function docsExpansionLines(acr) {
  const dir = resolve(ROOT, '.claude/tmp/docs')
  let files
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'))
  } catch {
    return []
  }
  const re = new RegExp(`[A-Za-z][A-Za-z /-]{4,60}\\(${acr}s?\\)`)
  const out = []
  for (const f of files) {
    for (const line of readFileSync(resolve(dir, f), 'utf8').split('\n')) {
      if (re.test(line)) out.push(`${f}: ${line.trim().slice(0, 160)}`)
      if (out.length >= 3) return out
    }
  }
  return out
}

const quizzes = JSON.parse(readFileSync(resolve(ROOT, 'src/data/quizzes.json'), 'utf8')).quizzes
const glossary = readFileSync(resolve(ROOT, 'src/domain/valueObjects/Glossary.ts'), 'utf8')
const terms = [...glossary.matchAll(/term: '([^']+)'/g)].map((m) => m[1])
const inGlossary = (t) => terms.some((h) => h === t || h.includes(t) || t.includes(h))

/** 「展開(略語)」または「略語(展開)」の形。全角/半角どちらの括弧も見る */
function expansionsIn(text) {
  const out = new Map()
  for (const m of text.matchAll(/([A-Z][A-Za-z][A-Za-z -]{6,60}?)\s*[（(]\s*([A-Z]{3,6})\s*[）)]/g))
    if (!out.has(m[2])) out.set(m[2], m[1].trim())
  for (const m of text.matchAll(/\b([A-Z]{3,6})\s*[（(]\s*([A-Z][A-Za-z][A-Za-z -]{6,60}?)\s*[）)]/g))
    if (!out.has(m[1])) out.set(m[1], m[2].trim())
  return out
}

const allText = (q) =>
  [q.question, q.hint, q.explanation, ...q.options.flatMap((o) => [o.text, o.wrongFeedback])]
    .filter((t) => typeof t === 'string')
    .join(' ')

// コーパス全体で1回でも展開されている略語（設問をまたいでよい）
const corpusExpanded = new Map()
for (const q of quizzes)
  for (const [acr, full] of expansionsIn(allText(q)))
    if (!corpusExpanded.has(acr)) corpusExpanded.set(acr, { full, at: q.id })

const found = new Map()
for (const q of quizzes.filter((x) => x.difficulty === difficulty)) {
  // 「選択肢を読んでいる時点で目に入る」ものだけを対象にする。
  // 解説にしか出ない語は、答え合わせのときにその場で読める
  const front = [q.question, q.hint, ...q.options.map((o) => o.text)].filter(Boolean).join(' ')
  const expanded = expansionsIn(allText(q))
  for (const acr of new Set(front.match(ACR) || [])) {
    if (SKIP.has(acr) || inGlossary(acr) || expanded.has(acr)) continue
    if (onlyCorpusExpanded && !corpusExpanded.has(acr)) continue
    if (onlyDocsExpanded && docsExpansionLines(acr).length === 0) continue
    if (!found.has(acr)) found.set(acr, [])
    found.get(acr).push(q.id)
  }
}

const rows = [...found.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
const total = rows.reduce((n, r) => n + r[1].length, 0)

console.log(`=== その設問だけでは解決できない略語（difficulty=${difficulty}）===`)
if (onlyCorpusExpanded) console.log('（コーパスの別の設問で展開されているものだけ）')
console.log('')
if (rows.length === 0) {
  console.log('  該当なし')
} else {
  for (const [acr, ids] of rows) {
    const known = corpusExpanded.get(acr)
    console.log(
      `  ${acr.padEnd(8)} ${String(ids.length).padStart(2)}問  ${ids.slice(0, 6).join(' ')}` +
        (known ? `\n           └ コーパス内の展開: ${known.full}（${known.at}）` : '')
    )
    // docs の行は**要約せずそのまま**出す。捕獲した展開文字列を信じると取り違える
    if (onlyDocsExpanded) for (const line of docsExpansionLines(acr)) console.log(`           │ ${line}`)
  }
  console.log('')
  console.log(`  ${total}件 / ${rows.length}語`)
}
console.log('')
console.log('※ 挙がった語を機械的に用語集へ入れないこと。')
console.log('   「知らない読み手には解けない」は言えるが「実際に詰まる」は言えない。')
console.log('   収録の可否はプレイテストで確かめる（--corpus-expanded の分だけは判断が要らない）。')
if (onlyDocsExpanded) {
  console.log('')
  console.log('※ 上の docs の行を**必ず自分で読むこと**。')
  console.log('   「TLS (SSL)」は SSL が TLS の別名として出ているだけで展開ではない。')
  console.log('   「Infrastructure (SSH)」は製品の見出し語。どちらも展開として扱えば事実の捏造になる。')
}
