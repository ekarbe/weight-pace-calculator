# End-to-end tests

Playwright tests that drive the real, statically exported site in Chromium (desktop 1280px and a 390px phone) and
scan it with axe for WCAG 2.1 AA. They run against `./out` served under `/weight-pace-calculator/` by
`scripts/serve-out.mjs`, exactly like GitHub Pages.

```bash
npx playwright install --with-deps chromium   # once
npm run e2e                                    # builds the site, serves it, runs everything
E2E_REUSE_BUILD=1 npm run e2e                  # reuse the existing ./out (skip the build)
npx playwright test e2e/chart.spec.ts          # one file
npm run e2e:ui                                 # Playwright's UI mode
npx playwright show-report                     # after a CI-style run (HTML reporter)
```

Environment: `E2E_PORT` (default 3100), `E2E_REUSE_BUILD=1`, and `PW_CHROMIUM_EXECUTABLE` to drive a Chromium you
already have instead of the one Playwright installs (local use only).

## How the tests stay deterministic

- No sleeps: every wait is a web-first assertion (or an `expect.poll` on state the page exposes).
- The clock is pinned to 2026-06-15 09:00 UTC, the time zone to UTC, the locale to en-US and the browser starts in
  the light theme with reduced motion (the tests about motion opt back in). See `support/fixtures.ts`.
- The tests wait for React to hydrate before touching the form (`waitForHydration`), then for the share-link state to
  appear, so typing is never lost to hydration.
- Any `console.error` or uncaught exception in any page fails the test (auto fixture).
- Retries are off locally and 1 in CI; a flaky test has to be fixed, not retried.

## Layout

| File | Covers |
| --- | --- |
| `smoke`, `shell` | every language renders, language and theme switching, base path, document head |
| `inputs`, `units`, `slider`, `race-cards`, `chart`, `timeline`, `race-result`, `training`, `warnings` | the features |
| `share`, `share-image`, `print` | share link round trips, the PNG download and its privacy, print layout and PDF |
| `controls` | non-text contrast read from real pixels: keyboard focus rings, the edge of text fields and selects, and that an open select list is opaque (`support/pixels.ts` decodes a screenshot in the page) |
| `a11y`, `a11y-states`, `keyboard`, `responsive`, `touch` | axe scans (4 languages x light/dark at 390px, English at 1280px, and many states), keyboard-only walk, reflow at 320 and 390px, touch input |

## Speed

The suite is CPU-bound (software-rendered Chromium), so its run time is the number of page loads and axe scans. 236
tests take 1.5 to 2.6 minutes on 4 vCPUs, depending on the machine (4 workers; more workers do not help). To keep it from growing:

- Where a test checks both themes it loads the page once and flips the emulated colour scheme (`inEachTheme`); opening
  the page in dark from the start is covered in `shell.spec.ts`.
- Tests are routed to projects instead of running everywhere: the four-language axe matrix (`@other-languages`) and the
  320px reflow checks (`@phone`) run in the phone project only, touch tests (`touch.spec.ts`) only there too, and the
  1024-1280px window-width checks (`@desktop`) in the desktop project only.
- Scans of one card (the Training context states) are scoped to it with `include`; the full page is scanned by
  `a11y.spec.ts`.

## Accessibility scans

`support/axe.ts` runs axe with the WCAG 2.0/2.1 A and AA tags plus best practices. The soft page-background gradient is
hidden for the duration of a scan: axe cannot compute the colour behind text that sits on a gradient and would
report nearly all of it as "incomplete" instead of checking it. The muted text colour is dark enough (about 5:1) for
the greenest part of that gradient too, which a scan cannot see; the reasoning is in `support/axe.ts`. Open Radix popups (select lists) are scanned with the
page-level rules that a modal popup breaks by design (landmarks, heading, hidden skip link) switched off.

## Known defects

None are parked: no test is annotated `test.fail`, and no scan leaves an element out to hide a failure. The defects found
while the suite was written (light-theme contrast of the red text and the threshold-pace tooltip, the first click of the
theme toggle, a duplicate `<meta name="description">`, the sticky header covering a focused control) are fixed and
covered by ordinary tests (`a11y-states`, `shell`, `keyboard`). If a defect has to be reported before it can be fixed,
annotate its test with `test.fail(true, reason)` and say so here; the annotation must be removed together with the fix,
because a `test.fail` test that starts passing fails the run.
