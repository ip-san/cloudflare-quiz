/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExplanationWithDiagrams } from './ExplanationWithDiagrams'

vi.mock('./QuizText', () => ({
  QuizText: ({ text }: { text: string }) => <span>{text}</span>,
}))

vi.mock('./diagrams/DiagramRenderer', () => ({
  DiagramRenderer: ({ diagrams }: { diagrams: unknown[] }) => (
    <div data-testid="diagram">{diagrams.length} diagrams</div>
  ),
}))

const flowDiagram = {
  type: 'flow' as const,
  steps: [
    { text: 'A', sub: '' },
    { text: 'B', sub: '' },
  ],
}
const compDiagram = {
  type: 'comparison' as const,
  columns: [
    { heading: 'X', items: ['a'] },
    { heading: 'Y', items: ['b'] },
  ],
}

// ── マーカーなしの場合 ────────────────────────────────────────────────────────

describe('マーカーなしの場合', () => {
  it('テキストとダイアグラムが順番に表示されること', () => {
    render(<ExplanationWithDiagrams explanation="説明テキスト" diagrams={[flowDiagram]} />)
    expect(screen.getByText('説明テキスト')).toBeDefined()
    expect(screen.getByTestId('diagram')).toBeDefined()
  })

  it('ダイアグラムが空の場合テキストのみ表示されること', () => {
    render(<ExplanationWithDiagrams explanation="テキストのみ" diagrams={[]} />)
    expect(screen.getByText('テキストのみ')).toBeDefined()
    expect(screen.queryByTestId('diagram')).toBeNull()
  })
})

// ── マーカーありの場合 ────────────────────────────────────────────────────────

describe('マーカーありの場合', () => {
  it('{{diagram:0}} と {{diagram:1}} の位置にダイアグラムが挿入されること', () => {
    render(
      <ExplanationWithDiagrams
        explanation="最初{{diagram:0}}中間{{diagram:1}}最後"
        diagrams={[flowDiagram, compDiagram]}
      />
    )
    const diagramNodes = screen.getAllByTestId('diagram')
    expect(diagramNodes).toHaveLength(2)
  })

  it('テキストセグメントが正しく分割されること', () => {
    render(<ExplanationWithDiagrams explanation="前のテキスト{{diagram:0}}後のテキスト" diagrams={[flowDiagram]} />)
    expect(screen.getByText('前のテキスト')).toBeDefined()
    expect(screen.getByText('後のテキスト')).toBeDefined()
  })

  it('空のテキストセグメントがスキップされること', () => {
    // マーカーが先頭と末尾にある場合、空テキストセグメントは表示されない
    render(
      <ExplanationWithDiagrams
        explanation="{{diagram:0}}間のテキスト{{diagram:1}}"
        diagrams={[flowDiagram, compDiagram]}
      />
    )
    expect(screen.getByText('間のテキスト')).toBeDefined()
    // 空テキストはスキップされるので diagram は2つだけ
    const diagramNodes = screen.getAllByTestId('diagram')
    expect(diagramNodes).toHaveLength(2)
  })
})

// ── エッジケース ──────────────────────────────────────────────────────────────

describe('エッジケース', () => {
  it('存在しないインデックスの参照が安全に処理されること', () => {
    // diagrams は 2 つだが {{diagram:5}} を参照 — out-of-bounds なのでその位置には何も挿入されない
    // ただし index 5 は使用済みとしてマークされないので index 0, 1 は残余として末尾に出る
    render(<ExplanationWithDiagrams explanation="テキスト{{diagram:5}}続き" diagrams={[flowDiagram, compDiagram]} />)
    // テキストセグメントは表示される
    expect(screen.getByText('テキスト')).toBeDefined()
    expect(screen.getByText('続き')).toBeDefined()
    // 参照されなかった diagrams[0], diagrams[1] が残余として末尾に表示される
    const diagramNode = screen.getByTestId('diagram')
    expect(diagramNode.textContent).toContain('2 diagrams')
  })

  it('マーカーで参照されていないダイアグラムが末尾に表示されること', () => {
    // {{diagram:0}} のみ参照。compDiagram (index=1) は残余として末尾に出る
    render(<ExplanationWithDiagrams explanation="説明{{diagram:0}}続き" diagrams={[flowDiagram, compDiagram]} />)
    const diagramNodes = screen.getAllByTestId('diagram')
    // diagram:0 の1つ + 残余の compDiagram をまとめた1つ = 2つ
    expect(diagramNodes).toHaveLength(2)
  })
})
