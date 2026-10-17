import { afterEach, describe, expect, it } from 'vitest';
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

describe('planByDate across clock changes', () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const savedTz = process.env.TZ;
    afterEach(() => {
        if (savedTz === undefined) delete process.env.TZ;
        else process.env.TZ = savedTz;
    });

    // [zone, a start date a few days before a clock change]: spring forward (23 hour day) and fall back (25 hour day).
    const cases: [string, [number, number, number]][] = [
        ['America/New_York', [2026, 2, 1]], // clocks go forward on 8 March
        ['America/New_York', [2026, 9, 25]], // clocks go back on 1 November
        ['Europe/Berlin', [2026, 2, 20]], // forward on 29 March
        ['Europe/Berlin', [2026, 9, 10]], // back on 25 October
        ['Pacific/Auckland', [2026, 8, 20]], // forward on 27 September
        ['Pacific/Auckland', [2026, 2, 30]], // back on 5 April
    ];
    for (const [zone, [y, m, d]] of cases) {
        it(`7 kg of 70 kg in exactly 70 calendar days is 1.0000% a week in ${zone} (from ${y}-${pad(m + 1)}-${pad(d)})`, () => {
            process.env.TZ = zone;
            const start = new Date(y, m, d, 15, 30);
            const target = iso(new Date(y, m, d + 70));
            const p = planByDate(70, 7, target, start)!;
            expect(p.weeks).toBe(10);
            expect(p.pctPerWeek).toBeCloseTo(1, 9);
            expect(p.risk).toBe('brisk'); // a millisecond count would call this "too fast" on the spring-forward side
            // One calendar day later is slower, one earlier is faster, in every zone.
            expect(planByDate(70, 7, iso(new Date(y, m, d + 71)), start)!.pctPerWeek).toBeLessThan(1);
            expect(planByDate(70, 7, iso(new Date(y, m, d + 69)), start)!.risk).toBe('aggressive');
        });
    }

    it('counts the time of day of today as no part of the window', () => {
        process.env.TZ = 'America/New_York';
        const target = '2026-03-15';
        const early = planByDate(80, 4, target, new Date(2026, 2, 1, 0, 5))!;
        const late = planByDate(80, 4, target, new Date(2026, 2, 1, 23, 55))!;
        expect(early.weeks).toBe(2);
        expect(late.weeks).toBe(2);
    });

    it('leaves dateAtRate on the same calendar arithmetic as before', () => {
        process.env.TZ = 'America/New_York';
        const r = dateAtRate(80, 4, new Date(2026, 2, 1, 9))!; // 10 weeks at 0.5% a week
        expect(r.weeks).toBeCloseTo(10, 9);
        expect(iso(r.date)).toBe('2026-05-10');
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
