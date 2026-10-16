import type { UserInput } from './calculations';
import type { FormState } from './share';
import { inToCm, lbToKg, secPerMileToSecPerKm } from './units';

export interface AdvancedState {
    paceFactor: string;
    bmiFloor: string;
}

export type FieldErrors = Partial<Record<'gender' | 'height' | 'weight' | 'bodyFat' | 'pace' | 'advanced', string>>;

export interface BuiltInput {
    input: UserInput | null;
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
    else if (!(heightCm > 50 && heightCm < 272)) errors.height = metric ? 'Enter 50–272 cm' : 'Enter 20–107 in';

    const w = parseFloat(form.weight);
    const weightKg = metric ? w : lbToKg(w);
    if (blank(form.weight)) missing.push('weight');
    else if (!(weightKg > 20 && weightKg < 400)) errors.weight = metric ? 'Enter 20–400 kg' : 'Enter 45–880 lb';

    let bodyFat: number | null = null;
    if (!blank(form.bodyFat)) {
        const bf = parseFloat(form.bodyFat);
        if (bf >= 5 && bf <= 70) bodyFat = bf;
        else errors.bodyFat = 'If entered, use 5–70%';
    }

    const pm = parseInt(form.paceMin, 10);
    const ps = parseInt(form.paceSec, 10);
    let perKm = NaN;
    if (blank(form.paceMin) || blank(form.paceSec)) missing.push('pace');
    else if (isNaN(pm) || isNaN(ps) || pm < 0 || ps < 0 || ps >= 60 || pm * 60 + ps === 0) errors.pace = 'Enter a valid pace (> 0:00)';
    else {
        const total = pm * 60 + ps;
        perKm = Math.round(metric ? total : secPerMileToSecPerKm(total));
    }

    const factor = parseFloat(adv.paceFactor);
    const floor = parseFloat(adv.bmiFloor);
    if (isNaN(factor) || factor < 0 || factor > 5) errors.advanced = 'Pace gain must be 0–5 s/km per kg';
    else if (isNaN(floor) || floor < 18.5 || floor > 30) errors.advanced = 'BMI floor must be 18.5–30';

    if (missing.length || Object.keys(errors).length || !form.gender) {
        return { input: null, errors, missing };
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
        errors,
        missing,
    };
}
