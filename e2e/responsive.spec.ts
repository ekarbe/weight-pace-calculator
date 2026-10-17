import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { DATE_BRISK, LOCALES, SAMPLE, hasHorizontalOverflow, openAllDetails, openApp, tr } from './support/app';

const FULL = { ...SAMPLE, td: DATE_BRISK, wk: '40', th: 'some' };

/** Text-bearing elements whose right edge sticks out of the viewport (scroll containers and screen-reader-only text excluded). */
function elementsPastTheEdge(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth + 1;
    const selector = 'h1, h2, h3, p, label, legend, button, a, summary, li, dt, dd, input, select, [role="combobox"], [role="slider"], svg[role="img"], canvas';
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => !el.closest('[role="region"], .sr-only, [aria-hidden="true"] .sr-only') && !el.matches('.sr-only'))
      .filter((el) => el.checkVisibility() && el.getClientRects().length > 0)
      .filter((el) => el.getBoundingClientRect().right > limit)
      .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}" right=${Math.round(el.getBoundingClientRect().right)}`);
  });
}

/**
 * The big time on each race card, when it is wider than its card. The card clips what sticks out (it has overflow-hidden for
 * its stripe), so this is invisible to the viewport-edge check above: 03:47:26 used to lose its last digits at 1024-1279 px.
 */
function clippedTimes(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('ul > li p.font-black')]
      .filter((p) => p.scrollWidth > p.clientWidth)
      .map((p) => `${p.textContent} (${p.scrollWidth}px in ${p.clientWidth}px)`),
  );
}

test.describe('layout at every width', () => {
  for (const width of [1024, 1100, 1180, 1279, 1280]) {
    // Desktop project only (a window width, not a phone); the phone project has its own 320 px check below.
    test(`the times on the race cards are not cut off at ${width} px`, { tag: '@desktop' }, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openApp(page, { params: SAMPLE, results: true });
      await expect(page.getByRole('listitem').filter({ hasText: /^Marathon:/ })).toBeVisible();
      expect(await clippedTimes(page)).toEqual([]);
    });
  }

  for (const lang of LOCALES) {
    test(`${lang}: nothing overflows horizontally with every feature and section open`, async ({ page }) => {
      await openApp(page, { lang, params: FULL, results: true });
      await page.getByRole('checkbox', { name: tr(lang, 'shareImage.weights.label') }).check();
      await openAllDetails(page);
      expect(await hasHorizontalOverflow(page)).toBe(false);
      expect(await elementsPastTheEdge(page)).toEqual([]);
    });
  }

  test('the input panel stacks above the results on a phone and sits beside them on a desktop', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    const inputs = (await page.getByRole('heading', { name: 'Your stats' }).boundingBox())!;
    const results = (await page.getByRole('heading', { name: 'Target weight' }).boundingBox())!;
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      expect(results.x).toBeGreaterThan(inputs.x + 200);
    } else {
      expect(results.y).toBeGreaterThan(inputs.y);
      expect(Math.abs(results.x - inputs.x)).toBeLessThan(40);
    }
  });

  test('race cards form two columns on a phone and four on a desktop', async ({ page }) => {
    await openApp(page, { params: { g: 'female', h: '170', w: '64', bf: '22', pm: '5', ps: '0' }, results: true });
    const cards = page.getByRole('listitem').filter({ hasText: /^(5 km|10 km|Half marathon|Marathon):/ });
    await expect(cards).toHaveCount(4);
    const xs = await cards.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    const columns = new Set(xs).size;
    expect((page.viewportSize()?.width ?? 0) >= 1024 ? columns === 4 : columns === 2).toBe(true);
  });
});

// Phone project only (a 320px viewport is a phone; see playwright.config.ts).
test.describe('narrow screens (WCAG 1.4.10 reflow, 320 CSS px)', { tag: '@phone' }, () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test('the times on the race cards are not cut off', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    expect(await clippedTimes(page)).toEqual([]);
  });
  for (const lang of LOCALES) {
    test(`${lang}: content reflows into one column without horizontal scrolling`, async ({ page }) => {
      await openApp(page, { lang, params: FULL, results: true });
      await openAllDetails(page);
      expect(await hasHorizontalOverflow(page)).toBe(false);
      expect(await elementsPastTheEdge(page)).toEqual([]);
    });
  }
});

test.describe('touch', () => {
  // The touch-only tests (tapping the chart, touch target sizes) are in touch.spec.ts.
  test('the form fields bring up numeric keyboards', async ({ page }) => {
    await openApp(page);
    await expect(page.getByLabel(/^Height/)).toHaveAttribute('inputmode', 'decimal');
    await expect(page.getByLabel('Threshold pace, minutes')).toHaveAttribute('inputmode', 'numeric');
    await expect(page.getByLabel(/^Custom race distance/)).toHaveAttribute('inputmode', 'decimal');
  });
});
