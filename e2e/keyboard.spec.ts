import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { DATE_BRISK, SAMPLE, choose, disableMotion, form, openApp, slider } from './support/app';

const FULL = { ...SAMPLE, td: DATE_BRISK, wk: '40', th: 'some' };

interface Stop {
  /** Position in the document-order inventory of tabbable controls. */
  index: number;
  name: string;
  outline: string;
  ring: string;
  inView: boolean;
  /** What is painted over the centre of the focused control, if anything. */
  coveredBy: string | null;
}

/** Marks every tabbable, visible control in document order and returns a label for each. */
async function markTabbable(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]';
    const controls = [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => {
      if (el.tabIndex < 0 || el.matches(':disabled')) return false;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      return el.checkVisibility() && el.getClientRects().length > 0;
    });
    controls.forEach((el, i) => el.setAttribute('data-e2e-stop', String(i)));
    return controls.map((el) => {
      const labelledBy = el.getAttribute('aria-labelledby');
      const label = el.getAttribute('aria-label') || (labelledBy && document.getElementById(labelledBy)?.textContent) || (el as HTMLInputElement).labels?.[0]?.textContent || el.textContent || el.getAttribute('placeholder') || el.id;
      return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} ${String(label).trim().replace(/\s+/g, ' ').slice(0, 40)}`;
    });
  });
}

/** What is focused right now, and whether the user can see it. */
function describeFocus(page: Page): Promise<Stop | null> {
  return page.evaluate(async () => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || !el.hasAttribute('data-e2e-stop')) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
    const cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
    const top = document.elementFromPoint(cx, cy);
    return {
      index: Number(el.getAttribute('data-e2e-stop')),
      name: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`,
      outline: `${s.outlineStyle} ${s.outlineWidth}`,
      ring: s.boxShadow,
      inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
      coveredBy: top && top !== el && !el.contains(top) && !top.contains(el) ? `${top.tagName.toLowerCase()}.${String(top.className).slice(0, 60)} at y=${Math.round(r.top)} scrollY=${Math.round(scrollY)}` : null,
    };
  });
}

/**
 * Presses Tab until the last control has been reached and returns every stop. A native date field has several
 * internal Tab stops (month, day, year, picker), so one control can legitimately be visited more than once in a row.
 */
async function tabThrough(page: Page, count: number): Promise<Stop[]> {
  const visited: Stop[] = [];
  for (let presses = 0; presses < count + 6; presses++) {
    await page.keyboard.press('Tab');
    const stop = await describeFocus(page);
    expect(stop, `Tab #${presses + 1} should land on a control of the page`).not.toBeNull();
    visited.push(stop!);
    if (stop!.index === count - 1) break;
  }
  return visited;
}

/** The first stop of every control: the later stops of a date field are its inner parts, drawn by the browser itself. */
const firstStops = (stops: Stop[]) => stops.filter((s, i) => i === 0 || stops[i - 1].index !== s.index);

const collapse = (stops: Stop[]) => stops.map((s) => s.index).filter((v, i, all) => v !== all[i - 1]);

/** The global 2px outline, or a box-shadow ring of at least 2px (the shadcn controls draw a 3px ring instead). */
const hasFocusIndicator = (s: Stop) => {
  const outlineWidth = parseFloat(s.outline.split(' ')[1] ?? '0');
  const spreads = s.ring.split(/,(?![^(]*\))/).map((shadow) => parseFloat(shadow.match(/-?\d+(?:\.\d+)?px/g)?.[3] ?? '0'));
  return (s.outline.startsWith('solid') && outlineWidth >= 2) || Math.max(0, ...spreads) >= 2;
};

