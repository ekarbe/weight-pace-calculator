import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite: runs against the static export (./out) served under the real basePath.
 *
 *   npm run build && npm run e2e         # CI does exactly this (browsers: npx playwright install --with-deps chromium)
 *   E2E_REUSE_BUILD=1 npm run e2e        # locally: skip the build and reuse the existing ./out
 *
 * Environment:
 *   E2E_PORT              port of the static server (default 3100)
 *   E2E_REUSE_BUILD=1     do not run `npm run build` first (otherwise every run tests a fresh build)
 *   PW_CHROMIUM_EXECUTABLE  local escape hatch: path to a Chromium / headless_shell binary to drive instead of the
 *                           one Playwright downloads. Needed only on machines where `playwright install` is not
 *                           possible and another Chromium is preinstalled. Never set in CI, which installs the
 *                           browser that matches the Playwright version (see .github/workflows/ci.yml).
 *
 * Playwright version: the latest (1.64) is used. It drove an older preinstalled Chromium (141, the build Playwright
 * 1.56 ships) through the whole suite (clock, clipboard, downloads, PDF, touch, emulated media) without problems,
 * so there is no reason to pin an older release.
 *
 * Everything that could make a run non-deterministic is pinned: locale, time zone, colour scheme, viewport and the
 * browser clock (see e2e/support/fixtures.ts), so there are no sleeps and no dependence on today's date.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_PATH = '/weight-pace-calculator';
const reuseBuild = process.env.E2E_REUSE_BUILD === '1';
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A retry is only a safety net on shared CI runners; locally a flaky test must fail.
  retries: process.env.CI ? 1 : 0,
  workers: '100%',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI
    ? [['list'], ['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list']],
  use: {
    // The trailing slash matters: relative URLs such as './?lang=de' resolve below the basePath.
    baseURL: `http://localhost:${PORT}${BASE_PATH}/`,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    // The page's background animation repaints continuously (with software-rendered blur), which slows a suite that
    // opens hundreds of pages and makes timing less predictable; the tests that are about motion opt back in.
    reducedMotion: 'reduce',
    // Traces cost time on every test; CI retries once and records the retry. Locally: npx playwright test --trace on.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      // A 390px-wide phone, the width the app is designed and audited for.
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
      testMatch: ['smoke.spec.ts', 'a11y.spec.ts', 'responsive.spec.ts'],
    },
  ],
  webServer: {
    command: `${reuseBuild ? '' : 'npm run build && '}node scripts/serve-out.mjs ${PORT}`,
    url: `http://localhost:${PORT}${BASE_PATH}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
