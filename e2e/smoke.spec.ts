import { test, expect } from './support/fixtures';
import { LOCALES, SAMPLE, hasHorizontalOverflow, leakedMarkup, openApp, slider, tr, type Locale } from './support/app';

const DECIMAL: Record<Locale, string> = { en: '.', de: ',', es: ',', fr: ',' };
const HOUR_WORD: Record<Locale, RegExp> = { en: /hour/, de: /Stunde/, es: /hora/, fr: /heure/ };

test.describe('every language renders', () => {
  for (const lang of LOCALES) {
    test(`${lang}: page chrome, empty form and results`, async ({ page }) => {
      await openApp(page, { lang });
      await expect(page).toHaveTitle(tr(lang, 'meta.title'));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(tr(lang, 'hero.title'));
      await expect(page.getByRole('heading', { level: 2, name: tr(lang, 'inputs.heading') })).toBeVisible();
      await expect(page.getByRole('link', { name: tr(lang, 'header.title') })).toBeVisible();
      await expect(page.getByLabel(tr(lang, 'lang.label'))).toHaveValue(lang);
      await expect(page.getByRole('button', { name: tr(lang, 'theme.toggle') })).toBeVisible();
      await expect(page.locator('meta[name="description"]').first()).toHaveAttribute('content', tr(lang, 'meta.description'));
      expect(await leakedMarkup(page)).toEqual([]);
      expect(await hasHorizontalOverflow(page)).toBe(false);

      await openApp(page, { lang, params: SAMPLE, results: true });
      await expect(page.getByRole('heading', { level: 2, name: tr(lang, 'target.heading') })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: tr(lang, 'sr.ready') })).toBeAttached();
      expect(await leakedMarkup(page)).toEqual([]);
      expect(await hasHorizontalOverflow(page)).toBe(false);
    });

    test(`${lang}: numbers use the local decimal mark and spoken durations are words, not clock times`, async ({ page }) => {
      await openApp(page, { lang, params: SAMPLE, results: true });
      await expect(slider(page)).toHaveAttribute('aria-valuetext', new RegExp(`61${DECIMAL[lang] === '.' ? '\\.' : ','}0`));
      const spoken = page.getByRole('listitem').filter({ hasText: tr(lang, 'race.hm') }).locator('p.sr-only');
      await expect(spoken).toContainText(HOUR_WORD[lang]);
      expect(await spoken.innerText()).not.toMatch(/\d+:\d\d/);
    });
  }
});
