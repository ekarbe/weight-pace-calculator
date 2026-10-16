import { test, expect } from './support/fixtures';
import { MODAL_POPUP_RULES, expectNoAxeViolations } from './support/axe';
import { DATE_BRISK, DATE_TOO_FAST, LOCALES, SAMPLE, brokenAriaReferences, disableMotion, fillSample, form, openAllDetails, openApp, slider, tr } from './support/app';

/**
 * Known defects (reported with this suite, not fixed by it):
 *  - In the light theme `text-destructive` (#ff3b30) is about 3.5:1 on the card background, so the "Too fast" label of
 *    the timeline and the table rows below healthy body fat fail WCAG 1.4.3.
 *  - The "What is threshold pace?" tooltip paints grey paragraph text (the global `p` colour) on its green
 *    background in both themes, about 2.4:1.
 * The scans below leave those elements out; the `test.fail` tests at the bottom assert the fixed behaviour, so
 * they start failing the run once the defects are fixed, and the exclusions can go.
 */
const KNOWN_LIGHT_CONTRAST_DEFECTS = ['[role="status"] strong.text-destructive', 'tbody tr.text-destructive'];

const FULL = { ...SAMPLE, td: DATE_BRISK, wk: '40', th: 'some' };

// Desktop project only: states that look the same at any width. Language and viewport coverage is in a11y.spec.ts.
for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe (WCAG 2.1 AA) in other states, ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test.beforeEach(({ page }) => disableMotion(page));

    test('empty form', async ({ page }) => {
      await openApp(page);
      await expectNoAxeViolations(page);
    });

    test('every field in error', async ({ page }) => {
      await openApp(page);
      const f = form(page);
      await fillSample(page, { height: '20', weight: '5', bodyFat: '3', paceMin: '5', paceSec: '75' });
      await f.distance.fill('0.5');
      await f.advanced.click();
      await f.paceGain.fill('9');
      await expect(page.getByRole('alert').filter({ hasText: 'Enter 50–272 cm' })).toBeVisible();
      await expectNoAxeViolations(page);
      expect(await brokenAriaReferences(page)).toEqual([]);
    });

    test('race-result mode with its errors and with a derived pace', async ({ page }) => {
      await openApp(page, { params: { g: 'female', h: '170', w: '64', pace: 'race', rd: 'custom', rdc: '8', rtm: '5', rts: '0' } });
      await expect(page.getByRole('alert').filter({ hasText: 'That time works out to a threshold pace' })).toBeVisible();
      await expectNoAxeViolations(page);
      await page.getByLabel('Minutes', { exact: true }).fill('36');
      await expect(slider(page)).toBeVisible();
      await expect(page.getByRole('group', { name: 'Threshold pace from a recent race' }).getByRole('status')).toContainText('4:38');
      await openAllDetails(page);
      await expectNoAxeViolations(page);
    });

    test('a too-fast plan (risk and withheld training in the warning colours)', async ({ page }) => {
      await openApp(page, { params: { ...FULL, td: DATE_TOO_FAST }, results: true });
      await expect(page.getByRole('status').filter({ hasText: 'No estimate shown' })).toBeVisible();
      await openAllDetails(page);
      await expectNoAxeViolations(page, { exclude: scheme === 'light' ? KNOWN_LIGHT_CONTRAST_DEFECTS : [] });
    });

    test('body fat below healthy levels (warnings, flagged rows, no share image)', async ({ page }) => {
      await openApp(page, { params: { g: 'male', h: '180', w: '75', bf: '10', pm: '4', ps: '0' }, results: true });
      await slider(page).focus();
      await page.keyboard.press('End');
      await expect(page.getByText('No image for this target weight')).toBeVisible();
      await openAllDetails(page);
      await expectNoAxeViolations(page, { exclude: scheme === 'light' ? KNOWN_LIGHT_CONTRAST_DEFECTS : [] });
    });

    test('capped pace warning in imperial units', async ({ page }) => {
      await openApp(page, { params: { u: 'imperial', g: 'female', h: '67', w: '141', pm: '4', ps: '40' }, results: true });
      await slider(page).focus();
      await page.keyboard.press('End');
      await expect(page.getByText('Pace is capped at the model’s limit here')).toBeVisible();
      await openAllDetails(page);
      await expectNoAxeViolations(page);
    });

    test('open select lists', async ({ page }) => {
      await openApp(page, { params: FULL, results: true });
      await form(page).sex.click();
      await expect(page.getByRole('listbox')).toBeVisible();
      await expectNoAxeViolations(page, { disableRules: MODAL_POPUP_RULES });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('listbox')).toBeHidden();

      await page.getByRole('combobox', { name: 'How long have you run regularly?' }).click();
      await expect(page.getByRole('listbox')).toBeVisible();
      await expectNoAxeViolations(page, { disableRules: MODAL_POPUP_RULES });
    });

    test('an open tooltip', async ({ page }) => {
      await openApp(page, { params: FULL, results: true });
      await page.getByRole('button', { name: 'What is threshold pace?' }).focus();
      await expect(page.getByRole('tooltip').first()).toBeVisible();
      // The tooltip text itself is a reported defect (below); it is portalled outside the landmarks by design.
      await expectNoAxeViolations(page, { exclude: ['[role="tooltip"]'] });
    });
  });
}

