import { DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM, DEFAULT_TARGET_BMI_FLOOR, estimateRaceTimeSec, type ResultRow, type UserInput } from './calculations';
import { BAND_HIGH_FACTOR, BAND_LOW_FACTOR } from './band';
import { MAX_PCT_PER_WEEK, planByDate, SUSTAINABLE_PCT_PER_WEEK, type LossRisk } from './plan';
import { KM_PER_MILE, kgToLb, type UnitSystem } from './units';

/**
 * Behavioural constants of the training-load context. The "How this is worked out" panel is generated from
 * this object, so changing a value here changes the text the user reads. Each one is one of:
 *  - SHARED: imported from another module (the band, the Timeline, the main calculation), so the cards cannot drift;
 *  - SAFETY CHOICE: deliberately stricter than the rest of the page;
 *  - ILLUSTRATIVE: a design choice with no outcome data behind it.
 * The rate classes (0.5 and 1.0 % of body weight a week) are not repeated here: they come from plan.ts.
 *
 * RELEASE GATE. Before this card ships on by default: (1) a qualified sports-medicine or sports-dietetics reviewer
 * signs off every ILLUSTRATIVE constant and the support wording; (2) a human opens and checks any literature the
 * rules lean on (none was verified while this was written, which is why the UI cites no source and shows no
 * literature number); (3) native speakers review the de/es/fr withheld, help, signs, scope and pointer strings.
 * STATUS: not met. No sign-off is recorded anywhere. Until it is, the card says what it is (a qualifier that can only
 * lower an estimate or hold it back, not a forecast of what training will give) and states in plain sight, outside the
 * "How this is worked out" panel and also on paper, that its limits are unchecked rules of thumb (`training.caveat`).
 * Record the sign-off here (who, when, which constants) before presenting the card as anything more.
 */
export interface TrainingConstants {
    /** SHARED (band): the lowest pace gain per kg shown (s/km per kg). If the user's own factor is lower, theirs is used. */
    readonly CONSERVATIVE_FACTOR: number;
    /** SHARED (band): a factor above this is counted as this (s/km per kg). An explicit choice of exactly this stands. */
    readonly FACTOR_CEILING: number;
    /** ILLUSTRATIVE: a lowered figure sits this fraction of the way from the lowest factor up to the counted headline factor. Two-level on purpose. */
    readonly REDUCTION_FRACTION: number;
    /** ILLUSTRATIVE: weekly running (km) from which the load counts as high / very high. 50 km is about 7 km a day. */
    readonly HIGH_LOAD_KM: number;
    readonly VERY_HIGH_LOAD_KM: number;
    /** ILLUSTRATIVE: a change under max(TINY_LOSS_KG, TINY_LOSS_PCT % of the entered weight) is within day-to-day swings. */
    readonly TINY_LOSS_KG: number;
    readonly TINY_LOSS_PCT: number;
    /** SHARED convention with print.ts and share-image.ts: below this (kg) there is no change at all. */
    readonly UNCHANGED_KG: number;
    /** SAFETY CHOICE: stricter than the table's Advanced floor (18.5). BMI is a crude, cautious stopping point, never a verdict. */
    readonly BMI_FLOOR: number;
    /** Table rows are rounded to 0.1 kg, so the last row at the floor can sit a hair under the floor BMI. */
    readonly BMI_TOLERANCE: number;
    /** ILLUSTRATIVE (reliability note only, never changes a number): a selected BMI below this, or a change of this many % of body weight or more. */
    readonly LEAN_BMI: number;
    readonly BIG_CHANGE_PCT: number;
    /** Display resolution: times are shown in whole seconds, so a shown conservative figure must not round to 0:00. */
    readonly MIN_SAVING_10K_SEC: number;
    /** Input sanity limit (km). */
    readonly WEEKLY_KM_MAX: number;
    /** The summary sentence uses the same 10 km as the rest of the app. */
    readonly REFERENCE_RACE_KM: number;
}

export const TRAINING: TrainingConstants = Object.freeze({
    CONSERVATIVE_FACTOR: BAND_LOW_FACTOR,
    FACTOR_CEILING: BAND_HIGH_FACTOR,
    REDUCTION_FRACTION: 0.5,
    HIGH_LOAD_KM: 50,
    VERY_HIGH_LOAD_KM: 100,
    TINY_LOSS_KG: 1,
    TINY_LOSS_PCT: 1,
    UNCHANGED_KG: 0.05,
    BMI_FLOOR: DEFAULT_TARGET_BMI_FLOOR,
    BMI_TOLERANCE: 0.05,
    LEAN_BMI: 22,
    BIG_CHANGE_PCT: 10,
    MIN_SAVING_10K_SEC: 0.5,
    WEEKLY_KM_MAX: 250,
    REFERENCE_RACE_KM: 10,
});

