import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QuizText } from './QuizText'

/**
 * 「※」で始まる行を注記として控えめに描くこと。
 *
 * 2026-08-29 のプレイテストで初学者が、ac-008 の設問末尾に足した用語注記について
 * 「文字の見た目が問題文と全く同じだから、覚えなきゃいけない条件の一部かと身構えた」
 * と報告した。その注記は**前回のテスターが用語を知らずに詰まったから足した**ものなので、
 * 内容の修正が描画に負けていたことになる。注記は注記に見えないと役に立たない。
 */
describe('QuizText の注記行', () => {
  it('「※」で始まる行は控えめな見た目になる', () => {
    render(<QuizText text={'本題の文\n※ これは注記です'} />)
    const note = screen.getByText(/これは注記です/)
    expect(note.className).toMatch(/text-stone-500/)
    expect(note.className).toMatch(/0\.9em/)
  })

  it('本文の行は注記の見た目にならない', () => {
    render(<QuizText text={'本題の文\n続きの本文'} />)
    const body = screen.getByText(/続きの本文/)
    expect(body.className ?? '').not.toMatch(/text-stone-500/)
  })

  it('注記行の中でも `code` は描画される', () => {
    const { container } = render(<QuizText text={'本題\n※ `env.DB` のことです'} />)
    expect(container.querySelector('code')?.textContent).toBe('env.DB')
  })
})
