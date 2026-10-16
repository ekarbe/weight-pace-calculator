import { test, expect } from './support/fixtures';
import { LOCALES, SAMPLE, hasHorizontalOverflow, leakedMarkup, openApp, tr } from './support/app';
import { LOCALE_NAMES } from '../src/i18n/core';

test.describe('smoke: every language renders', () => {
  for (const lang of LOCALES) {
    test(`${lang}: empty form and filled results`, async ({ page }) => {
      await openApp(page, { lang });
      await expect(page).toHaveTitle(tr(lang, 'meta.title'));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(tr(lang, 'hero.title'));
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', tr(lang, 'meta.description'));
      await expect(page.getByRole('heading', { level: 2, name: tr(lang, 'inputs.heading') })).toBeVisible();
      expect(await leakedMarkup(page)).toEqual([]);
      expect(await hasHorizontalOverflow(page)).toBe(false);

      await openApp(page, { lang, params: SAMPLE, results: true });
      await expect(page.getByRole('heading', { level: 2, name: tr(lang, 'target.heading') })).toBeVisible();
      expect(await leakedMarkup(page)).toEqual([]);
      expect(await hasHorizontalOverflow(page)).toBe(false);
    });
  }
});