/** Tolerance for comparing floating-point values against the boundaries above. */
const EPS = 1e-9;

export const TRAINING_HISTORIES = ['new', 'some', 'veteran'] as const;
export type TrainingHistory = (typeof TRAINING_HISTORIES)[number];

export type LoadTier = 'unknown' | 'normal' | 'high' | 'veryHigh';
export type WithheldReason = 'lowBmi' | 'lowBodyFat' | 'inputError' | 'tooFast' | 'fastAndHeavy';
export type NoteCode = 'assumedRate' | 'addKm' | 'highLoad' | 'bigOrLean';
/** Why a figure was lowered. Listed only when the lowering is visible in the rounded numbers. */
export type ReducedReason = 'brisk' | 'veryHigh' | 'factor';
/** 'none': nothing to compare (no lighter weight selected); 'tiny': a change within day-to-day swings. */
export type IdleKind = 'none' | 'tiny';
/** Which weight is under the BMI line: the entered one, or only the selected scenario. */
export type LowBmiAt = 'current' | 'selected';
/** What the race cards (above the Training card) must say about this scenario. */
export type TrainingPointer = 'none' | 'reduced' | 'withheld';
export type SummaryKind = 'same' | 'flat' | 'reduced' | 'unchecked';

export interface LossRate {
    pct: number;
    risk: LossRisk;
    source: 'targetDate' | 'assumed';
}

export interface TrainingInput {
    /** The ENTERED weight (the table's first row is this weight rounded to 0.1 kg, see `rateStartKg`). */
    startKg: number;
    /** Selected row's weight. */
    targetKg: number;
    /**
     * The table's first weight: the start the Timeline card measures its rate from (the entered weight rounded to
     * 0.1 kg). The pace of weight change is taken from this and `targetKg`, exactly the numbers the Timeline uses,
     * so the two cards cannot put the same plan in different classes. Defaults to `startKg`.
     */
    rateStartKg?: number;
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
    idleKind: IdleKind | null;
    lowBmiAt: LowBmiAt | null;
    /** Whether the supportive help line is shown (every withheld reason except a typo in a field). */
    showHelp: boolean;
    /** Whether the "signs worth raising with a doctor" line is shown: with the help line, or when the figure is visibly lowered. */
    showSigns: boolean;
    /**
     * True when the outputs that leave the page (the share image) must not be made for this scenario: when no estimate
     * is shown, and also when the estimate is lowered, because the picture would carry the higher headline figure
     * (and be read without the card that qualifies it). It is true exactly when `pointer` is not 'none'.
     */
    blocksOutputs: boolean;
    pointer: TrainingPointer;
    /** Set for 'full', 'tooFast' and 'fastAndHeavy': scenario descriptors, not outcome numbers. */
    load: LoadTier;
    rate: LossRate | null;
    /** 'full' only, s/km per kg. `headline` is the user's own factor; the figure never exceeds the counted one. */
    factors: { lowest: number; headline: number; realistic: number } | null;
    /** 'full' only, s/km. */
    gains: { conservative: number; realistic: number; headline: number } | null;
    /** 'full' only, seconds saved over 10 km. */
    savings10k: { conservative: number; realistic: number; headline: number } | null;
    /** The shown figure is visibly lower (by at least a second over 10 km) than the headline estimate. */
    reduced: boolean;
    /** Stable order: brisk, veryHigh, factor. Empty unless `reduced`. */
    reasons: ReducedReason[];
    /** The user's factor is above the ceiling and is counted as the ceiling. */
    factorCapped: boolean;
    /** Stable order: assumedRate, addKm, highLoad, bigOrLean. */
    notes: NoteCode[];
}

/** The lowest factor used for a headline factor `c`: the user's own when it is already lower. */
export const lowestFactor = (c: number, k: TrainingConstants = TRAINING) => Math.min(k.CONSERVATIVE_FACTOR, c);

const positive = (n: number) => Number.isFinite(n) && n > 0;
const bmiOf = (kg: number, heightCm: number) => kg / (heightCm / 100) ** 2;

/** null, NaN, infinite or negative distances are 'unknown'; 0 is a valid, normal load. Boundaries belong to the higher tier. */
export function classifyLoad(km: number | null): LoadTier {
    if (km === null || !Number.isFinite(km) || km < 0) return 'unknown';
    if (km >= TRAINING.VERY_HIGH_LOAD_KM) return 'veryHigh';
    if (km >= TRAINING.HIGH_LOAD_KM) return 'high';
    return 'normal';
}

/**
 * The user's own pace of weight change (the same planByDate and classes as the Timeline card, and the caller
 * passes the same start and lost weight the Timeline does), or the sustainable rate when no valid, future date is set.
 */
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

