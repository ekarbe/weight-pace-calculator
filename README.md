# Weight Pace Calculator

A web application built with Next.js and shadcn/ui to estimate potential running pace improvements based on projected weight loss. Enter your current stats and threshold pace to see how your race times might change as you approach a target weight.

**Live App:** [https://eikekarbe.com/weight-pace-calculator](https://eikekarbe.com/weight-pace-calculator)

![Weight-Pace-Calculator Screenshot](https://raw.githubusercontent.com/ekarbe/weight-pace-calculator/refs/heads/main/assets/APP.PNG)

## ✨ Features

*   **Live results:** No Calculate button. Estimates update as you type and as you drag the target-weight slider.
*   **Race cards:** Estimated 5K, 10K, half marathon and marathon times at the selected weight, with the time saved compared to now.
*   **Units:** Switch between kg / cm / min per km and lb / in / min per mile. Entered values are converted when you switch.
*   **Shareable links:** "Copy share link" encodes your inputs in the URL; the link is validated when it loads.
*   **Adjustable assumptions:** Change the pace gain per kg lost (default 2 s/km) and the lowest BMI shown (default 20, never below 18.5).
*   **Health safeguards:** A health note is always visible, the table stops at BMI 20 by default, and warnings appear when estimated body fat is below healthy levels or the pace is capped.
*   **Full table:** All weights in 0.5 kg steps, with estimated body fat if you entered it. Collapsed by default.
*   **Responsive, accessible UI:** Mobile-first layout, labelled form controls, light and dark mode (`next-themes`).

## 🚀 Tech Stack

*   **Framework:** Next.js 16 (App Router, static export to GitHub Pages)
*   **Language:** TypeScript 6
*   **Styling:** Tailwind CSS 4
*   **UI Components:** shadcn/ui on Radix UI
*   **Icons:** Lucide React, custom SVG icon
*   **Testing:** Vitest
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
5.  Use "Copy share link" to send your inputs to someone else.

Open "Advanced assumptions" to change the pace gain per kg or the lowest BMI shown.

## 🧪 Development

```bash
npm run dev        # dev server
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest (calculation, units, form and share-link logic)
npm run build      # static export to ./out
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests and the build on every pull request. Pushes to `main` deploy to GitHub Pages (`deploy.yml`).

Project layout: `src/lib/` holds the pure logic (calculation, units, form validation, share links); `src/components/calculator/` holds the input panel, race cards and results table.

## 💡 Calculation Logic & Disclaimer

The model is a rule of thumb: each kg lost improves threshold pace by about 2 s/km (adjustable). Race paces are derived from threshold pace (5K ×0.95, 10K ×0.98, half marathon ×1.04, marathon ×1.10), with a minimum pace cap per sex. If you enter body fat %, lean mass is assumed constant, so all weight lost is fat. The table stops at BMI 20 by default and never goes below BMI 18.5. A linear rule applied over a long range is optimistic at the far end of the slider.

**Disclaimer:** These are *estimates* and individual results can vary significantly based on training adaptations, specific changes in body composition (muscle vs. fat loss/gain), genetics, running efficiency, environmental factors, and more. This tool is intended for informational and motivational purposes only and is not a substitute for professional medical or coaching advice.

## 📄 License

Copyright © 2025 Eike Christian Karbe.

This project is licensed under the [GNU General Public License v3.0](LICENSE) (`GPL-3.0-only`). You may use, modify and redistribute it, but derivative works must also be released under the GPL-3.0 with their source code.

---

## Acknowledgements

* Built by Eike Christian Karbe.
  