test.describe('structure', () => {
  for (const lang of LOCALES) {
    test(`${lang}: one h1, landmarks, a working skip target, and a language attribute`, async ({ page }) => {
      await openApp(page, { lang, params: FULL, results: true });
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('banner')).toHaveCount(1);
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByRole('contentinfo')).toHaveCount(1);
      await expect(page.getByRole('link', { name: tr(lang, 'skip') })).toHaveAttribute('href', '#main');
      await expect(page.locator('main#main')).toHaveAttribute('tabindex', '-1');
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
    });
  }

  test('every form control has an accessible name', async ({ page }) => {
    await openApp(page, { params: FULL, results: true });
    await openAllDetails(page);
    const unnamed = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('input:not([type=hidden]), select, textarea, button, [role=slider], [role=combobox], [role=switch]')];
      return controls
        .filter((el) => (el as HTMLElement).checkVisibility())
        .filter((el) => el.getAttribute('aria-hidden') !== 'true')
        .filter((el) => {
          const labelled = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el as HTMLInputElement).labels?.length || (el.textContent ?? '').trim();
          return !labelled;
        })
        .map((el) => el.outerHTML.slice(0, 120));
    });
    expect(unnamed).toEqual([]);
  });

  test('live regions are polite status messages; an alert only ever appears for a field error', async ({ page }) => {
    await openApp(page, { params: FULL, results: true });
    const assertive = await page.evaluate(() => [...document.querySelectorAll('[aria-live="assertive"], [role="alert"]')].filter((el) => (el.textContent ?? '').trim()).length);
    expect(assertive).toBe(0);
    await expect(page.getByRole('status').filter({ hasText: 'Estimates are ready.' })).toBeAttached();
  });
});

test.describe('motion', () => {
  test.describe('reduced motion requested', () => {
    test.use({ reducedMotion: 'reduce' });
    test('the background does not animate and transitions are effectively instant', async ({ page }) => {
      await openApp(page, { params: SAMPLE, results: true });
      expect(await page.locator('.mesh-background').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      const duration = await page.getByRole('button', { name: 'Copy share link' }).evaluate((el) => getComputedStyle(el).transitionDuration);
      expect(parseFloat(duration)).toBeLessThan(0.001);
    });
  });

  test.describe('no preference', () => {
    test.use({ reducedMotion: 'no-preference' });
    test('the page does animate (so the check above is meaningful)', async ({ page }) => {
      await openApp(page, { params: SAMPLE, results: true });
      expect(await page.locator('.mesh-background').evaluate((el) => getComputedStyle(el).animationName)).toBe('mesh-pulse');
      const duration = await page.getByRole('button', { name: 'Copy share link' }).evaluate((el) => getComputedStyle(el).transitionDuration);
      expect(parseFloat(duration)).toBeGreaterThan(0.05);
    });
  });
});

test.describe('known contrast defects in the light theme', () => {
  test.use({ colorScheme: 'light' });
  test.beforeEach(({ page }) => disableMotion(page));

  test('the "Too fast" risk label has enough contrast', async ({ page }) => {
    test.fail(true, 'timeline risk label uses text-destructive, about 3.5:1 on the light card');
    await openApp(page, { params: { ...SAMPLE, td: DATE_TOO_FAST }, results: true });
    await expect(page.getByText('Too fast').first()).toBeVisible();
    await expectNoAxeViolations(page, { include: ['[role="status"] strong.text-destructive'], rules: ['color-contrast'] });
  });

  test('table rows below healthy body fat have enough contrast', async ({ page }) => {
    test.fail(true, 'flagged table rows use text-destructive, about 3.5:1 on the light card');
    await openApp(page, { params: { g: 'male', h: '180', w: '75', bf: '10', pm: '4', ps: '0' }, results: true });
    await openAllDetails(page);
    await expectNoAxeViolations(page, { include: ['tbody tr.text-destructive'], rules: ['color-contrast'] });
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`known contrast defect: tooltip, ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test.beforeEach(({ page }) => disableMotion(page));

    test('the "What is threshold pace?" tooltip text has enough contrast', async ({ page }) => {
      test.fail(true, 'tooltip paragraph inherits the global muted p colour on the green tooltip background, about 2.4:1');
      await openApp(page, { params: SAMPLE, results: true });
      await page.getByRole('button', { name: 'What is threshold pace?' }).focus();
      await expect(page.getByRole('tooltip').first()).toBeVisible();
      await expectNoAxeViolations(page, { include: ['[role="tooltip"]'], rules: ['color-contrast'] });
    });
  });
}
