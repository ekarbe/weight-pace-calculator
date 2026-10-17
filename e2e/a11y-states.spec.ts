import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { MODAL_POPUP_RULES, expectNoAxeViolations, type AxeOptions } from './support/axe';
import { DATE_BRISK, DATE_TOO_FAST, LOCALES, SAMPLE, brokenAriaReferences, disableMotion, fillSample, form, inEachTheme, openAllDetails, openApp, slider, tr } from './support/app';

const FULL = { ...SAMPLE, td: DATE_BRISK, wk: '40', th: 'some' };

/** Every state of the Training context card: [name, share-link parameters, steps that need the UI]. Each is scanned within the card. */
const TRAINING_STATES: [string, Record<string, string>, ((page: Page) => Promise<void>)?][] = [
  ['idle (nothing to compare)', SAMPLE, async (page) => { await slider(page).focus(); await page.keyboard.press('Home'); }],
  ['idle (a change within day-to-day swings)', SAMPLE, async (page) => { await slider(page).focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); }],
  ['matches the headline estimate', SAMPLE],
  ['lowered: brisk pace', { ...SAMPLE, td: DATE_BRISK, wk: '40', th: 'new' }],
  ['lowered: very high weekly running', { ...SAMPLE, wk: '100' }],
  ['lowered: factor above the usual range', SAMPLE, async (page) => { await form(page).advanced.click(); await form(page).paceGain.fill('4'); }],
  ['withheld: too fast', { ...SAMPLE, td: DATE_TOO_FAST, wk: '40' }],
  ['withheld: brisk and heavy', { ...SAMPLE, td: DATE_BRISK, wk: '60' }],
  ['withheld: current weight under the line', { g: 'male', h: '180', w: '60', pm: '4', ps: '0' }],
  ['withheld: selected weight under the line', { g: 'male', h: '180', w: '66', pm: '4', ps: '0' }, async (page) => { await form(page).advanced.click(); await form(page).bmiFloor.fill('18.5'); }],
  ['withheld: low body fat', { g: 'male', h: '180', w: '75', bf: '10', pm: '4', ps: '0' }, async (page) => { await slider(page).focus(); await page.keyboard.press('End'); }],
  ['withheld: a mistyped distance', { ...SAMPLE, wk: '300' }],
];

