import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { expectNoAxeViolations } from './support/axe';
import { DATE_BRISK, LOCALES, SAMPLE, brokenAriaReferences, disableMotion, openAllDetails, openApp, tr, type Locale } from './support/app';

/** Every optional feature switched on: custom distance, target date, training inputs, share-image weights. */
const FULL = { ...SAMPLE, td: DATE_BRISK, wk: '40', th: 'some' };

async function everythingOpen(page: Page, lang: Locale) {
  await openApp(page, { lang, params: FULL, results: true });
  await page.getByRole('checkbox', { name: tr(lang, 'shareImage.weights.label') }).check();
  await openAllDetails(page);
}

// Runs in both the desktop and the 390px mobile project: 4 languages x light/dark, with everything open and active.
for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe (WCAG 2.1 AA), ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test.beforeEach(({ page }) => disableMotion(page));

    for (const lang of LOCALES) {
      test(`${lang}: every feature active, all sections open`, async ({ page }) => {
        await everythingOpen(page, lang);
        await expect(page.locator('html')).toHaveClass(scheme === 'dark' ? /dark/ : /light/);
        await expectNoAxeViolations(page);
        expect(await brokenAriaReferences(page)).toEqual([]);
      });
    }
  });
}
