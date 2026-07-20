/**
 * @vitest-environment jsdom
 *
 * PWAUpdatePrompt コンポーネントのユニットテスト
 *
 * テスト対象:
 * - controllerchange イベントでバナーが表示されること
 * - 更新ボタンが window.location.reload を呼ぶこと
 * - 初期状態ではバナーが非表示であること
 * - アンマウント時にイベントリスナーが解除されること
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PWAUpdatePrompt } from './PWAUpdatePrompt'

// locale モジュールをモック
vi.mock('@/config/locale', () => ({
  locale: {
    pwaUpdate: {
      updated: '新しいバージョンが利用可能です',
      reload: '更新',
    },
  },
}))

// navigator.serviceWorker のモック
let controllerChangeHandler: (() => void) | null = null
const mockServiceWorker = {
  addEventListener: vi.fn((event: string, handler: () => void) => {
    if (event === 'controllerchange') controllerChangeHandler = handler
  }),
  removeEventListener: vi.fn(),
}

// window.location.reload のモック
const reloadMock = vi.fn()

beforeEach(() => {
  controllerChangeHandler = null
  mockServiceWorker.addEventListener.mockClear()
  mockServiceWorker.removeEventListener.mockClear()
  reloadMock.mockClear()

  Object.defineProperty(navigator, 'serviceWorker', {
    value: mockServiceWorker,
    configurable: true,
  })

  Object.defineProperty(window, 'location', {
    value: { reload: reloadMock },
    writable: true,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

// ── PWA環境の場合 ─────────────────────────────────────────────────────────────

describe('PWA環境の場合', () => {
  it('controllerchange イベントでバナーが表示されること', () => {
    render(<PWAUpdatePrompt />)

    // 初期状態ではバナーは非表示
    expect(screen.queryByText('新しいバージョンが利用可能です')).toBeNull()

    // controllerchange イベントを発火させる
    act(() => {
      if (controllerChangeHandler) controllerChangeHandler()
    })

    // バナーが表示されること
    expect(screen.queryByText('新しいバージョンが利用可能です')).not.toBeNull()
  })

  it('更新ボタンが location.reload を呼ぶこと', () => {
    render(<PWAUpdatePrompt />)

    // controllerchange イベントを発火させてバナーを表示
    act(() => {
      if (controllerChangeHandler) controllerChangeHandler()
    })

    // 更新ボタンをクリック
    const reloadButton = screen.getByRole('button', { name: '更新' })
    fireEvent.click(reloadButton)

    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('初期状態ではバナーが非表示であること', () => {
    const { container } = render(<PWAUpdatePrompt />)

    // イベントを発火させずに確認
    expect(screen.queryByText('新しいバージョンが利用可能です')).toBeNull()
    expect(screen.queryByText('更新')).toBeNull()
    expect(container.firstChild).toBeNull()
  })

  it('アンマウント時にイベントリスナーが解除されること', () => {
    const { unmount } = render(<PWAUpdatePrompt />)

    // addEventListener が呼ばれていること
    expect(mockServiceWorker.addEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function))

    // アンマウント
    unmount()

    // removeEventListener が同じハンドラで呼ばれていること
    expect(mockServiceWorker.removeEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function))
    expect(mockServiceWorker.removeEventListener).toHaveBeenCalledTimes(1)
  })
})
