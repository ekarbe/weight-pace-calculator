import { test, expect } from './support/fixtures';
import { SAMPLE, alerts, cardTime, form, openApp, raceCard, slider } from './support/app';
import { estimateRaceTimeSec } from '../src/lib/calculations';
import { formatTime } from '../src/lib/utils';

const noCustom = { g: 'female', h: '170', w: '64', bf: '22', pm: '5', ps: '0' };
// Threshold pace at the default position (61.0 kg, 3.0 kg lost, 2 s/km per kg): 5:00 -> 4:54.
const THRESHOLD_AT_61 = 294;

test.describe('race cards', () => {
  test('show the four standard distances with the saving, the range and a readable label', async ({ page }) => {
    await openApp(page, { params: noCustom, results: true });
    await expect(page.getByRole('heading', { name: 'Target weight' })).toBeVisible();
    await expect(page.getByText('−3.0 kg · threshold pace 4:54 /km · 10K 0:59 faster')).toBeVisible();

    const expected = [
      ['5 km', '23:17', '−0:29', '(0:14 to 0:43)', '5 km: 23 minutes and 17 seconds, 29 seconds faster than now. Estimated range: 14 seconds to 43 seconds faster.'],
      ['10 km', '48:01', '−0:59', '(0:29 to 1:28)', '10 km: 48 minutes and 1 second, 59 seconds faster than now. Estimated range: 29 seconds to 1 minute and 28 seconds faster.'],
      ['Half marathon', '01:47:31', '−2:12', '(1:06 to 3:17)', 'Half marathon: 1 hour, 47 minutes, and 31 seconds, 2 minutes and 12 seconds faster than now.'],
      ['Marathon', '03:47:26', '−4:38', '(2:19 to 6:58)', 'Marathon: 3 hours, 47 minutes, and 26 seconds, 4 minutes and 38 seconds faster than now.'],
    ] as const;
    for (const [name, time, saved, range, spoken] of expected) {
      await expect(cardTime(page, name)).toHaveText(time);
      const card = raceCard(page, name);
      await expect(card).toContainText(saved);
      await expect(card).toContainText(range);
      // The screen-reader text is spoken-style, never "01:47:31".
      await expect(card.locator('p.sr-only')).toContainText(spoken);
      await expect(card.locator('div[aria-hidden="true"]').first()).toBeVisible();
    }
    await expect(page.getByRole('listitem').filter({ hasText: /^15 km:/ })).toHaveCount(0);
  });

  test('the health note is always shown with the cards', async ({ page }) => {
    await openApp(page, { params: noCustom, results: true });
    await expect(page.getByText('Estimates, not a weight-loss plan. Don’t aim below a healthy weight for your height; talk to a doctor or dietitian before changing your weight.').first()).toBeVisible();
  });

  test('a custom distance adds a card with its own time and saving', async ({ page }) => {
    await openApp(page, { params: noCustom, results: true });
    await form(page).distance.fill('15');
    const card = raceCard(page, '15 km');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Your distance');
    await expect(cardTime(page, '15 km')).toHaveText('01:14:26');
    await expect(card).toContainText('−1:31');
    await expect(card).toContainText('(0:46 to 2:17)');
    await expect(card.locator('p.sr-only')).toContainText('15 km: 1 hour, 14 minutes, and 26 seconds, 1 minute and 31 seconds faster than now.');
    // It is the model's number, not a lookup.
    expect(formatTime(estimateRaceTimeSec(THRESHOLD_AT_61, 15))).toBe('01:14:26');
  });

  test('the custom card follows the slider and matches the model for other distances', async ({ page }) => {
    await openApp(page, { params: { ...noCustom, d: '21.1' }, results: true });
    await expect(cardTime(page, '21.1 km')).toHaveText(formatTime(estimateRaceTimeSec(THRESHOLD_AT_61, 21.1)));
    await slider(page).focus();
    await page.keyboard.press('Home');
    await expect(cardTime(page, '21.1 km')).toHaveText(formatTime(estimateRaceTimeSec(300, 21.1)));
    await expect(raceCard(page, '21.1 km')).toContainText('baseline');
  });

  test('distances from 1 to 100 km are accepted; anything else is reported and holds the results back', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    for (const km of ['1', '100', '42.2']) {
      await form(page).distance.fill(km);
      await expect(raceCard(page, `${km} km`)).toBeVisible();
      await expect(alerts(page)).toHaveCount(0);
    }
    for (const km of ['0.5', '101', '-3']) {
      await form(page).distance.fill(km);
      await expect(alerts(page).filter({ hasText: 'Enter 1–100 km' })).toBeVisible();
      await expect(form(page).distance).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByText('Fix the highlighted fields to see your estimates.')).toBeVisible();
      await expect(slider(page)).toHaveCount(0);
    }
    await form(page).distance.fill('');
    await expect(alerts(page)).toHaveCount(0);
    await expect(slider(page)).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: /Your distance/ })).toHaveCount(0);
  });

  test('in imperial the custom distance is in miles', async ({ page }) => {
    await openApp(page, { params: { u: 'imperial', g: 'female', h: '67', w: '141', pm: '8', ps: '3', d: '5' }, results: true });
    await expect(raceCard(page, '5 mi')).toBeVisible();
    // 5 mi = 8.047 km at the default position's pace.
    const text = await cardTime(page, '5 mi').innerText();
    expect(text).toMatch(/^\d\d:\d\d(:\d\d)?$/);
    await expect(page.getByRole('button', { name: '5 mi' })).toBeVisible();
  });
});
