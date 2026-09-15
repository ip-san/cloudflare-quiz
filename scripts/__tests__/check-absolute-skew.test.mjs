import { describe, expect, it } from 'vitest'
import { findAbsoluteSkew } from '../check-absolute-skew.mjs'

const q = (texts, correctIndex) => ({
  id: 'x-001',
  difficulty: 'advanced',
  category: 'c',
  correctIndex,
  options: texts.map((text) => ({ text })),
})

describe('findAbsoluteSkew', () => {
  it('誤答3つすべてが絶対表現で正解に無いものを挙げる', () => {
    const r = findAbsoluteSkew([q(['具体的な上限がある', '常にできる', '一切できない', '必ず失敗する'], 0)])
    expect(r.map((x) => x.id)).toEqual(['x-001'])
  })

  it('正解肢にも絶対表現があれば偏っていないので挙げない', () => {
    const r = findAbsoluteSkew([q(['常に上限がある', '常にできる', '一切できない', '必ず失敗する'], 0)])
    expect(r).toEqual([])
  })

  it('誤答の1つでも絶対表現が無ければ挙げない', () => {
    const r = findAbsoluteSkew([q(['具体的な上限がある', '常にできる', '50GBまで保持する', '必ず失敗する'], 0)])
    expect(r).toEqual([])
  })

  it('正解の位置が先頭以外でも正しく判定する', () => {
    const r = findAbsoluteSkew([q(['常にできる', '一切できない', '具体的な上限がある', '必ず失敗する'], 2)])
    expect(r.map((x) => x.id)).toEqual(['x-001'])
  })

  it('絶対表現がどこにも無ければ挙げない', () => {
    const r = findAbsoluteSkew([q(['上限がある', '50GBまで', '100GBまで', '設定で変わる'], 0)])
    expect(r).toEqual([])
  })
})
