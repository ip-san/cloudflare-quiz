import { expect, type Page, test } from '@playwright/test'

/**
 * Visual Regression テスト
 *
 * playwright.config.ts は visual-desktop / visual-iPhone-SE / visual-Galaxy-S8 /
 * visual-Pixel-7 / visual-iPhone-14-Pro-Max / visual-Galaxy-Tab-S9 / visual-iPad の
 * 7プロジェクトを `testMatch: /visual/` で定義している。このファイルが無い間、
 * それらは「エラーも出さず0件成功」で終わっていた（設定だけが残った空撃ち状態）。
 *
 * welcome + menu: 全デバイスで実行（固定レイアウト）
 * diagram + reader + freeTier: desktop のみ（可変コンテンツのため、モバイル分まで
 * 撮ると問題追加のたびに差分が出て運用できなくなる）
 * クイズ回答画面は撮らない——理由は下の「クイズ回答画面を撮らない理由」を参照。
 *
 * 実行: bun run test:e2e
 * ベースライン更新: bunx playwright test --update-snapshots
 */

/**
 * 許容差分比。
 * 移植元は 0.05 だったが、1280x720 で 46,000 画素まで差分を許すため、
 * 見出しの色やサイズを変えても検知できないことを実測で確認した（2026-08-25）。
 * アンチエイリアスの揺れは吸収しつつ実際の変更は捉えられる水準まで下げている。
 */
const DIFF_RATIO = 0.002

