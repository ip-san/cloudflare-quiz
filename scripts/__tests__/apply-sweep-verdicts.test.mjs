import { describe, expect, it } from 'vitest'
import { applyFinding, checkFinding } from '../apply-sweep-verdicts.mjs'

const quiz = (over = {}) => ({
  id: 'x-001',
  correctIndex: 1,
  hint: '現行のヒント',
  question: '現行の設問',
  explanation: '現行の解説',
  options: [
    { text: '誤答ゼロ', wrongFeedback: 'fb0' },
    { text: '正解の肢' },
    { text: '誤答ふたつ', wrongFeedback: 'fb2' },
    { text: '誤答みっつ', wrongFeedback: 'fb3' },
  ],
  ...over,
})

describe('掃引の判定を当てる前の検査', () => {
  it('問題が無ければ空を返す', () => {
    const f = { quizId: 'x-001', verdict: 'modify', survivingGenuine: '誤答2', proposedHint: '新しいヒント' }
    expect(checkFinding(f, quiz())).toEqual([])
  })

  it('modify で survivingGenuine が空なら止める', () => {
    const f = { quizId: 'x-001', verdict: 'modify', proposedHint: '新' }
    expect(checkFinding(f, quiz())[0]).toMatch(/survivingGenuine が空/)
  })

  it('hint-only は survivingGenuine が deferred でなければ止める', () => {
    const f = { quizId: 'x-001', verdict: 'hint-only', survivingGenuine: '誤答2', proposedHint: '新' }
    expect(checkFinding(f, quiz())[0]).toMatch(/deferred/)
  })

  it('change.from が現行と違えば止める（提案が古い）', () => {
    const f = {
      quizId: 'x-001',
      verdict: 'modify',
      survivingGenuine: '誤答2',
      proposedHint: '新',
      change: { field: 'hint', from: '別のヒント', to: '新' },
    }
    expect(checkFinding(f, quiz())[0]).toMatch(/一致しない/)
  })

  it('正解肢が最長なら止める', () => {
    const f = {
      quizId: 'x-001',
      verdict: 'modify',
      survivingGenuine: '誤答2',
      proposedOptions: ['短い', '正解の肢', '短い2', '短い3'],
      proposedWrongFeedback: ['a', null, 'c', 'd'],
    }
    // 正解「正解の肢」(4字) が最長になるよう、他を短くした
    expect(checkFinding(f, quiz()).some((p) => /正解肢が最長/.test(p))).toBe(true)
  })

  it('絶対表現が3肢以上なら止める', () => {
    const f = {
      quizId: 'x-001',
      verdict: 'modify',
      survivingGenuine: '誤答2',
      proposedOptions: ['常にAAAA', '正解', '一切BBBB', '必ずCCCC'],
      proposedWrongFeedback: ['a', null, 'c', 'd'],
    }
    expect(checkFinding(f, quiz()).some((p) => /絶対表現/.test(p))).toBe(true)
  })

  it('正解肢だけがバッククォートを持つなら止める', () => {
    const f = {
      quizId: 'x-001',
      verdict: 'modify',
      survivingGenuine: '誤答2',
      proposedOptions: ['ふつうの誤答です', '`code` の正解', 'ふつうの誤答2です', 'ふつうの誤答3です'],
      proposedWrongFeedback: ['a', null, 'c', 'd'],
    }
    expect(checkFinding(f, quiz()).some((p) => /正解肢だけがバッククォート/.test(p))).toBe(true)
  })

  it('正解肢の本文を変えようとしたら止める（correctText があれば通す）', () => {
    const base = {
      quizId: 'x-001',
      verdict: 'modify',
      survivingGenuine: '誤答2',
      proposedOptions: ['誤答ゼロ', '書き換えた正解', '誤答ふたつ', '誤答みっつ'],
      proposedWrongFeedback: ['a', null, 'c', 'd'],
    }
    expect(checkFinding(base, quiz()).some((p) => /正解肢の本文が変わっている/.test(p))).toBe(true)
    expect(checkFinding({ ...base, correctText: true }, quiz()).some((p) => /正解肢の本文/.test(p))).toBe(false)
  })

  it('正解位置の wrongFeedback が null でなければ止める', () => {
    const f = {
      quizId: 'x-001',
      verdict: 'modify',
      survivingGenuine: '誤答2',
      proposedOptions: ['誤答ゼロ', '正解の肢', '誤答ふたつ', '誤答みっつ'],
      proposedWrongFeedback: ['a', 'これは要らない', 'c', 'd'],
    }
    expect(checkFinding(f, quiz()).some((p) => /null でない/.test(p))).toBe(true)
  })
})

