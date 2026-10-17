import { MAX_CUSTOM_DISTANCE_KM, MIN_CUSTOM_DISTANCE_KM, RACE_DISTANCES, thresholdPaceFromRace } from './calculations';
import type { FormState } from './share';
import { KM_PER_MILE } from './units';

/** Where the threshold pace comes from: typed in directly, or worked back from a recent race result. */
export const PACE_SOURCES = ['threshold', 'race'] as const;
export type PaceSource = (typeof PACE_SOURCES)[number];

export const RACE_DISTANCE_KEYS = ['5k', '10k', 'hm', 'm', 'custom'] as const;
export type RaceDistanceKey = (typeof RACE_DISTANCE_KEYS)[number];

/** Threshold paces outside this range (s/km) almost certainly come from a mistyped time or distance. */
export const MIN_RACE_THRESHOLD_SEC_PER_KM = 2 * 60;
export const MAX_RACE_THRESHOLD_SEC_PER_KM = 12 * 60;

/** Message keys (see src/i18n/messages); the shared distance range messages are reused. */
export type RaceErrorKey =
    | 'err.distance.metric' | 'err.distance.imperial'
    | 'raceResult.err.time' | 'raceResult.err.pace.metric' | 'raceResult.err.pace.imperial';

export type RaceFormFields = Pick<FormState, 'units' | 'raceDist' | 'raceCustom' | 'raceH' | 'raceM' | 'raceS'>;

export interface RacePace {
    /** Race distance in km, or null while missing or invalid. */
    distanceKm: number | null;
    /** Finishing time in seconds, or null while missing or invalid. */
    timeSec: number | null;
    /**
     * Derived threshold pace in s/km, as it feeds the calculator, or null. Deliberately NOT rounded: the pace is
     * the exact inverse of the race model, so the row for "no weight change" gives back the time that was entered,
     * and toggling the units cannot move it.
     */
    perKm: number | null;
    /** The same pace in the user's units (s/km or s/mi), rounded to whole seconds. Display only: nothing is computed from it. */
    displaySec: number | null;
    /** Fields that are empty (not an error yet). */
    missing: ('raceDistance' | 'raceTime')[];
    errors: { raceDistance?: RaceErrorKey; raceTime?: RaceErrorKey };
}

const blank = (v: string) => v.trim() === '';
const WHOLE = /^\d+$/;
const MAX_HOURS = 99;
const MAX_MINUTES_WITHOUT_HOURS = 999;

export type ParsedRaceTime = { status: 'ok'; sec: number } | { status: 'missing' } | { status: 'invalid' };

/**
 * Hours are optional (blank = 0); minutes and seconds are required, like the typed pace.
 * Whole numbers only, seconds 0-59, minutes 0-59 once hours are entered, and the total must be positive.
 */
export function parseRaceTime(hours: string, minutes: string, seconds: string): ParsedRaceTime {
    const [h, m, s] = [hours.trim(), minutes.trim(), seconds.trim()];
    if ([h, m, s].some((v) => v !== '' && !WHOLE.test(v))) return { status: 'invalid' };
    if (m === '' || s === '') return { status: 'missing' };
    const [hn, mn, sn] = [h === '' ? 0 : Number(h), Number(m), Number(s)];
    if (hn > MAX_HOURS || sn > 59 || mn > (h === '' ? MAX_MINUTES_WITHOUT_HOURS : 59)) return { status: 'invalid' };
    const sec = hn * 3600 + mn * 60 + sn;
    return sec > 0 ? { status: 'ok', sec } : { status: 'invalid' };
}

/** Threshold pace implied by the race fields. Independent of the other form fields. */
export function deriveRacePace(form: RaceFormFields): RacePace {
    const metric = form.units === 'metric';
    const out: RacePace = { distanceKm: null, timeSec: null, perKm: null, displaySec: null, missing: [], errors: {} };

    if (form.raceDist !== 'custom') out.distanceKm = RACE_DISTANCES[form.raceDist];
    else if (blank(form.raceCustom)) out.missing.push('raceDistance');
    else {
        const d = Number(form.raceCustom);
        const km = metric ? d : d * KM_PER_MILE;
        if (km >= MIN_CUSTOM_DISTANCE_KM && km <= MAX_CUSTOM_DISTANCE_KM) out.distanceKm = km;
        else out.errors.raceDistance = metric ? 'err.distance.metric' : 'err.distance.imperial';
    }

    const time = parseRaceTime(form.raceH, form.raceM, form.raceS);
    if (time.status === 'missing') out.missing.push('raceTime');
    else if (time.status === 'invalid') out.errors.raceTime = 'raceResult.err.time';
    else out.timeSec = time.sec;

    if (out.distanceKm !== null && out.timeSec !== null) {
        const exact = thresholdPaceFromRace(out.timeSec, out.distanceKm);
        const displaySec = Math.round(metric ? exact : exact * KM_PER_MILE);
        // The plausible range is judged on the pace as shown, so a pace that reads 2:00 or 12:00 is accepted.
        const shownKm = Math.round(metric ? displaySec : displaySec / KM_PER_MILE);
        if (shownKm < MIN_RACE_THRESHOLD_SEC_PER_KM || shownKm > MAX_RACE_THRESHOLD_SEC_PER_KM) {
            out.errors.raceTime = metric ? 'raceResult.err.pace.metric' : 'raceResult.err.pace.imperial';
        } else {
            out.perKm = exact;
            out.displaySec = displaySec;
        }
    }
    return out;
}

/**
 * Converts the custom race distance for the unit toggle, so the derived pace does not drift when toggling
 * back and forth. Miles keep two decimals; kilometres snap to one decimal when that is within the
 * rounding error of a two-decimal mile value (12 km -> 7.46 mi -> 12 km, not 12.01).
 */
export function convertRaceDistance(value: string, toImperial: boolean): string {
    const n = parseFloat(value);
    if (!isFinite(n)) return value;
    if (toImperial) return String(Math.round((n / KM_PER_MILE) * 100) / 100);
    const km = n * KM_PER_MILE;
    const oneDecimal = Math.round(km * 10) / 10;
    return String(Math.abs(oneDecimal - km) <= 0.005 * KM_PER_MILE ? oneDecimal : Math.round(km * 100) / 100);
}