/** Percent change of pace per 1 % of body weight implied by a factor `c` s/km per kg at weight `kg` and pace `paceSec`. */
export const impliedElasticityPct = (c: number, kg: number, paceSec: number) => (c * kg) / paceSec;

const result = (display: TrainingResult['display'], extra: Partial<TrainingResult> = {}): TrainingResult => ({
    display, withheld: null, idleKind: null, lowBmiAt: null, showHelp: false, showSigns: false, blocksOutputs: false,
    pointer: 'none', load: 'unknown', rate: null, factors: null, gains: null, savings10k: null, reduced: false,
    reasons: [], factorCapped: false, notes: [], ...extra,
});

/** A withheld result shows no number. Every reason but a typo in a field also shows the support lines and blocks the outputs that leave the page. */
const withheld = (reason: WithheldReason, extra: Partial<TrainingResult> = {}): TrainingResult => {
    const typo = reason === 'inputError';
    return result('withheld', {
        withheld: reason,
        showHelp: !typo,
        showSigns: !typo,
        blocksOutputs: !typo,
        pointer: typo ? 'none' : 'withheld',
        ...extra,
    });
};

/**
 * Qualifies the headline pace gain; it can only lower it or withhold it, never raise it.
 * Gates run in this order and the first match wins (a non-'full' result carries no figure and no notes):
 *  1 hidden (unusable input)  2 withheld lowBmi  3 idle  4 hidden (nothing to qualify)  5 withheld lowBodyFat
 *  6 withheld tooFast  7 withheld inputError  8 withheld fastAndHeavy  9 full.
 * tooFast runs before inputError so that a typo never hides the more serious message.
 * `today` is injected so the function stays pure.
 */
export function computeTraining(i: TrainingInput, today: Date): TrainingResult {
    const c = i.centralFactor;
    const S = i.startKg;
    const T = i.targetKg;
    const H = i.heightCm;
    const P0 = i.baselinePaceSec;
    if (![S, T, H, P0, c].every(positive)) return result('hidden');
    const L = S - T;

    // The lighter of the entered and the selected weight, so a runner under the line is never invited to explore.
    const lowLine = TRAINING.BMI_FLOOR - TRAINING.BMI_TOLERANCE - EPS;
    if (bmiOf(Math.min(S, T), H) < lowLine) {
        // With no lighter weight selected there is no weight-based saving to block.
        const scenario = L >= TRAINING.UNCHANGED_KG - EPS;
        return withheld('lowBmi', {
            lowBmiAt: bmiOf(S, H) < lowLine ? 'current' : 'selected',
            blocksOutputs: scenario,
            pointer: scenario ? 'withheld' : 'none',
        });
    }

    if (L < Math.max(TRAINING.TINY_LOSS_KG, (TRAINING.TINY_LOSS_PCT / 100) * S) - EPS) {
        return result('idle', { idleKind: L < TRAINING.UNCHANGED_KG - EPS ? 'none' : 'tiny' });
    }

    // The headline gain, with the main model's pace cap already applied. Used as is: re-deriving it from the
    // 0.1 kg-rounded table weight could land a hair under it and read as a reduction.
    const G = i.headlineGainSecPerKm;
    const lowest = lowestFactor(c);
    const gainAt = (f: number) => (f >= c - EPS ? G : Math.min(f * L, G));
    const saving = (gain: number) => raceSavingSec(P0, gain, TRAINING.REFERENCE_RACE_KM);
    // Written so that a NaN (absurd input) also lands here.
    if (!Number.isFinite(G) || !(G > 0) || !(saving(gainAt(lowest)) >= TRAINING.MIN_SAVING_10K_SEC - EPS)) return result('hidden');

    if (i.rowUnhealthyFat) return withheld('lowBodyFat');

    // Not S and L: the Timeline works from the 0.1 kg table weights, and a hair of difference can cross a class limit.
    const R = positive(i.rateStartKg ?? NaN) ? i.rateStartKg! : S;
    const rate = resolveLossRate(R, R - T, i.targetDate, today);
    const load = classifyLoad(i.weeklyKmInvalid ? null : i.weeklyKm);
    if (rate.risk === 'aggressive') return withheld('tooFast', { rate, load });
    // Never fall back to 'unknown' or 0: the invalid value might have been the heavy one.
    if (i.weeklyKmInvalid) return withheld('inputError');
    if (rate.risk === 'brisk' && (load === 'high' || load === 'veryHigh')) return withheld('fastAndHeavy', { rate, load });

    const factorCapped = c > TRAINING.FACTOR_CEILING + EPS;
    const counted = Math.min(c, TRAINING.FACTOR_CEILING);
    const cut = rate.risk === 'brisk' || load === 'veryHigh';
    const f = cut ? lowest + TRAINING.REDUCTION_FRACTION * (counted - lowest) : counted;
    const gains = { conservative: gainAt(lowest), realistic: gainAt(f), headline: G };
    const savings10k = { conservative: saving(gains.conservative), realistic: saving(gains.realistic), headline: saving(gains.headline) };
    // A cut the runner cannot see in the rounded times is not announced.
    const reduced = Math.round(savings10k.headline) - Math.round(savings10k.realistic) >= 1;

    const reasons: ReducedReason[] = [];
    if (reduced) {
        if (rate.risk === 'brisk') reasons.push('brisk');
        if (load === 'veryHigh') reasons.push('veryHigh');
        if (factorCapped) reasons.push('factor');
    }

    const notes: NoteCode[] = [];
    if (rate.source === 'assumed') notes.push('assumedRate');
    if (load === 'unknown') notes.push('addKm');
    if (load === 'high') notes.push('highLoad');
    if ((L / S) * 100 >= TRAINING.BIG_CHANGE_PCT - EPS || bmiOf(T, H) < TRAINING.LEAN_BMI - EPS) notes.push('bigOrLean');

    return result('full', {
        rate,
        load,
        factors: { lowest, headline: c, realistic: f },
        gains,
        savings10k,
        reduced,
        reasons,
        factorCapped,
        notes,
        showSigns: reduced,
        pointer: reduced ? 'reduced' : 'none',
        blocksOutputs: reduced,
    });
}

