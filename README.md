# Weight Pace Calculator

**Live App:** [https://eikekarbe.com/weight-pace-calculator](https://eikekarbe.com/weight-pace-calculator)

![Weight-Pace-Calculator Screenshot](https://raw.githubusercontent.com/ekarbe/weight-pace-calculator/refs/heads/main/assets/APP.PNG)

A web application built with Next.js and shadcn/ui to estimate potential running pace improvements based on projected weight loss. Enter your current stats and threshold pace to see how your race times might change as you approach a target weight.

## ✨ Features

*   **Input Form:** Collects gender, height, current weight, optional body fat %, and current threshold pace (min/km).
*   **Input Validation:** Provides immediate feedback on invalid or missing inputs.
*   **Pace & Time Estimation:** Calculates estimated threshold pace and race times (5k, 10k, Half Marathon, Marathon) for various target weights down to a healthy minimum.
*   **Body Fat Estimation:** Estimates body fat percentage at target weights (requires initial BFP input).
*   **Health Indicators:**
    *   Displays minimum healthy weight based on BMI 18.5.
    *   Warns about potentially unhealthy low body fat percentages in the results.
*   **Calculation Warnings:** Displays relevant warnings or disclaimers about the estimation model (e.g., if BFP wasn't provided, if pace improvement is capped).
*   **Responsive Design:** Adapts layout for desktop and mobile devices.
*   **Theme Support:** Includes Light and Dark mode support (using `next-themes`).

## 🚀 Tech Stack

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **UI Components:** shadcn/ui
*   **Icons:** Lucide React, Custom SVG Icon
*   **State Management:** React Hooks (`useState`, `useMemo`)

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

1.  Navigate to the application in your browser.
2.  Fill in the required fields in the "Input Data" card on the left:
    *   Select your biological gender.
    *   Enter your height in centimeters.
    *   Enter your current weight in kilograms.
    *   Optionally, enter your current body fat percentage for more refined estimates.
    *   Enter your current lactate threshold pace in minutes and seconds per kilometer. (Hover over the info icon for a definition).
3.  Click the "Calculate Estimates" button.
4.  The results table will appear on the right, showing projected paces and race times at different target weights.
5.  Review any informational messages (like minimum healthy weight) or warnings (like calculation caveats or potentially unhealthy BFP levels) displayed above or below the results table.

## 💡 Calculation Logic & Disclaimer

The pace estimation is based on common models relating weight change (primarily non-lean mass) to running performance changes. Body fat percentage estimates assume weight loss primarily targets fat mass down to healthy levels.

**Disclaimer:** These are *estimates* and individual results can vary significantly based on training adaptations, specific changes in body composition (muscle vs. fat loss/gain), genetics, running efficiency, environmental factors, and more. This tool is intended for informational and motivational purposes only and is not a substitute for professional medical or coaching advice.

## 📄 License

See the [LICENSE](LICENSE.md) file for license rights and limitations (MIT).

---

## Acknowledgements

* Built by Eike Christian Karbe.
  