import type { UnitSystem } from './units';
import { RACE_DISTANCE_KEYS, type PaceSource, type RaceDistanceKey } from './race-result';
import { TRAINING_HISTORIES, type TrainingHistory } from './training';

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
    /** Whether the threshold pace is typed in or derived from a recent race result. */
    paceSource: PaceSource;
    /** Distance of that race: a preset, or 'custom' (then `raceCustom`, in the selected units). */
    raceDist: RaceDistanceKey;
    raceCustom: string;
    /** Finishing time parts; hours are optional. */
    raceH: string;
    raceM: string;
    raceS: string;
    /** Optional average weekly running distance, in the selected units (km or miles). */
    weeklyKm: string;
    /** Optional running history; only selects a context sentence in the training card. */
    trainingHistory: '' | TrainingHistory;
}

export const emptyForm: FormState = {
    units: 'metric', gender: '', height: '', weight: '', bodyFat: '', paceMin: '', paceSec: '', distance: '', targetDate: '',
    paceSource: 'threshold', raceDist: '5k', raceCustom: '', raceH: '', raceM: '', raceS: '',
    weeklyKm: '', trainingHistory: '',
};

const KEYS: Record<keyof FormState, string> = {
    units: 'u', gender: 'g', height: 'h', weight: 'w', bodyFat: 'bf', paceMin: 'pm', paceSec: 'ps', distance: 'd', targetDate: 'td',
    paceSource: 'pace', raceDist: 'rd', raceCustom: 'rdc', raceH: 'rth', raceM: 'rtm', raceS: 'rts',
    weeklyKm: 'wk', trainingHistory: 'th',
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
    const digits = (k: string, maxLength: number) => {
        const v = p.get(k) ?? '';
        return v.length <= maxLength && /^\d*$/.test(v) ? v : '';
    };
    const raceH = digits('rth', 2);
    const raceM = digits('rtm', 3);
    const raceS = digits('rts', 2);
    return {
        units: p.get('u') === 'imperial' ? 'imperial' : 'metric',
        gender: g === 'male' || g === 'female' ? g : '',
        height: num('h'), weight: num('w'), bodyFat: num('bf'), paceMin: num('pm'), paceSec: num('ps'),
        distance: num('d'),
        targetDate: /^\d{4}-\d{2}-\d{2}$/.test(p.get('td') ?? '') ? p.get('td')! : '',
        paceSource: p.get('pace') === 'race' ? 'race' : 'threshold',
        raceDist: RACE_DISTANCE_KEYS.find((k) => k === p.get('rd')) ?? emptyForm.raceDist,
        raceCustom: num('rdc'),
        raceH,
        // Seconds are 0-59, and so are minutes once hours are given (see parseRaceTime).
        raceM: raceH !== '' && Number(raceM) > 59 ? '' : raceM,
        raceS: Number(raceS) > 59 ? '' : raceS,
        weeklyKm: num('wk'),
        trainingHistory: TRAINING_HISTORIES.find((k) => k === p.get('th')) ?? '',
    };
}