describe('適用', () => {
  it('ヒントだけ変える', () => {
    const q = quiz()
    const fields = applyFinding({ quizId: 'x-001', proposedHint: '新しいヒント' }, q)
    expect(q.hint).toBe('新しいヒント')
    expect(fields).toEqual(['hint'])
  })

  it('選択肢を当てると正解位置の wrongFeedback は消える', () => {
    const q = quiz({
      options: [{ text: 'a' }, { text: 'b', wrongFeedback: '残ってはいけない' }, { text: 'c' }, { text: 'd' }],
    })
    applyFinding(
      {
        quizId: 'x-001',
        proposedOptions: ['a2', 'b2', 'c2', 'd2'],
        proposedWrongFeedback: ['fa', null, 'fc', 'fd'],
      },
      q
    )
    expect(q.options[1].text).toBe('b2')
    expect('wrongFeedback' in q.options[1]).toBe(false)
    expect(q.options[2].wrongFeedback).toBe('fc')
  })
})

describe('wrongFeedback だけの変更', () => {
  const quiz = (over = {}) => ({
    id: 'y-001',
    correctIndex: 1,
    hint: 'h',
    options: [
      { text: 'a', wrongFeedback: '古いa' },
      { text: 'b' },
      { text: 'c', wrongFeedback: '古いc' },
      { text: 'd', wrongFeedback: '古いd' },
    ],
    ...over,
  })

  it('proposedOptions が無くても適用できる', () => {
    const q = quiz()
    const fields = applyFinding({ quizId: 'y-001', proposedWrongFeedback: ['新しいa', null, '新しいc', null] }, q)
    expect(q.options[0].wrongFeedback).toBe('新しいa')
    expect(q.options[2].wrongFeedback).toBe('新しいc')
    expect(q.options[3].wrongFeedback).toBe('古いd') // null は据え置き
    expect(q.options[1].text).toBe('b')
    expect(fields).toEqual(['wrongFeedback'])
  })

  it('正解位置に値があれば止める', () => {
    const f = {
      quizId: 'y-001',
      verdict: 'modify',
      survivingGenuine: '誤答2',
      proposedWrongFeedback: ['a', 'これは要らない', 'c', 'd'],
    }
    expect(checkFinding(f, quiz()).some((p) => /null でない/.test(p))).toBe(true)
  })
})

describe('図のパッチ', () => {
  const quizWithDiagram = () => ({
    id: 'z-001',
    correctIndex: 0,
    options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }],
    diagrams: [
      {
        type: 'comparison',
        label: '古いラベル',
        columns: [
          { heading: 'A', items: ['x', 'y'] },
          { heading: 'B', items: ['z'] },
        ],
      },
    ],
  })

  it('配列を差し替えられる', () => {
    const q = quizWithDiagram()
    const fields = applyFinding(
      {
        quizId: 'z-001',
        proposedDiagrams: [{ index: 0, path: 'diagrams[0].columns[0].items', from: ['x', 'y'], to: ['p', 'q'] }],
      },
      q
    )
    expect(q.diagrams[0].columns[0].items).toEqual(['p', 'q'])
    expect(fields).toEqual(['diagrams(1)'])
  })

  it('文字列も差し替えられる', () => {
    const q = quizWithDiagram()
    applyFinding(
      { quizId: 'z-001', proposedDiagrams: [{ path: 'diagrams[0].label', from: '古いラベル', to: '新しいラベル' }] },
      q
    )
    expect(q.diagrams[0].label).toBe('新しいラベル')
  })

  it('from が現行値と違えば当てずに止める', () => {
    const q = quizWithDiagram()
    expect(() =>
      applyFinding({ quizId: 'z-001', proposedDiagrams: [{ path: 'diagrams[0].label', from: '別の値', to: 'x' }] }, q)
    ).toThrow(/from と一致しない/)
    expect(q.diagrams[0].label).toBe('古いラベル')
  })
})
