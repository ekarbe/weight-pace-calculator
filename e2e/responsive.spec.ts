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


/** Rendered size, in CSS pixels, of every text in the chart: the drawing is scaled to the card, so a fixed canvas shrank the labels on a phone. */
function chartTextSizes(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('svg[role="img"]')!;
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    return [...svg.querySelectorAll('text')].map((t) => parseFloat(getComputedStyle(t).fontSize) * scale);
  });
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

  test('the chart keeps readable axis and value labels at this width', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    const sizes = await chartTextSizes(page);
    expect(sizes.length).toBeGreaterThan(5);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(10);
  });

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
  test('the chart keeps readable axis and value labels', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    for (const size of await chartTextSizes(page)) expect(size).toBeGreaterThanOrEqual(10);
    // And it is still a chart: the line and its marker are inside the drawing.
    const inside = await page.evaluate(() => {
      const svg = document.querySelector<SVGSVGElement>('svg[role="img"]')!;
      const box = svg.getBoundingClientRect();
      return [...svg.querySelectorAll('path, circle, text')].every((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= box.left - 1 && r.right <= box.right + 1;
      });
    });
    expect(inside).toBe(true);
  });

  // The longest option ("Unter 1 Jahr oder nach langer Pause") used to make the list wider than the screen, with its end and
  // its checkmark off to the right. The list is as wide as its longest option but never wider than the room it has.
  // The cap itself, independent of how long today's translations are: far narrower than any phone, every list still fits and wraps.
  test('an open select list is capped to the room it has, and long options wrap', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 640 });
    await openApp(page, { lang: 'de', params: FULL, results: true });
    await page.locator('#training-history').scrollIntoViewIfNeeded();
    await page.locator('#training-history').click();
    await expect(page.getByRole('listbox')).toBeVisible();
    const geometry = await page.evaluate(() => {
      const list = document.querySelector<HTMLElement>('[data-slot="select-content"]')!;
      const box = list.getBoundingClientRect();
      const longest = [...list.querySelectorAll<HTMLElement>('[data-slot="select-item"]')].sort((a, b) => (b.textContent ?? '').length - (a.textContent ?? '').length)[0];
      return { right: box.right, width: document.documentElement.clientWidth, lines: Math.round(longest.getBoundingClientRect().height / parseFloat(getComputedStyle(longest).lineHeight)) };
    });
    expect(geometry.right).toBeLessThanOrEqual(geometry.width);
    expect(geometry.lines).toBeGreaterThan(1);
  });

  for (const lang of LOCALES) {
    test(`${lang}: open select lists stay on the screen and show every option in full`, async ({ page }) => {
      await openApp(page, { lang, params: { ...FULL, pace: 'race', rd: 'custom', rdc: '8', rtm: '45', rts: '0' }, results: true });
      for (const id of ['#gender', '#race-distance', '#training-history']) {
        await page.locator(id).scrollIntoViewIfNeeded();
        await page.locator(id).click();
        await expect(page.getByRole('listbox')).toBeVisible();
        const geometry = await page.evaluate(() => {
          const list = document.querySelector<HTMLElement>('[data-slot="select-content"]')!;
          const box = list.getBoundingClientRect();
          return {
            width: document.documentElement.clientWidth,
            left: box.left,
            right: box.right,
            listClipped: list.scrollWidth > list.clientWidth + 1,
            items: [...list.querySelectorAll<HTMLElement>('[data-slot="select-item"]')].map((i) => ({ text: i.textContent, right: i.getBoundingClientRect().right, clipped: i.scrollWidth > i.clientWidth + 1 })),
          };
        });
        expect(geometry.left, `${lang} ${id}`).toBeGreaterThanOrEqual(0);
        expect(geometry.right, `${lang} ${id}`).toBeLessThanOrEqual(geometry.width);
        expect(geometry.listClipped, `${lang} ${id}`).toBe(false);
        for (const item of geometry.items) {
          expect(item.right, `${lang} ${id} "${item.text}"`).toBeLessThanOrEqual(geometry.width);
          expect(item.clipped, `${lang} ${id} "${item.text}"`).toBe(false);
        }
        await page.keyboard.press('Escape');
        await expect(page.getByRole('listbox')).toBeHidden();
      }
    });

    test(`${lang}: the checkmark of the longest option is on the screen`, async ({ page }) => {
      await openApp(page, { lang, params: FULL, results: true });
      await page.locator('#training-history').scrollIntoViewIfNeeded();
      await page.locator('#training-history').click();
      await page.getByRole('option', { name: tr(lang, 'training.history.new') }).click();
      await expect(page.getByRole('listbox')).toBeHidden();
      await page.locator('#training-history').click();
      const mark = await page.evaluate(() => {
        const svg = document.querySelector('[data-slot="select-item"][data-state="checked"] svg');
        const box = svg?.getBoundingClientRect();
        return box && { left: box.left, right: box.right, width: document.documentElement.clientWidth };
      });
      expect(mark, 'a checkmark on the selected option').toBeTruthy();
      expect(mark!.left).toBeGreaterThanOrEqual(0);
      expect(mark!.right).toBeLessThanOrEqual(mark!.width);
    });
  }

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
