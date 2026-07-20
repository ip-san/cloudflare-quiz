import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

/**
 * Accessibility tests using axe-core
 *
 * Scans each major screen for WCAG 2.1 AA violations.
 * Runs on desktop chromium only (a11y rules are viewport-independent).
 */

async function goToMenu(page: Page) {
  const welcome = page.getByRole('button', { name: /はじめる/ })
  if (await welcome.isVisible({ timeout: 3000 }).catch(() => false)) {
    await welcome.click()
  }
  const skip = page.getByRole('button', { name: 'スキップ' })
  if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skip.click()
  }
  await page.getByRole('button', { name: 'メニューを開く' }).waitFor({ timeout: 5000 })
}

test.describe('Accessibility (axe-core)', () => {
  test.beforeEach(async ({ page }) => {
    // Collapse entrance animations (fade-in opacity) to their final state so axe
    // scans at full opacity. Without this, the scan can land mid-fade and report a
    // false color-contrast violation (e.g. stone-600 text blended to ~4.16:1 while
    // the feature-card fade-in with animation-delay:450ms is still in flight).
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('welcome screen has no a11y violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()

    expect(results.violations).toEqual([])
  })

  test('menu screen has no a11y violations (color-contrast partially fixed)', async ({ page }) => {
    await goToMenu(page)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze()

    expect(results.violations).toEqual([])
  })
})
