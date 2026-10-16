import { test, expect } from './support/fixtures';
import { DATE_BRISK, DATE_SUSTAINABLE, DATE_TOO_FAST, SAMPLE, TOMORROW, alerts, brokenAriaReferences, openApp, slider } from './support/app';

const dateInput = (page: import('@playwright/test').Page) => page.getByLabel('I want to get there by');
const timeline = (page: import('@playwright/test').Page) => page.locator('section', { has: page.getByRole('heading', { name: 'Timeline' }) });

test.describe('timeline', () => {
  test('shows the sustainable date relative to today, and follows the slider', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    await expect(timeline(page)).toContainText('Losing 3.0 kg at a sustainable 0.5% of body weight per week takes about 10 weeks (around Aug 20, 2026).');
    await slider(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(timeline(page)).toContainText('Losing 3.5 kg at a sustainable 0.5% of body weight per week takes about 11 weeks (around Aug 31, 2026).');
    await page.keyboard.press('Home');
    await expect(timeline(page)).toContainText('Move the slider below your current weight to see how long it would take.');
    await expect(dateInput(page)).toHaveCount(0);
  });

  test('a target date is classified as sustainable, brisk or too fast, in words and with advice', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    await expect(dateInput(page)).toHaveAttribute('min', TOMORROW);

    const cases: [string, string, string, string][] = [
      [DATE_SUSTAINABLE, '0.23 kg/week', '0.36% per week', 'Sustainable'],
      [DATE_BRISK, '0.46 kg/week', '0.71% per week', 'Brisk'],
      [DATE_TOO_FAST, '1.05 kg/week', '1.64% per week', 'Too fast'],
    ];
    const hints: Record<string, string> = {
      Sustainable: 'At or below about 0.5% of body weight per week.',
      Brisk: 'Above 0.5% per week. Hard to sustain while training and easy to under-fuel.',
      'Too fast': 'Above 1% of body weight per week. This risks injury, illness and lost performance; choose a later date or a higher target weight.',
    };
    for (const [date, rate, pct, risk] of cases) {
      await dateInput(page).fill(date);
      const status = timeline(page).getByRole('status');
      await expect(status).toContainText(`That needs ${rate} (${pct}): ${risk}.`);
      await expect(status).toContainText(hints[risk]);
    }
    expect(await brokenAriaReferences(page)).toEqual([]);
  });

  test('a past date, today or a malformed date asks for a future date', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    for (const bad of ['2026-06-10', '2026-06-15']) {
      await dateInput(page).fill(bad);
      await expect(alerts(page).filter({ hasText: 'Pick a date in the future.' })).toBeVisible();
      await expect(dateInput(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(dateInput(page)).toHaveAttribute('aria-describedby', /.+/);
      expect(await brokenAriaReferences(page)).toEqual([]);
    }
    await dateInput(page).fill(DATE_SUSTAINABLE);
    await expect(alerts(page).filter({ hasText: 'Pick a date in the future.' })).toHaveCount(0);
    await expect(dateInput(page)).not.toHaveAttribute('aria-describedby', /.+/);
  });

  test('a date from a link that cannot be a date is reported instead of crashing', async ({ page }) => {
    await openApp(page, { params: { ...SAMPLE, td: '2026-13-45' }, results: true });
    await expect(alerts(page).filter({ hasText: 'Pick a date in the future.' })).toBeVisible();
  });

  test('rates are shown in pounds in imperial', async ({ page }) => {
    await openApp(page, { params: { u: 'imperial', g: 'female', h: '67', w: '141', pm: '8', ps: '3', td: DATE_BRISK }, results: true });
    await expect(timeline(page).getByRole('status')).toContainText(/That needs \d\.\d\d lb\/week \(\d\.\d\d% per week\): Brisk\./);
  });

  test('a date in the link is restored in the field', async ({ page }) => {
    await openApp(page, { params: { ...SAMPLE, td: DATE_TOO_FAST }, results: true });
    await expect(dateInput(page)).toHaveValue(DATE_TOO_FAST);
    await expect(timeline(page).getByRole('status')).toContainText('Too fast');
  });
});

// "Today" is the local calendar date, not the UTC one: the same instant is a different day in different zones.
const INSTANT = '2026-06-15T23:30:00Z';
const ZONES: [string, string, string][] = [
  ['UTC', 'Aug 20, 2026', '2026-06-16'],
  ['America/Los_Angeles', 'Aug 20, 2026', '2026-06-16'],
  ['Pacific/Auckland', 'Aug 21, 2026', '2026-06-17'],
  ['Pacific/Kiritimati', 'Aug 21, 2026', '2026-06-17'],
];
for (const [timezoneId, expectedDate, minDate] of ZONES) {
  test.describe(`time zone ${timezoneId}`, () => {
    test.use({ timezoneId });
    test(`23:30 UTC counts as ${minDate === '2026-06-16' ? 'the 15th' : 'the 16th'} locally`, async ({ page, context }) => {
      await context.clock.setFixedTime(new Date(INSTANT));
      await openApp(page, { params: SAMPLE, results: true });
      await expect(timeline(page)).toContainText(`(around ${expectedDate})`);
      await expect(dateInput(page)).toHaveAttribute('min', minDate);
    });
  });
}
