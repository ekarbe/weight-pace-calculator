import { test, expect } from './support/fixtures';
import { SAMPLE, alerts, brokenAriaReferences, cardTime, choose, form, openApp, raceCard, slider, waitForHydration } from './support/app';
import type { Page } from '@playwright/test';

const base = { g: 'female', h: '170', w: '64', bf: '22' };
const raceDistance = (page: Page) => page.getByRole('combobox', { name: 'Race distance' });
const hours = (page: Page) => page.getByLabel('Hours', { exact: true });
const minutes = (page: Page) => page.getByLabel('Minutes', { exact: true });
const seconds = (page: Page) => page.getByLabel('Seconds', { exact: true });
/** The always-present live region under the race fields that announces the derived pace. */
const derived = (page: Page) => page.getByRole('group', { name: 'Threshold pace from a recent race' }).getByRole('status');

async function fillTime(page: Page, h: string, m: string, s: string) {
  await hours(page).fill(h);
  await minutes(page).fill(m);
  await seconds(page).fill(s);
}

test.describe('threshold pace from a recent race', () => {
  test('the source switch swaps the typed pace for the race fields, and keeps what was typed', async ({ page }) => {
    await openApp(page);
    const f = form(page);
    await expect(f.paceSource('Threshold pace')).toHaveAttribute('aria-pressed', 'true');
    await f.paceMin.fill('5');
    await f.paceSec.fill('30');

    await f.paceSource('From a recent race').click();
    await expect(f.paceSource('From a recent race')).toHaveAttribute('aria-pressed', 'true');
    await expect(f.paceMin).toBeHidden();
    await expect(page.getByText('Threshold pace from a recent race', { exact: true })).toBeVisible();
    await expect(raceDistance(page)).toHaveText('5 km');
    await expect(hours(page)).toHaveAttribute('placeholder', '0');
    await expect(derived(page)).toBeEmpty();

    await f.paceSource('Threshold pace').click();
    await expect(f.paceMin).toHaveValue('5');
    await expect(f.paceSec).toHaveValue('30');
    await expect(raceDistance(page)).toBeHidden();
  });

  test('derives the threshold pace for every race distance, in numbers and in words', async ({ page }) => {
    await openApp(page);
    await form(page).paceSource('From a recent race').click();
    const cases: [string, [string, string, string], string, string][] = [
      ['5 km', ['', '25', '0'], '5:16', '5 minutes and 16 seconds'],
      ['10 km', ['', '50', '0'], '5:06', '5 minutes and 6 seconds'],
      ['Half marathon', ['1', '45', '0'], '4:47', '4 minutes and 47 seconds'],
      ['Marathon', ['3', '30', '0'], '4:31', '4 minutes and 31 seconds'],
    ];
    for (const [distance, [h, m, s], pace, spoken] of cases) {
      await choose(page, raceDistance(page), distance);
      await fillTime(page, h, m, s);
      await expect(derived(page)).toContainText(`Estimated threshold pace: ${pace} /km`);
      await expect(derived(page)).toContainText(`Estimated threshold pace: ${spoken} per kilometer`);
    }
    await choose(page, raceDistance(page), 'Other distance');
    await page.getByLabel('Distance you ran (km)').fill('8');
    await fillTime(page, '', '36', '0');
    await expect(derived(page)).toContainText('Estimated threshold pace: 4:38 /km');
  });

  test('the derived pace drives the estimates and the table', async ({ page }) => {
    await openApp(page);
    const f = form(page);
    await f.paceMin.fill('5');
    await f.paceSec.fill('0');
    await f.paceSource('From a recent race').click();
    await form(page).sex.click();
    await page.getByRole('option', { name: 'Female' }).click();
    await f.height.fill(base.h);
    await f.weight.fill(base.w);
    await f.bodyFat.fill(base.bf);
    await expect(page.getByText('Still needed: race time.')).toBeVisible();
    await minutes(page).fill('25');
    await seconds(page).fill('0');

    await expect(slider(page)).toBeVisible();
    // The race (5K in 25:00) wins over the hidden typed pace (5:00): 24:31 here instead of 23:17.
    await expect(cardTime(page, '5 km')).toHaveText('24:31');
    await expect(cardTime(page, '10 km')).toHaveText('50:36');
    await expect(cardTime(page, 'Half marathon')).toHaveText('01:53:17');
    await expect(cardTime(page, 'Marathon')).toHaveText('03:59:39');
    await page.locator('summary', { hasText: /^Full table/ }).click();
    await expect(page.locator('tbody tr').first().locator('td').nth(2)).toHaveText('5:16');
  });

  test('at the current weight the cards give back the race time that was entered, in either unit', async ({ page }) => {
    // The pace is worked back from the result without rounding, so nothing is lost on the way there and back.
    await openApp(page, { params: { ...base, pm: '4', ps: '0', pace: 'race', rd: '10k', rtm: '48', rts: '26' }, results: true });
    await slider(page).focus();
    await page.keyboard.press('Home');
    await expect(cardTime(page, '10 km')).toHaveText('48:26');
    const times = await Promise.all(['5 km', 'Half marathon', 'Marathon'].map((n) => cardTime(page, n).innerText()));
    await form(page).units('lb · in · mi').click();
    await slider(page).focus();
    await page.keyboard.press('Home');
    await expect(cardTime(page, '10 km')).toHaveText('48:26');
    for (const [i, n] of ['5 km', 'Half marathon', 'Marathon'].entries()) await expect(cardTime(page, n)).toHaveText(times[i]);
    // 3:00:00 for a marathon is given back as 3:00:00, not as 3:00:15.
    await openApp(page, { params: { ...base, pace: 'race', rd: 'm', rth: '3', rtm: '0', rts: '0' }, results: true });
    await slider(page).focus();
    await page.keyboard.press('Home');
    await expect(cardTime(page, 'Marathon')).toHaveText('03:00:00');
  });

  test('a runner already under the BMI floor gets the entered time back as well, not the time at a heavier weight', async ({ page }) => {
    // 170 cm: the BMI-20 floor is 57.8 kg. At 56 and 50 kg the table's only row is the entered weight, and it used to be 57.8 kg
    // (25:17 and 26:14 for an entered 25:00, both labelled "same as now").
    for (const w of ['56', '50']) {
      await openApp(page, { params: { g: 'female', h: '170', w, pace: 'race', rd: '5k', rtm: '25', rts: '0' }, results: true });
      // (The warning is in the collapsed notes.)
      await expect(page.getByText(/is already at or below the lowest weight shown/)).toBeAttached();
      await expect(cardTime(page, '5 km')).toHaveText('25:00');
      await expect(raceCard(page, '5 km')).toContainText('baseline');
      await expect(raceCard(page, '5 km')).toContainText('5 km: 25 minutes, same as now');
      await expect(page.getByText(`${w}.0 kg (now)`)).toBeVisible();
    }
    // The same with a typed pace: a 5:00 threshold pace is a 23:45 5K at any weight under the floor.
    await openApp(page, { params: { g: 'female', h: '170', w: '49', pm: '5', ps: '0' }, results: true });
    await expect(cardTime(page, '5 km')).toHaveText('23:45');
    await page.locator('summary', { hasText: /^Full table/ }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr').first().locator('td').nth(2)).toHaveText('5:00');
  });

  test('bad times and distances are explained next to the field', async ({ page }) => {
    await openApp(page, { params: { ...base, pace: 'race', rd: '5k' } });
    await expect(page.getByText('Still needed: race time.')).toBeVisible();

    await fillTime(page, '', '0', '0');
    await expect(alerts(page).filter({ hasText: 'Enter a valid time: whole numbers, seconds 0–59, and minutes 0–59 once hours are entered.' })).toBeVisible();
    await expect(minutes(page)).toHaveAttribute('aria-invalid', 'true');
    expect(await brokenAriaReferences(page)).toEqual([]);

    await fillTime(page, '1', '75', '0');
    await expect(alerts(page).filter({ hasText: 'Enter a valid time' })).toBeVisible();
    await fillTime(page, '', '25', '75');
    await expect(alerts(page).filter({ hasText: 'Enter a valid time' })).toBeVisible();

    // A 5K in 5 minutes is a threshold pace of about 1:03 /km.
    await fillTime(page, '', '5', '0');
    await expect(alerts(page).filter({ hasText: 'That time works out to a threshold pace outside 2:00–12:00 per km. Please check the time and distance.' })).toBeVisible();
    await expect(derived(page)).toBeEmpty();
    await expect(slider(page)).toHaveCount(0);

    await fillTime(page, '', '25', '0');
    await expect(alerts(page)).toHaveCount(0);
    await expect(slider(page)).toBeVisible();

    await choose(page, raceDistance(page), 'Other distance');
    await expect(page.getByText('Still needed: race distance.')).toBeVisible();
    await page.getByLabel('Distance you ran (km)').fill('0.5');
    await expect(alerts(page).filter({ hasText: 'Enter 1–100 km' })).toBeVisible();
    await expect(page.getByLabel('Distance you ran (km)')).toHaveAttribute('aria-describedby', 'race-custom-err');
    expect(await brokenAriaReferences(page)).toEqual([]);
  });

  test('survives a shared link: the mode, distance, time and result come back', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openApp(page, { params: { ...base, pace: 'race', rd: 'hm', rth: '1', rtm: '45', rts: '0' }, results: true });
    await expect(derived(page)).toContainText('Estimated threshold pace: 4:47 /km');
    const original = await slider(page).getAttribute('aria-valuetext');
    const times = await Promise.all(['10 km', 'Marathon'].map((n) => cardTime(page, n).innerText()));

    await form(page).copyLink.click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(Object.fromEntries(new URL(link).searchParams)).toMatchObject({ pace: 'race', rd: 'hm', rth: '1', rtm: '45', rts: '0' });

    const copy = await context.newPage();
    await copy.goto(link);
    await waitForHydration(copy);
    await expect(form(copy).paceSource('From a recent race')).toHaveAttribute('aria-pressed', 'true');
    await expect(raceDistance(copy)).toHaveText('Half marathon');
    await expect(hours(copy)).toHaveValue('1');
    await expect(minutes(copy)).toHaveValue('45');
    await expect(seconds(copy)).toHaveValue('0');
    await expect(derived(copy)).toContainText('Estimated threshold pace: 4:47 /km');
    await expect(slider(copy)).toHaveAttribute('aria-valuetext', original ?? 'missing');
    await expect(cardTime(copy, '10 km')).toHaveText(times[0]);
    await expect(cardTime(copy, 'Marathon')).toHaveText(times[1]);

    // A reload of the shared URL (not only a fresh tab) behaves the same.
    await copy.reload();
    await waitForHydration(copy);
    await expect(derived(copy)).toContainText('Estimated threshold pace: 4:47 /km');
  });

  test('a custom race distance and the derived pace follow the unit switch without drifting', async ({ page }) => {
    await openApp(page, { params: { ...base, pace: 'race', rd: 'custom', rdc: '8', rtm: '36', rts: '0' }, results: true });
    await expect(derived(page)).toContainText('Estimated threshold pace: 4:38 /km');

    await form(page).units('lb · in · mi').click();
    await expect(page.getByLabel('Distance you ran (mi)')).toHaveValue('4.97');
    await expect(derived(page)).toContainText(/Estimated threshold pace: \d:\d\d \/mi/);
    await expect(derived(page)).toContainText('per mile');

    await form(page).units('kg · cm · km').click();
    await expect(page.getByLabel('Distance you ran (km)')).toHaveValue('8');
    await expect(derived(page)).toContainText('Estimated threshold pace: 4:38 /km');
  });

  test('a custom race distance typed with two decimals comes back unchanged from a round trip through miles', async ({ page }) => {
    // 0.01 mi is 0.016 km, so 8.39 km used to come back as 8.38 km and move the pace from 4:05 to 4:06.
    await openApp(page, { params: { g: 'male', h: '180', w: '75', pace: 'race', rd: 'custom', rdc: '8.39', rtm: '33', rts: '21' }, results: true });
    await expect(derived(page)).toContainText('Estimated threshold pace: 4:05 /km');
    await form(page).units('lb · in · mi').click();
    await expect(page.getByLabel('Distance you ran (mi)')).toHaveValue('5.213');
    await form(page).units('kg · cm · km').click();
    await expect(page.getByLabel('Distance you ran (km)')).toHaveValue('8.39');
    await expect(derived(page)).toContainText('Estimated threshold pace: 4:05 /km');
  });

  test('the typed pace is unaffected by the race fields while the typed source is selected', async ({ page }) => {
    await openApp(page, { params: { ...SAMPLE, rd: 'm', rth: '3', rtm: '30', rts: '0' }, results: true });
    await expect(cardTime(page, '5 km')).toHaveText('23:17');
    await expect(form(page).paceSource('Threshold pace')).toHaveAttribute('aria-pressed', 'true');
  });
});
