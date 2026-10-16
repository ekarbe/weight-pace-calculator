import { test, expect } from './support/fixtures';
import { SAMPLE, cardTime, openApp, raceCard, slider, toSeconds } from './support/app';

const params = { ...SAMPLE };

test.describe('target weight slider', () => {
  test('is a labelled slider whose value text spells out the scenario', async ({ page }) => {
    await openApp(page, { params, results: true });
    await expect(page.getByRole('slider', { name: 'Target weight' })).toHaveCount(1);
    await expect(slider(page)).toHaveAttribute('min', '0');
    await expect(slider(page)).toHaveAttribute('max', '13');
    await expect(slider(page)).toHaveValue('6');
    await expect(slider(page)).toHaveAttribute('aria-valuetext', '61.0 kg, 3.0 kg lost, 10K 59 seconds faster');
  });

  test('arrow keys move one weight at a time and the cards follow', async ({ page }) => {
    await openApp(page, { params, results: true });
    await slider(page).focus();

    await page.keyboard.press('ArrowLeft');
    await expect(slider(page)).toHaveAttribute('aria-valuetext', '61.5 kg, 2.5 kg lost, 10K 49 seconds faster');
    await expect(cardTime(page, '10 km')).toHaveText('48:11');
    await expect(raceCard(page, '10 km')).toContainText('10 km: 48 minutes and 11 seconds, 49 seconds faster than now.');

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(slider(page)).toHaveAttribute('aria-valuetext', '60.5 kg, 3.5 kg lost, 10K 1 minute and 9 seconds faster');
    await expect(cardTime(page, '10 km')).toHaveText('47:51');
  });

  test('Home is "no change" and End is the lightest weight', async ({ page }) => {
    await openApp(page, { params, results: true });
    await slider(page).focus();

    await page.keyboard.press('Home');
    await expect(slider(page)).toHaveAttribute('aria-valuetext', '64.0 kg, current weight');
    await expect(page.getByText('Drag the slider to see what a lighter you could run.')).toBeVisible();
    for (const name of ['5 km', '10 km', 'Half marathon', 'Marathon', '15 km']) {
      await expect(raceCard(page, name)).toContainText('same as now');
      await expect(raceCard(page, name)).toContainText('baseline');
    }
    await expect(cardTime(page, '10 km')).toHaveText('49:00');
    await expect(page.getByText('Move the slider below your current weight to see how long it would take.')).toBeVisible();
    await expect(page.getByText('This card sets the weight-based estimate against how you train once the selected weight is below your current weight.')).toBeVisible();

    await page.keyboard.press('End');
    await expect(slider(page)).toHaveAttribute('aria-valuetext', '57.8 kg, 6.2 kg lost, 10K 2 minutes and 2 seconds faster');
    await expect(cardTime(page, '10 km')).toHaveText('46:58');
    await expect(page.getByText('Losing 6.2 kg at a sustainable 0.5% of body weight per week takes about 20 weeks (around Oct 29, 2026).')).toBeVisible();
  });

  test('every step makes every race faster', async ({ page }) => {
    await openApp(page, { params, results: true });
    await slider(page).focus();
    await page.keyboard.press('Home');
    const names = ['5 km', '10 km', 'Half marathon', 'Marathon', '15 km'];
    let previous = await Promise.all(names.map(async (n) => toSeconds(await cardTime(page, n).innerText())));
    for (let i = 1; i <= 13; i++) {
      await page.keyboard.press('ArrowRight');
      await expect(slider(page)).toHaveValue(String(i));
      const now = await Promise.all(names.map(async (n) => toSeconds(await cardTime(page, n).innerText())));
      now.forEach((s, k) => expect(s, `${names[k]} at step ${i}`).toBeLessThan(previous[k]));
      previous = now;
    }
  });

  test('can be dragged: the far ends of the track select the first and the last weight', async ({ page }) => {
    await openApp(page, { params, results: true });
    const box = (await slider(page).boundingBox())!;
    await page.mouse.click(box.x + box.width - 1, box.y + box.height / 2);
    await expect(slider(page)).toHaveValue('13');
    await page.mouse.click(box.x + 1, box.y + box.height / 2);
    await expect(slider(page)).toHaveValue('0');
  });

  test('the table row and the chart marker follow the slider', async ({ page }) => {
    await openApp(page, { params, results: true });
    await page.locator('summary', { hasText: 'Full table (14 weights)' }).click();
    const current = page.locator('tr[aria-current="true"]');
    await expect(current).toHaveCount(1);
    await expect(current.locator('td').first()).toHaveText('61.0');
    const marker = page.getByRole('img', { name: /^Line chart/ }).locator('text.fill-foreground');
    await expect(marker).toHaveText('48:01');

    await slider(page).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(current.locator('td').first()).toHaveText('61.5');
    await expect(marker).toHaveText('48:11');
  });

  test('the first table row shows the weight exactly as typed', async ({ page }) => {
    await openApp(page, { params: { ...params, w: '64.25' }, results: true });
    await page.locator('summary', { hasText: /^Full table/ }).click();
    await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText('64.3');
    await slider(page).focus();
    await page.keyboard.press('Home');
    await expect(slider(page)).toHaveAttribute('aria-valuetext', '64.3 kg, current weight');
  });
});
