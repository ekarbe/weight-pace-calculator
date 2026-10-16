import type { AdvancedState } from './form';
import { planByDate } from './plan';
import type { FormState } from './share';
import { kgToLb, type UnitSystem } from './units';

/** Anything with a writable `open` flag (a `<details>` element, or a stand-in in tests). */
export interface DetailsLike {
    open: boolean;
}

/**
 * Closed `<details>` hide their content in print. `open` expands them all for printing and remembers
 * which ones were closed; `restore` puts them back. Both are idempotent, because `beforeprint`,
 * `afterprint` and the matchMedia('print') fallback can all fire for one print job.
 */
export function createDetailsExpander() {
    const wasOpen = new Map<DetailsLike, boolean>();
    return {
        open(all: Iterable<DetailsLike>) {
            for (const el of all) {
                if (!wasOpen.has(el)) wasOpen.set(el, el.open);
                el.open = true;
            }
        },
        restore() {
            for (const [el, open] of wasOpen) el.open = open;
            wasOpen.clear();
        },
    };
}

/** The page address without query or hash: the query holds the user's body measurements, so it never goes on paper. */
export function appUrl(href: string): string {
    try {
        const u = new URL(href);
        return `${u.protocol}//${u.host}${u.pathname}`;
    } catch {
        return '';
    }
}

export interface PrintFacts {
    units: UnitSystem;
    sex: 'male' | 'female' | null;
    /** Height, weight, distance and target are in the user's units (cm/in, kg/lb, km/mi). */
    height: number | null;
    weight: number | null;
    /** Only a plausible, valid percentage. */
    bodyFat: number | null;
    /** Threshold pace as typed, "m:ss", per km or per mile depending on `units`. */
    pace: string | null;
    distance: number | null;
    /** The weight picked with the slider, and how much lighter it is than the current weight (0 for no change). */
    target: { weight: number; lost: number };
    /** The chosen target date (ISO), only when it is in the future and a loss is planned. */
    targetDate: string | null;
    paceGain: number | null;
    bmiFloor: number | null;
}

const positive = (v: string): number | null => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : null;
};

/** What the printed "Your stats" block lists. Pure so the edge cases (blank fields, units, past dates) are testable. */
export function printFacts(
    form: FormState,
    adv: AdvancedState,
    sel: { startKg: number; targetKg: number },
    today: Date,
): PrintFacts {
    const metric = form.units === 'metric';
    const toUnit = (kg: number) => (metric ? kg : kgToLb(kg));
    const weight = positive(form.weight);
    const lostKg = Math.max(0, sel.startKg - sel.targetKg);
    const unchanged = lostKg < 0.05;

    const bf = parseFloat(form.bodyFat);
    const min = parseInt(form.paceMin, 10);
    const sec = parseInt(form.paceSec, 10);
    const gain = parseFloat(adv.paceFactor);
    const floor = parseFloat(adv.bmiFloor);

    return {
        units: form.units,
        sex: form.gender || null,
        height: positive(form.height),
        weight,
        bodyFat: bf >= 5 && bf <= 70 ? bf : null,
        pace: Number.isFinite(min) && Number.isFinite(sec) && min >= 0 && sec >= 0 && sec < 60 && min * 60 + sec > 0 ? `${min}:${String(sec).padStart(2, '0')}` : null,
        distance: positive(form.distance),
        target: { weight: unchanged && weight ? weight : toUnit(sel.targetKg), lost: unchanged ? 0 : toUnit(lostKg) },
        targetDate: form.targetDate && lostKg >= 0.25 && planByDate(sel.startKg, lostKg, form.targetDate, today) ? form.targetDate : null,
        paceGain: Number.isFinite(gain) ? gain : null,
        bmiFloor: Number.isFinite(floor) ? floor : null,
    };
}
