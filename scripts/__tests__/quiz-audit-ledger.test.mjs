import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { diffLedger, fingerprint, LAYERS, loadLedger } from '../quiz-audit-ledger.mjs'

/**
 * 監査台帳の指紋が守るべき性質。
 *
 * 1. `quiz:randomize` は選択肢順と correctIndex を入れ替えるが内容は変えない。
 *    指紋が動いたら、並べ替えのたびに全問が「台帳確定後に変わった」になり検出が無意味になる。
 * 2. 層は独立している。解説を直しても誤答の台帳は動かず、図を直しても正解の台帳は動かない。
 *    2026-09-02 に kv-012 が「図の台帳より前に図が変わった」ことで検証の対象から漏れた。
 *    層ごとに別の基準を持てることが、この台帳の存在理由。
 * 3. 追跡されている台帳ファイルに、存在しない設問の記録が溜まらない。
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function sample() {
  return {
    id: 'zz-001',
    type: 'single',
    question: 'Q',
    hint: 'H',
    explanation: 'E',
    referenceUrl: 'https://developers.cloudflare.com/workers/',
    correctIndex: 1,
    options: [
      { text: 'wrong-a', wrongFeedback: 'fa' },
      { text: 'right' },
      { text: 'wrong-b', wrongFeedback: 'fb' },
      { text: 'wrong-c', wrongFeedback: 'fc' },
    ],
    diagrams: [{ type: 'flow', label: 'L', steps: [{ text: 's1' }] }],
  }
}

function fps(q) {
  return Object.fromEntries(LAYERS.map((l) => [l, fingerprint(q, l)]))
}

describe('監査台帳の指紋', () => {
  it('選択肢を並べ替えて correctIndex を動かしても、3層とも指紋は変わらない', () => {
    const a = sample()
    const b = sample()
    b.options = [b.options[3], b.options[1], b.options[0], b.options[2]]
    b.correctIndex = 1
    const c = sample()
    c.options = [c.options[1], c.options[2], c.options[3], c.options[0]]
    c.correctIndex = 0
    expect(fps(b)).toEqual(fps(a))
    expect(fps(c)).toEqual(fps(a))
  })

  it('referenceUrl と hint の変更はどの層の指紋も動かさない（URL は lint:url、hint はプレイテストの担当）', () => {
    const a = sample()
    const b = sample()
    b.referenceUrl = 'https://developers.cloudflare.com/workers/#other'
    b.hint = 'H2'
    expect(fps(b)).toEqual(fps(a))
  })

  it('各フィールドの変更は、ちょうど1つの層の指紋だけを動かす', () => {
    const base = fps(sample())
    const moved = (mutate) => {
      const q = sample()
      mutate(q)
      const f = fps(q)
      return LAYERS.filter((l) => f[l] !== base[l])
    }
    expect(moved((q) => (q.explanation = 'E2'))).toEqual(['correct'])
    expect(moved((q) => (q.question = 'Q2'))).toEqual(['correct'])
    expect(moved((q) => (q.options[1].text = 'right2'))).toEqual(['correct'])
    expect(moved((q) => (q.options[0].text = 'wrong-a2'))).toEqual(['distractors'])
    expect(moved((q) => (q.options[2].wrongFeedback = 'fb2'))).toEqual(['distractors'])
    expect(moved((q) => (q.diagrams[0].steps[0].text = 's2'))).toEqual(['diagrams'])
  })

  it('diffLedger は「変わった」「記録なし」「設問が消えた記録」を分けて出す', () => {
    const a = sample()
    const b = { ...sample(), id: 'zz-002' }
    const ledger = { layers: { distractors: {}, correct: {}, diagrams: {} } }
    for (const l of LAYERS) ledger.layers[l]['zz-001'] = { fp: fingerprint(a, l), at: '2026-09-02' }
    ledger.layers.correct['zz-999'] = { fp: 'deadbeef0000', at: '2026-09-02' }
    a.explanation = 'E2'
    const d = diffLedger([a, b], ledger)
    expect(d.correct.changed).toEqual(['zz-001'])
    expect(d.distractors.changed).toEqual([])
    expect(d.correct.unrecorded).toEqual(['zz-002'])
    expect(d.correct.dead).toEqual(['zz-999'])
  })
})

describe('追跡されている台帳ファイル', () => {
  const path = resolve(ROOT, '.claude/quiz-audit-ledger.json')

  it('存在し、記録された ID はすべて現在の quizzes.json にある（死んだ記録を溜めない）', () => {
    expect(existsSync(path)).toBe(true)
    const ledger = loadLedger(path)
    const quizzes = JSON.parse(readFileSync(resolve(ROOT, 'src/data/quizzes.json'), 'utf8')).quizzes
    const d = diffLedger(quizzes, ledger)
    for (const l of LAYERS) {
      expect(d[l].dead, `${l} に消えた設問の記録がある。node scripts/quiz-audit-ledger.mjs prune で落とす`).toEqual([])
    }
  })

  // 「記録なし」は落とさない。足したばかりの設問は検証されるまで記録が無いのが正しく、
  // ここで落とすと mark で緑にする圧力になる（mark は「検証した」の宣言）。quiz:status が報告する
})
