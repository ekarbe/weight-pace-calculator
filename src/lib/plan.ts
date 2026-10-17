export type LossRisk = 'sustainable' | 'brisk' | 'aggressive';

/** Common guidance for athletes: up to ~0.5% of body weight per week is sustainable, above ~1% is too fast. */
export const SUSTAINABLE_PCT_PER_WEEK = 0.5;
export const MAX_PCT_PER_WEEK = 1;

export function classifyRate(pctPerWeek: number): LossRisk {
    if (pctPerWeek <= SUSTAINABLE_PCT_PER_WEEK + 1e-9) return 'sustainable';
    if (pctPerWeek <= MAX_PCT_PER_WEEK + 1e-9) return 'brisk';
    return 'aggressive';
}

/** Whole calendar days since the epoch for the local calendar date of `d` (a clock change cannot shift it). */
const dayNumber = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;

/** Parse "YYYY-MM-DD" as a local calendar date (never UTC, so no off-by-one). */
export function parseISODate(iso: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

export function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface RatePlan {
    weeks: number;
    kgPerWeek: number;
    pctPerWeek: number;
    risk: LossRisk;
}

/** Rate needed to lose `lostKg` from `startKg` by `targetISO`. Returns null for an invalid or past date. */
export function planByDate(startKg: number, lostKg: number, targetISO: string, today: Date): RatePlan | null {
    const target = parseISODate(targetISO);
    if (!target || lostKg <= 0 || startKg <= 0) return null;
    // Calendar days, not milliseconds: a 23 or 25 hour day around a clock change must not move a rate across a class limit.
    const weeks = (dayNumber(target) - dayNumber(today)) / 7;
    if (weeks <= 0) return null;
    const kgPerWeek = lostKg / weeks;
    const pctPerWeek = (kgPerWeek / startKg) * 100;
    return { weeks, kgPerWeek, pctPerWeek, risk: classifyRate(pctPerWeek) };
}

/** Earliest date reachable at a given % of body weight per week (default: the sustainable rate). */
export function dateAtRate(startKg: number, lostKg: number, today: Date, pctPerWeek = SUSTAINABLE_PCT_PER_WEEK): { weeks: number; date: Date } | null {
    if (lostKg <= 0 || startKg <= 0 || pctPerWeek <= 0) return null;
    const weeks = lostKg / (startKg * (pctPerWeek / 100));
    const base = startOfDay(today);
    return { weeks, date: new Date(base.getFullYear(), base.getMonth(), base.getDate() + Math.ceil(weeks * 7)) };
}
