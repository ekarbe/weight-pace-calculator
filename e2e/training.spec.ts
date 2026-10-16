import { test, expect } from './support/fixtures';
import { DATE_BRISK, DATE_TOO_FAST, alerts, brokenAriaReferences, choose, form, openApp, slider } from './support/app';
import type { Page } from '@playwright/test';

const base = { g: 'female', h: '170', w: '64', bf: '22', pm: '5', ps: '0' };
const card = (page: Page) => page.locator('section', { has: page.getByRole('heading', { name: 'Training context' }) });
const state = (page: Page) => card(page).getByRole('status');
const weeklyKm = (page: Page) => page.getByLabel(/^Running per week/);
const history = (page: Page) => page.getByRole('combobox', { name: 'How long have you run regularly?' });

const SUPPORT = 'If food, weight or exercise feel stressful or hard to control, a doctor, a sports dietitian or an eating-disorder support service can help. Asking early is always fine.';
const SIGNS = 'Constant tiredness, repeated illness or injury, or changes in sleep or mood are worth raising with a doctor or sports dietitian. This tool cannot assess them.';

test.describe('training context card', () => {
  test('is idle until the selected weight is below the current weight', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await slider(page).focus();
    await page.keyboard.press('Home');
    await expect(card(page)).toContainText('This card sets the weight-based estimate against how you train once the selected weight is below your current weight.');
    await expect(state(page)).toHaveCount(0);
    await expect(weeklyKm(page)).toHaveCount(0);
  });

  test('by default it matches the headline estimate and says what it assumed', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await expect(state(page)).toHaveText('Matches the headline estimate');
    // Seen and heard: the same sentence with 0:59 for the eye and "59 seconds" for a screen reader.
    await expect(card(page).locator('p[aria-hidden="true"]')).toHaveText('The weight-based estimate of about 0:59 off your 10 km time stands, though it could be as little as 0:29.');
    await expect(card(page).locator('p.sr-only')).toHaveText('The weight-based estimate of about 59 seconds off your 10 km time stands, though it could be as little as 29 seconds.');
    await expect(card(page)).toContainText('Weight change: Sustainable (0.5% of body weight a week) · Running: not entered');
    await expect(card(page)).toContainText('No target date is set, so a sustainable pace of 0.5% of body weight a week is assumed.');
    await expect(card(page)).toContainText('Weekly running is not entered, so no allowance is made for it.');
    await expect(card(page)).toContainText('For large changes, or for weights toward the lower end for your height, a straight-line estimate is less reliable.');
    await expect(card(page)).toContainText('For most runners, steady training is the main lever for getting faster. Say how long you’ve been running regularly for a more specific note.');
    await expect(card(page)).toContainText('These figures assume you keep your training steady and get enough energy to fuel it.');
    // No distress or warning copy for an ordinary scenario.
    await expect(card(page)).not.toContainText(SUPPORT);
    await expect(card(page)).not.toContainText(SIGNS);
  });

  test('weekly running and running history are optional inputs that refine the notes', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await weeklyKm(page).fill('40');
    await expect(card(page)).toContainText('Running: 40 km a week');
    await expect(card(page)).not.toContainText('Weekly running is not entered');
    await expect(state(page)).toHaveText('Matches the headline estimate');

    await choose(page, history(page), '1 to 3 years');
    await expect(card(page)).toContainText('With a year or two of regular running behind you, training still brings steady gains, though more slowly. Protect your training first.');
    await choose(page, history(page), 'More than 3 years');
    await expect(card(page)).toContainText('Experienced runners improve slowly from training, so small changes matter.');
    await choose(page, history(page), 'Under 1 year, or back after a long break');
    await expect(card(page)).toContainText('Runners who are new or returning often improve quickly from training itself in the first months');
    await choose(page, history(page), 'Prefer not to say');
    await expect(card(page)).toContainText('For most runners, steady training is the main lever for getting faster.');
    // "Prefer not to say" clears the answer.
    await expect(history(page)).toHaveText('Not set');
  });

  test('a brisk pace of weight change lowers the figure and says why', async ({ page }) => {
    await openApp(page, { params: { ...base, td: DATE_BRISK, wk: '40' }, results: true });
    await expect(state(page)).toHaveText('Estimate lowered');
    await expect(card(page).locator('p[aria-hidden="true"]')).toHaveText('A more cautious figure is about 0:44 off your 10 km time, not the 0:59 in the headline estimate. It could be as little as 0:29.');
    await expect(card(page)).toContainText('Weight change: Brisk (0.7% of body weight a week) · Running: 40 km a week');
    await expect(card(page)).toContainText('A brisk pace of weight change is harder to combine with good training, so the estimate is cut back.');
    await expect(card(page)).toContainText(SIGNS);
    await expect(card(page)).not.toContainText(SUPPORT);
    // It never raises the headline: the main cards are untouched.
    await expect(page.getByRole('listitem').filter({ hasText: /^10 km:/ })).toContainText('−0:59');
  });

  test('very high weekly running lowers the figure too', async ({ page }) => {
    await openApp(page, { params: { ...base, wk: '100' }, results: true });
    await expect(state(page)).toHaveText('Estimate lowered');
    await expect(card(page)).toContainText('Your weekly running is very high. Food has to cover your training as well as any weight change, so the estimate is cut back.');
    await expect(card(page)).toContainText(SIGNS);
  });

  test('a too-fast plan shows no figure, only support', async ({ page }) => {
    await openApp(page, { params: { ...base, td: DATE_TOO_FAST, wk: '40' }, results: true });
    await expect(state(page)).toHaveText('No estimate shown');
    await expect(card(page)).toContainText('At more than 1% of body weight a week, weight change tends to cost performance rather than add to it, and it can affect your health. No figure is shown.');
    await expect(card(page)).toContainText('Weight change: Too fast (1.6% of body weight a week) · Running: 40 km a week');
    await expect(card(page)).not.toContainText('off your 10 km time');
    await expect(card(page)).toContainText(SUPPORT);
    await expect(card(page)).toContainText(SIGNS);
    await expect(weeklyKm(page)).toBeVisible();
  });

  test('a brisk pace on top of heavy running shows no figure', async ({ page }) => {
    await openApp(page, { params: { ...base, td: DATE_BRISK, wk: '60' }, results: true });
    await expect(state(page)).toHaveText('No estimate shown');
    await expect(card(page)).toContainText('A brisk pace of weight change on top of this much running makes it hard to get enough energy for training, so no figure is shown.');
    await expect(card(page)).not.toContainText('off your 10 km time');
    await expect(card(page)).toContainText(SUPPORT);
  });

  test('a low weight for the height shows no figure and no inputs', async ({ page }) => {
    await openApp(page, { params: { g: 'male', h: '180', w: '60', pm: '4', ps: '0' }, results: true });
    await expect(state(page)).toHaveText('No estimate shown');
    await expect(card(page)).toContainText('We don’t show weight-based estimates for weights this low for your height. Going lower is unlikely to help your running and can hurt it.');
    await expect(card(page)).toContainText(SUPPORT);
    await expect(card(page)).not.toContainText('off your 10 km time');
    await expect(weeklyKm(page)).toHaveCount(0);
  });

  test('a weight below healthy body fat shows no figure and the cards warn too', async ({ page }) => {
    await openApp(page, { params: { g: 'male', h: '180', w: '75', bf: '10', pm: '4', ps: '0' }, results: true });
    await slider(page).focus();
    await page.keyboard.press('End');
    await expect(state(page)).toHaveText('No estimate shown');
    await expect(card(page)).toContainText('Estimated body fat at this weight is below healthy levels, so no training-adjusted figure is shown. Your health matters more than any time on the clock.');
    await expect(card(page)).toContainText(SUPPORT);
    await expect(card(page)).not.toContainText('off your 10 km time');
    await expect(page.getByRole('status').filter({ hasText: 'Estimated body fat at this weight is below healthy levels.' })).toBeVisible();
  });

  test('a mistyped weekly distance is flagged and withholds the figure instead of guessing', async ({ page }) => {
    await openApp(page, { params: { ...base, wk: '300' }, results: true });
    await expect(state(page)).toHaveText('No estimate shown');
    await expect(alerts(page).filter({ hasText: 'Enter 0–250 km' })).toBeVisible();
    await expect(weeklyKm(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(weeklyKm(page)).toHaveAttribute('aria-describedby', /.+/);
    await expect(card(page)).toContainText('Fix the highlighted training field to see this estimate.');
    await expect(card(page)).not.toContainText(SUPPORT);
    expect(await brokenAriaReferences(page)).toEqual([]);
    // The rest of the page is not affected by it.
    await expect(slider(page)).toBeVisible();

    await weeklyKm(page).fill('45');
    await expect(state(page)).toHaveText('Matches the headline estimate');
    await expect(alerts(page)).toHaveCount(0);
  });

  test('no card at all when there is no gain to qualify', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await form(page).advanced.click();
    await form(page).paceGain.fill('0');
    await expect(page.getByRole('heading', { name: 'Training context' })).toHaveCount(0);
  });

  test('the "how this is worked out" panel states the rules and units', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await card(page).getByText('How this is worked out').click();
    await expect(card(page)).toContainText('The starting point is the headline estimate of 2.0 s/km per kg. The lowest figure used is 1.0 s/km per kg. This card never shows more than the headline.');
    await expect(card(page)).toContainText('Running 50 km a week or more counts as high and 100 km or more as very high.');
    await expect(card(page)).toContainText('not medical or coaching advice');
  });

  test('in imperial the distances are miles', async ({ page }) => {
    await openApp(page, { params: { u: 'imperial', g: 'female', h: '67', w: '141', pm: '8', ps: '3', wk: '25' }, results: true });
    await expect(page.getByLabel(/^Running per week \(mi\)/)).toHaveValue('25');
    await expect(card(page)).toContainText('Running: 25 mi a week');
    await card(page).getByText('How this is worked out').click();
    await expect(card(page)).toContainText('Running 31 mi a week or more counts as high and 62 mi or more as very high.');
    await page.getByLabel(/^Running per week \(mi\)/).fill('200');
    await expect(alerts(page).filter({ hasText: 'Enter 0–155 mi' })).toBeVisible();
  });

  test('the only live region in the card is the state line, so slider moves are not announced', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await expect(card(page).locator('[aria-live], [role="status"], [role="alert"]')).toHaveCount(1);
  });
});
