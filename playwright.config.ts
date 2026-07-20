import { defineConfig, devices } from '@playwright/test'

/**
 * Multi-device E2E configuration
 *
 * - quiz-flow: functional tests on desktop chromium
 * - visual: layout regression
 *     * welcome + menu: all 7 devices × 2 themes (fixed layout)
 *     * quiz + quiz-explanation + reader: desktop only × 2 themes (variable content)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    serviceWorkers: 'block',
  },
  projects: [
    // Functional tests
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
      testMatch: /quiz-flow|menu|url-sharing/,
    },
    // Accessibility tests — desktop chromium
    {
      name: 'a11y',
      use: { browserName: 'chromium' },
      testMatch: /a11y/,
    },
    // Visual regression — all devices (welcome + menu)
    {
      name: 'visual-desktop',
      use: { browserName: 'chromium' },
      testMatch: /visual/,
    },
    {
      name: 'visual-iPhone-SE',
      use: { ...devices['iPhone SE'], defaultBrowserType: undefined, browserName: 'chromium' },
      testMatch: /visual/,
    },
    {
      name: 'visual-Galaxy-S8',
      use: { ...devices['Galaxy S8'] },
      testMatch: /visual/,
    },
    {
      name: 'visual-Pixel-7',
      use: { ...devices['Pixel 7'] },
      testMatch: /visual/,
    },
    {
      name: 'visual-iPhone-14-Pro-Max',
      use: { ...devices['iPhone 14 Pro Max'], defaultBrowserType: undefined, browserName: 'chromium' },
      testMatch: /visual/,
    },
    {
      name: 'visual-Galaxy-Tab-S9',
      use: { ...devices['Galaxy Tab S9'] },
      testMatch: /visual/,
    },
    {
      name: 'visual-iPad',
      use: { ...devices['iPad (gen 7)'], defaultBrowserType: undefined, browserName: 'chromium' },
      testMatch: /visual/,
    },
  ],
  webServer: {
    command: 'bun run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
})
