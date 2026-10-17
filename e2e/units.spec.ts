import { test, expect } from './support/fixtures';
import { SAMPLE, brokenAriaReferences, cardTime, form, openApp, raceCard, slider } from './support/app';

test.describe('units', () => {
  test('switching to imperial converts every field, label and result', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    const f = form(page);
    await expect(f.units('kg · cm · km')).toHaveAttribute('aria-pressed', 'true');
    await expect(f.units('lb · in · mi')).toHaveAttribute('aria-pressed', 'false');
    const metricTimes = await Promise.all(['5 km', '10 km', 'Half marathon', 'Marathon'].map((n) => cardTime(page, n).innerText()));

    await f.units('lb · in · mi').click();
    await expect(f.units('lb · in · mi')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Height (in)')).toHaveValue('66.9');
    await expect(page.getByLabel('Weight (lb)')).toHaveValue('141.1');
    await expect(page.locator('legend', { hasText: 'Threshold pace (min/mi)' })).toBeVisible();
    await expect(f.paceMin).toHaveValue('8');
    await expect(f.paceSec).toHaveValue('3');
    await expect(page.getByLabel('Custom race distance (mi)')).toHaveValue('9.3');
    await expect(page.getByRole('combobox', { name: 'Biological sex' })).toHaveText('Female');

    // The same runner, so the same race times; only the weights are shown in pounds.
    await expect(slider(page)).toHaveAttribute('aria-valuetext', '134.5 lb, 6.6 lb lost, 10K 59 seconds faster');
    for (const [i, n] of ['5 km', '10 km', 'Half marathon', 'Marathon'].entries()) {
      await expect(cardTime(page, n)).toHaveText(metricTimes[i]);
    }
    await expect(raceCard(page, '9.3 mi')).toBeVisible();
    await expect(page.getByText('141.1 lb (now)')).toBeVisible();
    expect(await brokenAriaReferences(page)).toEqual([]);

    await f.units('kg · cm · km').click();
    await expect(page.getByLabel('Weight (kg)')).toHaveValue('64');
    await expect(f.paceMin).toHaveValue('5');
    await expect(f.paceSec).toHaveValue('0');
    await expect(page.getByLabel('Custom race distance (km)')).toHaveValue('15');
    // 170 cm -> 66.9 in -> 169.9 cm: the inch field is rounded to one decimal, so the round trip is exact to 0.1 cm only.
    expect(Number(await form(page).height.inputValue())).toBeCloseTo(170, 0);
    await expect(slider(page)).toHaveAttribute('aria-valuetext', '61.0 kg, 3.0 kg lost, 10K 59 seconds faster');
  });

  test('imperial input from a link works and is validated in imperial ranges', async ({ page }) => {
    await openApp(page, { params: { u: 'imperial', g: 'male', h: '71', w: '166', pm: '8', ps: '3' }, results: true });
    await expect(page.getByLabel('Height (in)')).toHaveValue('71');
    await expect(page.getByText('(now)')).toHaveText('166.0 lb (now)');

    await page.getByLabel('Height (in)').fill('10');
    await expect(page.getByRole('alert').filter({ hasText: 'Enter 20–107 in' })).toBeVisible();
    await page.getByLabel('Height (in)').fill('71');
    await page.getByLabel('Weight (lb)').fill('5');
    await expect(page.getByRole('alert').filter({ hasText: 'Enter 45–880 lb' })).toBeVisible();
    await page.getByLabel('Weight (lb)').fill('166');
    await page.getByLabel('Custom race distance (mi)').fill('0.1');
    await expect(page.getByRole('alert').filter({ hasText: 'Enter 0.6–62 mi' })).toBeVisible();
  });

  test('the pace is per mile in imperial and the chart heading says so', async ({ page }) => {
    await openApp(page, { params: { u: 'imperial', g: 'female', h: '67', w: '141', pm: '8', ps: '3' }, results: true });
    await page.getByRole('button', { name: 'Pace', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Threshold pace (min/mi) vs. weight' })).toBeVisible();
    await expect(page.getByText(/threshold pace \d+:\d\d \/mi/)).toBeVisible();
  });
});