test.describe('keyboard only', () => {
  // Focus rings fade in over 150 ms. Transitions are switched off here so the computed style is the final one.
  test.beforeEach(({ page }) => disableMotion(page));

  test('the skip link is first, appears on focus, and moves focus to the main content', async ({ page }) => {
    await openApp(page, { params: FULL, results: true });
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    // Hidden until focused.
    expect((await skip.boundingBox())!.width).toBeLessThanOrEqual(2);
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    expect((await skip.boundingBox())!.width).toBeGreaterThan(60);
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
    expect(new URL(page.url()).hash).toBe('#main');
    // The next Tab lands on the first control of the page content, not back in the header.
    await page.keyboard.press('Tab');
    await expect(form(page).units('kg · cm · km')).toBeFocused();
  });

  test('Tab visits every control once, in reading order, with a visible focus indicator', async ({ page }) => {
    await openApp(page, { params: FULL, results: true });
    const inventory = await markTabbable(page);
    expect(inventory.length).toBeGreaterThan(30);

    const visited = await tabThrough(page, inventory.length);
    // Same controls, same order: nothing skipped, nothing out of order, no positive tabindex, no trap.
    expect(collapse(visited)).toEqual(inventory.map((_, i) => i));
    expect(visited.length - inventory.length, 'extra Tab stops (the date field has four)').toBeLessThanOrEqual(3);

    const noIndicator = firstStops(visited).filter((s) => !hasFocusIndicator(s)).map((s) => `${inventory[s.index]} [${s.outline}; ${s.ring}]`);
    expect(noIndicator, 'controls without a visible focus indicator').toEqual([]);
    const offscreen = visited.filter((s) => !s.inView).map((s) => inventory[s.index]);
    expect(offscreen, 'focused controls that were not scrolled into view').toEqual([]);
  });

  // WCAG 2.2 SC 2.4.11 (not part of 2.1 AA): Tab used to scroll a control just under the 64px sticky header, e.g. the
  // target weight slider. `scroll-padding-top` on <html> keeps it clear.
  test('a focused control is never hidden behind the sticky header', async ({ page }) => {
    await openApp(page, { params: FULL, results: true });
    const inventory = await markTabbable(page);
    const visited = await tabThrough(page, inventory.length);
    const covered = visited.filter((s) => s.coveredBy).map((s) => `${inventory[s.index]} <- ${s.coveredBy}`);
    expect(covered, 'focused controls hidden behind other content').toEqual([]);
  });

  test('the same holds on the empty form, with the race-result fields, and in the dark theme', async ({ page }) => {
    await openApp(page, { params: { ...SAMPLE, pace: 'race', rd: 'custom', rdc: '8', rtm: '36', rts: '0' }, results: true });
    await page.emulateMedia({ colorScheme: 'dark' });
    const inventory = await markTabbable(page);
    const visited = await tabThrough(page, inventory.length);
    expect(collapse(visited)).toEqual(inventory.map((_, i) => i));
    for (const stop of firstStops(visited)) {
      expect(hasFocusIndicator(stop), `${inventory[stop.index]} [${stop.outline}; ${stop.ring}]`).toBe(true);
    }
  });

  test('the slider, the select lists, the switches and the summaries work from the keyboard', async ({ page }) => {
    await openApp(page);
    // A select opens with Enter, moves with the arrows, picks with Enter and gives the focus back.
    await form(page).sex.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(form(page).sex).toBeFocused();
    await expect(form(page).sex).toHaveText('Female');
    // Escape closes without changing.
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(form(page).sex).toHaveText('Female');

    await form(page).height.fill('180');
    await form(page).weight.fill('75');
    await form(page).paceMin.fill('4');
    await form(page).paceSec.fill('0');
    await expect(slider(page)).toBeVisible();

    await slider(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider(page)).toHaveValue(/^[1-9]/);

    // The range switch toggles with Space, a <details> opens with Enter.
    const toggle = page.getByRole('switch', { name: 'Show range' });
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).not.toBeChecked();
    await page.keyboard.press('Space');
    await expect(toggle).toBeChecked();

    const summary = page.locator('summary', { hasText: /^Full table/ });
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('details', { has: summary })).toHaveAttribute('open', '');
    // The scrollable table is itself reachable, so keyboard users can scroll it.
    await expect(page.getByRole('region', { name: /^Full table/ })).toHaveAttribute('tabindex', '0');
  });

  test('the explanation of threshold pace is available on keyboard focus and closes with Escape', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'What is threshold pace?' }).focus();
    await expect(page.getByRole('tooltip').first()).toContainText('The pace you could hold for about an hour in a race.');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });

  test('every step of the main flow can be done without a pointer', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab'); // logo link
    await form(page).units('lb · in · mi').focus();
    await page.keyboard.press('Enter');
    await expect(form(page).units('lb · in · mi')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(form(page).units('lb · in · mi')).toHaveAttribute('aria-pressed', 'true');
    await choose(page, form(page).sex, 'Female');
  });
});
