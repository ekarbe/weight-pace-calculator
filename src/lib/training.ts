import { DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM, DEFAULT_TARGET_BMI_FLOOR, estimateRaceTimeSec, type ResultRow, type UserInput } from './calculations';
import { BAND_LOW_FACTOR } from './band';
import { planByDate, SUSTAINABLE_PCT_PER_WEEK, type LossRisk } from './plan';

/**
 * Behavioural constants of the training-load context. The "How this is worked out" panel is generated
 * from this object. Everything marked ILLUSTRATIVE is a design choice, not a measurement, and has not been
 * validated against outcomes.
 *
 * RELEASE GATE. Before this card ships: (1) a qualified sports-medicine or sports-dietetics reviewer signs off
 * every ILLUSTRATIVE constant (50/100 km, the halfway cut, 1 kg, the BMI 20 gate and its tolerance);
 * (2) a native speaker reviews the de/es/fr withheld, help and signs strings for tone and banned vocabulary;
 * (3) any literature behind these rules is opened and checked by a human. None was verified while this was
 * written, which is why the UI cites no source and shows no literature number.
 */
export const TRAINING = {
    /** Lowest pace gain per kg lost (s/km per kg), shared with the uncertainty band. If the user's own factor is lower, theirs is used. */
    CONSERVATIVE_FACTOR: BAND_LOW_FACTOR,
    /** ILLUSTRATIVE: a reduction cuts this fraction of the way from the headline factor down to the conservative one. */
    REDUCTION_FRACTION: 0.5,
    /** ILLUSTRATIVE: weekly running distance (km) from which the load counts as high / very high. */
    HIGH_LOAD_KM: 50,
    VERY_HIGH_LOAD_KM: 100,
    /** ILLUSTRATIVE: below this loss (kg) a weekly rate means little, so "too fast" is treated as "brisk". */
    RATE_RULES_MIN_LOSS_KG: 1,
    /** Same gate as the Timeline card: smaller changes show no context at all. */
    MIN_LOSS_KG: 0.25,
    /** Stricter than the table, whose Advanced BMI floor can go down to 18.5. Deliberate. */
    BMI_FLOOR: DEFAULT_TARGET_BMI_FLOOR,
    /** Table rows are rounded to 0.1 kg, so the last row at the floor can sit a hair under the floor BMI. */
    BMI_TOLERANCE: 0.05,
    /** ILLUSTRATIVE (reliability note only): a target BMI below this, or a change of this many % of body weight or more. */
    LEAN_BMI: 22,
    BIG_CHANGE_PCT: 10,
    /** ILLUSTRATIVE: a change under max(TINY_LOSS_KG, TINY_LOSS_PCT % of body weight) is within day-to-day swings. */
    TINY_LOSS_KG: 1,
    TINY_LOSS_PCT: 1,
    /** Below this pace gain (s/km, about 0.5 s over 10 km) there is nothing to qualify. */
    MIN_HEADLINE_GAIN_SEC_PER_KM: 0.05,
    /** Input sanity limit. */
    WEEKLY_KM_MAX: 250,
    /** The summary sentence uses the same 10 km as the rest of the app. */
    REFERENCE_RACE_KM: 10,
} as const;

/** Tolerance for comparing floating-point values against the boundaries above. */
const EPS = 1e-9;

export const TRAINING_HISTORIES = ['new', 'some', 'veteran'] as const;
export type TrainingHistory = (typeof TRAINING_HISTORIES)[number];

export type LoadTier = 'unknown' | 'normal' | 'high' | 'veryHigh';
export type WithheldReason = 'lowBmi' | 'lowBodyFat' | 'inputError' | 'tooFast' | 'fastAndHeavy';
export type NoteCode = 'assumedRate' | 'addKm' | 'bigOrLean' | 'tiny';

export interface LossRate {
    pct: number;
    /** The real class from the Timeline card, even when a loss under 1 kg is treated as brisk. */
    risk: LossRisk;
    source: 'targetDate' | 'assumed';
}

