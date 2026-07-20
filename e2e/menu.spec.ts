import { expect, type Page, test } from '@playwright/test'

/** Skip welcome + tutorial to reach menu screen */
async function goToMenu(page: Page) {
  const welcome = page.getByRole('button', { name: /はじめる/ })
  if (await welcome.isVisible({ timeout: 3000 }).catch(() => false)) {
    await welcome.click()
  }
  const skip = page.getByRole('button', { name: 'スキップ' })
  if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skip.click()
  }
  // Confirm we reached the menu screen
  await page.getByRole('button', { name: 'メニューを開く' }).waitFor({ timeout: 5000 })
}

test.describe('Menu screen', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to simulate first-time user
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('navigates to menu via welcome and tutorial skip', async ({ page }) => {
    // Welcome screen should appear first
    const welcomeButton = page.getByRole('button', { name: /はじめる/ })
    await expect(welcomeButton).toBeVisible({ timeout: 5000 })

    // Click はじめる
    await welcomeButton.click()

    // Skip tutorial if shown
    const skip = page.getByRole('button', { name: 'スキップ' })
    if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skip.click()
    }

    // Should be on menu screen with hamburger button visible
    await expect(page.getByRole('button', { name: 'メニューを開く' })).toBeVisible({ timeout: 5000 })
  })

  test('shows クイズで学ぶ button on menu screen', async ({ page }) => {
    await goToMenu(page)

    // クイズで学ぶ button is part of FirstTimeGuide (PWA first-time user)
    await expect(page.getByRole('button', { name: /クイズで学ぶ/ })).toBeVisible({ timeout: 5000 })
  })

  test('shows 読んでから解く button on menu screen', async ({ page }) => {
    await goToMenu(page)

    // 読んでから解く button is part of FirstTimeGuide
    await expect(page.getByRole('button', { name: /読んでから解く/ })).toBeVisible({ timeout: 5000 })
  })

  test('shows すでに活用されている方へ button on menu screen', async ({ page }) => {
    await goToMenu(page)

    // Experience user button
    await expect(page.getByRole('button', { name: /すでに活用されている方へ/ })).toBeVisible({ timeout: 5000 })
  })

  test('shows search after first quiz attempt', async ({ page }) => {
    await goToMenu(page)

    // First-time user: search is hidden. Start a quiz first.
    await page.getByRole('button', { name: 'メニューを開く' }).click()
    const menu = page.getByRole('dialog', { name: 'メニュー' })
    await menu.getByRole('button', { name: /クイズモード/ }).click()
    await menu.getByText('全カテゴリからランダムに20問').click()
    await page.waitForSelector('[role="listbox"], [role="group"]', { timeout: 5000 })

    // Answer one question to get progress
    await page.locator('[role="option"], [role="checkbox"]').first().click()
    await page.getByRole('button', { name: '回答する' }).click()

    // Quit to menu
    await page.getByRole('button', { name: /中止/ }).click()
    await page
      .getByRole('button', { name: /続ける|中止する/ })
      .last()
      .click()

    // Now search should be visible (user has progress)
    await expect(page.getByText('検索・リファレンス')).toBeVisible({ timeout: 5000 })
  })

  test('hamburger menu opens on click', async ({ page }) => {
    await goToMenu(page)

    // Click hamburger button to open menu
    await page.getByRole('button', { name: 'メニューを開く' }).click()

    // Dialog with メニュー label should appear
    await expect(page.getByRole('dialog', { name: 'メニュー' })).toBeVisible({ timeout: 3000 })
  })

  test('hamburger menu closes on close button click', async ({ page }) => {
    await goToMenu(page)

    // Open menu
    await page.getByRole('button', { name: 'メニューを開く' }).click()
    const menu = page.getByRole('dialog', { name: 'メニュー' })
    await expect(menu).toBeVisible({ timeout: 3000 })

    // Close menu
    await menu.getByRole('button', { name: 'メニューを閉じる' }).click()

    // Dialog should be gone
    await expect(menu).not.toBeVisible({ timeout: 3000 })
  })

  test('hamburger menu shows クイズモード section', async ({ page }) => {
    await goToMenu(page)

    await page.getByRole('button', { name: 'メニューを開く' }).click()
    const menu = page.getByRole('dialog', { name: 'メニュー' })

    await expect(menu.getByText('クイズモード')).toBeVisible({ timeout: 3000 })
  })

  test('クイズで学ぶ button starts overview mode', async ({ page }) => {
    await goToMenu(page)

    await page.getByRole('button', { name: /クイズで学ぶ/ }).click()

    // Should navigate to quiz screen (question or chapter intro visible)
    await expect(page.getByRole('button', { name: /次へ|回答|学習を始める/ }).first()).toBeVisible({ timeout: 5000 })
  })

  test('すでに活用されている方へ opens hamburger menu with modes', async ({ page }) => {
    await goToMenu(page)

    await page.getByRole('button', { name: /すでに活用されている方へ/ }).click()

    // Should open hamburger menu with mode list
    const menu = page.getByRole('dialog', { name: 'メニュー' })
    await expect(menu).toBeVisible({ timeout: 3000 })
    await expect(menu.getByText('クイズモード')).toBeVisible({ timeout: 3000 })
  })
})
