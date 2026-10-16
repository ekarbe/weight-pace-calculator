import { test, expect } from './support/fixtures';
import { brokenAriaReferences, cardTime, choose, fillSample, form, openApp, slider } from './support/app';

test.describe('inputs and results', () => {
  test('an empty form lists what is still needed and shows no results', async ({ page }) => {
    await openApp(page);
    await expect(page.getByText('Still needed: sex, height, weight, and threshold pace.')).toBeVisible();
    await expect(slider(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy share link' })).toBeDisabled();
  });

  test('typing the stats unlocks the results step by step', async ({ page }) => {
    await openApp(page);
    const f = form(page);

    await choose(page, f.sex, 'Female');
    await expect(page.getByText('Still needed: height, weight, and threshold pace.')).toBeVisible();
    await f.height.fill('170');
    await f.weight.fill('64');
    await expect(page.getByText('Still needed: threshold pace.')).toBeVisible();
    await f.bodyFat.fill('22');
    await f.paceMin.fill('5');
    await expect(page.getByText('Still needed: threshold pace.')).toBeVisible();
    await f.paceSec.fill('00');

    await expect(slider(page)).toBeVisible();
    await expect(page.getByText('Still needed')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Estimates are ready. Use the target weight slider to explore them.' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Copy share link' })).toBeEnabled();

    // Default position: about 5 % lighter, here 61.0 kg.
    await expect(slider(page)).toHaveAttribute('aria-valuetext', '61.0 kg, 3.0 kg lost, 10K 59 seconds faster');
    await expect(cardTime(page, '5 km')).toHaveText('23:17');
    await expect(cardTime(page, '10 km')).toHaveText('48:01');
    await expect(cardTime(page, 'Half marathon')).toHaveText('01:47:31');
    await expect(cardTime(page, 'Marathon')).toHaveText('03:47:26');
  });

  test('decimal weights are accepted and a changed input resets the slider to its default', async ({ page }) => {
    await openApp(page, { params: { g: 'female', h: '170', w: '64', bf: '22', pm: '5', ps: '0' }, results: true });
    await slider(page).focus();
    await page.keyboard.press('End');
    await expect(slider(page)).toHaveAttribute('aria-valuetext', /^57\.8 kg/);
    await form(page).weight.fill('70.5');
    await expect(slider(page)).toHaveAttribute('aria-valuetext', /^67\.0 kg, 3\.5 kg lost/);
  });

  test('invalid values are flagged next to the field, and the page says what to do', async ({ page }) => {
    await openApp(page);
    const f = form(page);
    await fillSample(page, { height: '20' });

    const heightError = page.getByRole('alert').filter({ hasText: 'Enter 50–272 cm' });
    await expect(heightError).toBeVisible();
    await expect(f.height).toHaveAttribute('aria-invalid', 'true');
    await expect(f.height).toHaveAttribute('aria-describedby', 'height-err');
    await expect(page.getByText('Fix the highlighted fields to see your estimates.')).toBeVisible();
    await expect(slider(page)).toHaveCount(0);
    expect(await brokenAriaReferences(page)).toEqual([]);

    // Every other field reports its own range.
    await f.height.fill('170');
    await f.weight.fill('5');
    await f.bodyFat.fill('3');
    await f.paceSec.fill('75');
    await f.distance.fill('0.5');
    for (const message of ['Enter 20–400 kg', 'If entered, use 5–70%', 'Enter a valid pace (more than 0:00)', 'Enter 1–100 km']) {
      await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible();
    }
    await expect(f.weight).toHaveAttribute('aria-invalid', 'true');
    expect(await brokenAriaReferences(page)).toEqual([]);

    // Fixing a field removes its error and its aria-describedby reference together.
    await f.weight.fill('64');
    await expect(page.getByRole('alert').filter({ hasText: 'Enter 20–400 kg' })).toHaveCount(0);
    await expect(f.weight).not.toHaveAttribute('aria-describedby', /.+/);
    await expect(f.weight).not.toHaveAttribute('aria-invalid', 'true');
    expect(await brokenAriaReferences(page)).toEqual([]);
  });

  test('a pace of 0:00 is rejected', async ({ page }) => {
    await openApp(page);
    await fillSample(page, { paceMin: '0', paceSec: '0' });
    await expect(page.getByRole('alert').filter({ hasText: 'Enter a valid pace (more than 0:00)' })).toBeVisible();
    await expect(slider(page)).toHaveCount(0);
  });

  test('advanced assumptions change the estimate and are validated', async ({ page }) => {
    await openApp(page, { params: { g: 'female', h: '170', w: '64', bf: '22', pm: '5', ps: '0' }, results: true });
    const f = form(page);
    await expect(f.paceGain).toBeHidden();
    await f.advanced.click();
    await expect(f.paceGain).toHaveValue('2');
    await expect(f.bmiFloor).toHaveValue('20');

    // 3 s/km per kg instead of 2: 3.0 kg lost is worth 9 s/km, so 10K improves by about 1:28 instead of 0:59.
    await f.paceGain.fill('3');
    await expect(page.getByRole('listitem').filter({ hasText: /^10 km:/ })).toContainText('−1:28');
    await expect(cardTime(page, '10 km')).toHaveText('47:32');

    await f.paceGain.fill('9');
    await expect(page.getByRole('alert').filter({ hasText: 'Pace gain must be 0–5 s/km per kg' })).toBeVisible();
    await expect(slider(page)).toHaveCount(0);

    await f.paceGain.fill('2');
    await f.bmiFloor.fill('17');
    await expect(page.getByRole('alert').filter({ hasText: 'BMI floor must be 18.5–30' })).toBeVisible();
    await expect(slider(page)).toHaveCount(0);

    // The floor can go down to the underweight threshold, which lengthens the table.
    await f.bmiFloor.fill('18.5');
    await expect(slider(page)).toBeVisible();
    await expect(page.locator('summary', { hasText: 'Full table (23 weights)' })).toBeVisible();
  });

  test('body fat is optional: without it the notes say so', async ({ page }) => {
    await openApp(page, { params: { g: 'female', h: '170', w: '64', pm: '5', ps: '0' }, results: true });
    await page.getByText(/Notes & disclaimers \(\d+\)/).click();
    await expect(page.getByText('Body fat percentage not provided or invalid.')).toBeVisible();
    await expect(page.getByText('Disclaimer: These calculations are estimates')).toBeVisible();
    await expect(page.getByText('Weight loss should be approached healthily.')).toBeVisible();
  });
});
