import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Download, Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { SAMPLE, alerts, brokenAriaReferences, form, openApp, slider, tr, waitForHydration } from './support/app';
import { IMAGE_FILE_NAME, IMAGE_HEIGHT, IMAGE_SCALE, IMAGE_WIDTH } from '../src/lib/share-image';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const section = (page: Page) => page.locator('section', { has: page.getByRole('heading', { name: 'Share image' }) });
const preview = (page: Page) => page.getByRole('img', { name: /^Image preview:/ });
const weightsBox = (page: Page) => page.getByRole('checkbox', { name: 'Include weights in the image' });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Save image' });

async function save(page: Page): Promise<{ download: Download; png: Buffer }> {
  const [download] = await Promise.all([page.waitForEvent('download'), saveButton(page).click()]);
  return { download, png: readFileSync(await download.path()) };
}
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** Records every string the page paints onto a canvas, so tests can see exactly what ends up in the image. */
async function recordCanvasText(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __drawn: string[] };
    w.__drawn = [];
    for (const method of ['fillText', 'strokeText'] as const) {
      const original = CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method] = function (this: CanvasRenderingContext2D, text: string, ...rest: [number, number, number?]) {
        w.__drawn.push(String(text));
        return original.call(this, text, ...rest);
      };
    }
  });
}
const drawn = (page: Page) => page.evaluate(() => (window as unknown as { __drawn: string[] }).__drawn);