// Desktop project only: states that look the same at any width. Language and viewport coverage is in a11y.spec.ts.
// Each state is scanned in the light and then in the dark theme within one page load.
test.describe('axe (WCAG 2.1 AA) in other states, light and dark', () => {
  test.beforeEach(({ page }) => disableMotion(page));

  /** Scans the current page in both themes. */
  const scanBothThemes = (page: Page, opts: AxeOptions = {}) =>
    inEachTheme(page, (scheme) => expectNoAxeViolations(page, { ...opts, label: `${scheme} theme` }));

  test('empty form', async ({ page }) => {
    await openApp(page);
    await scanBothThemes(page);
  });

  test('every field in error', async ({ page }) => {
    await openApp(page);
    const f = form(page);
    await fillSample(page, { height: '20', weight: '5', bodyFat: '3', paceMin: '5', paceSec: '75' });
    await f.distance.fill('0.5');
    await f.advanced.click();
    await f.paceGain.fill('9');
    await expect(page.getByRole('alert').filter({ hasText: 'Enter 50–272 cm' })).toBeVisible();
    await scanBothThemes(page);
    expect(await brokenAriaReferences(page)).toEqual([]);
  });

  test('race-result mode with its errors and with a derived pace', async ({ page }) => {
    await openApp(page, { params: { g: 'female', h: '170', w: '64', pace: 'race', rd: 'custom', rdc: '8', rtm: '5', rts: '0' } });
    await expect(page.getByRole('alert').filter({ hasText: 'That time works out to a threshold pace' })).toBeVisible();
    await scanBothThemes(page);
    await page.getByLabel('Minutes', { exact: true }).fill('36');
    await expect(slider(page)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Threshold pace from a recent race' }).getByRole('status')).toContainText('4:38');
    await openAllDetails(page);
    await scanBothThemes(page);
  });

  test('a too-fast plan (risk and withheld training in the warning colours)', async ({ page }) => {
    await openApp(page, { params: { ...FULL, td: DATE_TOO_FAST }, results: true });
    await expect(page.getByRole('status').filter({ hasText: 'No estimate shown' })).toBeVisible();
    await openAllDetails(page);
    await scanBothThemes(page);
  });

  test('body fat below healthy levels (warnings, flagged rows, no share image)', async ({ page }) => {
    await openApp(page, { params: { g: 'male', h: '180', w: '75', bf: '10', pm: '4', ps: '0' }, results: true });
    await slider(page).focus();
    await page.keyboard.press('End');
    await expect(page.getByText('No image for this target weight')).toBeVisible();
    await openAllDetails(page);
    await scanBothThemes(page);
  });

  test('capped pace warning in imperial units', async ({ page }) => {
    await openApp(page, { params: { u: 'imperial', g: 'female', h: '67', w: '141', pm: '4', ps: '40' }, results: true });
    await slider(page).focus();
    await page.keyboard.press('End');
    await expect(page.getByText('Pace is capped at the model’s limit here')).toBeVisible();
    await openAllDetails(page);
    await scanBothThemes(page);
  });

  for (const [name, params, steps] of TRAINING_STATES) {
    test(`training context: ${name}`, async ({ page }) => {
      await openApp(page, { params, results: true });
      await steps?.(page);
      await expect(page.locator('section#training')).toBeVisible();
      await openAllDetails(page);
      // Scoped to the card: the rest of the page is scanned in full by a11y.spec.ts and the tests above.
      await scanBothThemes(page, { include: ['section#training'] });
      expect(await brokenAriaReferences(page)).toEqual([]);
    });
  }

  // German and French run 30 to 40 % longer: the narrowest reflow width, with the state that carries the most text.
  for (const lang of ['de', 'fr'] as const) {
    for (const [name, params] of [['lowered', { ...SAMPLE, td: DATE_BRISK, wk: '40' }], ['withheld', { ...SAMPLE, td: DATE_TOO_FAST, wk: '60' }]] as const) {
      test(`training context, ${lang} at 320 px: ${name}`, async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await openApp(page, { lang, params, results: true });
        await openAllDetails(page);
        // The card is what changes between the states; the whole page is scanned once, for the first state.
        await scanBothThemes(page, name === 'lowered' ? {} : { include: ['section#training'] });
        expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      });
    }
  }

  test('open select lists', async ({ page }) => {
    await openApp(page, { params: FULL, results: true });
    await inEachTheme(page, async (scheme) => {
      await form(page).sex.click();
      await expect(page.getByRole('listbox')).toBeVisible();
      await expectNoAxeViolations(page, { disableRules: MODAL_POPUP_RULES, label: `${scheme} theme, sex` });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('listbox')).toBeHidden();

      await page.getByRole('combobox', { name: 'How long have you run regularly?' }).click();
      await expect(page.getByRole('listbox')).toBeVisible();
      await expectNoAxeViolations(page, { disableRules: MODAL_POPUP_RULES, label: `${scheme} theme, history` });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('listbox')).toBeHidden();
    });
  });

  test('an open tooltip', async ({ page }) => {
    await openApp(page, { params: FULL, results: true });
    await page.getByRole('button', { name: 'What is threshold pace?' }).focus();
    await expect(page.getByRole('tooltip').first()).toBeVisible();
    // The tooltip is portalled outside the landmarks by design, so the landmark rule does not apply to it.
    await scanBothThemes(page, { disableRules: ['region'] });
  });
});

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

