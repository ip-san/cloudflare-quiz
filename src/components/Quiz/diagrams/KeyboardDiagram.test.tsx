/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { KeyboardDiagram } from './KeyboardDiagram'

// アニメーション hook は IntersectionObserver / matchMedia に依存するため、
// 可視状態を返すようモックして描画内容だけを検証する。
vi.mock('./useDiagramAnimation', () => ({
  useDiagramAnimation: () => ({
    containerRef: { current: null },
    isVisible: true,
    getItemDelay: () => '0ms',
    itemCount: 0, // 実装シグネチャ(useDiagramAnimation の返り値)と一致させる
  }),
}))

describe('KeyboardDiagram', () => {
  it('renders each key as a keycap', () => {
    render(
      <KeyboardDiagram combos={[{ keys: [{ label: 'Ctrl' }, { label: 'C', highlight: true }], caption: '中断' }]} />
    )
    expect(screen.getByText('Ctrl')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('中断')).toBeInTheDocument()
    // highlight=true は操作キーをアクセント色で強調する（中核表現なので退行を固定）
    expect(screen.getByText('C').className).toContain('claude-orange')
    expect(screen.getByText('Ctrl').className).not.toContain('claude-orange')
  })

  it('joins keys in a combo with "+"', () => {
    render(<KeyboardDiagram combos={[{ keys: [{ label: '⇧ Shift' }, { label: 'Tab' }] }]} />)
    expect(screen.getByText('+')).toBeInTheDocument()
  })

  it('uses an arrow separator for a sequence (e.g. Esc Esc)', () => {
    render(
      <KeyboardDiagram
        sequence
        combos={[{ keys: [{ label: 'Esc' }] }, { keys: [{ label: 'Esc' }] }]}
        caption="2回押し"
      />
    )
    expect(screen.getByText('→')).toBeInTheDocument()
    expect(screen.getByText('2回押し')).toBeInTheDocument()
  })

  it('uses a "/" separator for alternatives (non-sequence)', () => {
    render(<KeyboardDiagram combos={[{ keys: [{ label: 'Ctrl' }, { label: 'C' }] }, { keys: [{ label: 'Esc' }] }]} />)
    expect(screen.getByText('/')).toBeInTheDocument()
  })

  it('renders nothing when there are no combos', () => {
    const { container } = render(<KeyboardDiagram combos={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
