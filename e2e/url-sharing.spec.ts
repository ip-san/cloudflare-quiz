import { expect, type Page, test } from '@playwright/test'

/**
 * E2E coverage for the PWA URL ↔ state sync layer (src/lib/urlSync.ts).
 *
 * For every shareable URL we verify:
 *  1. the app lands on the right screen, AND
 *  2. the address bar ends up at the expected URL (auto-rewrite vs. stable).
 *
 * Welcome + tutorial localStorage flags are set via addInitScript so that
 * React skips the onboarding modals on the very first render — otherwise
 * the initial URL intent fires underneath a welcome overlay.
 */

async function waitForNotLoading(page: Page) {
  await expect(page.getByText('読み込み中...')).toHaveCount(0, { timeout: 10000 })
}

test.describe('URL sharing', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        // hasSeenFlag in src/lib/storage.ts checks for exactly '1'
        localStorage.setItem('cloudflare-quiz-welcomed', '1')
        localStorage.setItem('cloudflare-quiz-tutorial-seen', '1')
      } catch {
        /* ignore quota/security errors */
      }
    })
  })

  test('?q=<id> starts a 1-question share session', async ({ page }) => {
    await page.goto('/?q=wk-001')
    await waitForNotLoading(page)

    // Header badge exposes the share label
    await expect(page.getByText(/🔍 共有された問題/)).toBeVisible({ timeout: 10000 })
    // Progress bar total = 1 (single question)
    const bar = page.getByRole('progressbar', { name: '問題の進捗' })
    await expect(bar).toHaveAttribute('aria-valuemax', '1')
    // URL should remain at ?q=wk-001 (current question matches intent)
    await expect(page).toHaveURL(/\?q=wk-001/)
  })

  test('?category=<id> starts a category session and rewrites URL to current question', async ({ page }) => {
    await page.goto('/?category=workers')
    await waitForNotLoading(page)
    // Address bar should be rewritten to the first workers question (wk-*)
    await expect(page).toHaveURL(/\?q=wk-[^&]+$/, { timeout: 10000 })
    await expect(page.getByRole('progressbar', { name: '問題の進捗' })).toBeVisible()
  })

  test('?mode=weak starts weak mode with 20 questions', async ({ page }) => {
    await page.goto('/?mode=weak')
    await waitForNotLoading(page)
    const bar = page.getByRole('progressbar', { name: '問題の進捗' })
    await expect(bar).toHaveAttribute('aria-valuemax', '20', { timeout: 10000 })
    // URL is rewritten to the per-question form
    await expect(page).toHaveURL(/\?q=[^&]+$/)
  })

  test('?mode=scenario opens the scenario select screen, URL stable', async ({ page }) => {
    await page.goto('/?mode=scenario')
    await waitForNotLoading(page)
    await expect(page.getByRole('heading', { name: '実践シナリオ' })).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\?mode=scenario$/)
  })

  // Cloudflare Codex Quiz ships with SCENARIOS = [] at launch (src/data/scenarios.ts),
  // so no scenario id can resolve yet — parseUrlIntent rejects any ?scenario= value.
  // Re-enable once scenario content exists.
  test.skip('?scenario=<id> starts that scenario and keeps the scenario URL', async ({ page }) => {
    await page.goto('/?scenario=scenario-onboard')
    await waitForNotLoading(page)
    // The URL must NOT be rewritten to ?q=... — the scenario flow is the share unit
    await expect(page).toHaveURL(/\?scenario=scenario-onboard$/, { timeout: 10000 })
  })

  test('?view=progress opens the progress dashboard', async ({ page }) => {
    await page.goto('/?view=progress')
    await waitForNotLoading(page)
    await expect(page.getByRole('heading', { name: '学習進捗' })).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\?view=progress$/)
  })

  test('?view=reader opens the explanation reader', async ({ page }) => {
    await page.goto('/?view=reader')
    await waitForNotLoading(page)
    await expect(page.getByRole('heading', { name: '解説リーダー' })).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\?view=reader$/)
  })

  test('?view=reader&filter=bookmarked activates the bookmarked filter', async ({ page }) => {
    await page.goto('/?view=reader&filter=bookmarked')
    await waitForNotLoading(page)
    await expect(page.getByRole('heading', { name: '解説リーダー' })).toBeVisible({ timeout: 10000 })
    // The "保存済み" filter button should be in its active/selected style (bg-stone-700 text-white).
    const savedBtn = page.getByRole('button', { name: '保存済み', exact: true })
    await expect(savedBtn).toHaveClass(/bg-stone-700/)
  })

  test('?view=tutorial opens the tutorial screen', async ({ page }) => {
    await page.goto('/?view=tutorial')
    await waitForNotLoading(page)
    // Tutorial screen has a スキップ button
    await expect(page.getByRole('button', { name: 'スキップ' })).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\?view=tutorial$/)
  })

  test('?view=result with no session falls back to menu and cleans the URL', async ({ page }) => {
    await page.goto('/?view=result')
    await waitForNotLoading(page)
    // Menu screen — hamburger button is the most stable menu signal
    await expect(page.getByRole('button', { name: 'メニューを開く' })).toBeVisible({ timeout: 10000 })
    // URL should be cleaned to pathname only (no query string)
    await expect(page).toHaveURL(/\/(\?)?$/)
  })

  test('unknown ?category value is ignored and falls back to menu', async ({ page }) => {
    await page.goto('/?category=bogus')
    await waitForNotLoading(page)
    await expect(page.getByRole('button', { name: 'メニューを開く' })).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\/(\?)?$/)
  })

  test('unknown ?view value is ignored and falls back to menu', async ({ page }) => {
    await page.goto('/?view=bogus')
    await waitForNotLoading(page)
    await expect(page.getByRole('button', { name: 'メニューを開く' })).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\/(\?)?$/)
  })
})
