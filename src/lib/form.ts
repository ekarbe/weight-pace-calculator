import type { UserInput } from './calculations';
import type { FormState } from './share';
import { MAX_CUSTOM_DISTANCE_KM, MIN_CUSTOM_DISTANCE_KM } from './calculations';
import { KM_PER_MILE, inToCm, lbToKg, secPerMileToSecPerKm } from './units';

export interface AdvancedState {
    paceFactor: string;
    bmiFloor: string;
}

/** Values are message keys (see src/i18n/messages), not display text. */
export type FieldErrors = Partial<Record<'gender' | 'height' | 'weight' | 'bodyFat' | 'pace' | 'advanced' | 'distance', ErrorKey>>;

export type ErrorKey =
    | 'err.height.metric' | 'err.height.imperial' | 'err.weight.metric' | 'err.weight.imperial'
    | 'err.bodyFat' | 'err.pace' | 'err.paceFactor' | 'err.bmiFloor'
    | 'err.distance.metric' | 'err.distance.imperial';

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
    if (blank(form.paceMin) || blank(form.paceSec)) missing.push('pace');
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
