import { test as base, expect } from '@playwright/test';

/**
 * "Now" for every test. The app only reads the clock for the timeline, the training card and the print date, so
 * pinning it (the context time zone is UTC, see playwright.config.ts) makes all date-dependent text exact.
 */
export const NOW = new Date('2026-06-15T09:00:00Z');

export const test = base.extend<{ pinnedClock: void; pageErrors: void }>({
  pinnedClock: [
    async ({ context }, use) => {
      // Date only: timers keep running normally, so nothing in the app has to be fast-forwarded.
      await context.clock.setFixedTime(NOW);
      await use();
    },
    { auto: true },
  ],
  // Every test, in every page it opens, fails on an uncaught exception or a console error (this includes
  // failed asset loads and React hydration warnings).
  pageErrors: [
    async ({ context }, use) => {
      const errors: string[] = [];
      context.on('weberror', (e) => errors.push(`uncaught: ${e.error().message}`));
      context.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
      });
      await use();
      expect(errors, 'browser console / uncaught errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