test.describe('share image', () => {
  test('the preview is a described image, and by default it says it holds no body data', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    await expect(preview(page)).toBeVisible();
    await expect(preview(page)).toHaveAttribute('width', String(IMAGE_WIDTH * IMAGE_SCALE));
    await expect(preview(page)).toHaveAttribute('height', String(IMAGE_HEIGHT * IMAGE_SCALE));
    const alt = (await preview(page).getAttribute('aria-label')) ?? '';
    expect(alt).toContain('Estimated race times');
    expect(alt).toContain('10 km: 48 minutes and 1 second, 59 seconds faster than now.');
    expect(alt).toContain('The image shows no weights or other body measurements');
    await expect(weightsBox(page)).not.toBeChecked();
    await expect(weightsBox(page)).toHaveAttribute('aria-describedby', /.+/);
    await expect(section(page)).toContainText('Off by default: the image shows no weight, height or body fat.');
    expect(await brokenAriaReferences(page)).toEqual([]);
  });

  test('"Save image" downloads a real PNG of the documented size', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    const { download, png } = await save(page);
    expect(download.suggestedFilename()).toBe(IMAGE_FILE_NAME);
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    // The first chunk is IHDR: 4 bytes length, "IHDR", then width and height as big-endian 32-bit integers.
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(IMAGE_WIDTH * IMAGE_SCALE);
    expect(png.readUInt32BE(20)).toBe(IMAGE_HEIGHT * IMAGE_SCALE);
    expect(png.subarray(png.length - 8, png.length - 4).toString('ascii')).toBe('IEND');
    expect(png.length).toBeGreaterThan(10_000);
    await expect(page.getByRole('status').filter({ hasText: 'Image saved' })).toBeVisible();
  });

  test('what is painted: times, the health note and the bare address, but no weight, height, body fat or link parameters', async ({ page }) => {
    await recordCanvasText(page);
    await openApp(page, { params: SAMPLE, results: true });
    await expect.poll(async () => (await drawn(page)).join('\n')).toContain('48:01');
    const lines = await drawn(page);
    const text = lines.join('\n');

    for (const expected of ['ESTIMATED RACE TIMES', 'Estimated race times', '23:17', '48:01', '01:47:31', '03:47:26', '01:14:26', '15 km']) {
      if (expected === 'ESTIMATED RACE TIMES' || expected === 'Estimated race times') continue;
      expect(text, `painted text should contain ${expected}`).toContain(expected);
    }
    expect(text.toLowerCase()).toContain('estimated race times');
    expect(text).toContain('Estimates, not a weight-loss plan.');
    const address = lines.find((l) => l.startsWith('http'));
    expect(address, 'the image carries the app address').toBeDefined();
    expect(address).toBe(new URL('./', page.url()).href);

    const withoutAddress = lines.filter((l) => l !== address).join('\n');
    for (const forbidden of [/\b64\b/, /\b61\b/, /\b64\.0\b/, /\b61\.0\b/, /\b170\b/, /\b22\b/, /\bkg\b/i, /\blb\b/i, /body fat/i, /\bweight\b.*\d/i]) {
      expect(withoutAddress, `must not match ${forbidden}`).not.toMatch(forbidden);
    }
  });

  test('turning the weights option on adds the weights, and only then', async ({ page }) => {
    await recordCanvasText(page);
    await openApp(page, { params: SAMPLE, results: true });
    await expect.poll(async () => (await drawn(page)).join('\n')).toContain('48:01');
    await page.evaluate(() => ((window as unknown as { __drawn: string[] }).__drawn.length = 0));

    await weightsBox(page).check();
    await expect.poll(async () => (await drawn(page)).join('\n')).toMatch(/64\.0 kg/);
    expect((await drawn(page)).join('\n')).toMatch(/61\.0 kg/);
    const alt = (await preview(page).getAttribute('aria-label')) ?? '';
    expect(alt).toContain('Weight from 64.0 kg to 61.0 kg');
    expect(alt).not.toContain('The image shows no weights');

    await weightsBox(page).uncheck();
    await expect(preview(page)).toHaveAttribute('aria-label', /The image shows no weights/);
  });

  test('two different people with the same estimate get a byte-identical image, unless they opt in', async ({ browser }) => {
    const images: Record<string, Buffer> = {};
    const people = {
      a: { ...SAMPLE },
      b: { g: 'male', h: '185', w: '80', bf: '15', pm: '5', ps: '0', d: '15' },
    };
    for (const [who, params] of Object.entries(people)) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US', timezoneId: 'UTC' });
      const page = await context.newPage();
      try {
        await openApp(page, { params, results: true });
        await slider(page).focus();
        await page.keyboard.press('Home');
        for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
        await expect(slider(page)).toHaveAttribute('aria-valuetext', /3\.0 kg lost, 10K 59 seconds faster$/);
        images[who] = (await save(page)).png;
        if (who === 'a') {
          await weightsBox(page).check();
          await expect(preview(page)).toHaveAttribute('aria-label', /Weight from/);
          images['a+weights'] = (await save(page)).png;
        }
      } finally {
        await context.close();
      }
    }
    expect(sha(images.a)).toBe(sha(images.b));
    expect(sha(images['a+weights'])).not.toBe(sha(images.a));
  });

  test('the weights option is per visit: it is not in the share link and starts off again', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openApp(page, { params: SAMPLE, results: true });
    await weightsBox(page).check();
    await form(page).copyLink.click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect([...new URL(link).searchParams.keys()].sort()).toEqual(['bf', 'd', 'g', 'h', 'lang', 'pm', 'ps', 'w']);

    const fresh = await context.newPage();
    await fresh.goto(link);
    await waitForHydration(fresh);
    await expect(weightsBox(fresh)).not.toBeChecked();
    await page.reload();
    await waitForHydration(page);
    await expect(weightsBox(page)).not.toBeChecked();
  });

  test('a weight that is below healthy body fat gets no image at all', async ({ page }) => {
    await openApp(page, { params: { g: 'male', h: '180', w: '75', bf: '10', pm: '4', ps: '0' }, results: true });
    await expect(preview(page)).toBeVisible();
    await slider(page).focus();
    await page.keyboard.press('End');
    await expect(section(page)).toContainText('No image for this target weight: it may be below a healthy body-fat level, or past the model’s pace limit. Choose a higher target weight.');
    await expect(preview(page)).toHaveCount(0);
    await expect(saveButton(page)).toBeDisabled();
    await expect(saveButton(page)).toHaveAttribute('aria-describedby', /.+/);
    expect(await brokenAriaReferences(page)).toEqual([]);

    await page.keyboard.press('Home');
    await expect(preview(page)).toBeVisible();
    await expect(saveButton(page)).toBeEnabled();
  });

  test('a pace that hit the model limit gets no image either', async ({ page }) => {
    await openApp(page, { params: { g: 'female', h: '170', w: '64', pm: '3', ps: '10' }, results: true });
    await slider(page).focus();
    await page.keyboard.press('End');
    await expect(section(page)).toContainText('No image for this target weight');
    await expect(saveButton(page)).toBeDisabled();
  });

  test('in imperial the opt-in image shows pounds', async ({ page }) => {
    await openApp(page, { params: { u: 'imperial', g: 'female', h: '67', w: '141', pm: '8', ps: '3' }, results: true });
    await weightsBox(page).check();
    await expect(preview(page)).toHaveAttribute('aria-label', /Weight from 141\.0 lb to /);
  });

  test('is translated: label, alt text and file name', async ({ page }) => {
    await openApp(page, { lang: 'de', params: SAMPLE, results: true });
    await expect(page.getByRole('heading', { name: tr('de', 'shareImage.heading') })).toBeVisible();
    await expect(page.getByRole('img', { name: /^Bildvorschau:/ })).toHaveAttribute('aria-label', new RegExp(tr('de', 'shareImage.alt.private')));
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: tr('de', 'shareImage.save') }).click()]);
    expect(download.suggestedFilename()).toBe(IMAGE_FILE_NAME);
    await expect(page.getByRole('status').filter({ hasText: tr('de', 'shareImage.saved') })).toBeVisible();
  });
});

