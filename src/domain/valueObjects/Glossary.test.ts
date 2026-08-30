import { describe, expect, it } from 'vitest'
import { GLOSSARY, hasTerm, indexOfTerm } from './Glossary'

/**
 * 略語が別の語に埋もれて誤爆しないことを守る。
 *
 * 2026-08-30、`DEX` を収録しようとしたとき D1 の設問にある
 * `CREATE INDEX` の IN**DEX** に当たることに気づいた。
 * 本文側はコード片を除外していたので偶然逃れていたが、
 * チップ側は生の文字列を `includes` で見ていたので**確実に出ていた**。
 * 「本文で出ていないから大丈夫」は根拠にならない、という形の失敗だった。
 */
describe('用語の照合は英数字の語境界を見る', () => {
  it('略語が英単語の一部に当たらない', () => {
    expect(hasTerm('CREATE INDEX で作成する', 'DEX')).toBe(false)
    expect(hasTerm('PERFORMANCE の指標', 'ORM')).toBe(false)
    expect(hasTerm('GREEDYな正規表現', 'GRE')).toBe(false)
  })

  it('語として現れていれば当たる', () => {
    expect(hasTerm('DEX のテスト結果を見る', 'DEX')).toBe(true)
    expect(hasTerm('GREトンネルを張る', 'GRE')).toBe(true)
    expect(hasTerm('(DEX)', 'DEX')).toBe(true)
    expect(hasTerm('ORMをそのまま使える', 'ORM')).toBe(true)
  })

  it('日本語の語は境界を要求しない（区切りが無いため）', () => {
    expect(hasTerm('オリジンサーバーへ', 'オリジン')).toBe(true)
    expect(hasTerm('エッジキャッシュ', 'エッジ')).toBe(true)
  })

  it('埋没した位置を飛ばして、後ろの正しい出現を見つける', () => {
    const text = 'CREATE INDEX を作ってから DEX で監視する'
    expect(indexOfTerm(text, 'DEX')).toBe(text.lastIndexOf('DEX'))
  })

  it('長い語から先に照合できるよう文字数の降順で並んでいる', () => {
    const lens = GLOSSARY.map((e) => e.term.length)
    expect(lens).toEqual([...lens].sort((a, b) => b - a))
  })
})