/**
 * Which summary sentence applies to a full result: 'reduced' when the figure is visibly lower than the headline;
 * 'unchecked' when nothing could be set against it (no target date, so the pace of weight change is only assumed, and
 * no weekly running), which must not read as a check that passed; 'flat' when the lowest and the shown figure read the
 * same in whole seconds (no "could be as little as" clause); otherwise 'same'. Null for a result without figures.
 */
export function chooseSummary(r: TrainingResult): SummaryKind | null {
    if (r.display !== 'full' || !r.savings10k) return null;
    if (r.reduced) return 'reduced';
    if (r.rate?.source === 'assumed' && r.load === 'unknown') return 'unchecked';
    return Math.round(r.savings10k.conservative) === Math.round(r.savings10k.realistic) ? 'flat' : 'same';
}

/** Rounds UP to one decimal (with float slack), so a printed threshold is never more permissive than the logic. */
export const ceilTenth = (x: number) => Math.ceil(x * 10 - 1e-9) / 10;

export interface ExplainerFigures {
    /** The headline factor and the lowest and highest factors this card counts (s/km per kg). */
    central: number;
    lowest: number;
    ceiling: number;
    /** Percent change of pace per 1 % of body weight at the headline factor. */
    elasticityPct: number;
    /** Rate class limits, % of body weight a week (from the Timeline). */
    sust: number;
    max: number;
    /** Weekly running thresholds in the user's unit (km or mi), rounded up to 0.1. */
    high: number;
    veryHigh: number;
    /** The smallest change that is not treated as a day-to-day swing, in the user's weight unit, rounded up to 0.1. */
    minChange: number;
    bmi: number;
}

/** Every number the "How this is worked out" panel prints, derived from the constants (never typed into the copy). */
export function explainerFigures(
    o: { units: UnitSystem; startKg: number; centralFactor: number; baselinePaceSec: number },
    k: TrainingConstants = TRAINING,
): ExplainerFigures {
    const metric = o.units === 'metric';
    const dist = (km: number) => ceilTenth(metric ? km : km / KM_PER_MILE);
    const minChangeKg = Math.max(k.TINY_LOSS_KG, (k.TINY_LOSS_PCT / 100) * o.startKg);
    return {
        central: o.centralFactor,
        lowest: lowestFactor(o.centralFactor, k),
        ceiling: k.FACTOR_CEILING,
        elasticityPct: impliedElasticityPct(o.centralFactor, o.startKg, o.baselinePaceSec),
        sust: SUSTAINABLE_PCT_PER_WEEK,
        max: MAX_PCT_PER_WEEK,
        high: dist(k.HIGH_LOAD_KM),
        veryHigh: dist(k.VERY_HIGH_LOAD_KM),
        minChange: ceilTenth(metric ? minChangeKg : kgToLb(minChangeKg)),
        bmi: k.BMI_FLOOR,
    };
}

/**
 * Maps the calculator's input and the selected table row to what `computeTraining` needs.
 * `tableStartKg` is the weight of the table's first row, which the Timeline card starts from.
 */
export function trainingInputFor(
    input: UserInput,
    row: ResultRow,
    tableStartKg: number,
    fields: { weeklyKm: number | null; weeklyKmError: string | null },
    targetDate: string,
): TrainingInput {
    const baselinePaceSec = input.thresholdPaceMin * 60 + input.thresholdPaceSec;
    return {
        startKg: input.weightKg,
        rateStartKg: tableStartKg,
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
