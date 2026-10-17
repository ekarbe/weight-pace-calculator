import { describe, expect, it } from 'vitest';
import {
    BAND_DEFAULT_FACTOR,
    BAND_HIGH_FACTOR,
    BAND_LINEAR_LIMIT_KG,
    BAND_LOW_FACTOR,
    bandFactors,
    bandValue,
    calculateBand,
    timeSavedRange,
    type BandMetric,
    type BandPoint,
} from './band';
import {
    calculateWeightPaceEstimates,
    DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM,
    estimateRaceTimeSec,
    minPaceSecFor,
    type ResultRow,
    type UserInput,
} from './calculations';

const base: UserInput = {
    gender: 'male',
    heightCm: 180,
    weightKg: 80,
    bodyFatPercentage: null,
    thresholdPaceMin: 4,
    thresholdPaceSec: 30,
};

const METRICS: BandMetric[] = ['pace', '5K', '10K', 'HM', 'M', 'custom'];

function mainValue(r: ResultRow, metric: BandMetric, customKm: number): number {
    const pace = r.estimatedThresholdPaceSec ?? 0;
    switch (metric) {
        case 'pace': return pace;
        case '5K': return r.estimated5kTimeSec ?? 0;
        case '10K': return r.estimated10kTimeSec ?? 0;
        case 'HM': return r.estimatedHmTimeSec ?? 0;
        case 'M': return r.estimatedMTimeSec ?? 0;
        case 'custom': return estimateRaceTimeSec(pace, customKm);
    }
}

const edgeValue = (p: BandPoint, metric: BandMetric, customKm: number) => bandValue(p, metric, customKm);

describe('constants', () => {
    it('are the researched 1 / 2 / 3 s/km per kg, in order', () => {
        expect([BAND_LOW_FACTOR, BAND_DEFAULT_FACTOR, BAND_HIGH_FACTOR]).toEqual([1, 2, 3]);
    });
    it('keep the default in step with the model default', () => {
        expect(BAND_DEFAULT_FACTOR).toBe(DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM);
    });
    it('name roughly 10 kg as where a constant gain per kg stops being a good approximation', () => {
        expect(BAND_LINEAR_LIMIT_KG).toBe(10);
    });
});

describe('bandFactors', () => {
    it('uses the fixed band when the factor is inside it, or missing', () => {
        expect(bandFactors()).toEqual({ low: 1, high: 3 });
        expect(bandFactors(2)).toEqual({ low: 1, high: 3 });
        expect(bandFactors(1)).toEqual({ low: 1, high: 3 });
        expect(bandFactors(3)).toEqual({ low: 1, high: 3 });
    });
    it('widens to include a factor outside the band', () => {
        expect(bandFactors(4.5)).toEqual({ low: 1, high: 4.5 });
        expect(bandFactors(0.4)).toEqual({ low: 0.4, high: 3 });
        expect(bandFactors(0)).toEqual({ low: 0, high: 3 });
    });
    it('ignores a non-finite factor', () => {
        expect(bandFactors(NaN)).toEqual({ low: 1, high: 3 });
    });
});

