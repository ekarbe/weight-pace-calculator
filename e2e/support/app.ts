import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';
import { MESSAGES, interpolate, type Locale } from '../../src/i18n/core';
import type { MessageKey } from '../../src/i18n/messages/en';

export { LOCALES } from '../../src/i18n/core';
export type { Locale, MessageKey };

/** Canonical sample (female, 170 cm, 64 kg, 22 % body fat, 5:00 /km threshold pace, custom 15 km). */
export const SAMPLE = { g: 'female', h: '170', w: '64', bf: '22', pm: '5', ps: '0', d: '15' } as const;

/** Today's date is pinned to 2026-06-15 (see fixtures.ts); the first selectable date is the 16th. */
export const TOMORROW = '2026-06-16';
/** Target dates for a 3.0 kg loss from 64 kg (the sample's default slider position): 0.36 %, 0.71 % and 1.64 % a week. */
export const DATE_SUSTAINABLE = '2026-09-15';
export const DATE_BRISK = '2026-07-31';
export const DATE_TOO_FAST = '2026-07-05';

/** Message text exactly as the app renders it (same dictionary, same interpolation). */
export function tr(lang: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  return interpolate(MESSAGES[lang][key], params, lang);
}

type Params = Record<string, string | undefined>;

/** Form fields reachable through the share link, mapped to the input that shows them. */
const FIELD_IDS: Record<string, string> = { h: '#height', w: '#weight', bf: '#bfp', pm: '#pace-min', ps: '#pace-sec', d: '#distance' };

/**
 * React attaches its internal props to a DOM node when it hydrates it. Typing before that point would be wiped
 * by hydration, so every test waits for it instead of racing it.
 */
export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('height');
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$'));
  });
}

/** Opens the app in `lang` with the form state given as share-link parameters, and waits until it is interactive. */
export async function openApp(page: Page, opts: { lang?: Locale; params?: Params; results?: boolean; applied?: boolean } = {}) {
  const { lang = 'en', params = {}, results = false, applied = true } = opts;
  const q = new URLSearchParams({ lang });
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, v);
  await page.goto(`./?${q}`);
  await waitForHydration(page);
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  // The share-link state is applied in an effect after hydration; wait for it before the test touches the form.
  // (`applied: false` for links whose parameters are expected to be rejected.)
  for (const [k, id] of Object.entries(FIELD_IDS)) {
    const v = params[k];
    if (applied && v !== undefined) await expect(page.locator(id)).toHaveValue(v);
  }
  if (results) await expect(slider(page)).toBeVisible();
}

export const slider = (page: Page) => page.getByRole('slider');

/**
 * Alerts that have text. Next.js keeps an empty role="alert" route announcer on every page, so a bare
 * getByRole('alert') is never empty.
 */
export const alerts = (page: Page) => page.getByRole('alert').filter({ hasText: /\S/ });

/** Picks an option of a Radix Select by its accessible trigger name and the option's visible text. */
export async function choose(page: Page, trigger: Locator, option: string | RegExp) {
  await trigger.click();
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
}

/** English-UI locators for the form, by accessible name. */
export const form = (page: Page) => ({
  units: (label: 'kg · cm · km' | 'lb · in · mi') => page.getByRole('group', { name: 'Units' }).getByRole('button', { name: label }),
  sex: page.getByRole('combobox', { name: 'Biological sex' }),
  height: page.getByLabel(/^Height \(/),
  weight: page.getByLabel(/^Weight \(/),
  bodyFat: page.getByLabel('Body fat %'),
  paceMin: page.getByLabel('Threshold pace, minutes'),
  paceSec: page.getByLabel('Threshold pace, seconds'),
  distance: page.getByLabel(/^Custom race distance/),
  advanced: page.getByText('Advanced assumptions'),
  paceGain: page.getByLabel('Pace gain (s/km per kg lost)'),
  bmiFloor: page.getByLabel('Lowest BMI to show'),
  copyLink: page.getByRole('button', { name: /^(Copy share link|Link copied!)$/ }),
  paceSource: (label: 'Threshold pace' | 'From a recent race') => page.getByRole('group', { name: 'Threshold pace source' }).getByRole('button', { name: label }),
});

/** Fills the three required fields plus pace the way a person would (sex via the select, the rest typed). */
export async function fillSample(page: Page, values: { sex?: string; height?: string; weight?: string; bodyFat?: string; paceMin?: string; paceSec?: string } = {}) {
  const { sex = 'Female', height = '170', weight = '64', bodyFat = '22', paceMin = '5', paceSec = '0' } = values;
  const f = form(page);
  await choose(page, f.sex, sex);
  await f.height.fill(height);
  await f.weight.fill(weight);
  if (bodyFat) await f.bodyFat.fill(bodyFat);
  await f.paceMin.fill(paceMin);
  await f.paceSec.fill(paceSec);
}

/** A race card (list item) by its screen-reader label: "5 km", "10 km", "Half marathon", "Marathon" or the custom distance. */
export const raceCard = (page: Page, name: string) =>
  page.getByRole('listitem').filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`) });

/** The time shown on a race card (the large figure), e.g. "48:01". */
export const cardTime = (page: Page, name: string) => raceCard(page, name).locator('div[aria-hidden="true"] > p').first();

/** "mm:ss" or "hh:mm:ss" to seconds. */
export function toSeconds(text: string): number {
  return text.trim().split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

export async function openAllDetails(page: Page) {
  await page.locator('details').evaluateAll((els) => els.forEach((d) => ((d as HTMLDetailsElement).open = true)));
}

/** Every aria-describedby / aria-labelledby / aria-controls reference on the page points at an element that exists. */
export async function brokenAriaReferences(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const broken: string[] = [];
    for (const attr of ['aria-describedby', 'aria-labelledby', 'aria-controls']) {
      document.querySelectorAll(`[${attr}]`).forEach((el) => {
        for (const id of (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean)) {
          if (!document.getElementById(id)) broken.push(`${el.tagName.toLowerCase()}#${el.id || '?'} ${attr}="${id}"`);
        }
      });
    }
    return broken;
  });
}

/** Unfilled `{placeholders}` or stray `<b>/<r>/<g>` markup in the text a user can see. */
export const leakedMarkup = (page: Page) =>
  page.evaluate(() => [...document.body.innerText.matchAll(/\{\w+\}|<\/?[brg]>/g)].map((m) => m[0]));

export const hasHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

/**
 * Switches off CSS transitions and animations for the page, so computed styles and axe's colour maths see the final
 * state instead of a fade-in or a focus ring half-way through its transition. Not for tests about motion.
 */
export async function disableMotion(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });
  });
}