/** Skip welcome + tutorial to reach menu screen */
async function goToMenu(page: Page) {
  await page.getByRole('button', { name: /はじめる/ }).click()
  const skip = page.getByRole('button', { name: 'スキップ' })
  if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skip.click()
  }
  await page.getByRole('button', { name: 'メニューを開く' }).waitFor({ timeout: 5000 })
}

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('welcome screen — light mode', async ({ page }) => {
    await expect(page).toHaveScreenshot('welcome-light.png', {
      maxDiffPixelRatio: DIFF_RATIO,
    })
  })

  test('welcome screen — dark mode', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await expect(page).toHaveScreenshot('welcome-dark.png', {
      maxDiffPixelRatio: DIFF_RATIO,
    })
  })

  test('menu screen — light mode', async ({ page }) => {
    await goToMenu(page)
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('menu-light.png', {
      maxDiffPixelRatio: DIFF_RATIO,
    })
  })

  test('menu screen — dark mode', async ({ page }) => {
    await goToMenu(page)
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
    })
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot('menu-dark.png', {
      maxDiffPixelRatio: DIFF_RATIO,
    })
  })

  /**
   * 以下は desktop のみで追跡する。
   * `reducedMotion: 'reduce'` でターミナルのタイピング演出を完了状態に固定し、
   * アニメーション付きの図があってもスナップショットが安定するようにする。
   */
  async function prepareDeepLink(page: Page, url: string) {
    await page.addInitScript(() => {
      try {
        // theme.ts の storagePrefix ('cloudflare-quiz') に対応
        localStorage.setItem('cloudflare-quiz-welcomed', '1')
        localStorage.setItem('cloudflare-quiz-tutorial-seen', '1')
      } catch {
        /* ignore */
      }
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(url)
    await page.waitForLoadState('networkidle')
  }

  const desktopOnly = (testInfo: { project: { name: string } }, what: string) =>
    test.skip(testInfo.project.name !== 'visual-desktop', `${what} snapshot tracked on desktop only`)

  /**
   * 【クイズ回答画面を撮らない理由】
   * `quiz:randomize` が選択肢の並びをシャッフルするため、問題を1問直すだけで
   * 全問の選択肢順が変わり、クイズ画面のスナップショットは必ず差分になる。
   * 「常に落ちる検査」は誰も見なくなるので撮らない。
   *
   * 代わりに図解は下の「diagram」テストで撮る。
   * reader 画面の全体スナップショット（reader-light/dark）はカードが
   * 畳まれた状態なので、図は1つも写っていない——ここを reader でカバー済みだと
   * 思い込むと、図解の視覚回帰が丸ごと抜ける。
   */

  /**
   * リーダーで1問だけに絞り込み、カードを開いて図を表示させる。
   *
   * 撮るのはページ全体ではなく図の要素だけ。全体を撮ると、無関係な問題の
   * 文言を1文字直しただけでベースラインが壊れ、結局「常に落ちる検査」になる。
   */
  async function openDiagram(page: Page, searchText: string, questionPattern: RegExp, diagramLabel: string) {
    await prepareDeepLink(page, '/?view=reader')
    await page.getByRole('heading', { name: '解説リーダー' }).waitFor({ timeout: 10000 })
    await page.getByLabel('問題を検索').fill(searchText)
    await page.getByRole('button', { name: questionPattern }).first().click()

    const diagram = page.locator(`[aria-label="${diagramLabel}"]`).first()
    await diagram.scrollIntoViewIfNeeded()
    await diagram.waitFor({ state: 'visible', timeout: 10000 })
    // 出現アニメーション（reducedMotion で短縮済み）が終わるのを待つ
    await page.waitForTimeout(600)
    return diagram
  }

  // terminal 図: 以前クイズ画面で撮っていたケース。ここが図解描画の代表。
  test('diagram — terminal', async ({ page }, testInfo) => {
    desktopOnly(testInfo, 'diagram')
    const diagram = await openDiagram(page, 'エントリーポイント', /モジュール形式/, 'ローカル開発サーバーでの確認')
    await expect(diagram).toHaveScreenshot('diagram-terminal.png', { maxDiffPixelRatio: DIFF_RATIO })
  })

  // layer 図 overrides=true: 「◀ 外側が上書き / ベース ▶」ラベルが出る唯一の問題。
  // このラベルは overrides フラグでしか出ないので、フラグが壊れれば差分になる。
  test('diagram — layer with overrides label', async ({ page }, testInfo) => {
    desktopOnly(testInfo, 'diagram')
    const diagram = await openDiagram(
      page,
      // 「プライベートネットワーク」だけだと6問ヒットするので、tn-011 に一意な語で絞る
      'ルーティングを設定する際の推奨',
      /プライベートネットワークへのルーティング/,
      'プライベートIP空間のポリシー構成'
    )
    await expect(diagram).toHaveScreenshot('diagram-layer-overrides.png', { maxDiffPixelRatio: DIFF_RATIO })
  })

  // layer 図 overrides 未指定: 上書きラベルが出ないことを固定する。
  // 以前は全 layer 図に無条件でラベルが出ており、13件が事実に反していた。
  test('diagram — layer without overrides label', async ({ page }, testInfo) => {
    desktopOnly(testInfo, 'diagram')
    const diagram = await openDiagram(page, '観測性', /observability/, 'Workersの観測性レイヤー')
    await expect(diagram).toHaveScreenshot('diagram-layer-plain.png', { maxDiffPixelRatio: DIFF_RATIO })
  })

  // 図解のダークモード対応漏れを検知する（図は SVG + Tailwind の dark: 指定が多く崩れやすい）
  test('diagram — terminal dark mode', async ({ page }, testInfo) => {
    desktopOnly(testInfo, 'diagram')
    const diagram = await openDiagram(page, 'エントリーポイント', /モジュール形式/, 'ローカル開発サーバーでの確認')
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(300)
    await expect(diagram).toHaveScreenshot('diagram-terminal-dark.png', { maxDiffPixelRatio: DIFF_RATIO })
  })

  test('reader screen — light mode', async ({ page }, testInfo) => {
    desktopOnly(testInfo, 'reader')
    await prepareDeepLink(page, '/?view=reader')
    await page.getByRole('heading', { name: '解説リーダー' }).waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)
    await expect(page).toHaveScreenshot('reader-light.png', { maxDiffPixelRatio: DIFF_RATIO })
  })

  test('reader screen — dark mode', async ({ page }, testInfo) => {
    desktopOnly(testInfo, 'reader')
    await prepareDeepLink(page, '/?view=reader')
    await page.getByRole('heading', { name: '解説リーダー' }).waitFor({ timeout: 10000 })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(300)
    await expect(page).toHaveScreenshot('reader-dark.png', { maxDiffPixelRatio: DIFF_RATIO })
  })

  // 無料枠早見表は CF 独自画面。数値表なのでレイアウト崩れが起きやすく、
  // ダークモード対応漏れ（実際に bg-cf-bg 未定義トークンの取りこぼしがあった）を
  // 機械的に検知したい。
  test('free tier table — light mode', async ({ page }, testInfo) => {
    desktopOnly(testInfo, 'freeTier')
    await prepareDeepLink(page, '/?view=freetier')
    await page.getByRole('heading', { name: '無料枠早見表' }).waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)
    await expect(page).toHaveScreenshot('freetier-light.png', { maxDiffPixelRatio: DIFF_RATIO })
  })

  test('free tier table — dark mode', async ({ page }, testInfo) => {
    desktopOnly(testInfo, 'freeTier')
    await prepareDeepLink(page, '/?view=freetier')
    await page.getByRole('heading', { name: '無料枠早見表' }).waitFor({ timeout: 10000 })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(300)
    await expect(page).toHaveScreenshot('freetier-dark.png', { maxDiffPixelRatio: DIFF_RATIO })
  })
})
