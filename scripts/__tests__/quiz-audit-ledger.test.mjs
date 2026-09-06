import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  applyMark,
  diffLedger,
  fingerprint,
  inLayer,
  LAYERS,
  loadLedger,
  parseMarkArgs,
} from '../quiz-audit-ledger.mjs'

/**
 * 監査台帳の指紋が守るべき性質。
 *
 * 0. 層は distractors / correct / diagrams / hint の4つ。referenceUrl は入れない。
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

  it('referenceUrl の変更はどの層の指紋も動かさない（アンカーは lint:url の担当）', () => {
    const a = sample()
    const b = sample()
    b.referenceUrl = 'https://developers.cloudflare.com/workers/#other'
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
    expect(moved((q) => (q.hint = 'H2'))).toEqual(['hint'])
  })

  it('図を全部消した設問・multi になった設問は「対象外」であって「消えた」ではない（prune が存在する設問の記録を消さない）', () => {
    const a = sample()
    const b = { ...sample(), id: 'zz-002' }
    const ledger = { layers: Object.fromEntries(LAYERS.map((l) => [l, {}])) }
    for (const q of [a, b]) for (const l of LAYERS) ledger.layers[l][q.id] = { fp: fingerprint(q, l), at: '2026-09-06' }
    a.diagrams = []
    b.type = 'multi'
    const d = diffLedger([a, b], ledger)
    expect(d.diagrams.outOfLayer).toEqual(['zz-001'])
    expect(d.diagrams.dead).toEqual([])
    expect(d.distractors.outOfLayer).toEqual(['zz-002'])
    expect(d.correct.outOfLayer).toEqual(['zz-002'])
    expect(d.hint.outOfLayer).toEqual([])
    expect(d.distractors.dead).toEqual([])
    expect(d.diagrams.recorded).toBe(1)
    expect(d.diagrams.total).toBe(1)
  })

  it('diffLedger は「変わった」「記録なし」「設問が消えた記録」を分けて出す', () => {
    const a = sample()
    const b = { ...sample(), id: 'zz-002' }
    const ledger = { layers: Object.fromEntries(LAYERS.map((l) => [l, {}])) }
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

describe('mark の引数', () => {
  it('--note の値にオプションを飲み込まない（--note --bulk が note="--bulk" として通っていた）', () => {
    expect(() => parseMarkArgs(['correct', '--at', 'HEAD', '--note', '--bulk', 'cb-011'])).toThrow(/--note の値が無い/)
    expect(() => parseMarkArgs(['correct', '--at', 'HEAD', '--note', '--at', 'HEAD', 'cb-011'])).toThrow(
      /--note の値が無い/
    )
    expect(() => parseMarkArgs(['correct', '--at', 'HEAD', 'cb-011', '--note'])).toThrow(/--note の値が無い/)
  })

  it('--at は必須で、2 回は指定できず、オプションに見える値は弾く', () => {
    expect(() => parseMarkArgs(['correct', 'cb-011'])).toThrow(/--at <ref> は必須/)
    expect(() => parseMarkArgs(['correct', '--at', 'HEAD', '--at', 'abc', 'cb-011'])).toThrow(/2 回/)
    expect(() => parseMarkArgs(['correct', '--at', '--bulk', 'cb-011'])).toThrow(/値が無い/)
    expect(() => parseMarkArgs(['correct', '--at', '-1', 'cb-011'])).toThrow(/オプションに見える/)
  })

  it('ID を省くには --bulk が要り、--baseline は --bulk と一緒にしか使えない', () => {
    expect(() => parseMarkArgs(['hint', '--at', 'HEAD'])).toThrow(/--bulk が要る/)
    expect(parseMarkArgs(['hint', '--at', 'HEAD', '--bulk']).bulk).toBe(true)
    expect(() => parseMarkArgs(['hint', '--at', 'HEAD', '--baseline', 'cb-011'])).toThrow(/--baseline は --bulk/)
    expect(() => parseMarkArgs(['hint', '--at', 'HEAD', '--bulk', '--baseline'])).toThrow(/--baseline には --note/)
    expect(parseMarkArgs(['hint', '--at', 'HEAD', '--bulk', '--baseline', '--note', 'b']).baseline).toBe(true)
  })

  it('--note は「指定なし」と「明示的に空」を区別し、--bulk と ID は同時に指定できない', () => {
    expect(parseMarkArgs(['hint', '--at', 'HEAD', 'wk-001']).note).toBeNull()
    expect(parseMarkArgs(['hint', '--at', 'HEAD', '--note', '', 'wk-001']).note).toBe('')
    expect(() => parseMarkArgs(['hint', '--at', 'HEAD', '--bulk', 'wk-001'])).toThrow(/--bulk と ID/)
    expect(() => parseMarkArgs(['hint', '--at', 'HEAD', '--bulk', '--baseline', 'wk-001'])).toThrow(/--bulk と ID/)
  })

  it('空白入りの ID は zsh の単語分割の説明つきで弾く。all は 4 層に展開する', () => {
    expect(() => parseMarkArgs(['hint', '--at', 'HEAD', 'wk-001 wk-002'])).toThrow(/単語分割/)
    const r = parseMarkArgs(['all', '--at', 'HEAD', '--note', 'n', 'wk-001', 'wk-002'])
    expect(r.layers).toEqual(LAYERS)
    expect(r.ids).toEqual(['wk-001', 'wk-002'])
    expect(r.note).toBe('n')
  })
})

describe('applyMark（記録を書く本体）', () => {
  const opts = (o) => ({
    layers: ['hint'],
    sha: 'abc1234',
    note: null,
    baseline: false,
    ids: [],
    at: '2026-09-06',
    ...o,
  })
  const fresh = () => ({ layers: Object.fromEntries(LAYERS.map((l) => [l, {}])) })

  it('note の無い基準点の記録は、--note なしの ID 明示 mark で昇格できない', () => {
    const q = sample()
    const ledger = fresh()
    ledger.layers.hint[q.id] = { fp: fingerprint(q, 'hint'), at: '2026-09-01', ref: 'old0000', baseline: true }
    expect(() => applyMark(ledger, [q], opts({ ids: [q.id] }))).toThrow(/基準点の記録/)
    expect(ledger.layers.hint[q.id].baseline).toBe(true)
  })

  it('--note 付きなら基準点が落ちて検証済みになり、基準点の note は引き継がれない', () => {
    const q = sample()
    const ledger = fresh()
    ledger.layers.hint[q.id] = {
      fp: 'stale0000000',
      at: '2026-09-01',
      ref: 'old0000',
      note: '基準点。未検証',
      baseline: true,
    }
    const r = applyMark(ledger, [q], opts({ ids: [q.id], note: '検証した' }))
    expect(r.n).toBe(1)
    expect(ledger.layers.hint[q.id]).toEqual({
      fp: fingerprint(q, 'hint'),
      at: '2026-09-06',
      ref: 'abc1234',
      note: '検証した',
    })
  })

  it('検証済みの記録に --note なしなら前の note を引き継ぎ、--note "" なら note を消す', () => {
    const q = sample()
    const ledger = fresh()
    ledger.layers.hint[q.id] = { fp: 'stale0000000', at: '2026-09-01', ref: 'old0000', note: '前の検証' }
    const r1 = applyMark(ledger, [q], opts({ ids: [q.id] }))
    expect(r1.carried).toEqual([`hint:${q.id}`])
    expect(ledger.layers.hint[q.id].note).toBe('前の検証')
    ledger.layers.hint[q.id].fp = 'stale0000000'
    applyMark(ledger, [q], opts({ ids: [q.id], note: '' }))
    expect(ledger.layers.hint[q.id].note).toBeUndefined()
  })

  it('一括 mark は指紋の同じ記録を据え置き、変わった記録だけ書く。基準点は baseline を持つ', () => {
    const a = sample()
    const b = { ...sample(), id: 'zz-002', hint: 'H-b' }
    const ledger = fresh()
    ledger.layers.hint[a.id] = {
      fp: fingerprint(a, 'hint'),
      at: '2026-09-01',
      ref: 'old0000',
      note: '据え置かれるべき',
    }
    const r = applyMark(ledger, [a, b], opts({ baseline: true, note: '基準' }))
    expect(r.kept).toBe(1)
    expect(r.n).toBe(1)
    expect(ledger.layers.hint[a.id].note).toBe('据え置かれるべき')
    expect(ledger.layers.hint[b.id]).toEqual({
      fp: fingerprint(b, 'hint'),
      at: '2026-09-06',
      ref: 'abc1234',
      note: '基準',
      baseline: true,
    })
  })

  it('存在しない ID は例外、層の対象外の ID は無視して報告する', () => {
    const q = { ...sample(), diagrams: [] }
    const ledger = fresh()
    expect(() => applyMark(ledger, [q], opts({ ids: ['zz-999'] }))).toThrow(/無い ID/)
    const r = applyMark(ledger, [q], opts({ layers: ['diagrams'], ids: [q.id], note: 'x' }))
    expect(r.n).toBe(0)
    expect(r.ignored).toEqual([`diagrams:${q.id}`])
  })
})

describe('層の対象', () => {
  it('hint は multi 型でも対象、誤答・正解は multi を数えない、図は空なら対象外', () => {
    const q = { ...sample(), type: 'multi', diagrams: [] }
    expect(inLayer(q, 'hint')).toBe(true)
    expect(inLayer(q, 'distractors')).toBe(false)
    expect(inLayer(q, 'correct')).toBe(false)
    expect(inLayer(q, 'diagrams')).toBe(false)
  })
})

describe('loadLedger の互換性', () => {
  it('layers が無い / null の JSON でも 4 層の空の台帳として読める', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ledger-'))
    for (const body of ['{}', '{"layers": null}', '{"layers": {"correct": {}}}']) {
      const path = join(dir, 'l.json')
      writeFileSync(path, body)
      const ledger = loadLedger(path)
      for (const l of LAYERS) expect(ledger.layers[l]).toEqual({})
    }
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
