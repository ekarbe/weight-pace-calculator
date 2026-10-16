import { describe, expect, it } from 'vitest';
import { calculateMinHealthyWeight, calculateWeightPaceEstimates, type UserInput } from './calculations';

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
        expect(r.warnings.some(w => w.includes('valid threshold pace'))).toBe(true);
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
        expect(r.warnings.filter(w => w.includes('very large')).length).toBeLessThanOrEqual(1);
    });
    it('flags unhealthy body fat and stops at lean mass', () => {
        const r = calculateWeightPaceEstimates({ ...base, bodyFatPercentage: 12 });
        expect(r.resultsTable.some(x => x.isPotentiallyUnhealthyFat)).toBe(true);
        expect(r.resultsTable.every(x => x.targetWeightKg > 80 * 0.88)).toBe(true);
    });
    it('warns when already at/below min healthy weight', () => {
        const r = calculateWeightPaceEstimates({ ...base, weightKg: 58 });
        expect(r.warnings.some(w => w.includes('minimum healthy weight'))).toBe(true);
    });
});
