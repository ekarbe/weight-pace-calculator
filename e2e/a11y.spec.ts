import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { expectNoAxeViolations } from './support/axe';
import { DATE_BRISK, LOCALES, SAMPLE, brokenAriaReferences, disableMotion, inEachTheme, openAllDetails, openApp, tr, type Locale } from './support/app';

/** Every optional feature switched on: custom distance, target date, training inputs, share-image weights. */
const FULL = { ...SAMPLE, td: DATE_BRISK, wk: '40', th: 'some' };

async function everythingOpen(page: Page, lang: Locale) {
  await openApp(page, { lang, params: FULL, results: true });
  await page.getByRole('checkbox', { name: tr(lang, 'shareImage.weights.label') }).check();
  await openAllDetails(page);
}

// The 390px mobile project runs all four languages; the desktop project runs English only (its layout does not
// depend on the language, see playwright.config.ts). Each page is scanned in the light and then in the dark theme.
test.describe('axe (WCAG 2.1 AA), every feature active, all sections open', () => {
  test.beforeEach(({ page }) => disableMotion(page));

  for (const lang of LOCALES) {
    test(`${lang}: light and dark`, { tag: lang === 'en' ? [] : '@other-languages' }, async ({ page }) => {
      await everythingOpen(page, lang);
      await inEachTheme(page, async (scheme) => {
        await expectNoAxeViolations(page, { label: `${scheme} theme` });
        expect(await brokenAriaReferences(page)).toEqual([]);
      });
    });
  }
});
