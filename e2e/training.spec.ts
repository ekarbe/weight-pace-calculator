import { test, expect } from './support/fixtures';
import { DATE_BRISK, DATE_SUSTAINABLE, DATE_TOO_FAST, LOCALES, alerts, brokenAriaReferences, choose, form, openApp, slider, tr } from './support/app';
import type { Locale } from './support/app';
import type { Page } from '@playwright/test';

const base = { g: 'female', h: '170', w: '64', bf: '22', pm: '5', ps: '0' };
const card = (page: Page) => page.locator('section#training');
const state = (page: Page) => card(page).getByRole('status');
const weeklyKm = (page: Page) => page.getByLabel(/^Running per week/);
const history = (page: Page) => page.getByRole('combobox', { name: 'How long have you run regularly?' });
const pointer = (page: Page) => page.getByTestId('training-pointer');
const summary = (page: Page) => card(page).locator('p[aria-hidden="true"]');
const saveButton = (page: Page) => page.getByRole('button', { name: 'Save image' });

const SUPPORT = 'If food, weight or exercise feel stressful or hard to control, a doctor, a sports dietitian or an eating-disorder support service can help. It is never too early to ask.';
const SIGNS = 'Constant tiredness, repeated illness or injury, or changes in sleep, mood or menstrual cycle are worth raising with a doctor or sports dietitian. This tool cannot assess them.';
const SCOPE = 'This card is written for adults. If you are under 18, pregnant, unwell or returning from injury, ask a doctor before relying on any weight-change figure.';
const BRISK_REASON = 'A brisk pace of weight change is harder to combine with good training, so the estimate is lowered.';
const SHARE_BLOCKED = 'No image for this scenario: the Training context card shows no estimate for it.';

/** The card's text without the closed explainer, which legitimately talks about s/km and thresholds. */
const visibleText = (page: Page) =>
  card(page).evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('details').forEach((d) => d.remove());
    return copy.textContent ?? '';
  });

/** Withheld states show no figure, in the visible text or in the text only a screen reader gets. */
async function expectNoFigures(page: Page) {
  const text = await visibleText(page);
  expect(text).not.toMatch(/\d+:\d{2}/);
  expect(text).not.toMatch(/s\/km/);
  expect(text).not.toMatch(/\b(seconds?|minutes?)\b/);
  expect(text).not.toContain('off your 10 km time');
}

