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
| `a11y`, `a11y-states`, `keyboard`, `responsive` | axe scans (4 languages x light/dark x desktop/mobile and many states), keyboard-only walk, reflow at 320 and 390px |

## Known defects

A few tests are annotated `test.fail(...)`: they assert the *fixed* behaviour of defects found while writing the suite
(contrast of the "Too fast" label, flagged table rows and the threshold-pace tooltip, the first click of the theme
toggle, a duplicate `<meta name="description">`, and the sticky header covering a focused control). They pass while
the defect exists and start failing the run when it is fixed, which is the cue to delete the annotation (and, for the
axe scans, the matching exclusion).
