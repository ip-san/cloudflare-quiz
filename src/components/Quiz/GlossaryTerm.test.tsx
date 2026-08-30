import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { clampShift } from './GlossaryTerm'
import { QuizText } from './QuizText'

/**
 * 用語集の表示。
 *
 * 本文を書き換えずに語の説明を届けるための仕組みなので、
 * 「本文が変わらないこと」と「コード片には手を出さないこと」が要件になる。
 * 詳しい経緯は src/domain/valueObjects/Glossary.ts を参照。
 */
describe('用語集', () => {
  it('本文中の用語がタップで説明を開ける', () => {
    render(<QuizText text="最寄りのエッジでキャッシュします" />)
    const term = screen.getByRole('button', { name: 'エッジ' })
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.click(term)
    expect(screen.getByRole('note').textContent).toMatch(/Cloudflareのデータセンター/)
  })

  it('同じ語は1つの本文につき最初の1回だけマークする（下線だらけにしない）', () => {
    render(<QuizText text="オリジンへ問い合わせ、オリジンから返る" />)
    expect(screen.getAllByRole('button', { name: 'オリジン' })).toHaveLength(1)
  })

  it('コード片の中の語はマークしない', () => {
    const { container } = render(<QuizText text="`TTL` の設定" />)
    expect(container.querySelector('code')?.textContent).toBe('TTL')
    expect(screen.queryByRole('button', { name: 'TTL' })).toBeNull()
  })

  it('長い語を優先する（WAFカスタムルールがWAFに割られない）', () => {
    render(<QuizText text="WAFカスタムルールで止めます" />)
    expect(screen.getByRole('button', { name: 'WAFカスタムルール' })).toBeTruthy()
  })

  it('用語が無い本文はそのまま描画される', () => {
    render(<QuizText text="ここには用語がありません" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('ここには用語がありません')).toBeTruthy()
  })

  // 実ブラウザではタップ時に mousedown が click より先に起きる。
  // 外側のタップで閉じる仕組みはそれを見ているので、テストでも同じ順で発火させる。
  // click だけを送ると、実際には起きない「2つ開いたまま」の状態を検証してしまう。
  function tap(el: HTMLElement) {
    fireEvent.mouseDown(el)
    fireEvent.click(el)
  }

  it('別の語を開くと前の説明は閉じる（画面が説明で埋まらない）', () => {
    render(<QuizText text="エッジとオリジン" />)
    tap(screen.getByRole('button', { name: 'エッジ' }))
    expect(screen.getAllByRole('note')).toHaveLength(1)
    tap(screen.getByRole('button', { name: 'オリジン' }))
    expect(screen.getAllByRole('note')).toHaveLength(1)
    expect(screen.getByRole('note').textContent).toMatch(/元のサーバー/)
  })

  it('Escape で閉じる', () => {
    render(<QuizText text="エッジでキャッシュ" />)
    fireEvent.click(screen.getByRole('button', { name: 'エッジ' }))
    expect(screen.getByRole('note')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('note')).toBeNull()
  })
})

describe('用語集を出さない場所', () => {
  /**
   * 選択肢は `<button>` なので、その中に用語のボタンを置くと
   * 用語をタップした時点でその選択肢が選ばれてしまう。
   * 2026-08-30 に実機で確認して分かった。入れ子の対話要素は
   * アクセシビリティ上も不正。
   */
  it('glossary={false} のとき用語をマークしない', () => {
    render(<QuizText text="最寄りのエッジでキャッシュします" glossary={false} />)
    expect(screen.queryByRole('button', { name: 'エッジ' })).toBeNull()
    expect(screen.getByText(/最寄りのエッジでキャッシュします/)).toBeTruthy()
  })

  it('glossary={false} でもインラインコードは描画される', () => {
    const { container } = render(<QuizText text="`env.DB` を使う" glossary={false} />)
    expect(container.querySelector('code')?.textContent).toBe('env.DB')
  })
})

describe('ポップオーバーの横位置', () => {
  // 幅390pxの端末。チップの行が折り返して右端まで並ぶので、右寄りの語で実際に起きる
  const MOBILE = 390

  it('右へはみ出すぶんだけ左へ寄せる', () => {
    // 左端300px・幅256px → 右端556px。画面は390px
    expect(clampShift(300, 556, MOBILE)).toBe(390 - 8 - 556)
  })

  it('収まっているときは動かさない', () => {
    expect(clampShift(20, 276, MOBILE)).toBe(0)
  })

  it('寄せた結果それでも左が切れるなら、左端に合わせる', () => {
    // 画面より説明のほうが広い場合。右を優先して左が負にならないようにする
    expect(clampShift(100, 500, 320)).toBe(8 - 100)
  })
})