describe('calculateBand', () => {
    it('has one entry per row of the main table and equals the main table at row 0', () => {
        const rows = calculateWeightPaceEstimates(base).resultsTable;
        const band = calculateBand(base);
        expect(band.rows).toHaveLength(rows.length);
        expect(band.factor).toBe(2);
        expect(band.lowFactor).toBe(1);
        expect(band.highFactor).toBe(3);
        for (const m of METRICS) {
            expect(edgeValue(band.rows[0].conservative, m, 15)).toBe(mainValue(rows[0], m, 15));
            expect(edgeValue(band.rows[0].optimistic, m, 15)).toBe(mainValue(rows[0], m, 15));
        }
    });

    it('gives the same paces as running the model with the band factors', () => {
        const band = calculateBand(base);
        const slow = calculateWeightPaceEstimates({ ...base, paceFactorSecPerKg: 1 }).resultsTable;
        const fast = calculateWeightPaceEstimates({ ...base, paceFactorSecPerKg: 3 }).resultsTable;
        band.rows.forEach((r, i) => {
            expect(r.conservative.paceSec).toBe(slow[i].estimatedThresholdPaceSec);
            expect(r.optimistic.paceSec).toBe(fast[i].estimatedThresholdPaceSec);
            expect(r.conservative.t10kSec).toBeCloseTo(slow[i].estimated10kTimeSec!, 6);
            expect(r.optimistic.tMSec).toBeCloseTo(fast[i].estimatedMTimeSec!, 6);
        });
    });

    it('spans exactly half and one-and-a-half times the default gain', () => {
        const band = calculateBand(base);
        const i = 10; // 5 kg lost, no cap involved
        expect(band.rows[i].conservative.paceSec).toBe(270 - 5 * 1);
        expect(band.rows[i].optimistic.paceSec).toBe(270 - 5 * 3);
        expect(calculateWeightPaceEstimates(base).resultsTable[i].estimatedThresholdPaceSec).toBe(270 - 5 * 2);
    });

    it('keeps conservative >= main >= optimistic for every row and metric, with equality at row 0', () => {
        const inputs: UserInput[] = [];
        for (const gender of ['male', 'female'] as const) {
            for (const [min, sec] of [[3, 0], [4, 30], [6, 15], [9, 0]]) {
                for (const [heightCm, weightKg] of [[160, 55], [175, 72], [185, 120]]) {
                    for (const factor of [undefined, 0, 0.5, 1, 2, 2.5, 3, 4, 5]) {
                        inputs.push({ gender, heightCm, weightKg, bodyFatPercentage: null, thresholdPaceMin: min, thresholdPaceSec: sec, paceFactorSecPerKg: factor });
                    }
                }
            }
        }
        for (const input of inputs) {
            const rows = calculateWeightPaceEstimates(input).resultsTable;
            const band = calculateBand(input);
            expect(band.rows).toHaveLength(rows.length);
            rows.forEach((row, i) => {
                for (const m of METRICS) {
                    const main = mainValue(row, m, 15);
                    expect(edgeValue(band.rows[i].conservative, m, 15), `${m} row ${i}`).toBeGreaterThanOrEqual(main);
                    expect(edgeValue(band.rows[i].optimistic, m, 15), `${m} row ${i}`).toBeLessThanOrEqual(main);
                    if (i === 0) {
                        expect(edgeValue(band.rows[0].conservative, m, 15)).toBe(main);
                        expect(edgeValue(band.rows[0].optimistic, m, 15)).toBe(main);
                    }
                }
            });
        }
    });

    it('keeps the order, as a zero-width band, when the entered weight is already below the BMI floor', () => {
        // 170 cm at 50 kg is BMI 17.3: the table's only row is the heavier floor weight, so no weight is "lost".
        for (const input of [
            { ...base, gender: 'female' as const, heightCm: 170, weightKg: 50, thresholdPaceMin: 5, thresholdPaceSec: 0 },
            { ...base, gender: 'male' as const, heightCm: 180, weightKg: 55, thresholdPaceMin: 4, thresholdPaceSec: 0, paceFactorSecPerKg: 3.5 },
            { ...base, heightCm: 175, weightKg: 60, bmiFloor: 25 },
        ]) {
            const rows = calculateWeightPaceEstimates(input).resultsTable;
            expect(rows[0].targetWeightKg).toBeGreaterThan(input.weightKg);
            const band = calculateBand(input);
            band.rows.forEach((r, i) => {
                for (const m of METRICS) {
                    const main = mainValue(rows[i], m, 15);
                    expect(edgeValue(r.conservative, m, 15), `${m} row ${i}`).toBeGreaterThanOrEqual(main);
                    expect(edgeValue(r.optimistic, m, 15), `${m} row ${i}`).toBeLessThanOrEqual(main);
                    expect(edgeValue(r.conservative, m, 15)).toBe(main);
                    expect(edgeValue(r.optimistic, m, 15)).toBe(main);
                }
            });
        }
    });

    it('keeps conservative >= main >= optimistic over a sweep of inputs, including weights below the floor', () => {
        let below = 0;
        for (let w = 40; w <= 130; w += 3) {
            for (const heightCm of [155, 170, 190]) {
                for (const factor of [undefined, 0.5, 2, 3.5]) {
                    const input: UserInput = { ...base, gender: 'female', heightCm, weightKg: w, thresholdPaceMin: 5, thresholdPaceSec: 12, paceFactorSecPerKg: factor };
                    const rows = calculateWeightPaceEstimates(input).resultsTable;
                    if (rows.length > 0 && rows[0].targetWeightKg > w) below++;
                    calculateBand(input).rows.forEach((r, i) => {
                        expect(r.conservative.paceSec).toBeGreaterThanOrEqual(rows[i].estimatedThresholdPaceSec!);
                        expect(r.optimistic.paceSec).toBeLessThanOrEqual(rows[i].estimatedThresholdPaceSec!);
                        expect(r.conservative.t10kSec).toBeGreaterThanOrEqual(r.optimistic.t10kSec);
                    });
                }
            }
        }
        expect(below).toBeGreaterThan(10);
    });

    it('never gets slower as weight drops, on either edge', () => {
        const band = calculateBand(base);
        for (let i = 1; i < band.rows.length; i++) {
            for (const m of METRICS) {
                expect(edgeValue(band.rows[i].conservative, m, 12)).toBeLessThanOrEqual(edgeValue(band.rows[i - 1].conservative, m, 12));
                expect(edgeValue(band.rows[i].optimistic, m, 12)).toBeLessThanOrEqual(edgeValue(band.rows[i - 1].optimistic, m, 12));
            }
        }
    });

    it('applies the pace cap per sex to the optimistic edge', () => {
        const fast: UserInput = { ...base, thresholdPaceMin: 3, thresholdPaceSec: 5 };
        const male = calculateBand(fast);
        const female = calculateBand({ ...fast, gender: 'female' });
        const last = (b: typeof male) => b.rows[b.rows.length - 1];
        expect(last(male).optimistic.paceSec).toBe(minPaceSecFor('male'));
        expect(last(male).optimistic.paceSec).toBe(160);
        expect(last(female).optimistic.paceSec).toBe(minPaceSecFor('female'));
        expect(last(female).optimistic.paceSec).toBe(180);
        for (const b of [male, female]) for (const r of b.rows) {
            expect(r.optimistic.paceSec).toBeGreaterThanOrEqual(minPaceSecFor(b === male ? 'male' : 'female'));
            expect(r.conservative.paceSec).toBeGreaterThanOrEqual(r.optimistic.paceSec);
        }
        // the cap also scales the race times, so a capped edge cannot undercut the cap
        expect(last(male).optimistic.t5kSec).toBeCloseTo(160 * 0.95 * 5, 6);
    });

    it('collapses the optimistic edge onto the main line where both are capped', () => {
        const rows = calculateWeightPaceEstimates({ ...base, thresholdPaceMin: 2, thresholdPaceSec: 45 }).resultsTable;
        const band = calculateBand({ ...base, thresholdPaceMin: 2, thresholdPaceSec: 45 });
        const i = rows.length - 1;
        expect(rows[i].paceLimited).toBe(true);
        expect(band.rows[i].optimistic.paceSec).toBe(rows[i].estimatedThresholdPaceSec);
        expect(band.rows[i].optimistic.t10kSec).toBe(rows[i].estimated10kTimeSec);
    });

    it('treats weights where the raw optimistic pace is non-positive as capped, not as missing', () => {
        // 200 kg to BMI 20 is 120 kg lost: 300 - 3 * 120 < 0 stops the high-factor model early, but the main model (factor 2) continues.
        const heavy: UserInput = { ...base, heightCm: 200, weightKg: 200, thresholdPaceMin: 5, thresholdPaceSec: 0 };
        const rows = calculateWeightPaceEstimates(heavy).resultsTable;
        const short = calculateWeightPaceEstimates({ ...heavy, paceFactorSecPerKg: 3 }).resultsTable;
        expect(short.length).toBeLessThan(rows.length);
        const band = calculateBand(heavy);
        expect(band.rows).toHaveLength(rows.length);
        const tail = band.rows[rows.length - 1];
        expect(tail.optimistic.paceSec).toBe(160);
        expect(tail.optimistic.paceSec).toBeLessThanOrEqual(rows[rows.length - 1].estimatedThresholdPaceSec!);
        expect(tail.optimistic.t10kSec).toBeLessThanOrEqual(rows[rows.length - 1].estimated10kTimeSec!);
        expect(tail.optimistic.t10kSec).toBeGreaterThan(0);
    });

    it('supports a custom distance through the same race-time model', () => {
        const band = calculateBand(base);
        const rows = calculateWeightPaceEstimates(base).resultsTable;
        const i = 12;
        for (const km of [1, 3, 15, 30, 100]) {
            expect(bandValue(band.rows[i].conservative, 'custom', km)).toBe(estimateRaceTimeSec(band.rows[i].conservative.paceSec, km));
            expect(bandValue(band.rows[i].optimistic, 'custom', km)).toBeLessThan(estimateRaceTimeSec(rows[i].estimatedThresholdPaceSec!, km));
            expect(bandValue(band.rows[i].conservative, 'custom', km)).toBeGreaterThan(estimateRaceTimeSec(rows[i].estimatedThresholdPaceSec!, km));
        }
        // a custom distance equal to a standard race agrees with that race's column
        expect(bandValue(band.rows[i].optimistic, 'custom', 10)).toBeCloseTo(band.rows[i].optimistic.t10kSec, 6);
        expect(bandValue(band.rows[i].optimistic, 'custom', 5)).toBeCloseTo(band.rows[i].optimistic.t5kSec, 6);
        expect(bandValue(band.rows[i].optimistic, 'custom', null)).toBeCloseTo(band.rows[i].optimistic.t10kSec, 6);
    });

    it('widens the band to include a user factor above the high value', () => {
        const input = { ...base, paceFactorSecPerKg: 4 };
        const rows = calculateWeightPaceEstimates(input).resultsTable;
        const band = calculateBand(input);
        expect(band.factor).toBe(4);
        expect(band.highFactor).toBe(4);
        expect(band.lowFactor).toBe(1);
        rows.forEach((row, i) => {
            for (const m of METRICS) {
                expect(edgeValue(band.rows[i].optimistic, m, 15)).toBe(mainValue(row, m, 15));
            }
            expect(band.rows[i].conservative.paceSec).toBeGreaterThanOrEqual(row.estimatedThresholdPaceSec!);
        });
        expect(band.rows.at(-1)!.conservative.paceSec).toBeGreaterThan(rows.at(-1)!.estimatedThresholdPaceSec!);
    });

    it('widens the band to include a user factor below the low value', () => {
        const input = { ...base, paceFactorSecPerKg: 0.5 };
        const rows = calculateWeightPaceEstimates(input).resultsTable;
        const band = calculateBand(input);
        expect(band.lowFactor).toBe(0.5);
        expect(band.highFactor).toBe(3);
        rows.forEach((row, i) => {
            for (const m of METRICS) {
                expect(edgeValue(band.rows[i].conservative, m, 15)).toBe(mainValue(row, m, 15));
            }
        });
        expect(band.rows.at(-1)!.optimistic.paceSec).toBeLessThan(rows.at(-1)!.estimatedThresholdPaceSec!);
    });

    it('is a zero-width band with a zero factor only on the conservative side', () => {
        const band = calculateBand({ ...base, paceFactorSecPerKg: 0 });
        expect(band.lowFactor).toBe(0);
        expect(band.rows.every((r) => r.conservative.paceSec === 270)).toBe(true);
        expect(band.rows.at(-1)!.optimistic.paceSec).toBeLessThan(270);
    });

    it('returns no rows when the model returns none', () => {
        expect(calculateBand({ ...base, thresholdPaceMin: 0, thresholdPaceSec: 0 }).rows).toEqual([]);
        expect(calculateBand({ ...base, gender: '' }).rows).toEqual([]);
        expect(calculateBand({ ...base, weightKg: 0 }).rows).toEqual([]);
    });

    it('does not change its input', () => {
        const input = Object.freeze({ ...base });
        expect(() => calculateBand(input)).not.toThrow();
    });

    it('works with a body-fat entry that stops the table early', () => {
        const input: UserInput = { ...base, bodyFatPercentage: 8 };
        const rows = calculateWeightPaceEstimates(input).resultsTable;
        const band = calculateBand(input);
        expect(band.rows).toHaveLength(rows.length);
    });
});

describe('timeSavedRange', () => {
    it('returns the saving at the conservative and optimistic edges', () => {
        expect(timeSavedRange(3000, 2970, 2912)).toEqual({ low: 30, high: 88 });
    });
    it('never goes negative', () => {
        expect(timeSavedRange(3000, 3010, 2990)).toEqual({ low: 0, high: 10 });
        expect(timeSavedRange(3000, 3020, 3010)).toEqual({ low: 0, high: 0 });
    });
});