export interface TrainingInput {
    /** The ENTERED weight. Not rows[0]: when it is below the BMI floor, rows[0] is the heavier floor weight. */
    startKg: number;
    /** Selected row's weight. */
    targetKg: number;
    heightCm: number;
    /** Entered threshold pace, s/km. */
    baselinePaceSec: number;
    /** Entered pace minus the selected row's pace: the main model's gain, already including its pace cap. */
    headlineGainSecPerKm: number;
    /** The headline pace factor, s/km per kg. */
    centralFactor: number;
    rowUnhealthyFat: boolean;
    /** Canonical km; null when blank or invalid. */
    weeklyKm: number | null;
    weeklyKmInvalid: boolean;
    /** '' or YYYY-MM-DD. */
    targetDate: string;
}

export interface TrainingResult {
    display: 'hidden' | 'idle' | 'withheld' | 'full';
    withheld: WithheldReason | null;
    /** Whether the supportive help line is shown (every withheld reason except a typo in a field). */
    showHelp: boolean;
    load: LoadTier;
    rate: LossRate | null;
    /** 'full' only, s/km per kg. */
    factors: { lowest: number; headline: number; realistic: number } | null;
    /** 'full' only, s/km. */
    gains: { conservative: number; realistic: number; headline: number } | null;
    /** 'full' only, seconds saved over 10 km. */
    savings10k: { conservative: number; realistic: number; headline: number } | null;
    reduced: boolean;
    reducedBy: 'brisk' | 'veryHigh' | null;
    /** Stable order: assumedRate, addKm, bigOrLean, tiny. */
    notes: NoteCode[];
}

/** The lowest factor used for a headline factor `c`: the user's own when it is already lower. */
export const lowestFactor = (c: number) => Math.min(TRAINING.CONSERVATIVE_FACTOR, c);

const positive = (n: number) => Number.isFinite(n) && n > 0;
const bmiOf = (kg: number, heightCm: number) => kg / (heightCm / 100) ** 2;

/** null, NaN, infinite or negative distances are 'unknown'; 0 is a valid, normal load. Boundaries belong to the higher tier. */
export function classifyLoad(km: number | null): LoadTier {
    if (km === null || !Number.isFinite(km) || km < 0) return 'unknown';
    if (km >= TRAINING.VERY_HIGH_LOAD_KM) return 'veryHigh';
    if (km >= TRAINING.HIGH_LOAD_KM) return 'high';
    return 'normal';
}

/** The user's own pace of weight change, or the sustainable rate when no (valid, future) date is set. */
export function resolveLossRate(startKg: number, lostKg: number, targetISO: string, today: Date): LossRate {
    const p = planByDate(startKg, lostKg, targetISO, today);
    return p
        ? { pct: p.pctPerWeek, risk: p.risk, source: 'targetDate' }
        : { pct: SUSTAINABLE_PCT_PER_WEEK, risk: 'sustainable', source: 'assumed' };
}

/** Seconds saved over `km` by a pace gain, computed with the same model as the race cards. */
export function raceSavingSec(baselinePaceSec: number, gainSecPerKm: number, km: number): number {
    return estimateRaceTimeSec(baselinePaceSec, km) - estimateRaceTimeSec(baselinePaceSec - gainSecPerKm, km);
}

const result = (display: TrainingResult['display'], extra: Partial<TrainingResult> = {}): TrainingResult => ({
    display, withheld: null, showHelp: false, load: 'unknown', rate: null,
    factors: null, gains: null, savings10k: null, reduced: false, reducedBy: null, notes: [], ...extra,
});

const withheld = (reason: WithheldReason, extra: Partial<TrainingResult> = {}): TrainingResult =>
    result('withheld', { withheld: reason, showHelp: reason !== 'inputError', ...extra });

/**
 * Qualifies the headline pace gain; it can only lower it or withhold it, never raise it.
 * Gates run in this order and the first match wins (no number leaks from a non-'full' result):
 * hidden, lowBmi, idle, hidden (nothing to qualify), lowBodyFat, inputError, tooFast, fastAndHeavy, full.
 */
