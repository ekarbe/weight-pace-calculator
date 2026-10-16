import type { Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { test, expect } from './support/fixtures';
import { DATE_BRISK, SAMPLE, form, openApp, tr } from './support/app';

const FULL = { ...SAMPLE, td: DATE_BRISK, wk: '40', th: 'some' };
const HEALTH_NOTE = 'Estimates, not a weight-loss plan. Don’t aim below a healthy weight for your height; talk to a doctor or dietitian before changing your weight.';
const printOnly = (page: Page) => page.locator('#print-stats-h');
const footer = (page: Page) => page.locator('footer.print-footer');

/** Page count and the text of every page of the PDF the browser would print. */
async function pdfText(page: Page): Promise<{ pages: number; text: string }> {
  const data = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  const task = getDocument({ data: new Uint8Array(data), verbosity: 0 });
  const doc = await task.promise;
  const chunks: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    chunks.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  const pages = doc.numPages;
  await task.destroy();
  return { pages, text: chunks.join('\n').replace(/\s+/g, ' ') };
}

test.describe('print', () => {
  test('the print layout drops the interactive page and keeps results, notes and the health note', async ({ page }) => {
    await openApp(page, { params: FULL, results: true });
    // On screen the print-only parts do not exist for the user.
    await expect(printOnly(page)).toBeHidden();
    await expect(footer(page)).toBeHidden();

    await page.emulateMedia({ media: 'print' });
    await expect(printOnly(page)).toBeVisible();
    await expect(page.getByText('Estimate running pace improvements based on weight loss.')).toBeVisible();
    await expect(footer(page)).toContainText('Printed on Jun 15, 2026 · ');
    await expect(footer(page)).toContainText(HEALTH_NOTE);

    // Gone: header, the form, the slider, buttons, the share image card and the site footer.
    await expect(page.getByRole('banner')).toBeHidden();
    await expect(form(page).copyLink).toBeHidden();
    await expect(page.getByRole('slider')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Print / save as PDF' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Share image' })).toBeHidden();
    await expect(page.getByText('Eike Christian Karbe')).toBeHidden();
    await expect(page.getByLabel('Height (cm)')).toBeHidden();

    // Kept: the cards, the chart, the timeline, the training card, and the table and notes expanded.
    await expect(page.getByRole('heading', { name: 'Target weight' })).toBeVisible();
    await expect(page.getByRole('img', { name: /^Line chart/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Training context' })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(14);
    await expect(page.getByText('Disclaimer: These calculations are estimates')).toBeVisible();
    await expect(page.getByText('How this is worked out').locator('..')).toBeVisible();
  });

  test('the printed stats list the scenario in the chosen units', async ({ page }) => {
    await openApp(page, { params: FULL, results: true });
    await page.emulateMedia({ media: 'print' });
    const stats = page.locator('section[aria-labelledby="print-stats-h"] dl');
    const row = (label: string) => stats.locator('div', { has: page.locator('dt', { hasText: label }) }).locator('dd');
    await expect(row('Units')).toHaveText('kg · cm · km');
    await expect(row('Biological sex')).toHaveText('Female');
    await expect(row('Height (cm)')).toHaveText('170');
    await expect(row('Weight (kg)')).toHaveText('64');
    await expect(row('Threshold pace (min/km)')).toHaveText('5:00');
    await expect(row('Target weight')).toHaveText('61 kg (3 kg lighter)');
    await expect(row('Target date')).toHaveText('Jul 31, 2026');
    await expect(row('Pace gain (s/km per kg lost)')).toHaveText('2');
  });

  test('in race mode the printed pace is the derived one, not the hidden typed one', async ({ page }) => {
    await openApp(page, { params: { ...SAMPLE, pm: '4', ps: '0', pace: 'race', rd: '5k', rtm: '25', rts: '0' }, results: true });
    await page.emulateMedia({ media: 'print' });
    const stats = page.locator('section[aria-labelledby="print-stats-h"] dl');
    await expect(stats.locator('div', { has: page.locator('dt', { hasText: 'Threshold pace (min/km)' }) }).locator('dd')).toHaveText('5:16');
  });

  test('the footer carries the bare address: no body measurements from the link', async ({ page }) => {
    await openApp(page, { params: FULL, results: true });
    await page.emulateMedia({ media: 'print' });
    await expect(footer(page)).toContainText('Printed on Jun 15, 2026');
    const text = (await footer(page).innerText()).replace(/\s+/g, ' ');
    expect(text).toContain(new URL('./', page.url()).href);
    expect(text).not.toMatch(/[?&=]|lang|g=|h=170|w=64/);
    expect(text).not.toMatch(/\b(170|64|22)\b/);
  });

  test('prints in the light theme even when the page is dark, and closed sections go back afterwards', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 900 }, locale: 'en-US', timezoneId: 'UTC' });
    const page = await context.newPage();
    try {
      await openApp(page, { params: FULL, results: true });
      await expect(page.locator('html')).toHaveClass(/dark/);
      const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(await bg()).toBe('rgb(0, 0, 0)');
      const tableDetails = page.locator('details', { has: page.locator('summary', { hasText: 'Full table' }) });
      await expect(tableDetails).not.toHaveAttribute('open', '');

      await page.emulateMedia({ media: 'print' });
      await expect.poll(bg).toBe('rgb(255, 255, 255)');
      await expect(tableDetails).toHaveAttribute('open', '');
      await expect(page.locator('main h1, main p').first()).toBeAttached();

      await page.emulateMedia({ media: 'screen' });
      await expect.poll(bg).toBe('rgb(0, 0, 0)');
      await expect(tableDetails).not.toHaveAttribute('open', '');
      await expect(printOnly(page)).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test('the beforeprint and afterprint events prepare and restore the page too', async ({ page }) => {
    await openApp(page, { params: FULL, results: true });
    const tableDetails = page.locator('details', { has: page.locator('summary', { hasText: 'Full table' }) });
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await expect(tableDetails).toHaveAttribute('open', '');
    await expect(footer(page)).toContainText('Printed on Jun 15, 2026');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(tableDetails).not.toHaveAttribute('open', '');
  });

  test('"Print / save as PDF" asks the browser to print', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __prints: number };
      w.__prints = 0;
      window.print = () => {
        w.__prints += 1;
      };
    });
    await openApp(page, { params: FULL, results: true });
    await page.getByRole('button', { name: 'Print / save as PDF' }).click();
    expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);
  });

  test('the PDF is short, complete and carries the health note without the link parameters', async ({ page }) => {
    await openApp(page, { params: FULL, results: true });
    await page.emulateMedia({ media: 'print' });
    await expect(footer(page)).toBeVisible();
    const { pages, text } = await pdfText(page);
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(pages).toBeLessThanOrEqual(3);
    for (const expected of [
      'Weight Pace Calculator', 'YOUR STATS', 'TARGET WEIGHT', 'RACE TIME VS. WEIGHT', 'TIMELINE', 'TRAINING CONTEXT',
      'Notes & disclaimers', 'Disclaimer: These calculations are estimates', 'Printed on Jun 15, 2026',
    ]) {
      expect(text, `PDF should contain "${expected}"`).toContain(expected);
    }
    expect(text).toContain('Estimates, not a weight-loss plan.');
    expect(text).toContain('talk to a doctor or dietitian before changing your weight');
    // Nothing interactive and no query string made it onto paper.
    expect(text).not.toMatch(/Copy share link|Print \/ save as PDF|Save image|Skip to main content/);
    expect(text).not.toMatch(/[?&](lang|g|h|w|bf|pm|ps|d|td|wk|th)=/);
  });

  test('a long table still prints on a handful of pages', async ({ page }) => {
    await openApp(page, { params: { g: 'male', h: '195', w: '130', pm: '6', ps: '0' }, results: true });
    await page.emulateMedia({ media: 'print' });
    const rows = await page.locator('tbody tr').count();
    expect(rows).toBeGreaterThan(40);
    const { pages, text } = await pdfText(page);
    expect(pages).toBeLessThanOrEqual(5);
    expect(text).toContain('Disclaimer: These calculations are estimates');
  });

  test('is translated: German date, notes and health note on paper', async ({ page }) => {
    await openApp(page, { lang: 'de', params: FULL, results: true });
    await page.emulateMedia({ media: 'print' });
    await expect(footer(page)).toContainText(tr('de', 'print.printedOn', { date: new Date('2026-06-15T09:00:00Z').toLocaleDateString('de', { year: 'numeric', month: 'short', day: 'numeric' }) }));
    await expect(footer(page)).toContainText(tr('de', 'health.note'));
    const { text } = await pdfText(page);
    expect(text).toContain('Gedruckt am');
    expect(text).toContain(tr('de', 'health.note').split('.')[0] + '.');
  });
});
