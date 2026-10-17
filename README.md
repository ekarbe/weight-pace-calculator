# Weight Pace Calculator

A web application built with Next.js and shadcn/ui to estimate potential running pace improvements based on projected weight loss. Enter your current stats and threshold pace to see how your race times might change as you approach a target weight.

**Live App:** [https://eikekarbe.com/weight-pace-calculator](https://eikekarbe.com/weight-pace-calculator)

![Weight-Pace-Calculator Screenshot](https://raw.githubusercontent.com/ekarbe/weight-pace-calculator/refs/heads/main/assets/APP.PNG)

## ✨ Features

*   **Live results:** No Calculate button. Estimates update as you type and as you drag the target-weight slider.
*   **Race cards:** Estimated 5K, 10K, half marathon and marathon times at the selected weight, with the time saved compared to now.
*   **Pace from a recent race:** Instead of typing a threshold pace you can enter a recent race result (5K, 10K, half marathon, marathon or any distance and time). The pace is worked back from it with the same model that estimates the race times, without rounding, so the row for "no weight change" gives back the time you entered.
*   **Uncertainty range:** The chart and every race card show a range next to the estimate: how much time the same weight change would save if each kg lost improved your pace by 1 s/km instead of 2, or by 3. It covers the healthy case only (mostly fat lost, training and fuelling kept up); the gain can be smaller or absent, and the chart notes that a straight-line estimate gets less reliable beyond roughly 10 kg.
*   **Training context:** A card that sets the estimate against how fast the weight would change (from your target date, or an assumed sustainable pace) and how much you run each week. It is a safety qualifier, not a forecast of what training will give you: it can lower an estimate (a brisk pace of weight change, or a very high weekly distance) or hold it back (too fast a change, a brisk change on top of heavy running, a weight under the BMI line or below healthy body fat), and it never raises one. When it lowers or holds back an estimate the race cards point at it and no share image is made. Its thresholds are rules of thumb that have not been checked against outcomes (the card says so, and "How this is worked out" lists every number); they need review by a sports-medicine or sports-dietitian professional before this is relied on as more than an illustration.
*   **Share image:** "Share image" draws the estimated race times as a picture to save or share (Web Share where the browser supports files). Weights are left out unless you tick the box, and the picture never carries your height, body fat or the link's parameters. No image is made for a flagged target weight or when the Training context card shows no estimate or a lowered one.
*   **Print / save as PDF:** A dedicated print stylesheet gives a black-on-white document (always the light theme) with your stats, the race cards, chart, timeline, training card, full table and notes, and none of the controls. Print date and the bare address (never the query with your measurements) are at the top.
*   **Custom distance:** Add any race distance from 1 to 100 km (or the mile equivalent). Its pace factor is interpolated between the 5K, 10K, half marathon and marathon anchors.
*   **Pace chart:** Line chart of threshold pace or any race time against weight. Click or drag on it to move the slider.
*   **Timeline:** Shows how long the selected weight loss takes at a sustainable 0.5% of body weight per week. Enter a target date to see the weekly rate it needs, rated sustainable, brisk (above 0.5%) or too fast (above 1%).
*   **Languages:** English, German, Spanish and French. The language is picked from `?lang=`, your last choice, or the browser setting, and can be changed in the header. Share links include the language. Numbers, dates and plurals follow the locale.
*   **Units:** Switch between kg / cm / min per km and lb / in / min per mile. Entered values are converted when you switch.
*   **Shareable links:** "Copy share link" encodes your inputs in the URL; the link is validated when it loads.
*   **Adjustable assumptions:** Change the pace gain per kg lost (default 2 s/km) and the lowest BMI shown (default 20, never below 18.5).
*   **Health safeguards:** A health note is always visible, the table stops at BMI 20 by default, and warnings appear when estimated body fat is below healthy levels or the pace is capped.
*   **Full table:** All weights in 0.5 kg steps, with estimated body fat if you entered it. Collapsed by default.
*   **Responsive, accessible UI:** Mobile-first layout, labelled form controls, light and dark mode (`next-themes`). Skip link, labelled controls and groups, a slider whose value is announced in words, visually hidden text equivalents for the race cards, a captioned and keyboard-reachable table, visible focus indicators and `prefers-reduced-motion` support. Checked with axe-core (WCAG 2.1 AA) in all four languages, light, dark and mobile, and in the error, warning, popup and Training-context states; the Playwright suite repeats these scans in CI, so a regression fails the build.

## 🚀 Tech Stack

*   **Framework:** Next.js 16 (App Router, static export to GitHub Pages)
*   **Language:** TypeScript 6
*   **Styling:** Tailwind CSS 4
*   **UI Components:** shadcn/ui on Radix UI
*   **Icons:** Lucide React, custom SVG icon
*   **Testing:** Vitest (logic), Playwright with axe-core (end-to-end, in a real browser)
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
2.  Enter your biological sex, height, weight and threshold pace (the pace you could hold for about an hour). Body fat % is optional.
3.  Drag the target-weight slider. The race cards show estimated times and the time saved against your current weight.
4.  Open "Full table" for every weight step and "Notes & disclaimers" for the model's caveats.
5.  Optionally add a custom distance, and pick a target date in the Timeline card.
6.  Use "Copy share link" to send your inputs to someone else.

Open "Advanced assumptions" to change the pace gain per kg or the lowest BMI shown.

## 🧪 Development

```bash
npm run dev        # dev server
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest (calculation, units, form, share-link, planning, training, band and i18n logic)
npm run build      # static export to ./out
npx playwright install --with-deps chromium   # once, for the end-to-end tests
npm run e2e        # builds, serves ./out under the production base path and runs the Playwright suite
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and the build, and, as a second job, the end-to-end suite (Playwright and axe-core in Chromium, at 1280 px and on a 390 px phone) on every pull request. Pushes to `main` deploy to GitHub Pages (`deploy.yml`). How the end-to-end tests stay deterministic, and how to run one file or reuse a build, is in [`e2e/README.md`](e2e/README.md).

### Adding or changing a language

All text lives in `src/i18n/messages/`. `en.ts` is the source; `de.ts`, `es.ts` and `fr.ts` are typed against it, so a missing key fails the build. To add a language, create `xx.ts`, add it to `LOCALES`, `LOCALE_NAMES` and `MESSAGES` in `src/i18n/core.ts`, and run `npm test`. The tests check that every language has the same keys, placeholders (`{name}`) and emphasis tags (`<b>`, `<r>`, `<g>`). Warnings from the calculation logic are message codes (`warn.*`), not sentences.

Project layout: `src/lib/` holds the pure logic (calculation, units, form validation, share links); `src/components/calculator/` holds the input panel, race cards, chart, timeline and results table; `src/i18n/` holds the translation core and provider.

## 💡 Calculation Logic & Disclaimer

The model is a rule of thumb: each kg lost improves threshold pace by about 2 s/km (adjustable). The range shown beside it uses 1 and 3 s/km per kg. Race paces are derived from threshold pace (5K ×0.95, 10K ×0.98, half marathon ×1.04, marathon ×1.10), with a minimum pace cap per sex. If you enter body fat %, lean mass is assumed constant, so all weight lost is fat. The table stops at BMI 20 by default and never goes below BMI 18.5. A linear rule applied over a long range is optimistic at the far end of the slider.

**Disclaimer:** These are *estimates* and individual results can vary significantly based on training adaptations, specific changes in body composition (muscle vs. fat loss/gain), genetics, running efficiency, environmental factors, and more. This tool is intended for informational and motivational purposes only and is not a substitute for professional medical or coaching advice.

## 📄 License

Copyright © 2025 Eike Christian Karbe.

This project is licensed under the [GNU General Public License v3.0](LICENSE) (`GPL-3.0-only`). You may use, modify and redistribute it, but derivative works must also be released under the GPL-3.0 with their source code.

---

## Acknowledgements

* Built by Eike Christian Karbe.
  