import { describe, expect, it } from 'vitest';
import { classifyRate, dateAtRate, parseISODate, planByDate } from './plan';
import { estimateRaceTimeSec, racePaceFactor } from './calculations';

const today = new Date(2026, 0, 1, 15, 30);

describe('plan', () => {
    it('parses only real calendar dates', () => {
        expect(parseISODate('2026-02-30')).toBeNull();
        expect(parseISODate('nope')).toBeNull();
        expect(parseISODate('2026-03-05')?.getDate()).toBe(5);
    });
    it('computes weekly rate to a date', () => {
        const p = planByDate(80, 4, '2026-02-26', today)!; // 8 weeks
        expect(p.weeks).toBeCloseTo(8, 5);
        expect(p.kgPerWeek).toBeCloseTo(0.5, 5);
        expect(p.pctPerWeek).toBeCloseTo(0.625, 3);
        expect(p.risk).toBe('brisk');
    });
    it('rejects past dates and zero loss', () => {
        expect(planByDate(80, 4, '2025-12-31', today)).toBeNull();
        expect(planByDate(80, 4, '2026-01-01', today)).toBeNull();
        expect(planByDate(80, 0, '2026-06-01', today)).toBeNull();
    });
    it('classifies rates', () => {
        expect(classifyRate(0.5)).toBe('sustainable');
        expect(classifyRate(0.8)).toBe('brisk');
        expect(classifyRate(1.2)).toBe('aggressive');
    });
    it('finds the date at the sustainable rate', () => {
        const r = dateAtRate(80, 4, today)!; // 0.4 kg/week -> 10 weeks
        expect(r.weeks).toBeCloseTo(10, 5);
        expect(r.date).toEqual(new Date(2026, 2, 12));
    });
});

describe('custom distance', () => {
    it('matches the anchors', () => {
        expect(racePaceFactor(5)).toBeCloseTo(0.95);
        expect(racePaceFactor(10)).toBeCloseTo(0.98);
        expect(racePaceFactor(21.0975)).toBeCloseTo(1.04);
        expect(racePaceFactor(42.195)).toBeCloseTo(1.1);
    });
    it('is monotonic and clamped', () => {
        let prev = 0;
        for (const d of [1, 3, 5, 8, 10, 15, 21.0975, 30, 42.195, 60, 100]) {
            const f = racePaceFactor(d);
            expect(f).toBeGreaterThanOrEqual(prev);
            prev = f;
        }
        expect(racePaceFactor(0.1)).toBe(racePaceFactor(1));
        expect(racePaceFactor(500)).toBe(racePaceFactor(100));
    });
    it('gives 15K between the 10K and half marathon paces', () => {
        const f = racePaceFactor(15);
        expect(f).toBeGreaterThan(0.98);
        expect(f).toBeLessThan(1.04);
    });
    it('computes a time', () => {
        expect(estimateRaceTimeSec(270, 10)).toBeCloseTo(270 * 0.98 * 10);
    });
});
