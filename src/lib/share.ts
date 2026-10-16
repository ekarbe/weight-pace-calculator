import type { UnitSystem } from './units';

export interface FormState {
    units: UnitSystem;
    gender: 'male' | 'female' | '';
    height: string;
    weight: string;
    bodyFat: string;
    paceMin: string;
    paceSec: string;
    /** Optional custom race distance, in the selected units (km or miles). */
    distance: string;
    /** Optional target date, YYYY-MM-DD. */
    targetDate: string;
}

export const emptyForm: FormState = {
    units: 'metric', gender: '', height: '', weight: '', bodyFat: '', paceMin: '', paceSec: '', distance: '', targetDate: '',
};

const KEYS: Record<keyof FormState, string> = {
    units: 'u', gender: 'g', height: 'h', weight: 'w', bodyFat: 'bf', paceMin: 'pm', paceSec: 'ps', distance: 'd', targetDate: 'td',
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
        distance: num('d'),
        targetDate: /^\d{4}-\d{2}-\d{2}$/.test(p.get('td') ?? '') ? p.get('td')! : '',
    };
}
