import type { UserInput } from './calculations';
import type { FormState } from './share';
import { MAX_CUSTOM_DISTANCE_KM, MIN_CUSTOM_DISTANCE_KM } from './calculations';
import { KM_PER_MILE, inToCm, lbToKg, secPerMileToSecPerKm } from './units';
import { deriveRacePace, type RaceErrorKey } from './race-result';
import { TRAINING, TRAINING_HISTORIES, type TrainingHistory } from './training';

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
