import { test, expect } from './support/fixtures';
import { DATE_BRISK, SAMPLE, form, openApp, slider, tr, waitForHydration } from './support/app';

test.describe('share link', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  const FULL = { ...SAMPLE, td: DATE_BRISK, wk: '40', th: 'some' };

  test('copy puts the whole form in the link, tells the user, and updates the address bar', async ({ page }) => {
    await openApp(page, { params: FULL, results: true });
    await form(page).copyLink.click();
    await expect(form(page).copyLink).toHaveText('Link copied!');
    await expect(page.getByRole('status').filter({ hasText: 'Link copied!' })).toBeAttached();

    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(page.url()).toBe(link);
    const url = new URL(link);
    expect(`${url.origin}${url.pathname}`).toBe(new URL('./', page.url()).href);
    // Defaults (metric units, threshold-pace source, first race distance) are left out; everything entered is in.
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lang: 'en', g: 'female', h: '170', w: '64', bf: '22', pm: '5', ps: '0', d: '15', td: DATE_BRISK, wk: '40', th: 'some',
    });
  });

  test('opening the link in a fresh tab restores the form, the results and the language', async ({ page, context }) => {
    await openApp(page, { lang: 'de', params: FULL, results: true });
    await page.getByRole('button', { name: tr('de', 'share.copy') }).click();
    await expect(page.getByRole('button', { name: tr('de', 'share.copied') })).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(link).searchParams.get('lang')).toBe('de');

    const copy = await context.newPage();
    await copy.goto(link);
    await waitForHydration(copy);
    await expect(copy.locator('html')).toHaveAttribute('lang', 'de');
    await expect(copy.getByLabel(/^Größe \(cm\)/)).toHaveValue('170');
    await expect(copy.getByLabel(/^Gewicht \(kg\)/)).toHaveValue('64');
    await expect(copy.getByLabel('Körperfett %')).toHaveValue('22');
    await expect(copy.getByLabel('Schwellentempo, Minuten')).toHaveValue('5');
    await expect(copy.getByLabel(/^Eigene Wettkampfdistanz/)).toHaveValue('15');
    await expect(copy.getByLabel(tr('de', 'plan.label'))).toHaveValue(DATE_BRISK);
    await expect(copy.getByLabel(/^Laufumfang pro Woche/)).toHaveValue('40');
    await expect(copy.getByRole('combobox', { name: tr('de', 'training.history.label') })).toHaveText(tr('de', 'training.history.some'));
    await expect(slider(copy)).toHaveAttribute('aria-valuetext', await slider(page).getAttribute('aria-valuetext') ?? 'missing');
  });

  test('imperial units survive the round trip as typed', async ({ page, context }) => {
    await openApp(page, { params: { u: 'imperial', g: 'male', h: '71', w: '166.5', pm: '8', ps: '3' }, results: true });
    await form(page).copyLink.click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(Object.fromEntries(new URL(link).searchParams)).toMatchObject({ u: 'imperial', h: '71', w: '166.5', pm: '8', ps: '3' });

    const copy = await context.newPage();
    await copy.goto(link);
    await waitForHydration(copy);
    await expect(copy.getByLabel('Weight (lb)')).toHaveValue('166.5');
    await expect(copy.getByRole('button', { name: 'lb · in · mi' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the slider position is not part of the link: a shared link opens at the default position', async ({ page, context }) => {
    await openApp(page, { params: SAMPLE, results: true });
    await slider(page).focus();
    await page.keyboard.press('End');
    await form(page).copyLink.click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    const copy = await context.newPage();
    await copy.goto(link);
    await waitForHydration(copy);
    await expect(slider(copy)).toHaveValue('6');
  });

  test('without clipboard access the address bar still holds the link and nothing breaks', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) } });
    });
    await openApp(page, { params: SAMPLE, results: true });
    await form(page).copyLink.click();
    await expect(page).toHaveURL(/[?&]g=female&/);
    await expect(page.getByRole('button', { name: 'Copy share link' })).toBeVisible();
    await expect(page.getByText('Link copied!')).toHaveCount(0);
  });

  test('hostile or garbled parameters are ignored instead of breaking the page', async ({ page }) => {
    await openApp(page, { params: { h: 'abc', w: '99999999', g: 'other', pm: '-5', u: 'weird', rd: '7k', th: 'expert', td: 'tomorrow', pace: 'x', d: '<script>' }, applied: false });
    await expect(page.getByText('Still needed: sex, height, weight, and threshold pace.')).toBeVisible();
    await expect(form(page).height).toHaveValue('');
    await expect(form(page).units('kg · cm · km')).toHaveAttribute('aria-pressed', 'true');

    // A usable link with a bad extra parameter keeps the good parts.
    await openApp(page, { params: { ...SAMPLE, th: 'expert', rd: 'nope', u: 'weird' }, results: true });
    await expect(form(page).height).toHaveValue('170');
    await expect(page.getByRole('combobox', { name: 'How long have you run regularly?' })).toHaveText('Not set');
  });

  test('the link button is only enabled once there is something to share', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('button', { name: 'Copy share link' })).toBeDisabled();
    await form(page).weight.fill('64');
    await expect(page.getByRole('button', { name: 'Copy share link' })).toBeEnabled();
  });
});
