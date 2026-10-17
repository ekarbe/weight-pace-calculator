# Weight Pace Calculator

A web application built with Next.js and shadcn/ui to estimate potential running pace improvements based on projected weight loss. Enter your current stats and a threshold pace (or a recent race result) to see how your race times might change as you approach a target weight.

**Live App:** [https://eikekarbe.com/weight-pace-calculator](https://eikekarbe.com/weight-pace-calculator)

![Weight-Pace-Calculator Screenshot](https://raw.githubusercontent.com/ekarbe/weight-pace-calculator/refs/heads/main/assets/APP.PNG)

## ✨ Features

*   **Live results:** No Calculate button. Estimates update as you type and as you drag the target-weight slider.
*   **Race cards:** Estimated 5K, 10K, half marathon and marathon times at the selected weight, with the time saved compared to now and a range beside each saving (see "Uncertainty range").
*   **Pace from a recent race:** Instead of typing a threshold pace you can switch to "From a recent race" and enter a recent result: 5K, 10K, half marathon, marathon or another distance (1 to 100 km, or the mile equivalent) and a finishing time. The threshold pace is worked back from it with the inverse of the model that estimates the race times, without rounding, so with the slider on your current weight the race cards give back the time you entered. That holds at every weight, including one already at or under the lowest weight shown, where the table is the single row for the weight you entered. The derived pace is shown under the fields and has to come out between 2:00 and 12:00 per km (3:13 and 19:19 per mile), otherwise the fields explain what to check. A race you did not run flat out makes your threshold pace look slower than it is, so treat the result as a rough guide.
*   **Uncertainty range:** The chart draws a shaded band around the estimate (with a "Show range" switch, on by default) and the race cards print a range beside the time saved, for example "Range: 0:39 to 1:58". The two ends show how much time the same weight change would save if each kg lost improved your pace by 1 s/km instead of the 2 used for the estimate, or by 3 (if your own setting is outside 1 to 3, the range widens to include it). It covers the healthy case only (mostly fat lost, training and fuelling kept up): the gain can be smaller or absent, which the cards say, and the chart notes that a straight-line estimate gets less reliable beyond roughly 10 kg. A card shows no range where there is no saving to qualify, the chart none where the band would have no width (a runner already at or under the lowest BMI shown), and both leave it out where the Training context card says the estimate should not be relied on.
*   **Training context:** A card that sets the estimate against how fast the weight would change (from your target date, or an assumed sustainable 0.5% of body weight a week) and, if you enter it, how much you run each week. It is a safety check, not a training model: it does not work out how much of the predicted gain your training will actually deliver, and weekly distance is only a rough stand-in for how much energy your training already needs. For most inputs it therefore leaves the estimate as it is and says so ("No adjustment applied", or "Nothing was checked" when neither a target date nor a weekly distance is entered). What it can do is lower an estimate or hold it back, and it never raises one: a brisk pace of weight change or very high weekly running lowers the 10K saving it shows, and a pace of change that is too fast, a brisk pace on top of heavy running, a weight under BMI 20 for your height or estimated body fat below healthy levels show no figure at all (so does a mistyped weekly distance, until you fix it). When it lowers an estimate or says one should not be relied on, the race cards link to the card (and, where no figure is shown, lose their green and their range) and no share image is made. Running history (optional) only picks one sentence of context and changes no number, as the card says. Every threshold is listed under "Calculation Logic" and in the card's "How this is worked out" panel. They are rules of thumb that have not been checked against outcomes or reviewed by a sports-medicine or sports-dietitian professional (the card says so, on screen and on paper), so read the card as an illustration, not as advice.
*   **Share image:** "Share image" draws the estimated race times (the four race cards and your custom distance), the health note and the bare address of the app as a 2400 × 1260 PNG in a fixed light palette. "Save image" downloads it, and "Share…" appears where the browser can share files (Web Share). The image holds no weight, height or body fat, and never the parameters of the share link, unless you tick "Include weights in the image", which adds your current and target weight and nothing else. That tick starts off on every visit and is neither stored nor put in the share link. No image is made for a target weight that is flagged (below healthy body fat, or past the model's pace limit) or when the Training context card lowers the estimate or says it should not be relied on, because the picture would show the higher headline estimate. The preview has a text description for screen readers.
*   **Print / save as PDF:** The "Print / save as PDF" button at the bottom of the results opens the browser's print dialog (choose "Save as PDF" as the printer to get a file). A dedicated print stylesheet gives a black-on-white document, always in the light theme, of about two to three sheets: the title, the print date and the bare address of the app (never the query with your measurements), a "Your stats" block with the values you entered, the race cards, chart, timeline, the Training context card (without its inputs and its explainer), the full table with every weight (a long table starts on a fresh page and repeats its header) and all notes and disclaimers. The input panel, the share image card, buttons and the "How this is worked out" panel are left out. The stats block does list your height, weight and body fat if you entered them, so a printout or PDF carries your measurements.
*   **Custom distance:** Add any race distance from 1 to 100 km (or the mile equivalent). Its pace factor is interpolated between the 5K, 10K, half marathon and marathon anchors.
*   **Pace chart:** Line chart of threshold pace or any race time against weight, with the uncertainty band. Click or drag on it to move the slider.
*   **Timeline:** Shows how long the selected weight loss takes at a sustainable 0.5% of body weight per week. Enter a target date to see the weekly rate it needs, rated sustainable, brisk (above 0.5%) or too fast (above 1%).
*   **Languages:** English, German, Spanish and French. The language is picked from `?lang=`, your last choice, or the browser setting, and can be changed in the header. Share links include the language. Numbers, dates and plurals follow the locale.
*   **Units:** Switch between kg / cm / min per km and lb / in / min per mile. Entered values, including a custom race distance and the weekly running distance, are converted when you switch.
*   **Shareable links:** "Copy share link" encodes your inputs in the URL (including a race result, weekly running and running history if you entered them); the link is validated when it loads. The link carries the numbers you typed, height, weight and body fat among them, so share it only with people you would show them to. The share image never does.
*   **Adjustable assumptions:** Change the pace gain per kg lost (default 2 s/km) and the lowest BMI shown (default 20, never below 18.5).
*   **Health safeguards:** A health note is always visible, the table stops at BMI 20 by default, and warnings appear when estimated body fat is below healthy levels or the pace is capped. Weights flagged for low body fat or a capped pace get no share image, and the Training context card shows no figure for low body fat.
*   **Full table:** All weights in 0.5 kg steps, with estimated body fat if you entered it. Collapsed by default. A weight already at or under the lowest one shown gets a single row, your own weight, with the health warning.
*   **Responsive, accessible UI:** Mobile-first layout, labelled form controls, light and dark mode (`next-themes`). Skip link, labelled controls and groups, a slider whose value is announced in words, visually hidden text equivalents for the race cards, a described chart and share-image preview, a captioned and keyboard-reachable table, visible focus indicators and `prefers-reduced-motion` support. The Playwright suite scans the page with axe-core against the WCAG 2.1 A and AA rules, with every feature switched on and all sections open, in all four languages in light and dark at 390 px (English also at 1280 px), and again in the error, warning, popup and Training-context states. It adds pixel-level checks of focus-ring and field-edge contrast, a keyboard-only walk through the whole flow, reflow at 320 px and a forced-colours check, and runs in CI, so a regression fails the build. Automated checks find only part of the possible problems, so this is not a claim of full WCAG conformance.

## 🚀 Tech Stack

*   **Framework:** Next.js 16 (App Router, static export to GitHub Pages)
*   **Language:** TypeScript 6
*   **Styling:** Tailwind CSS 4
*   **UI Components:** shadcn/ui on Radix UI
*   **Icons:** Lucide React, custom SVG icon
*   **Share image:** Drawn on a canvas in the browser, no library
*   **Testing:** Vitest (logic), Playwright 1.64 with axe-core (end-to-end, in Chromium)
*   **i18n:** Small typed dictionary layer in `src/i18n` (no dependency)
*   **Tooling:** ESLint 10 (flat config), Node 22+

> TypeScript is held at 6.x because typescript-eslint does not support 7.x yet.

## ⚙️ Getting Started

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ekarbe/weight-pace-calculator.git
    cd weight-pace-calculator
    ```

2.  **Install dependencies:**
    Choose your preferred package manager:
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```

4.  Open http://localhost:3000/weight-pace-calculator in your browser to see the application.

## 📋 Usage

1.  Open the app and pick your units (kg/cm/km or lb/in/mi).
2.  Enter your biological sex, height, weight and threshold pace (the pace you could hold for about an hour). Or switch to "From a recent race" and enter a distance and finishing time instead. Body fat % is optional.
3.  Drag the target-weight slider. The race cards show estimated times, the time saved against your current weight and a range.
4.  Open "Full table" for every weight step and "Notes & disclaimers" for the model's caveats.
5.  Optionally add a custom distance, and pick a target date in the Timeline card. Once the slider is on a lighter weight, the Training context card sets the estimate against that date and, if you enter it, your weekly running.
6.  Use "Share image" to save a picture of the race times, "Print / save as PDF" for a printable page, and "Copy share link" to send your inputs to someone else.

Open "Advanced assumptions" to change the pace gain per kg or the lowest BMI shown.

## 🧪 Development

```bash
npm run dev        # dev server
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest (calculation, units, form, share-link, planning, pace-from-race, band, training, share-image layout, print helper and i18n logic)
npm run build      # static export to ./out
npm run e2e        # Playwright end-to-end suite: builds, serves ./out under the production base path, runs the tests
```

### End-to-end tests

The Playwright suite in `e2e/` drives the real static export in Chromium (a 1280 px desktop and a 390 px touch phone) and scans it with axe-core. It covers each feature (inputs, units, slider, race result, race cards and range, chart, timeline, every Training context state, share link, share image and its privacy, print layout and PDF) as well as accessibility, keyboard-only use, reflow and touch. `npm run e2e` builds the site, serves `./out` with `scripts/serve-out.mjs` under `/weight-pace-calculator/` exactly like GitHub Pages, and runs everything.

```bash
npx playwright install --with-deps chromium   # once: downloads the browser (and, on Linux, its system libraries)
npm run e2e                                    # build, serve ./out, run the suite
E2E_REUSE_BUILD=1 npm run e2e                  # skip the build and test the ./out that is already there
npx playwright test e2e/chart.spec.ts          # one file
```

Environment variables:

*   `E2E_PORT`: port of the static server (default 3100). A server that is already listening on it is reused locally, so give a second run its own port.
*   `E2E_REUSE_BUILD=1`: do not run `npm run build` first. Run it yourself beforehand, and again after every change to the app, or the tests check a stale build.
*   `PW_CHROMIUM_EXECUTABLE`: path of a Chromium or headless-shell binary to drive instead of the one Playwright downloads. Local use only, for machines where `npx playwright install` is not possible (no network access to the download host) but a Chromium is already there. CI never sets it.

To run the suite on such a machine:

```bash
npm run build
E2E_REUSE_BUILD=1 E2E_PORT=3270 PW_CHROMIUM_EXECUTABLE=/path/to/chromium npm run e2e
```

The browser does not have to be the exact build Playwright would download: the suite has been run against an older preinstalled Chromium without problems. The tests pin the clock, time zone, locale, colour scheme and viewport, so they do not depend on today's date. How they stay deterministic, how the work is split between the desktop and phone projects and how the axe scans work is in [`e2e/README.md`](e2e/README.md).

### Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on every push to a branch other than `main`, in two jobs:

*   `check`: `npm ci`, lint, typecheck, the Vitest tests and the build.
*   `e2e`: installs Chromium (the download is cached per Playwright version, the system libraries are installed every time), builds once, and runs the Playwright suite with one retry for a failing test. The HTML report and the traces are uploaded as a workflow artifact and kept for 14 days.

Pushes to `main` build the site and deploy it to GitHub Pages (`deploy.yml`).

### Adding or changing a language

All text lives in `src/i18n/messages/`. `en.ts` holds the shared strings and is the source; each larger feature keeps its own strings in `src/i18n/messages/parts/<feature>.ts` (`raceResult`, `training`, `band`, `shareImage` and `print`). A part file holds all four languages: an `en` object that is the source for its keys, and `de`, `es` and `fr` objects typed against it, so a missing or extra key fails the build. `en.ts`, `de.ts`, `es.ts` and `fr.ts` spread their language of every part into one dictionary (`...training.de` and so on), and `de.ts`, `es.ts` and `fr.ts` are typed against `en.ts`. A new feature gets its own part file, which is spread into all four language files; keeping its strings there also avoids merge conflicts between features. All UI text goes through `t()`.

To add a language, create `xx.ts`, give every file in `parts/` an `xx` object, spread them into `xx.ts`, add the language to `LOCALES`, `LOCALE_NAMES` and `MESSAGES` in `src/i18n/core.ts`, and run `npm test`. The tests check that every language has the same keys, placeholders (`{name}`) and emphasis tags (`<b>`, `<r>`, `<g>`) as English and no empty strings. `src/i18n/training-copy.test.ts` also checks the Training context card's wording in every language: no calorie, diet, goal-weight, diagnosis or praise wording, no exclamation marks, and no digits where a number arrives as a placeholder. Warnings from the calculation logic are message codes (`warn.*`), not sentences. The German, Spanish and French refusal, support, scope and pointer texts of the Training context card still need a review by native speakers.

Project layout: `src/lib/` holds the pure logic (calculation, units, form validation, share links, pace from a race result, the uncertainty band, planning, training context, the share image's layout and the print helpers) with its Vitest tests; `src/components/calculator/` holds the input panel, race cards, chart, timeline, training card, share image card, print helpers and results table; `src/app/print.css` is the print stylesheet; `src/i18n/` holds the translation core and provider; `e2e/` and `scripts/serve-out.mjs` hold the end-to-end suite and its static server.

## 💡 Calculation Logic & Disclaimer

The model is a rule of thumb: each kg lost improves threshold pace by about 2 s/km (adjustable). The range shown beside it uses 1 and 3 s/km per kg. Race paces are derived from threshold pace (5K ×0.95, 10K ×0.98, half marathon ×1.04, marathon ×1.10), with a minimum pace cap per sex. A threshold pace worked back from a race result is the exact inverse of this: the finishing time divided by the distance and by the race-pace factor for that distance. If you enter body fat %, lean mass is assumed constant, so all weight lost is fat. The table stops at BMI 20 by default and never goes below BMI 18.5. A linear rule applied over a long range is optimistic at the far end of the slider.

**Training context card.** The card takes the headline gain and the 10K saving it implies, and checks the scenario against these rules, which are the constants in `src/lib/training.ts`. The pace of weight change uses the same classes as the Timeline card (sustainable up to 0.5% of body weight a week, brisk up to 1%, too fast above that); without a target date a sustainable pace is assumed. Where a figure is "lowered", it is counted at the point halfway between your pace-gain setting (counted as 3 s/km per kg at most) and 1 s/km per kg (or your own setting, if that is lower). The rows are checked from the top and the first match wins.

| Situation | What the card does |
| --- | --- |
| A weight under BMI 20 for your height, entered or selected | No figure |
| No lighter weight selected, or a change under 1 kg or 1% of your weight (day-to-day swings) | Nothing to qualify, a short note |
| No weight-based gain to qualify (for example the pace is already at the model's limit) | The card is hidden |
| Estimated body fat below the healthy limit used elsewhere on the page | No figure |
| A pace of weight change above 1% of body weight a week (too fast) | No figure |
| A weekly distance that is not a valid number (0 to 250 km, or 155 mi) | No figure until it is fixed |
| A brisk pace and weekly running of 50 km (31.1 mi) or more | No figure |
| A brisk pace, or weekly running of 100 km (62.2 mi) or more | Figure lowered |
| Weekly running of 50 to 99 km at a sustainable pace | Figure unchanged, with a note |
| Anything else | Figure unchanged ("No adjustment applied") |

The thresholds are rules of thumb: the 50 and 100 km lines, the one-kg and 1% limits and the halfway step are illustrative choices, and the BMI line is a deliberately cautious stopping point (BMI says nothing about an individual's health). None of them has been checked against outcomes, and the card knows nothing about your food intake, injuries or health history.

**Disclaimer:** These are *estimates* and individual results can vary significantly based on training adaptations, specific changes in body composition (muscle vs. fat loss/gain), genetics, running efficiency, environmental factors, and more. This tool is intended for informational and motivational purposes only and is not a substitute for professional medical or coaching advice.

## 📄 License

Copyright © 2025 Eike Christian Karbe.

This project is licensed under the [GNU General Public License v3.0](LICENSE) (`GPL-3.0-only`). You may use, modify and redistribute it, but derivative works must also be released under the GPL-3.0 with their source code.

The end-to-end test tooling (Playwright and `@axe-core/playwright`, under Apache-2.0 and MPL-2.0, and pdf.js, under Apache-2.0, which reads the printed PDF in the print tests) is a development dependency only. It is not part of the built site, and no runtime dependency was added for these features.

---

## Acknowledgements

* Built by Eike Christian Karbe.
