import { test, expect } from './support/fixtures';
import { SAMPLE, openApp, slider } from './support/app';

// Mobile project only (a touch screen; see playwright.config.ts).
test.describe('touch', () => {
  test('tapping the chart selects a weight', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    const chart = page.getByRole('img', { name: /^Line chart/ });
    const { width, height } = (await chart.boundingBox())!;
    await chart.tap({ position: { x: (width * 624) / 640, y: height / 2 } });
    await expect(slider(page)).toHaveValue('13');
    await chart.tap({ position: { x: (width * 56) / 640, y: height / 2 } });
    await expect(slider(page)).toHaveValue('0');
  });

  test('the training fields are touch-sized and keep the numeric keyboard', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    const km = page.getByLabel(/^Running per week/);
    const since = page.getByRole('combobox', { name: 'How long have you run regularly?' });
    await expect(km).toHaveAttribute('inputmode', 'decimal');
    for (const field of [km, since]) {
      await field.scrollIntoViewIfNeeded();
      expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      // 16 px stops mobile browsers from zooming the page when the field is focused.
      expect(parseFloat(await field.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    }
  });
});
