import type { UserInput } from './calculations';
import { emptyForm, type FormState } from './share';
import { MAX_CUSTOM_DISTANCE_KM, MIN_CUSTOM_DISTANCE_KM } from './calculations';
import { KM_PER_MILE, inToCm, lbToKg, secPerMileToSecPerKm, type UnitSystem } from './units';
import { deriveRacePace, type RaceErrorKey } from './race-result';
import { TRAINING, TRAINING_HISTORIES, classifyLoad, type TrainingHistory } from './training';

export interface AdvancedState {
    paceFactor: string;
    bmiFloor: string;
}

/** Values are message keys (see src/i18n/messages), not display text. */
export type FieldErrors = Partial<Record<'gender' | 'height' | 'weight' | 'bodyFat' | 'pace' | 'advanced' | 'distance' | 'raceDistance' | 'raceTime', ErrorKey>>;

export type ErrorKey =
    | 'err.height.metric' | 'err.height.imperial' | 'err.weight.metric' | 'err.weight.imperial'
    | 'err.bodyFat' | 'err.pace' | 'err.paceFactor' | 'err.bmiFloor'
    | 'err.distance.metric' | 'err.distance.imperial'
    | RaceErrorKey;

export interface BuiltInput {
    input: UserInput | null;
    /** Valid custom race distance in km, or null. Independent of `input`. */
    customDistanceKm: number | null;
    errors: FieldErrors;
    /** Fields that are empty (not yet an error, just incomplete). */
    missing: string[];
}

const blank = (v: string) => v.trim() === '';

export function buildInput(form: FormState, adv: AdvancedState): BuiltInput {
    const errors: FieldErrors = {};
    const missing: string[] = [];
    const metric = form.units === 'metric';

    if (!form.gender) missing.push('gender');

    const h = parseFloat(form.height);
    const heightCm = metric ? h : inToCm(h);
    if (blank(form.height)) missing.push('height');
    else if (!(heightCm > 50 && heightCm < 272)) errors.height = metric ? 'err.height.metric' : 'err.height.imperial';

    const w = parseFloat(form.weight);
    const weightKg = metric ? w : lbToKg(w);
    if (blank(form.weight)) missing.push('weight');
    else if (!(weightKg > 20 && weightKg < 400)) errors.weight = metric ? 'err.weight.metric' : 'err.weight.imperial';

    let bodyFat: number | null = null;
    if (!blank(form.bodyFat)) {
        const bf = parseFloat(form.bodyFat);
        if (bf >= 5 && bf <= 70) bodyFat = bf;
        else errors.bodyFat = 'err.bodyFat';
    }

    const pm = parseInt(form.paceMin, 10);
    const ps = parseInt(form.paceSec, 10);
    let perKm = NaN;
    if (form.paceSource === 'race') {
        const race = deriveRacePace(form);
        perKm = race.perKm ?? NaN;
        missing.push(...race.missing);
        Object.assign(errors, race.errors);
    } else if (blank(form.paceMin) || blank(form.paceSec)) missing.push('pace');
    else if (isNaN(pm) || isNaN(ps) || pm < 0 || ps < 0 || ps >= 60 || pm * 60 + ps === 0) errors.pace = 'err.pace';
    else {
        const total = pm * 60 + ps;
        perKm = Math.round(metric ? total : secPerMileToSecPerKm(total));
    }

    let customDistanceKm: number | null = null;
    if (!blank(form.distance)) {
        const d = parseFloat(form.distance);
        const km = metric ? d : d * KM_PER_MILE;
        if (km >= MIN_CUSTOM_DISTANCE_KM && km <= MAX_CUSTOM_DISTANCE_KM) customDistanceKm = km;
        else errors.distance = metric ? 'err.distance.metric' : 'err.distance.imperial';
    }

    const factor = parseFloat(adv.paceFactor);
    const floor = parseFloat(adv.bmiFloor);
    if (isNaN(factor) || factor < 0 || factor > 5) errors.advanced = 'err.paceFactor';
    else if (isNaN(floor) || floor < 18.5 || floor > 30) errors.advanced = 'err.bmiFloor';

    if (missing.length || Object.keys(errors).length || !form.gender) {
        return { input: null, customDistanceKm, errors, missing };
    }
    return {
        input: {
            gender: form.gender,
            heightCm,
            weightKg,
            bodyFatPercentage: bodyFat,
            thresholdPaceMin: Math.floor(perKm / 60),
            thresholdPaceSec: perKm % 60,
            paceFactorSecPerKg: factor,
            bmiFloor: floor,
        },
        customDistanceKm,
        errors,
        missing,
    };
}