test.describe('training context card: states', () => {
  test('is idle until the selected weight is below the current weight', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await slider(page).focus();
    await page.keyboard.press('Home');
    await expect(card(page)).toContainText('This card sets the weight-based estimate against how you train once the selected weight is below your current weight.');
    await expect(state(page)).toHaveCount(0);
    await expect(weeklyKm(page)).toHaveCount(0);
    await expect(card(page)).not.toContainText(SCOPE);
    await expect(pointer(page)).toHaveCount(0);
  });

  test('a change within day-to-day swings has nothing to add', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await slider(page).focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight'); // 0.5 kg lighter
    await expect(card(page)).toContainText('A change this small is within normal day-to-day swings in body weight, so there is nothing meaningful to add here.');
    await expect(state(page)).toHaveCount(0);
    await expect(weeklyKm(page)).toHaveCount(0);
    await page.keyboard.press('ArrowRight'); // 1 kg lighter: now there is something to say
    await expect(state(page)).toHaveText('Matches the headline estimate');
  });

  test('by default it matches the headline estimate and says what it assumed', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await expect(state(page)).toHaveText('Matches the headline estimate');
    // Seen and heard: the same sentence with 0:59 for the eye and "59 seconds" for a screen reader.
    await expect(summary(page)).toHaveText('The weight-based estimate of about 0:59 off your 10 km time stands, though it could be as little as 0:29.');
    await expect(card(page).locator('p.sr-only')).toHaveText('The weight-based estimate of about 59 seconds off your 10 km time stands, though it could be as little as 29 seconds.');
    await expect(card(page)).toContainText('Weight change: Sustainable (0.5% of body weight a week) · Running: not entered');
    await expect(card(page)).toContainText('There is no future target date, so a sustainable pace of 0.5% of body weight a week is assumed.');
    await expect(card(page)).toContainText('Weekly running is not entered, so no allowance is made for it.');
    await expect(card(page)).toContainText('For large changes, or for weights close to the lowest this card gives figures for, a straight-line estimate is less reliable.');
    await expect(card(page)).toContainText('For most runners, steady training is the main lever for getting faster. Say how long you’ve been running regularly for a more specific note.');
    await expect(card(page)).toContainText('These figures assume you keep your training steady and get enough energy to fuel it.');
    // The scope sentence is always there, never inside the disclosure.
    await expect(card(page).locator('details').getByText(SCOPE)).toHaveCount(0);
    await expect(card(page).getByText(SCOPE)).toBeVisible();
    // No distress or warning copy for an ordinary scenario, and nothing on the race cards.
    await expect(card(page)).not.toContainText(SUPPORT);
    await expect(card(page)).not.toContainText(SIGNS);
    await expect(pointer(page)).toHaveCount(0);
  });

  test('weekly running and running history are optional inputs that refine the notes', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await weeklyKm(page).fill('40');
    await expect(card(page)).toContainText('Running: 40 km a week');
    await expect(card(page)).not.toContainText('Weekly running is not entered');
    await expect(state(page)).toHaveText('Matches the headline estimate');

    // The history only selects one sentence: the figure does not move.
    const figure = await summary(page).textContent();
    await choose(page, history(page), '1 to 3 years');
    await expect(card(page)).toContainText('With a year or two of regular running behind you, training still brings steady gains, though more slowly. Protect your training first.');
    await choose(page, history(page), 'More than 3 years');
    await expect(card(page)).toContainText('Experienced runners improve slowly from training, so small changes matter.');
    await expect(card(page)).toContainText('Weight change is not a shortcut to a faster time');
    await choose(page, history(page), 'Under 1 year, or back after a long break');
    await expect(card(page)).toContainText('Runners who are new or returning often improve quickly from training itself in the first months');
    expect(await summary(page).textContent()).toBe(figure);
    await choose(page, history(page), 'Prefer not to say');
    await expect(card(page)).toContainText('For most runners, steady training is the main lever for getting faster.');
    // "Prefer not to say" clears the answer.
    await expect(history(page)).toHaveText('Not set');
    expect(await summary(page).textContent()).toBe(figure);
  });

  test('a brisk pace of weight change lowers the figure, says why and points from the race cards', async ({ page }) => {
    await openApp(page, { params: { ...base, td: DATE_BRISK, wk: '40' }, results: true });
    await expect(state(page)).toHaveText('Estimate lowered');
    await expect(summary(page)).toHaveText('A more cautious figure is about 0:44 off your 10 km time, not the 0:59 in the headline estimate. It could be as little as 0:29.');
    await expect(card(page)).toContainText('Weight change: Brisk (0.7% of body weight a week) · Running: 40 km a week');
    await expect(card(page)).toContainText(BRISK_REASON);
    await expect(card(page)).toContainText(SIGNS);
    await expect(card(page)).not.toContainText(SUPPORT);
    // It never raises or replaces the headline: the main cards are untouched, and they point at this card.
    await expect(page.getByRole('listitem').filter({ hasText: /^10 km:/ })).toContainText('−0:59');
    await expect(pointer(page)).toHaveText('Training context: a more cautious figure applies to this scenario. See the Training context card below.');
    // The image may still be made: it shows the same headline estimate as the cards, which are not withheld.
    await expect(saveButton(page)).toBeEnabled();
  });

  test('very high weekly running lowers the figure too, with its own reason', async ({ page }) => {
    await openApp(page, { params: { ...base, wk: '100' }, results: true });
    await expect(state(page)).toHaveText('Estimate lowered');
    await expect(card(page)).toContainText('Your weekly running is very high. Food has to cover your training as well as any weight change, so the estimate is lowered.');
    await expect(card(page)).not.toContainText(BRISK_REASON);
    await expect(card(page)).toContainText(SIGNS);
    await expect(pointer(page)).toBeVisible();
  });

  test('a high but not very high load at a sustainable pace keeps the figure and says so in a note', async ({ page }) => {
    await openApp(page, { params: { ...base, td: DATE_SUSTAINABLE, wk: '60' }, results: true });
    await expect(state(page)).toHaveText('Matches the headline estimate');
    await expect(card(page)).toContainText('At this weekly distance your training already asks a lot of your energy supply, so any weight change is best kept slow and secondary to it.');
    await expect(card(page)).not.toContainText(SIGNS);
    await expect(pointer(page)).toHaveCount(0);
  });

  test('a pace-gain setting above the usual range is counted at most 3 and says so', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await form(page).advanced.click();
    await form(page).paceGain.fill('4');
    await expect(state(page)).toHaveText('Estimate lowered');
    await expect(card(page)).toContainText('Your pace-gain setting is above the usual range, so this card counts at most 3 s/km per kg.');
    await expect(summary(page)).toHaveText('A more cautious figure is about 1:28 off your 10 km time, not the 1:58 in the headline estimate. It could be as little as 0:29.');
    await expect(card(page)).toContainText(SIGNS);
    await expect(pointer(page)).toBeVisible();
  });

  test('a too-fast plan shows no figure, no inputs, only support, and withholds the share image', async ({ page }) => {
    await openApp(page, { params: { ...base, td: DATE_TOO_FAST, wk: '40' }, results: true });
    await expect(state(page)).toHaveText('No estimate shown');
    await expect(card(page)).toContainText('Weight change at this pace is hard to combine with training and can set back both performance and health, so no figure is shown, and the headline estimate should not be relied on for it. A later date, or a smaller change, is a safer scenario to look at.');
    await expect(card(page)).toContainText('Weight change: Too fast (1.6% of body weight a week) · Running: 40 km a week');
    await expectNoFigures(page);
    await expect(card(page)).toContainText(SUPPORT);
    await expect(card(page)).toContainText(SIGNS);
    await expect(card(page)).toContainText(SCOPE);
    // Nothing typed there can change the outcome, so there is nothing to type.
    await expect(weeklyKm(page)).toHaveCount(0);
    await expect(history(page)).toHaveCount(0);
    // The race cards say so, and no picture leaves the page.
    await expect(pointer(page)).toHaveText('Training context: the weight-based estimate here should not be relied on for this scenario. See the Training context card below.');
    await expect(page.getByText(SHARE_BLOCKED)).toBeVisible();
    await expect(saveButton(page)).toBeDisabled();
    expect(await brokenAriaReferences(page)).toEqual([]);
    // A later date and the image is back.
    await page.getByLabel('I want to get there by').fill(DATE_SUSTAINABLE);
    await expect(state(page)).toHaveText('Matches the headline estimate');
    await expect(saveButton(page)).toBeEnabled();
    await expect(pointer(page)).toHaveCount(0);
  });

  test('a brisk pace on top of heavy running shows no figure; 49 km is lowered instead', async ({ page }) => {
    await openApp(page, { params: { ...base, td: DATE_BRISK, wk: '60' }, results: true });
    await expect(state(page)).toHaveText('No estimate shown');
    await expect(card(page)).toContainText('A brisk pace of weight change on top of this much running makes it hard to get enough energy for training, so no figure is shown, and the headline estimate should not be relied on for it. A slower pace, or keeping your weight where it is, is the safer choice.');
    await expectNoFigures(page);
    await expect(card(page)).toContainText(SUPPORT);
    await expect(pointer(page)).toBeVisible();
    await expect(page.getByText(SHARE_BLOCKED)).toBeVisible();
    // Weekly running does change this outcome, so the field stays.
    await expect(weeklyKm(page)).toBeVisible();
    await weeklyKm(page).fill('49');
    await expect(state(page)).toHaveText('Estimate lowered');
    await weeklyKm(page).fill('50');
    await expect(state(page)).toHaveText('No estimate shown');
  });

  test('a low weight for the height shows no figure and no inputs, whichever weight is the low one', async ({ page }) => {
    await openApp(page, { params: { g: 'male', h: '180', w: '60', pm: '4', ps: '0' }, results: true });
    await expect(state(page)).toHaveText('No estimate shown');
    await expect(card(page)).toContainText('Your current weight is below the range this card gives figures for at your height, so none is shown. This card cannot tell what is right for you. A doctor or a sports dietitian can.');
    await expect(card(page)).toContainText(SUPPORT);
    await expect(card(page)).toContainText(SIGNS);
    await expectNoFigures(page);
    await expect(weeklyKm(page)).toHaveCount(0);
    // With nothing selected there is no weight-based saving to block.
    await expect(pointer(page)).toHaveCount(0);
  });

  test('a selected weight under the line is refused while the current weight is not', async ({ page }) => {
    await openApp(page, { params: { g: 'male', h: '180', w: '66', pm: '4', ps: '0' }, results: true });
    await form(page).advanced.click();
    await form(page).bmiFloor.fill('18.5');
    await slider(page).focus();
    await page.keyboard.press('End');
    await expect(state(page)).toHaveText('No estimate shown');
    await expect(card(page)).toContainText('The selected weight is below the range this card gives figures for at your height, so none is shown. Going lower is unlikely to help your running and can hurt it.');
    await expectNoFigures(page);
    await expect(pointer(page)).toBeVisible();
    await expect(page.getByText(SHARE_BLOCKED)).toBeVisible();
    // Back at the current weight (its BMI is above the line) there is nothing to refuse: the card is idle again.
    await page.keyboard.press('Home');
    await expect(state(page)).toHaveCount(0);
    await expect(card(page)).toContainText('This card sets the weight-based estimate against how you train');
    await expect(pointer(page)).toHaveCount(0);
  });

  test('a weight below healthy body fat shows no figure and the cards warn too', async ({ page }) => {
    await openApp(page, { params: { g: 'male', h: '180', w: '75', bf: '10', pm: '4', ps: '0' }, results: true });
    await slider(page).focus();
    await page.keyboard.press('End');
    await expect(state(page)).toHaveText('No estimate shown');
    await expect(card(page)).toContainText('At this weight the estimated body fat falls below the lowest level this page works with, so no training-adjusted figure is shown. Your health matters more than any time on the clock.');
    await expect(card(page)).toContainText(SUPPORT);
    await expectNoFigures(page);
    await expect(pointer(page)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Estimated body fat at this weight is below healthy levels.' })).toBeVisible();
    // The image was already blocked for this row, with its own wording.
    await expect(page.getByText('No image for this target weight')).toBeVisible();
  });

  test('a mistyped weekly distance is flagged and withholds the figure instead of guessing', async ({ page }) => {
    await openApp(page, { params: { ...base, wk: '300' }, results: true });
    await expect(state(page)).toHaveText('No estimate shown');
    await expect(alerts(page).filter({ hasText: 'Enter 0–250 km' })).toBeVisible();
    await expect(weeklyKm(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(weeklyKm(page)).toHaveAttribute('aria-describedby', /.+/);
    await expect(card(page)).toContainText('Fix the highlighted training field to see this estimate.');
    await expect(card(page)).not.toContainText(SUPPORT);
    await expect(card(page)).not.toContainText(SIGNS);
    await expectNoFigures(page);
    expect(await brokenAriaReferences(page)).toEqual([]);
    // A typo is transient: no pointer, no blocked image. The rest of the page is unaffected.
    await expect(pointer(page)).toHaveCount(0);
    await expect(saveButton(page)).toBeEnabled();
    await expect(slider(page)).toBeVisible();

    await weeklyKm(page).fill('45');
    await expect(state(page)).toHaveText('Matches the headline estimate');
    await expect(alerts(page)).toHaveCount(0);
  });

  test('a mistyped distance never hides the more serious message', async ({ page }) => {
    await openApp(page, { params: { ...base, td: DATE_TOO_FAST, wk: '300' }, results: true });
    await expect(state(page)).toHaveText('No estimate shown');
    await expect(card(page)).toContainText('Weight change at this pace is hard to combine with training');
    await expect(card(page)).not.toContainText('Fix the highlighted training field');
    await expect(card(page)).toContainText(SUPPORT);
    await expect(pointer(page)).toBeVisible();
  });

  test('strict distance: exponents, signs and four digits are errors', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    for (const bad of ['1e2', '-5', '1234']) {
      await weeklyKm(page).fill(bad);
      await expect(alerts(page).filter({ hasText: 'Enter 0–250 km' }), bad).toBeVisible();
    }
    await weeklyKm(page).fill('0');
    await expect(alerts(page)).toHaveCount(0);
    await expect(card(page)).not.toContainText('Weekly running is not entered');
  });

  test('no card at all when there is no gain to qualify', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await form(page).advanced.click();
    await form(page).paceGain.fill('0');
    await expect(page.getByRole('heading', { name: 'Training context' })).toHaveCount(0);
    await expect(pointer(page)).toHaveCount(0);
  });
});

