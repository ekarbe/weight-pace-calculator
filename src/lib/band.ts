import {
    calculateWeightPaceEstimates,
    DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM,
    estimateRaceTimeSec,
    minPaceSecFor,
    type ResultRow,
    type UserInput,
} from './calculations';

/**
 * Plausible range for the pace gain per kg lost, in s/km per kg. It covers the healthy case only
 * (mostly fat lost, training and fuelling maintained). Under-fuelled or rapid loss can give no or
 * negative change, which is outside this range and is covered by the disclaimer instead.
 */
export const BAND_LOW_FACTOR = 1;
export const BAND_DEFAULT_FACTOR = 2;
export const BAND_HIGH_FACTOR = 3;

/**
 * Factors of the two band edges. If the user's own factor lies outside [BAND_LOW_FACTOR, BAND_HIGH_FACTOR]
 * the band widens to include it, so the main line is never drawn outside its own range.
 */
export function bandFactors(userFactor: number = BAND_DEFAULT_FACTOR): { low: number; high: number } {
    const f = Number.isFinite(userFactor) ? userFactor : BAND_DEFAULT_FACTOR;
    return { low: Math.min(BAND_LOW_FACTOR, f), high: Math.max(BAND_HIGH_FACTOR, f) };
}

/** One edge of the band at one weight: threshold pace in s/km and the race times it implies, in seconds. */
export interface BandPoint {
    paceSec: number;
    t5kSec: number;
    t10kSec: number;
    tHmSec: number;
    tMSec: number;
}

/** `conservative` uses the low factor (slower), `optimistic` the high factor (faster). */
export interface BandRow {
    conservative: BandPoint;
    optimistic: BandPoint;
}

export interface Band {
    /** The user's own factor (s/km per kg), which drives the main line. */
    factor: number;
    /** Factors (s/km per kg) of the conservative and optimistic edges. */
    lowFactor: number;
    highFactor: number;
    /** One entry per row of `calculateWeightPaceEstimates(input).resultsTable`, same order. */
    rows: BandRow[];
}

export type BandMetric = 'pace' | '5K' | '10K' | 'HM' | 'M' | 'custom';

/** Race times are linear in threshold pace, so an edge is the main row scaled by the pace ratio (exactly the main row when the paces match). */
function point(main: ResultRow, paceSec: number): BandPoint {
    const mainPace = main.estimatedThresholdPaceSec ?? 0;
    const k = mainPace > 0 ? paceSec / mainPace : 1;
    return {
        paceSec,
        t5kSec: (main.estimated5kTimeSec ?? 0) * k,
        t10kSec: (main.estimated10kTimeSec ?? 0) * k,
        tHmSec: (main.estimatedHmTimeSec ?? 0) * k,
        tMSec: (main.estimatedMTimeSec ?? 0) * k,
    };
}

/**
 * Conservative and optimistic estimates for every row of the main table, produced by the same model
 * (same weights, pace cap per sex) with the band's factors instead of the user's. Per row, and for
 * every metric: conservative time >= main time >= optimistic time, with equality at row 0.
 */
export function calculateBand(input: UserInput): Band {
    const userFactor = input.paceFactorSecPerKg ?? DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM;
    const { low, high } = bandFactors(userFactor);
    const main = calculateWeightPaceEstimates(input).resultsTable;
    const paces = (factor: number) =>
        (factor === userFactor ? main : calculateWeightPaceEstimates({ ...input, paceFactorSecPerKg: factor }).resultsTable)
            .map((r) => r.estimatedThresholdPaceSec);
    const slow = paces(low);
    const fast = paces(high);
    const floor = minPaceSecFor(input.gender);
    return {
        factor: userFactor,
        lowFactor: low,
        highFactor: high,
        rows: main.map((row, i) => {
            const mainPace = row.estimatedThresholdPaceSec ?? 0;
            return {
                conservative: point(row, slow[i] ?? mainPace),
                // The model stops generating rows once the raw pace reaches zero; those weights are at the pace cap.
                optimistic: point(row, fast[i] ?? Math.min(floor, mainPace)),
            };
        }),
    };
}

/** Value of `metric` at a band edge: threshold pace in s/km (convert for display) or a race time in seconds. */
export function bandValue(p: BandPoint, metric: BandMetric, customKm: number | null): number {
    switch (metric) {
        case 'pace': return p.paceSec;
        case '5K': return p.t5kSec;
        case '10K': return p.t10kSec;
        case 'HM': return p.tHmSec;
        case 'M': return p.tMSec;
        case 'custom': return estimateRaceTimeSec(p.paceSec, customKm ?? 10);
    }
}

/** Range of time saved against the starting time, from the conservative to the optimistic edge (never negative). */
export function timeSavedRange(baseSec: number, conservativeSec: number, optimisticSec: number): { low: number; high: number } {
    return { low: Math.max(0, baseSec - conservativeSec), high: Math.max(0, baseSec - optimisticSec) };
}