export type TrainingErrorKey = 'training.err.weeklyKm.metric' | 'training.err.weeklyKm.imperial';

export interface TrainingFields {
    /** Average weekly running in km, or null when blank or invalid. */
    weeklyKm: number | null;
    weeklyKmError: TrainingErrorKey | null;
    history: TrainingHistory | null;
}

/** Up to 3 integer digits and an optional fraction of 1 or 2 digits: no exponent, sign, hex, trailing dot or thousands separator. */
const WEEKLY_KM_PATTERN = /^\d{0,3}(\.\d{1,2})?$/;

/**
 * The optional training fields. Kept apart from `buildInput` on purpose: a typo here must not blank the main results.
 * A blank distance is simply unknown; an invalid one is an error (the card then withholds its figure instead of guessing).
 */
export function buildTraining(form: FormState): TrainingFields {
    const metric = form.units === 'metric';
    const history = TRAINING_HISTORIES.find((h) => h === form.trainingHistory) ?? null;
    if (blank(form.weeklyKm)) return { weeklyKm: null, weeklyKmError: null, history };
    const text = form.weeklyKm.trim();
    if (WEEKLY_KM_PATTERN.test(text)) {
        const v = Number(text);
        const km = metric ? v : v * KM_PER_MILE;
        if (km <= TRAINING.WEEKLY_KM_MAX + 1e-9) return { weeklyKm: km, weeklyKmError: null, history };
    }
    return { weeklyKm: null, weeklyKmError: metric ? 'training.err.weeklyKm.metric' : 'training.err.weeklyKm.imperial', history };
}

/** What a typed weekly distance means to the Training card: invalid, not entered, or one of the load tiers. */
const weeklyClass = (text: string, units: UnitSystem) => {
    const f = buildTraining({ ...emptyForm, units, weeklyKm: text });
    return f.weeklyKmError ? 'invalid' : classifyLoad(f.weeklyKm);
};

const hundredths = (n: number) => Math.round(n * 100) / 100;

/**
 * Converts the weekly distance for the unit toggle. The tier of the load (and whether the entry is valid) is a safety
 * input, so a display-unit toggle must never move it: 100 km is 62.1371 mi, and a one-decimal "62.1" would read back as
 * 99.94 km, just under the very-high line. Miles keep two decimals; kilometres snap to one decimal when that is within
 * the rounding error of a two-decimal mile value (40 km -> 24.85 mi -> 40 km, not 39.99). If the tidy text still lands
 * in another tier, the nearest hundredth that keeps the tier is used.
 */
export function convertWeeklyDistance(value: string, toImperial: boolean): string {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return value;
    const [from, to]: UnitSystem[] = toImperial ? ['metric', 'imperial'] : ['imperial', 'metric'];
    const exact = toImperial ? n / KM_PER_MILE : n * KM_PER_MILE;
    const tenth = Math.round(exact * 10) / 10;
    const base = hundredths(exact);
    const candidates = [
        ...(!toImperial && Math.abs(tenth - exact) <= 0.005 * KM_PER_MILE ? [tenth] : []),
        base,
        hundredths(base + 0.01),
        hundredths(base - 0.01),
    ];
    const want = weeklyClass(value, from);
    const kept = candidates.find((c) => weeklyClass(String(c), to) === want);
    return String(kept ?? base);
}