test.describe('training context card: details', () => {
  test('the "how this is worked out" panel states the rules and units, and is closed by default', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await expect(card(page).locator('details')).not.toHaveAttribute('open', '');
    await card(page).getByText('How this is worked out').click();
    await expect(card(page)).toContainText('The starting point is the headline estimate of 2.0 s/km per kg. The lowest figure used is 1.0 s/km per kg. This card never shows more than the headline and counts at most 3.0 s/km per kg.');
    await expect(card(page)).toContainText('At 2.0 s/km per kg, each 1% of body weight changed moves your pace by about 0.43%.');
    await expect(card(page)).toContainText('Up to 0.5% of body weight a week counts as sustainable, up to 1% as brisk, above that as too fast. These are the bands of the Timeline card.');
    await expect(card(page)).toContainText('Running 50 km a week or more counts as high and 100 km or more as very high.');
    await expect(card(page)).toContainText('A change smaller than 1.0 kg counts as day-to-day swings in body weight, and no figure is shown.');
    await expect(card(page)).toContainText('No figure is shown at weights below a BMI of 20 for your height');
    await expect(card(page)).toContainText('not medical or coaching advice');
  });

  test('in imperial the distances are miles and the printed thresholds are rounded up', async ({ page }) => {
    await openApp(page, { params: { u: 'imperial', g: 'female', h: '67', w: '141', pm: '8', ps: '3', wk: '25' }, results: true });
    await expect(page.getByLabel(/^Running per week \(mi\)/)).toHaveValue('25');
    await expect(card(page)).toContainText('Running: 25 mi a week');
    await card(page).getByText('How this is worked out').click();
    await expect(card(page)).toContainText('Running 31.1 mi a week or more counts as high and 62.2 mi or more as very high.');
    await expect(card(page)).toContainText('A change smaller than 2.3 lb counts as day-to-day swings');
    await page.getByLabel(/^Running per week \(mi\)/).fill('200');
    await expect(alerts(page).filter({ hasText: 'Enter 0–155 mi' })).toBeVisible();
    await page.getByLabel(/^Running per week \(mi\)/).fill('155.3');
    await expect(alerts(page)).toHaveCount(0);
    await page.getByLabel(/^Running per week \(mi\)/).fill('155.4');
    await expect(alerts(page).filter({ hasText: 'Enter 0–155 mi' })).toBeVisible();
  });

  test('imperial boundaries: 31.0 mi is not high, 31.1 mi is', async ({ page }) => {
    const brisk = { u: 'imperial', g: 'female', h: '67', w: '141', pm: '8', ps: '3', td: DATE_BRISK };
    await openApp(page, { params: { ...brisk, wk: '31' }, results: true });
    await expect(state(page)).toHaveText('Estimate lowered');
    await page.getByLabel(/^Running per week \(mi\)/).fill('31.1');
    await expect(state(page)).toHaveText('No estimate shown');
  });

  test('switching units converts the typed distance and keeps the state', async ({ page }) => {
    await openApp(page, { params: { ...base, wk: '40' }, results: true });
    await expect(card(page)).toContainText('Running: 40 km a week');
    await form(page).units('lb · in · mi').click();
    await expect(page.getByLabel(/^Running per week \(mi\)/)).toHaveValue('24.9');
    await expect(card(page)).toContainText('Running: 24.9 mi a week');
    await expect(state(page)).toHaveText('Matches the headline estimate');
  });

  test('the weekly distance and the history survive a shared link, in both units', async ({ page }) => {
    await openApp(page, { params: { ...base, wk: '42.5', th: 'veteran', td: DATE_BRISK }, results: true });
    await expect(weeklyKm(page)).toHaveValue('42.5');
    await expect(history(page)).toHaveText('More than 3 years');
    await expect(state(page)).toHaveText('Estimate lowered');
    await openApp(page, { params: { u: 'imperial', g: 'female', h: '67', w: '141', pm: '8', ps: '3', wk: '20', th: 'new' }, results: true });
    await expect(page.getByLabel(/^Running per week \(mi\)/)).toHaveValue('20');
    await expect(history(page)).toHaveText('Under 1 year, or back after a long break');
    // Rejected values in a link are dropped, never guessed.
    await openApp(page, { params: { ...base, wk: '99999', th: 'hacker' }, results: true, applied: false });
    await expect(weeklyKm(page)).toHaveValue('');
    await expect(history(page)).toHaveText('Not set');
  });

  test('a link with an impossible distance opens as an input error, not a guess', async ({ page }) => {
    await openApp(page, { params: { ...base, wk: '9999' }, results: true });
    await expect(alerts(page).filter({ hasText: 'Enter 0–250 km' })).toBeVisible();
    await expect(state(page)).toHaveText('No estimate shown');
  });
});