// The red used for text (errors, "Too fast", flagged rows, the warning box) has its own dark-on-light ink: the plain
// destructive red is only 3.5:1 on the light card. These check the elements directly, in the light theme where it matters.
test.describe('red text in the light theme', () => {
  test.use({ colorScheme: 'light' });
  test.beforeEach(({ page }) => disableMotion(page));

  const contrastOfRedText = (page: Page) => expectNoAxeViolations(page, { include: ['.text-destructive-ink'], rules: ['color-contrast'] });

  test('the "Too fast" risk label has enough contrast', async ({ page }) => {
    await openApp(page, { params: { ...SAMPLE, td: DATE_TOO_FAST }, results: true });
    await expect(page.getByText('Too fast').first()).toBeVisible();
    await contrastOfRedText(page);
  });

  test('flagged table rows and the warning box under the slider have enough contrast', async ({ page }) => {
    await openApp(page, { params: { g: 'male', h: '180', w: '75', bf: '10', pm: '4', ps: '0' }, results: true });
    await slider(page).focus();
    await page.keyboard.press('End');
    await expect(page.getByText('Estimated body fat at this weight is below healthy levels.')).toBeVisible();
    await openAllDetails(page);
    await contrastOfRedText(page);
  });

  test('the input panel\'s field errors and the past-date message have enough contrast', async ({ page }) => {
    await openApp(page);
    await fillSample(page, { height: '20' });
    await expect(page.getByRole('alert').filter({ hasText: 'Enter 50–272 cm' })).toBeVisible();
    await contrastOfRedText(page);
    await page.getByLabel('Height (cm)').fill('170');
    await page.getByLabel(/^I want to get there by/).fill('2026-06-01');
    await expect(page.getByRole('alert').filter({ hasText: 'Pick a date in the future.' })).toBeVisible();
    await contrastOfRedText(page);
  });
});

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`tooltip, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });
    test.beforeEach(({ page }) => disableMotion(page));

    test('the "What is threshold pace?" tooltip text has enough contrast', async ({ page }) => {
      await openApp(page, { params: SAMPLE, results: true });
      await page.getByRole('button', { name: 'What is threshold pace?' }).focus();
      await expect(page.getByRole('tooltip').first()).toBeVisible();
      await expectNoAxeViolations(page, { include: ['[role="tooltip"]'], rules: ['color-contrast'] });
    });
  });
}

// Windows High Contrast and other forced-colour modes replace author backgrounds. A selected segment that is shown by a
// fill alone, and a button without a border, would then look like the others, or like plain text.
test.describe('forced colours', () => {
  test.beforeEach(({ page }) => disableMotion(page));

  test('the pressed segments and the borderless buttons stay distinguishable', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await openApp(page, { params: { ...SAMPLE, pace: 'race', rd: '5k', rtm: '25', rts: '0' }, results: true });
    const look = (locator: ReturnType<Page['locator']>) =>
      locator.evaluate((el) => {
        const c = getComputedStyle(el);
        return { background: c.backgroundColor, border: c.borderTopWidth, adjust: c.forcedColorAdjust };
      });
    const pressed = await look(form(page).paceSource('From a recent race'));
    const other = await look(form(page).paceSource('Threshold pace'));
    // The pressed state opts out of the forced palette and paints Highlight; the others keep the forced colours.
    expect(pressed.adjust).toBe('none');
    expect(other.adjust).not.toBe('none');
    expect(pressed.background).not.toBe(other.background);
    const units = await look(form(page).units('kg · cm · km'));
    const imperial = await look(form(page).units('lb · in · mi'));
    expect(units.background).not.toBe(imperial.background);
    const chart = page.getByRole('group', { name: 'Chart metric' });
    expect(await look(chart.getByRole('button', { name: '10K', exact: true }))).not.toEqual(await look(chart.getByRole('button', { name: '5K', exact: true })));
    // A filled button has no border of its own; in forced colours it gets one.
    expect(parseFloat((await look(page.getByRole('button', { name: 'Save image' }))).border)).toBeGreaterThan(0);
  });
});
