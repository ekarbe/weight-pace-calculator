import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { DATE_BRISK, SAMPLE, disableMotion, form, inEachTheme, openApp } from './support/app';
import { bestContrast, contrast, samplePixels, type RGB } from './support/pixels';

// Desktop project only (the look of a control does not depend on the viewport). These read real pixels: axe cannot see a
// 1px border, a focus ring drawn as a shadow, or what shows through a translucent popup.

const RACE = { ...SAMPLE, td: DATE_BRISK, wk: '40', th: 'some', pace: 'race', rd: 'custom', rdc: '8', rtm: '45', rts: '0' };
const MIN_NON_TEXT_CONTRAST = 3;

/** Moves the focus to `locator` the way a keyboard user would, so :focus-visible applies. */
async function focusWithKeyboard(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(locator).toBeFocused();
}

/** Some plain pixel of the card the control sits on (the card's left padding, level with the control). */
async function cardBox(locator: Locator) {
  const handle = await locator.evaluateHandle((el) => el.closest('.glassmorphism') ?? el.parentElement!);
  const box = await handle.asElement()!.boundingBox();
  await handle.dispose();
  return box!;
}

test.describe('controls: non-text contrast (WCAG 1.4.11)', () => {
  test.beforeEach(({ page }) => disableMotion(page));

  test('keyboard focus on a filled or borderless button shows a ring of at least 3:1', async ({ page }) => {
    await openApp(page, { params: { ...SAMPLE, pace: 'race', rd: '5k', rtm: '25', rts: '0' }, results: true });
    const buttons: [string, Locator][] = [
      ['Save image (filled)', page.getByRole('button', { name: 'Save image' })],
      ['Threshold pace, unpressed (ghost)', form(page).paceSource('Threshold pace')],
      ['From a recent race, pressed (filled)', form(page).paceSource('From a recent race')],
      ['lb · in · mi, unpressed (ghost)', form(page).units('lb · in · mi')],
      ['kg · cm · km, pressed (filled)', form(page).units('kg · cm · km')],
      ['Copy share link (outline)', form(page).copyLink],
    ];
    await inEachTheme(page, async (scheme) => {
      for (const [name, button] of buttons) {
        await focusWithKeyboard(page, button);
        const style = await button.evaluate((el) => {
          const s = getComputedStyle(el);
          return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), offset: parseFloat(s.outlineOffset) };
        });
        expect(style, `${name}, ${scheme}`).toMatchObject({ style: 'solid' });
        expect(style.width, `${name}, ${scheme}`).toBeGreaterThanOrEqual(2);
        const box = (await button.boundingBox())!;
        const card = await cardBox(button);
        const y = box.y + box.height / 2;
        // The ring is the 2px band that starts `offset` px outside the button's edge; its middle is 3px out.
        const [ring, around] = await samplePixels(page, [{ x: box.x - style.offset - 1, y }, { x: card.x + 4, y }]);
        expect(contrast(ring, around), `${name}, ${scheme}: ring ${ring} against the card ${around}`).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
      }
    });
  });

  test('the edge of every text field and select is at least 3:1 against the card, in both themes', async ({ page }) => {
    await openApp(page, { params: RACE, results: true });
    const fields: [string, Locator][] = [
      ['Biological sex (select)', page.locator('#gender')],
      ['Height', page.locator('#height')],
      ['Threshold pace source: race distance (select)', page.locator('#race-distance')],
      ['Race minutes', page.locator('#race-minutes')],
      ['Custom race distance', page.locator('#race-custom')],
      ['Weekly running', page.locator('#training-km')],
      ['Running history (select)', page.locator('#training-history')],
    ];
    await inEachTheme(page, async (scheme) => {
      for (const [name, field] of fields) {
        await field.scrollIntoViewIfNeeded();
        const box = (await field.boundingBox())!;
        const left = Math.floor(box.x);
        const y = box.y + box.height / 2;
        const [outside, edgeA, edgeB, edgeC, inside] = await samplePixels(page, [-6, -1, 0, 1, 6].map((dx) => ({ x: left + dx, y })));
        const edges: RGB[] = [edgeA, edgeB, edgeC];
        expect(bestContrast(edges, outside), `${name}, ${scheme}: edge against the card outside`).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        // In the dark theme the field also has its own, lighter fill.
        expect(bestContrast(edges, inside), `${name}, ${scheme}: edge against the field's fill`).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
      }
    });
  });
});

test.describe('open select lists', () => {
  test.beforeEach(({ page }) => disableMotion(page));

  // The list opens over body text and other controls; a translucent surface lets them show through the options.
  test('are opaque, in both themes', async ({ page }) => {
    await openApp(page, { params: RACE, results: true });
    await inEachTheme(page, async (scheme) => {
      for (const trigger of [page.locator('#gender'), page.locator('#race-distance'), page.locator('#training-history')]) {
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();
        await expect(page.getByRole('listbox')).toBeVisible();
        const list = page.locator('[data-slot="select-content"]');
        const colour = await list.evaluate((el) => getComputedStyle(el).backgroundColor);
        const alpha = colour.match(/^rgba?\(([^)]*)\)$/)?.[1].split(/[,/ ]+/).filter(Boolean)[3];
        expect(alpha === undefined || Number(alpha) === 1, `${scheme}: background ${colour}`).toBe(true);
        // And what is painted: the list's own padding, level with its middle, is exactly the colour it says it is.
        const box = (await list.boundingBox())!;
        const [left, right] = await samplePixels(page, [{ x: box.x + 3, y: box.y + box.height / 2 }, { x: box.x + box.width - 4, y: box.y + box.height / 2 }]);
        const [r, g, b] = colour.match(/\d+/g)!.map(Number);
        expect(left, `${scheme}: the list's left padding`).toEqual([r, g, b]);
        expect(right, `${scheme}: the list's right padding`).toEqual([r, g, b]);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('listbox')).toBeHidden();
      }
    });
  });
});