test.describe('share image: system share sheet', () => {
  test('is offered only when the browser can share files, and hands over the PNG', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __shared: unknown };
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: { title?: string; files?: File[] }) => {
          w.__shared = { title: data.title, files: (data.files ?? []).map((f) => ({ name: f.name, type: f.type, size: f.size })) };
        },
      });
    });
    await openApp(page, { params: SAMPLE, results: true });
    await page.getByRole('button', { name: 'Share…' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __shared?: unknown }).__shared)).toMatchObject({
      title: 'Estimated race times',
      files: [{ name: IMAGE_FILE_NAME, type: 'image/png' }],
    });
    const shared = (await page.evaluate(() => (window as unknown as { __shared: { files: { size: number }[] } }).__shared));
    expect(shared.files[0].size).toBeGreaterThan(10_000);
    await expect(alerts(page)).toHaveCount(0);
  });

  test('cancelling the share sheet is not an error, a failure says so', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      const w = window as unknown as { __shareCalls: number };
      w.__shareCalls = 0;
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async () => {
          w.__shareCalls += 1;
          throw w.__shareCalls === 1 ? new DOMException('cancelled', 'AbortError') : new Error('boom');
        },
      });
    });
    await openApp(page, { params: SAMPLE, results: true });
    const share = page.getByRole('button', { name: 'Share…' });
    await share.click();
    // Cancelling gives no visible feedback, so the stub's call counter is the signal that the first attempt is over.
    await expect.poll(() => page.evaluate(() => (window as unknown as { __shareCalls: number }).__shareCalls)).toBe(1);
    await expect(page.getByText('Couldn’t share the image.')).toHaveCount(0);
    await share.click();
    await expect(page.getByRole('status').filter({ hasText: 'Couldn’t share the image. Try saving it instead.' })).toBeVisible();
  });

  test('without Web Share support only "Save image" is shown', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    await openApp(page, { params: SAMPLE, results: true });
    await expect(saveButton(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share…' })).toHaveCount(0);
  });
});
