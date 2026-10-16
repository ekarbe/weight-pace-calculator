import type { UnitSystem } from './units';

export interface FormState {
    units: UnitSystem;
    gender: 'male' | 'female' | '';
    height: string;
    weight: string;
    bodyFat: string;
    paceMin: string;
    paceSec: string;
}

export const emptyForm: FormState = {
    units: 'metric', gender: '', height: '', weight: '', bodyFat: '', paceMin: '', paceSec: '',
};

const KEYS: Record<keyof FormState, string> = {
    units: 'u', gender: 'g', height: 'h', weight: 'w', bodyFat: 'bf', paceMin: 'pm', paceSec: 'ps',
};

export function encodeForm(f: FormState): string {
    const p = new URLSearchParams();
    (Object.keys(KEYS) as (keyof FormState)[]).forEach((k) => {
        if (f[k] !== '' && f[k] !== emptyForm[k]) p.set(KEYS[k], f[k]);
    });
    return p.toString();
}

export function decodeForm(query: string): FormState {
    const p = new URLSearchParams(query);
    const num = (k: string) => {
        const v = p.get(k) ?? '';
        return /^\d{0,4}(\.\d{0,2})?$/.test(v) ? v : '';
    };
    const g = p.get('g');
    return {
        units: p.get('u') === 'imperial' ? 'imperial' : 'metric',
        gender: g === 'male' || g === 'female' ? g : '',
        height: num('h'), weight: num('w'), bodyFat: num('bf'), paceMin: num('pm'), paceSec: num('ps'),
    };
}
