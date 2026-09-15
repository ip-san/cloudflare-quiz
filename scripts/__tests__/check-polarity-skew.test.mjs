import { describe, expect, it } from 'vitest'
import { findPolaritySkew } from '../check-polarity-skew.mjs'

const q = (id, correctIndex, texts) => ({
  id,
  difficulty: 'beginner',
  correctIndex,
  options: texts.map((text) => ({ text })),
})

describe('制限の偏り（正解だけが「できること」を述べる）', () => {
  it('誤答3つすべてが制限を述べ、正解肢が述べていなければ挙げる', () => {
    const f = findPolaritySkew([
      q('a-001', 3, ['Aはできない', 'Bは含まれない', 'Cに対応していない', 'DとEの両方を扱える']),
    ])
    expect(f.map((x) => x.id)).toEqual(['a-001'])
  })

  it('正解肢も制限を述べているなら挙げない（制限そのものを問う設問）', () => {
    const f = findPolaritySkew([
      q('a-002', 3, ['Aはできない', 'Bは含まれない', 'Cに対応していない', 'Dは利用できない']),
    ])
    expect(f).toEqual([])
  })

  it('誤答の1つでも制限を述べていなければ挙げない（偏りではない）', () => {
    const f = findPolaritySkew([
      q('a-003', 3, ['Aはできない', 'Bは含まれない', 'Cも同時に扱える', 'DとEの両方を扱える']),
    ])
    expect(f).toEqual([])
  })

  it('「〜は不要」も制限として数える（正解だけが手順を並べる形）', () => {
    const f = findPolaritySkew([
      q('a-005', 2, ['追加設定は不要になる', '設定を行う必要はない', 'AとBとCを順に設定する', 'Access側の設定は不要']),
    ])
    expect(f.map((x) => x.id)).toEqual(['a-005'])
  })

  it('正解肢の位置が先頭でも判定できる', () => {
    const f = findPolaritySkew([
      q('a-004', 0, ['DとEの両方を扱える', 'Aはできない', 'Bは含まれない', 'Cに対応していない']),
    ])
    expect(f.map((x) => x.id)).toEqual(['a-004'])
  })
})
