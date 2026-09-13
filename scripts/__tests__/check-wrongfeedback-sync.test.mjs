import { describe, expect, it } from 'vitest'
import { findStaleFeedback } from '../check-wrongfeedback-sync.mjs'

const q = (options, correctIndex = 0) => ({ id: 'x-001', correctIndex, options })

describe('findStaleFeedback', () => {
  it('本文を替えて feedback を据え置いた肢を挙げる', () => {
    const base = [q([{ text: '正解' }, { text: '旧誤答', wrongFeedback: '旧の理由' }])]
    const head = [q([{ text: '正解' }, { text: '新誤答', wrongFeedback: '旧の理由' }])]
    const stale = findStaleFeedback(base, head)
    expect(stale).toHaveLength(1)
    expect(stale[0]).toMatchObject({ id: 'x-001', index: 1, text: '新誤答' })
  })

  it('本文と feedback を両方替えたものは挙げない', () => {
    const base = [q([{ text: '正解' }, { text: '旧誤答', wrongFeedback: '旧の理由' }])]
    const head = [q([{ text: '正解' }, { text: '新誤答', wrongFeedback: '新の理由' }])]
    expect(findStaleFeedback(base, head)).toEqual([])
  })

  it('何も変えていなければ挙げない', () => {
    const base = [q([{ text: '正解' }, { text: '誤答', wrongFeedback: '理由' }])]
    expect(findStaleFeedback(base, structuredClone(base))).toEqual([])
  })

  it('正解肢は対象外（本文が変わっても挙げない）', () => {
    const base = [
      q([
        { text: '旧正解', wrongFeedback: '理由' },
        { text: '誤答', wrongFeedback: '別の理由' },
      ]),
    ]
    const head = [
      q([
        { text: '新正解', wrongFeedback: '理由' },
        { text: '誤答', wrongFeedback: '別の理由' },
      ]),
    ]
    expect(findStaleFeedback(base, head)).toEqual([])
  })

  it('肢の順序が入れ替わっただけなら挙げない（quiz:randomize 対策）', () => {
    const base = [q([{ text: '正解' }, { text: 'A', wrongFeedback: 'a' }, { text: 'B', wrongFeedback: 'b' }])]
    const head = [q([{ text: '正解' }, { text: 'B', wrongFeedback: 'b' }, { text: 'A', wrongFeedback: 'a' }])]
    expect(findStaleFeedback(base, head)).toEqual([])
  })

  it('feedback が無い肢は対象外', () => {
    const base = [q([{ text: '正解' }, { text: '旧誤答' }])]
    const head = [q([{ text: '正解' }, { text: '新誤答' }])]
    expect(findStaleFeedback(base, head)).toEqual([])
  })

  it('新しく増えた設問は基準に無いので挙げない', () => {
    const head = [q([{ text: '正解' }, { text: '誤答', wrongFeedback: '理由' }])]
    expect(findStaleFeedback([], head)).toEqual([])
  })
})
