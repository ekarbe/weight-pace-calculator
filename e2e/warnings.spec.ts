import { test, expect } from './support/fixtures';
import { SAMPLE, openApp, openAllDetails, slider } from './support/app';
import type { Page } from '@playwright/test';

const notes = (page: Page) => page.locator('details', { has: page.locator('summary', { hasText: 'Notes & disclaimers' }) });
const table = (page: Page) => page.getByRole('table', { name: /^Full table/ });

const DISCLAIMER = 'Disclaimer: These calculations are estimates based on general rules of thumb (for example about 2 s/km improvement per kg lost, and constant lean mass if body fat is provided).';
const HEALTH = 'Weight loss should be approached healthily. Aim for gradual change and talk to a doctor or registered dietitian before making significant changes, especially when aiming for a low body weight.';

test.describe('results table, notes and safety warnings', () => {
  test('the disclaimers are always there, closed by default and counted in the summary', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    await expect(notes(page)).toBeVisible();
    await expect(notes(page).locator('summary')).toHaveText('Notes & disclaimers (2)');
    await expect(notes(page)).not.toHaveAttribute('open', '');
    await notes(page).locator('summary').click();
    await expect(notes(page)).toContainText(DISCLAIMER);
    await expect(notes(page)).toContainText(HEALTH);
  });

  test('without body fat the notes explain the limits of the table', async ({ page }) => {
    await openApp(page, { params: { g: 'female', h: '170', w: '64', pm: '5', ps: '0' }, results: true });
    await expect(notes(page).locator('summary')).toHaveText('Notes & disclaimers (3)');
    await notes(page).locator('summary').click();
    await expect(notes(page)).toContainText('Body fat percentage not provided or invalid. Body fat estimates and related warnings are unavailable, and the lowest weight shown is based on BMI alone.');
  });

  test('rows below healthy body fat are marked in words and the model stops at the physical limit', async ({ page }) => {
    await openApp(page, { params: { g: 'male', h: '180', w: '75', bf: '10', pm: '4', ps: '0' }, results: true });
    await openAllDetails(page);
    await expect(notes(page)).toContainText('Highlighted rows indicate estimated body fat below 5%, a level that can carry health risks for men. Consult a healthcare professional.');
    await expect(notes(page)).toContainText('Calculations stopped because the target weight reached the estimated lean body mass (about 0% body fat), which is physically impossible.');
    // The marker is an icon with a text alternative, not only a red row.
    const flagged = table(page).getByRole('img', { name: 'Below healthy body fat' });
    expect(await flagged.count()).toBeGreaterThan(0);
    await expect(table(page).locator('tbody tr').last()).toContainText('0.7');

    await slider(page).focus();
    await page.keyboard.press('End');
    await expect(page.getByRole('status').filter({ hasText: 'Estimated body fat at this weight is below healthy levels.' })).toBeVisible();
  });

  test('a capped pace is flagged with an asterisk, a footnote, a card warning and a note', async ({ page }) => {
    await openApp(page, { params: { g: 'female', h: '170', w: '64', pm: '3', ps: '10' }, results: true });
    await openAllDetails(page);
    await slider(page).focus();
    await page.keyboard.press('End');
    await expect(page.getByRole('status').filter({ hasText: 'Pace is capped at the model’s limit here, so these times are not reliable.' })).toBeVisible();
    await expect(table(page).locator('tbody tr').last().locator('td').nth(2)).toHaveText('3:00 *');
    await expect(page.getByText('* pace capped at the model’s limit.')).toBeVisible();
    await expect(notes(page)).toContainText('Estimated threshold pace was capped at the model’s minimum (3:00 per km, women) for some weights.');
  });

  test('someone already at the lowest weight shown is warned instead of invited to lose more', async ({ page }) => {
    await openApp(page, { params: { g: 'male', h: '180', w: '60', pm: '4', ps: '0' }, results: true });
    await openAllDetails(page);
    await expect(notes(page)).toContainText('Your current weight is already at or below the lowest weight shown (BMI 20). Further weight loss is generally not recommended without medical supervision.');
    await expect(slider(page)).toHaveAttribute('max', '0');
    await expect(slider(page)).toHaveAttribute('aria-valuetext', '60.0 kg, current weight');
  });

  test('the health note appears with the results and the table', async ({ page }) => {
    await openApp(page, { params: SAMPLE, results: true });
    await expect(page.getByText('Estimates, not a weight-loss plan.').first()).toBeVisible();
    await expect(page.getByText('talk to a doctor or dietitian before changing your weight').first()).toBeVisible();
  });
});
