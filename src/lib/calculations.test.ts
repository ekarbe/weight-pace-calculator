import { describe, expect, it } from 'vitest';
import { calculateMinHealthyWeight, calculateWeightPaceEstimates, estimateRaceTimeSec, type UserInput } from './calculations';

const base: UserInput = {
    gender: 'male',
    heightCm: 180,
    weightKg: 80,
    bodyFatPercentage: null,
    thresholdPaceMin: 4,
    thresholdPaceSec: 30,
};

describe('calculateMinHealthyWeight', () => {
    it('uses BMI 18.5', () => {
        expect(calculateMinHealthyWeight(180)).toBeCloseTo(59.94, 2);
    });
    it('returns null for invalid height', () => {
        expect(calculateMinHealthyWeight(0)).toBeNull();
    });
});

describe('calculateWeightPaceEstimates', () => {
    it('starts at current weight with the entered pace and ends at the BMI-20 floor', () => {
        const r = calculateWeightPaceEstimates(base);
        expect(r.resultsTable[0].targetWeightKg).toBe(80);
        expect(r.resultsTable[0].estimatedThresholdPaceSec).toBe(270);
        expect(r.resultsTable.at(-1)!.targetWeightKg).toBeCloseTo(64.8, 1);
    });
    it('lets the user lower the floor to BMI 18.5 but not below', () => {
        const low = calculateWeightPaceEstimates({ ...base, bmiFloor: 18.5 }).resultsTable.at(-1)!.targetWeightKg;
        const lower = calculateWeightPaceEstimates({ ...base, bmiFloor: 15 }).resultsTable.at(-1)!.targetWeightKg;
        expect(low).toBeCloseTo(59.9, 1);
        expect(lower).toBeCloseTo(59.9, 1);
    });
    it('honours a custom pace factor', () => {
        const rows = calculateWeightPaceEstimates({ ...base, paceFactorSecPerKg: 1 }).resultsTable;
        expect(rows[2].estimatedThresholdPaceSec).toBe(269);
    });
    it('steps by 0.5 kg without float drift', () => {
        const w = calculateWeightPaceEstimates(base).resultsTable.map(x => x.targetWeightKg);
        expect(w.slice(0, 4)).toEqual([80, 79.5, 79, 78.5]);
    });
    it('improves pace by 2 s/km per kg lost', () => {
        const rows = calculateWeightPaceEstimates(base).resultsTable;
        expect(rows[2].estimatedThresholdPaceSec).toBe(268);
    });
    it('returns no rows and a pace warning for zero pace', () => {
        const r = calculateWeightPaceEstimates({ ...base, thresholdPaceMin: 0, thresholdPaceSec: 0 });
        expect(r.resultsTable).toHaveLength(0);
        expect(r.warnings.some(w => w.code === 'invalidPace')).toBe(true);
    });
    it('does not depend on warning order for invalid pace', () => {
        const r = calculateWeightPaceEstimates({ ...base, bodyFatPercentage: 3, thresholdPaceSec: 75 });
        expect(r.resultsTable).toHaveLength(0);
    });
    it('caps pace at the gender floor', () => {
        const r = calculateWeightPaceEstimates({ ...base, thresholdPaceMin: 3, thresholdPaceSec: 0 });
        expect(r.resultsTable.some(x => x.paceLimited)).toBe(true);
        expect(Math.min(...r.resultsTable.map(x => x.estimatedThresholdPaceSec!))).toBe(160);
    });
    it('emits the zero-pace warning only once', () => {
        const r = calculateWeightPaceEstimates({ ...base, gender: '' as never, thresholdPaceMin: 0, thresholdPaceSec: 30 });
        expect(r.warnings.filter(w => w.code === 'paceImprovementTooLarge').length).toBeLessThanOrEqual(1);
    });
    it('flags unhealthy body fat and stops at lean mass', () => {
        const r = calculateWeightPaceEstimates({ ...base, bodyFatPercentage: 12 });
        expect(r.resultsTable.some(x => x.isPotentiallyUnhealthyFat)).toBe(true);
        expect(r.resultsTable.every(x => x.targetWeightKg > 80 * 0.88)).toBe(true);
    });
    it('warns when already at/below min healthy weight', () => {
        const r = calculateWeightPaceEstimates({ ...base, weightKg: 58 });
        expect(r.warnings.some(w => w.code === 'belowFloor')).toBe(true);
    });
    it('gives the entered weight and pace back as row 0, whatever the weight, including under the BMI floor', () => {
        // 170 cm: the BMI-20 floor is 57.8 kg. Weights on both sides of it, and exactly on it.
        for (const gender of ['male', 'female'] as const) {
            for (const weightKg of [41, 50, 53, 56, 57.7, 57.8, 57.9, 58, 60, 70, 95]) {
                for (const paceFactorSecPerKg of [undefined, 0.5, 2, 4]) {
                    const input: UserInput = { ...base, gender, heightCm: 170, weightKg, thresholdPaceMin: 5, thresholdPaceSec: 0, paceFactorSecPerKg };
                    const rows = calculateWeightPaceEstimates(input).resultsTable;
                    const label = `${gender} ${weightKg} kg factor ${paceFactorSecPerKg}`;
                    expect(rows[0].targetWeightKg, label).toBe(weightKg);
                    expect(rows[0].estimatedThresholdPaceSec, label).toBe(300);
                    expect(rows[0].estimated5kTimeSec, label).toBeCloseTo(estimateRaceTimeSec(300, 5), 9);
                    // No row is heavier than the entered weight, and the weights never go up.
                    for (let i = 1; i < rows.length; i++) expect(rows[i].targetWeightKg, label).toBeLessThan(rows[i - 1].targetWeightKg);
                    expect(Math.max(...rows.map((r) => r.targetWeightKg)), label).toBe(weightKg);
                }
            }
        }
    });
    it('has one row for a runner already under the floor, with the warning, and no faster or slower estimate than the entered one', () => {
        const r = calculateWeightPaceEstimates({ ...base, heightCm: 170, weightKg: 50, thresholdPaceMin: 5, thresholdPaceSec: 0 });
        expect(r.resultsTable).toHaveLength(1);
        expect(r.resultsTable[0]).toMatchObject({ targetWeightKg: 50, estimatedThresholdPaceSec: 300, estimated5kTimeSec: 1425 });
        expect(r.warnings.some((w) => w.code === 'belowFloor')).toBe(true);
    });
    it('never makes any row slower than the entered pace (fuzz)', () => {
        let rand = 12345;
        const next = () => (rand = (rand * 1103515245 + 12345) % 2147483648) / 2147483648;
        for (let n = 0; n < 2000; n++) {
            const input: UserInput = {
                ...base,
                gender: next() < 0.5 ? 'male' : 'female',
                heightCm: 150 + Math.floor(next() * 50),
                weightKg: 35 + Math.floor(next() * 800) / 10,
                bmiFloor: next() < 0.5 ? undefined : 18.5 + Math.floor(next() * 23) / 2,
                thresholdPaceMin: 3 + Math.floor(next() * 5),
                thresholdPaceSec: Math.floor(next() * 60),
                paceFactorSecPerKg: next() < 0.5 ? undefined : Math.floor(next() * 8) / 2,
            };
            const rows = calculateWeightPaceEstimates(input).resultsTable;
            const entered = input.thresholdPaceMin * 60 + input.thresholdPaceSec;
            const cap = input.gender === 'male' ? 160 : 180;
            expect(rows.length, JSON.stringify(input)).toBeGreaterThan(0);
            // The first row is the entered weight and pace, unless that pace is itself faster than the model's cap.
            expect(rows[0].estimatedThresholdPaceSec, JSON.stringify(input)).toBe(Math.max(entered, cap));
            for (const row of rows) expect(row.estimatedThresholdPaceSec!, JSON.stringify(input)).toBeLessThanOrEqual(Math.max(entered, cap));
        }
    });
});