test.describe('training context card: page integration', () => {
  test('the pointer link moves focus to the card heading and leaves the address alone', async ({ page }) => {
    await openApp(page, { params: { ...base, td: DATE_TOO_FAST }, results: true });
    const before = page.url();
    await pointer(page).getByRole('link').click();
    await expect(card(page).getByRole('heading', { name: 'Training context' })).toBeFocused();
    expect(page.url()).toBe(before);
    expect(page.url()).not.toContain('#');
    await expect(card(page)).toBeInViewport();
  });

  test('the pointer is a link, reachable with the keyboard', async ({ page }) => {
    await openApp(page, { params: { ...base, td: DATE_BRISK }, results: true });
    const link = pointer(page).getByRole('link');
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(card(page).getByRole('heading', { name: 'Training context' })).toBeFocused();
  });

  test('the only live region in the card is the state line, and slider moves within a state are not announced', async ({ page }) => {
    await openApp(page, { params: { ...base, td: DATE_BRISK, wk: '40' }, results: true });
    await expect(card(page).locator('[aria-live], [role="status"], [role="alert"]')).toHaveCount(1);
    await expect(state(page)).toHaveText('Estimate lowered');
    const live = await state(page).evaluate((el) => el.outerHTML);
    await slider(page).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(summary(page)).toContainText('off your 10 km time');
    await expect(state(page)).toHaveText('Estimate lowered');
    expect(await state(page).evaluate((el) => el.outerHTML)).toBe(live);
    // A change of state changes the text.
    await page.keyboard.press('End');
    await expect(state(page)).toHaveText('No estimate shown');
  });

  test('the explainer and the inputs do not print; the state, the summary and the scope do', async ({ page }) => {
    await openApp(page, { params: { ...base, td: DATE_BRISK, wk: '40' }, results: true });
    await page.emulateMedia({ media: 'print' });
    await expect(card(page).getByRole('heading', { name: 'Training context' })).toBeVisible();
    await expect(card(page).getByText('Estimate lowered')).toBeVisible();
    await expect(summary(page)).toBeVisible();
    await expect(card(page).getByText(SCOPE)).toBeVisible();
    await expect(card(page).locator('fieldset')).toBeHidden();
    await expect(card(page).getByText('How this is worked out')).toBeHidden();
    await expect(pointer(page)).toBeVisible();
  });

  test('keyboard: the fields and the disclosure are reachable in reading order', async ({ page }) => {
    await openApp(page, { params: base, results: true });
    await weeklyKm(page).focus();
    await page.keyboard.press('Tab');
    await expect(history(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(card(page).getByText('How this is worked out')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(card(page).locator('details')).toHaveAttribute('open', '');
  });
});

test.describe('training context card: other languages', () => {
  for (const lang of LOCALES.filter((l): l is Exclude<Locale, 'en'> => l !== 'en')) {
    test(`${lang}: the lowered and withheld states use the translated copy`, async ({ page }) => {
      await openApp(page, { lang, params: { ...base, td: DATE_BRISK, wk: '40' }, results: true });
      await expect(card(page).getByRole('heading', { name: tr(lang, 'training.heading') })).toBeVisible();
      await expect(state(page)).toHaveText(tr(lang, 'training.state.reduced'));
      await expect(card(page)).toContainText(tr(lang, 'training.reduced.brisk'));
      await expect(card(page)).toContainText(tr(lang, 'training.signs'));
      await expect(card(page)).toContainText(tr(lang, 'training.scope'));
      await expect(pointer(page)).toHaveText(tr(lang, 'training.pointer.reduced'));

      await openApp(page, { lang, params: { ...base, td: DATE_TOO_FAST, wk: '40' }, results: true });
      await expect(state(page)).toHaveText(tr(lang, 'training.state.withheld'));
      await expect(card(page)).toContainText(tr(lang, 'training.withheld.tooFast'));
      await expect(card(page)).toContainText(tr(lang, 'training.help'));
      await expect(page.getByText(tr(lang, 'training.output.shareBlocked'))).toBeVisible();
      await expect(pointer(page)).toHaveText(tr(lang, 'training.pointer.withheld'));
      await expectNoFigures(page);
    });
  }
});