export function computeTraining(i: TrainingInput, today: Date): TrainingResult {
    const c = i.centralFactor;
    if (![i.startKg, i.targetKg, i.heightCm, i.baselinePaceSec, c].every(positive)) return result('hidden');

    // The lighter of the entered and the selected weight, so an underweight runner is never invited to explore.
    if (bmiOf(Math.min(i.startKg, i.targetKg), i.heightCm) < TRAINING.BMI_FLOOR - TRAINING.BMI_TOLERANCE - EPS) return withheld('lowBmi');

    const lost = i.startKg - i.targetKg;
    if (lost < TRAINING.MIN_LOSS_KG - EPS) return result('idle');

    const headline = Math.max(0, i.headlineGainSecPerKm);
    if (!(headline >= TRAINING.MIN_HEADLINE_GAIN_SEC_PER_KM)) return result('hidden');

    if (i.rowUnhealthyFat) return withheld('lowBodyFat');
    // Never fall back to 'unknown': the invalid value might have been the heavy one.
    if (i.weeklyKmInvalid) return withheld('inputError');

    const rate = resolveLossRate(i.startKg, lost, i.targetDate, today);
    const load = classifyLoad(i.weeklyKm);
    const effective: LossRisk = rate.risk === 'aggressive' && lost < TRAINING.RATE_RULES_MIN_LOSS_KG - EPS ? 'brisk' : rate.risk;

    if (effective === 'aggressive') return withheld('tooFast', { rate, load });
    if (effective === 'brisk' && (load === 'high' || load === 'veryHigh')) return withheld('fastAndHeavy', { rate, load });

    const lowest = lowestFactor(c);
    const reduce = effective === 'brisk' || load === 'veryHigh';
    const realisticFactor = reduce ? lowest + (c - lowest) * TRAINING.REDUCTION_FRACTION : c;
    // The headline is the gain at factor c with the main model's pace cap already applied, so it is used as is
    // (re-deriving it from the rounded table weight could land a hair under it). Lower factors are bounded by it.
    const gainAt = (factor: number) => (factor >= c ? headline : Math.min(factor * lost, headline));
    const gains = { conservative: gainAt(lowest), realistic: gainAt(realisticFactor), headline };
    const saving = (gain: number) => raceSavingSec(i.baselinePaceSec, gain, TRAINING.REFERENCE_RACE_KM);
    const reduced = gains.realistic < headline - EPS;

    const notes: NoteCode[] = [];
    if (rate.source === 'assumed') notes.push('assumedRate');
    if (load === 'unknown') notes.push('addKm');
    if ((lost / i.startKg) * 100 >= TRAINING.BIG_CHANGE_PCT - EPS || bmiOf(i.targetKg, i.heightCm) < TRAINING.LEAN_BMI - EPS) notes.push('bigOrLean');
    if (lost < Math.max(TRAINING.TINY_LOSS_KG, (TRAINING.TINY_LOSS_PCT / 100) * i.startKg) - EPS) notes.push('tiny');

    return result('full', {
        rate,
        load,
        factors: { lowest, headline: c, realistic: realisticFactor },
        gains,
        savings10k: { conservative: saving(gains.conservative), realistic: saving(gains.realistic), headline: saving(gains.headline) },
        reduced,
        reducedBy: reduced ? (effective === 'brisk' ? 'brisk' : 'veryHigh') : null,
        notes,
    });
}

/** Maps the calculator's input and the selected table row to what `computeTraining` needs. */
export function trainingInputFor(
    input: UserInput,
    row: ResultRow,
    fields: { weeklyKm: number | null; weeklyKmError: string | null },
    targetDate: string,
): TrainingInput {
    const baselinePaceSec = input.thresholdPaceMin * 60 + input.thresholdPaceSec;
    return {
        startKg: input.weightKg,
        targetKg: row.targetWeightKg,
        heightCm: input.heightCm,
        baselinePaceSec,
        headlineGainSecPerKm: row.estimatedThresholdPaceSec == null ? 0 : baselinePaceSec - row.estimatedThresholdPaceSec,
        centralFactor: input.paceFactorSecPerKg ?? DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM,
        rowUnhealthyFat: row.isPotentiallyUnhealthyFat,
        weeklyKm: fields.weeklyKm,
        weeklyKmInvalid: fields.weeklyKmError !== null,
        targetDate,
    };
}
