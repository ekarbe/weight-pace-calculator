import { test, expect } from './support/fixtures';
import { SAMPLE, form, openApp, slider } from './support/app';

const chart = (page: import('@playwright/test').Page) => page.getByRole('img', { name: /^Line chart of / });
const marker = (page: import('@playwright/test').Page) => chart(page).locator('text.fill-foreground');
const tab = (page: import('@playwright/test').Page, name: string) => page.getByRole('group', { name: 'Chart metric' }).getByRole('button', { name, exact: true });

test.describe('chart', () => {
  test('starts on the 10K race time with the range shown and a spoken description', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    await expect(page.getByRole('heading', { name: 'Race time vs. weight' })).toBeVisible();
    await expect(tab(page, '10K')).toHaveAttribute('aria-pressed', 'true');
    await expect(marker(page)).toHaveText('48:01');
    const label = (await chart(page).getAttribute('aria-label')) ?? '';
    expect(label).toContain('Line chart of race time against weight. At 61 kg: 48 minutes and 1 second.');
    expect(label).toContain('From 49 minutes at 64 kg to 46 minutes and 58 seconds at 58 kg.');
    expect(label).toMatch(/Estimated range at 61 kg: .+ to .+\.$/);
  });

  test('below the BMI floor there is no range to draw or announce (it used to read slow to fast, backwards)', async ({ page }) => {
    // 170 cm at 50 kg is BMI 17.3: the table has one row, the heavier floor weight, and nothing is "lost".
    await openApp(page, { params: { g: 'female', h: '170', w: '50', pm: '5', ps: '0' }, results: true });
    await expect(chart(page)).toBeVisible();
    await expect(chart(page)).not.toHaveAttribute('aria-label', /Estimated range/);
    await expect(page.getByRole('switch', { name: 'Show range' })).toHaveCount(0);
    await expect(chart(page).locator('path[stroke-dasharray]')).toHaveCount(0);
    // The estimate itself and the disclaimer are still there.
    await expect(marker(page)).toHaveText(/^\d\d:\d\d$/);
    await expect(page.getByText(/^The pace gain per kg lost is a rule of thumb/)).toBeVisible();
  });

  test('metric buttons switch what is plotted, and the marker agrees with the matching card', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    const metrics: [string, string, RegExp][] = [
      ['Pace', '4:54', /^Line chart of threshold pace against weight\. At 61 kg: 4 minutes and 54 seconds\./],
      ['5K', '23:17', /^Line chart of race time against weight\. At 61 kg: 23 minutes and 17 seconds\./],
      ['Half', '01:47:31', /At 61 kg: 1 hour, 47 minutes, and 31 seconds\./],
      ['Marathon', '03:47:26', /At 61 kg: 3 hours, 47 minutes, and 26 seconds\./],
      ['15 km', '01:14:26', /At 61 kg: 1 hour, 14 minutes, and 26 seconds\./],
      ['10K', '48:01', /At 61 kg: 48 minutes and 1 second\./],
    ];
    for (const [name, value, label] of metrics) {
      await tab(page, name).click();
      await expect(tab(page, name)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('group', { name: 'Chart metric' }).locator('[aria-pressed="true"]')).toHaveCount(1);
      await expect(marker(page)).toHaveText(value);
      await expect(chart(page)).toHaveAttribute('aria-label', label);
      await expect(page.getByRole('heading', { name: name === 'Pace' ? 'Threshold pace (min/km) vs. weight' : 'Race time vs. weight' })).toBeVisible();
    }
  });

  test('the marker moves with the slider on every metric', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    await tab(page, 'Pace').click();
    await slider(page).focus();
    await page.keyboard.press('Home');
    await expect(marker(page)).toHaveText('5:00');
    await page.keyboard.press('End');
    await expect(marker(page)).toHaveText('4:48');
  });

  test('the custom-distance button exists only while a custom distance is valid, and falls back to 10K', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    await tab(page, '15 km').click();
    await expect(tab(page, '15 km')).toHaveAttribute('aria-pressed', 'true');
    await form(page).distance.fill('');
    await expect(tab(page, '15 km')).toHaveCount(0);
    await expect(tab(page, '10K')).toHaveAttribute('aria-pressed', 'true');
    await expect(marker(page)).toHaveText('48:01');
    await form(page).distance.fill('30');
    await expect(tab(page, '30 km')).toBeVisible();
  });

  test('the range can be switched off and on, and the disclaimer stays either way', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    const toggle = page.getByRole('switch', { name: 'Show range' });
    const dashed = chart(page).locator('path[stroke-dasharray]');
    const disclaimer = page.getByText('The pace gain per kg lost is a rule of thumb of roughly 1 to 3 s/km per kg (default 2), not a prediction.');

    await expect(toggle).toBeChecked();
    await expect(page.getByText('Estimate: 2 s/km per kg')).toBeVisible();
    await expect(page.getByText('Range: 1 to 3 s/km per kg')).toBeVisible();
    await expect(dashed).toHaveCount(2);
    await expect(chart(page)).toHaveAttribute('aria-label', /Estimated range at 61 kg:/);
    await expect(disclaimer).toBeVisible();

    await toggle.uncheck();
    await expect(toggle).not.toBeChecked();
    await expect(page.getByText('Estimate: 2 s/km per kg')).toHaveCount(0);
    await expect(page.getByText('Range: 1 to 3 s/km per kg')).toHaveCount(0);
    await expect(dashed).toHaveCount(0);
    await expect(chart(page)).not.toHaveAttribute('aria-label', /Estimated range/);
    await expect(disclaimer).toBeVisible();
    // Switching the range off does not hide the saving range on the cards.
    await expect(page.getByRole('listitem').filter({ hasText: /^10 km:/ })).toContainText('(0:29 to 1:28)');

    await toggle.check();
    await expect(dashed).toHaveCount(2);
  });

  test('the range follows the advanced pace gain', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    await form(page).advanced.click();
    await form(page).paceGain.fill('3');
    await expect(page.getByText('Estimate: 3 s/km per kg')).toBeVisible();
  });

  test('clicking the chart selects a weight', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    const { width, height } = (await chart(page).boundingBox())!;
    // The plot area spans x = 56..624 of the 640-unit-wide viewBox.
    await chart(page).click({ position: { x: (width * 624) / 640, y: height / 2 } });
    await expect(slider(page)).toHaveValue('13');
    await expect(marker(page)).toHaveText('46:58');
    await chart(page).click({ position: { x: (width * 56) / 640, y: height / 2 } });
    await expect(slider(page)).toHaveValue('0');
    await expect(marker(page)).toHaveText('49:00');
  });
});
