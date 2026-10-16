import { describe, expect, it } from 'vitest';
import { calculateWeightPaceEstimates, type UserInput } from './calculations';
import { classifyRate, planByDate } from './plan';
import {
    TRAINING, classifyLoad, computeTraining, lowestFactor, raceSavingSec, resolveLossRate, trainingInputFor,
    type TrainingInput, type TrainingResult,
} from './training';

const today = new Date(2026, 0, 5);
const pad = (n: number) => String(n).padStart(2, '0');
/** YYYY-MM-DD, `days` after `today`. */
const dateIn = (days: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** 80 kg to 76 kg (4 kg), 180 cm, 5:00/km, factor 2, headline gain 8 s/km. */
const base: TrainingInput = {
    startKg: 80, targetKg: 76, heightCm: 180, baselinePaceSec: 300, headlineGainSecPerKm: 8, centralFactor: 2,
    rowUnhealthyFat: false, weeklyKm: null, weeklyKmInvalid: false, targetDate: '',
};
const run = (o: Partial<TrainingInput> = {}) => computeTraining({ ...base, ...o }, today);

/** A result with figures: asserts it is 'full' and narrows the type. */
function full(r: TrainingResult) {
    expect(r.display).toBe('full');
    return { ...r, factors: r.factors!, gains: r.gains!, savings10k: r.savings10k!, rate: r.rate! };
}

const FIXTURE_L1 = { targetKg: 79.5, headlineGainSecPerKm: 1 }; // a 0.5 kg change

describe('classifyLoad', () => {
    it('treats missing, non-finite and negative distances as unknown', () => {
        for (const km of [null, NaN, -1, -0.01, Infinity, -Infinity]) expect(classifyLoad(km)).toBe('unknown');
    });
    it('puts the boundaries in the higher tier', () => {
        expect(classifyLoad(0)).toBe('normal');
        expect(classifyLoad(49.99)).toBe('normal');
        expect(classifyLoad(50)).toBe('high');
        expect(classifyLoad(99.99)).toBe('high');
        expect(classifyLoad(100)).toBe('veryHigh');
        expect(classifyLoad(250)).toBe('veryHigh');
    });
});

describe('resolveLossRate', () => {
    it('uses the date when it is valid and in the future', () => {
        const r = resolveLossRate(80, 4, dateIn(42), today);
        const p = planByDate(80, 4, dateIn(42), today)!;
        expect(r).toEqual({ pct: p.pctPerWeek, risk: p.risk, source: 'targetDate' });
        expect(r.pct).toBeCloseTo(0.8333, 3);
        expect(r.risk).toBe('brisk');
    });
    it('assumes the sustainable rate without a usable date', () => {
        for (const d of ['', dateIn(0), dateIn(-3), '2026-13-40', 'soon', '2026-1-5']) {
            expect(resolveLossRate(80, 4, d, today)).toEqual({ pct: 0.5, risk: 'sustainable', source: 'assumed' });
        }
    });
    it('uses the class boundaries of the Timeline card', () => {
        expect(classifyRate(0.5)).toBe('sustainable');
        expect(classifyRate(0.5000000001)).toBe('sustainable');
        expect(classifyRate(0.51)).toBe('brisk');
        expect(classifyRate(1.0)).toBe('brisk');
        expect(classifyRate(1.01)).toBe('aggressive');
    });
});

describe('raceSavingSec', () => {
    it('saves 78.4 s over 10 km for 8 s/km at 5:00/km', () => {
        expect(raceSavingSec(300, 8, 10)).toBeCloseTo(78.4, 6);
    });
    it('is zero without a gain and never negative or NaN near the baseline', () => {
        expect(raceSavingSec(300, 0, 10)).toBe(0);
        const s = raceSavingSec(300, 299.5, 10);
        expect(Number.isFinite(s)).toBe(true);
        expect(s).toBeGreaterThan(0);
        expect(Number.isFinite(raceSavingSec(300, 400, 10))).toBe(true);
    });
});

describe('worked examples', () => {
    it('A: no date, no distance matches the headline and says what it assumed', () => {
        const r = full(run());
        expect(r.rate).toMatchObject({ pct: 0.5, risk: 'sustainable', source: 'assumed' });
        expect(r.load).toBe('unknown');
        expect(r.factors).toEqual({ lowest: 1, headline: 2, realistic: 2 });
        expect(r.reduced).toBe(false);
        expect(r.reducedBy).toBeNull();
        expect([r.gains.conservative, r.gains.realistic, r.gains.headline]).toEqual([4, 8, 8]);
        expect(r.savings10k.conservative).toBeCloseTo(39.2, 6);
        expect(r.savings10k.realistic).toBeCloseTo(78.4, 6);
        expect(r.savings10k.headline).toBeCloseTo(78.4, 6);
        expect(r.notes).toEqual(['assumedRate', 'addKm']);
        expect(r.showHelp).toBe(false);
    });

    it('B: a brisk plan lowers the figure halfway to the conservative end', () => {
        const r = full(run({ targetDate: dateIn(42), weeklyKm: 30 }));
        expect(r.rate.risk).toBe('brisk');
        expect(r.load).toBe('normal');
        expect(r.factors.realistic).toBe(1.5);
        expect([r.gains.conservative, r.gains.realistic, r.gains.headline]).toEqual([4, 6, 8]);
        expect(r.savings10k.conservative).toBeCloseTo(39.2, 6);
        expect(r.savings10k.realistic).toBeCloseTo(58.8, 6);
        expect(r.savings10k.headline).toBeCloseTo(78.4, 6);
        expect(r.reduced).toBe(true);
        expect(r.reducedBy).toBe('brisk');
        expect(r.notes).toEqual([]);
    });

    it('B2: the same without a distance gives the same numbers plus the addKm note', () => {
        const a = full(run({ targetDate: dateIn(42), weeklyKm: 30 }));
        const b = full(run({ targetDate: dateIn(42), weeklyKm: null }));
        expect(b.gains).toEqual(a.gains);
        expect(b.savings10k).toEqual(a.savings10k);
        expect(b.notes).toEqual(['addKm']);
    });

    it('C: brisk with 50 km a week or more is withheld; 49.99 km is not', () => {
        const r = run({ targetDate: dateIn(42), weeklyKm: 50 });
        expect(r.display).toBe('withheld');
        expect(r.withheld).toBe('fastAndHeavy');
        expect(r.rate?.risk).toBe('brisk');
        expect(r.load).toBe('high');
        expect(r.showHelp).toBe(true);
        expect(run({ targetDate: dateIn(42), weeklyKm: 49.99 }).display).toBe('full');
    });

    it('D: too fast with a real loss is withheld', () => {
        const r = run({ targetDate: dateIn(21) });
        expect(r.withheld).toBe('tooFast');
        expect(r.rate?.risk).toBe('aggressive');
        expect(r.rate?.pct).toBeCloseTo(1.6667, 3);
        expect(r.showHelp).toBe(true);
    });

    it('D2: for a loss under 1 kg, too fast is treated as brisk but still reported as too fast', () => {
        const r = full(run({ ...FIXTURE_L1, targetDate: dateIn(3) }));
        expect(r.rate.risk).toBe('aggressive');
        expect(r.rate.pct).toBeCloseTo(1.4583, 3);
        expect(r.factors.realistic).toBe(1.5);
        expect(r.gains.conservative).toBeCloseTo(0.5, 9);
        expect(r.gains.realistic).toBeCloseTo(0.75, 9);
        expect(r.gains.headline).toBe(1);
        expect(r.savings10k.conservative).toBeCloseTo(4.9, 6);
        expect(r.savings10k.realistic).toBeCloseTo(7.35, 6);
        expect(r.savings10k.headline).toBeCloseTo(9.8, 6);
        expect(r.reducedBy).toBe('brisk');
        expect(r.notes).toContain('tiny');
    });

    it('D2 boundary: a loss of exactly 1 kg is treated as a real loss', () => {
        expect(run({ targetKg: 79, headlineGainSecPerKm: 2, targetDate: dateIn(3) }).withheld).toBe('tooFast');
        expect(run({ targetKg: 79.01, headlineGainSecPerKm: 2, targetDate: dateIn(3) }).display).toBe('full');
    });

    it('E: a very high load halves the figure at a sustainable rate; 99.99 km does not', () => {
        const r = full(run({ targetDate: dateIn(280), weeklyKm: 100 }));
        expect(r.rate.risk).toBe('sustainable');
        expect(r.rate.pct).toBeCloseTo(0.125, 6);
        expect(r.load).toBe('veryHigh');
        expect(r.reducedBy).toBe('veryHigh');
        expect(r.factors.realistic).toBe(1.5);
        expect([r.gains.conservative, r.gains.realistic, r.gains.headline]).toEqual([4, 6, 8]);
        const lower = full(run({ targetDate: dateIn(280), weeklyKm: 99.99 }));
        expect(lower.factors.realistic).toBe(2);
        expect(lower.reduced).toBe(false);
    });

    it('F: a headline factor of 0.5 cannot be lowered further', () => {
        const at = { centralFactor: 0.5, headlineGainSecPerKm: 2 };
        for (const targetDate of ['', dateIn(280), dateIn(42)]) {
            for (const weeklyKm of [null, 0, 30, 100]) {
                const r = run({ ...at, targetDate, weeklyKm });
                if (r.display === 'withheld') {
                    expect(r.withheld).toBe('fastAndHeavy'); // brisk with a high load; the rule does not depend on the factor
                    continue;
                }
                const f = full(r);
                expect(f.factors).toEqual({ lowest: 0.5, headline: 0.5, realistic: 0.5 });
                expect([f.gains.conservative, f.gains.realistic, f.gains.headline]).toEqual([2, 2, 2]);
                expect(f.reduced).toBe(false);
                expect(f.reducedBy).toBeNull();
            }
        }
    });

    it('G: a headline factor above the band is lowered halfway to 1, never above itself', () => {
        const at = { centralFactor: 4, headlineGainSecPerKm: 16 };
        const brisk = full(run({ ...at, targetDate: dateIn(42) }));
        expect(brisk.factors).toEqual({ lowest: 1, headline: 4, realistic: 2.5 });
        expect([brisk.gains.conservative, brisk.gains.realistic, brisk.gains.headline]).toEqual([4, 10, 16]);
        expect(brisk.savings10k.conservative).toBeCloseTo(39.2, 6);
        expect(brisk.savings10k.realistic).toBeCloseTo(98, 6);
        expect(brisk.savings10k.headline).toBeCloseTo(156.8, 6);
        const sustainable = full(run(at));
        expect(sustainable.factors.realistic).toBe(4);
        expect(sustainable.reduced).toBe(false);
        expect([sustainable.gains.conservative, sustainable.gains.realistic, sustainable.gains.headline]).toEqual([4, 16, 16]);
    });

    it('H: the main model’s pace cap bounds the figure and nothing is flagged as reduced', () => {
        const r = full(run({ headlineGainSecPerKm: 5, targetDate: dateIn(42) }));
        expect([r.gains.conservative, r.gains.realistic, r.gains.headline]).toEqual([4, 5, 5]);
        expect(r.reduced).toBe(false);
        expect(r.reducedBy).toBeNull();
    });

    it('I: a weight just under the floor because of 0.1 kg rounding is still shown', () => {
        const at = { heightCm: 175, startKg: 70 };
        expect(run({ ...at, targetKg: 61.2, headlineGainSecPerKm: 17.6 }).display).toBe('full'); // BMI 19.98
        const low = run({ ...at, targetKg: 60.5, headlineGainSecPerKm: 19 }); // BMI 19.76
        expect(low.display).toBe('withheld');
        expect(low.withheld).toBe('lowBmi');
    });

    it('J: an entered weight under the floor is withheld even when nothing changes', () => {
        const r = run({ heightCm: 175, startKg: 60, targetKg: 60, headlineGainSecPerKm: 0 });
        expect(r.withheld).toBe('lowBmi');
        expect(r.showHelp).toBe(true);
    });
});

describe('rate x load matrix', () => {
    const rates = {
        sustainable: {},
        brisk: { targetDate: dateIn(42) },
        'too fast': { targetDate: dateIn(21) },
        'too fast, under 1 kg': { ...FIXTURE_L1, targetDate: dateIn(3) },
    } as const;
    const loads = { unknown: null, normal: 30, high: 50, veryHigh: 100 } as const;
    type Cell = number | 'tooFast' | 'fastAndHeavy';
    const expected: Record<keyof typeof rates, Cell[]> = {
        sustainable: [2, 2, 2, 1.5],
        brisk: [1.5, 1.5, 'fastAndHeavy', 'fastAndHeavy'],
        'too fast': ['tooFast', 'tooFast', 'tooFast', 'tooFast'],
        'too fast, under 1 kg': [1.5, 1.5, 'fastAndHeavy', 'fastAndHeavy'],
    };
    for (const [rateName, rate] of Object.entries(rates)) {
        Object.entries(loads).forEach(([loadName, weeklyKm], col) => {
            const want = expected[rateName as keyof typeof rates][col];
            it(`${rateName} x ${loadName}`, () => {
                const r = run({ ...rate, weeklyKm });
                if (typeof want === 'number') {
                    expect(r.display).toBe('full');
                    expect(r.factors?.realistic).toBe(want);
                    expect(r.reduced).toBe(want < 2);
                    const reducedBy = rateName === 'sustainable' ? 'veryHigh' : 'brisk';
                    expect(r.reducedBy).toBe(want < 2 ? reducedBy : null);
                } else {
                    expect(r.display).toBe('withheld');
                    expect(r.withheld).toBe(want);
                }
            });
        });
    }
});

describe('gate precedence', () => {
    const everything = { heightCm: 175, startKg: 60, targetKg: 55, rowUnhealthyFat: true, weeklyKmInvalid: true, targetDate: dateIn(21) };

    it('hidden beats everything', () => {
        expect(run({ ...everything, centralFactor: 0 }).display).toBe('hidden');
        expect(run({ ...everything, centralFactor: -1 }).display).toBe('hidden');
        expect(run({ ...everything, baselinePaceSec: 0 }).display).toBe('hidden');
    });
    it('lowBmi beats idle, lowBodyFat, inputError and tooFast', () => {
        expect(run(everything).withheld).toBe('lowBmi');
        expect(run({ ...everything, targetKg: 60 }).withheld).toBe('lowBmi'); // nothing to change, still withheld
        expect(run({ ...everything, targetKg: 59.9 }).withheld).toBe('lowBmi');
    });
    it('idle beats lowBodyFat, inputError and tooFast', () => {
        expect(run({ targetKg: 79.9, rowUnhealthyFat: true, weeklyKmInvalid: true, targetDate: dateIn(1) }).display).toBe('idle');
    });
    it('hidden (nothing to qualify) beats lowBodyFat and inputError', () => {
        expect(run({ headlineGainSecPerKm: 0.01, rowUnhealthyFat: true }).display).toBe('hidden');
        expect(run({ headlineGainSecPerKm: -3, weeklyKmInvalid: true }).display).toBe('hidden');
    });
    it('lowBodyFat beats inputError and tooFast', () => {
        const r = run({ rowUnhealthyFat: true, weeklyKmInvalid: true, targetDate: dateIn(21) });
        expect(r.withheld).toBe('lowBodyFat');
    });
    it('inputError beats tooFast and fastAndHeavy and returns no rate', () => {
        const r = run({ weeklyKmInvalid: true, weeklyKm: 100, targetDate: dateIn(21) });
        expect(r.withheld).toBe('inputError');
        expect(r.showHelp).toBe(false);
        expect(r.rate).toBeNull();
    });
    it('an invalid field never falls back to the permissive reading', () => {
        expect(run({ weeklyKmInvalid: true, weeklyKm: null }).display).toBe('withheld');
        expect(run({ weeklyKmInvalid: true, weeklyKm: 0 }).withheld).toBe('inputError');
    });
    it('tooFast beats fastAndHeavy', () => {
        expect(run({ targetDate: dateIn(21), weeklyKm: 120 }).withheld).toBe('tooFast');
    });
});

describe('gates', () => {
    it('is idle under 0.25 kg and not at 0.25 kg', () => {
        expect(run({ targetKg: 79.76, headlineGainSecPerKm: 0.5 }).display).toBe('idle');
        expect(run({ targetKg: 79.75, headlineGainSecPerKm: 0.5 }).display).toBe('full');
        expect(run({ targetKg: 80, headlineGainSecPerKm: 0 }).display).toBe('idle');
        expect(run({ targetKg: 85, headlineGainSecPerKm: 0 }).display).toBe('idle');
    });
    it('is hidden for non-finite or non-positive inputs, without throwing', () => {
        const bad = [NaN, Infinity, -Infinity, 0, -5];
        for (const key of ['startKg', 'targetKg', 'heightCm', 'baselinePaceSec', 'centralFactor'] as const) {
            for (const v of bad) expect(run({ [key]: v }).display, `${key}=${v}`).toBe('hidden');
        }
        expect(run({ headlineGainSecPerKm: NaN }).display).toBe('hidden');
    });
    it('is hidden when the headline gain is below 0.05 s/km', () => {
        expect(run({ headlineGainSecPerKm: 0.04 }).display).toBe('hidden');
        expect(run({ headlineGainSecPerKm: 0.05 }).display).toBe('full');
        expect(run({ headlineGainSecPerKm: 0 }).display).toBe('hidden');
    });
    it('withholds at the BMI floor minus the rounding tolerance, not at it', () => {
        const kgAt = (bmi: number) => bmi * 1.75 ** 2;
        const at = { heightCm: 175, startKg: 70, headlineGainSecPerKm: 10 };
        expect(run({ ...at, targetKg: kgAt(20) }).display).toBe('full');
        expect(run({ ...at, targetKg: kgAt(19.95) }).display).toBe('full');
        expect(run({ ...at, targetKg: kgAt(19.94) }).withheld).toBe('lowBmi');
    });
    it('withholds for a flagged row and reports no figure', () => {
        const r = run({ rowUnhealthyFat: true });
        expect(r.withheld).toBe('lowBodyFat');
        expect(r.showHelp).toBe(true);
    });
});

describe('notes', () => {
    const notes = (o: Partial<TrainingInput>) => full(run({ targetDate: dateIn(280), weeklyKm: 30, ...o })).notes;
    it('flags a tiny change: under 1 kg, or under 1% of body weight when that is more', () => {
        expect(notes({ startKg: 80, targetKg: 79.1, headlineGainSecPerKm: 2 })).toContain('tiny');
        expect(notes({ startKg: 80, targetKg: 79, headlineGainSecPerKm: 2 })).not.toContain('tiny');
        expect(notes({ startKg: 130, targetKg: 128.8, headlineGainSecPerKm: 2, heightCm: 190 })).toContain('tiny');
        expect(notes({ startKg: 130, targetKg: 128.7, headlineGainSecPerKm: 2, heightCm: 190 })).not.toContain('tiny');
    });
    it('flags a big change at exactly 10% of body weight', () => {
        expect(notes({ targetKg: 72, headlineGainSecPerKm: 16 })).toContain('bigOrLean');
        expect(notes({ targetKg: 72.1, headlineGainSecPerKm: 16 })).not.toContain('bigOrLean');
    });
    it('flags a lean selected weight under BMI 22', () => {
        const kgAt = (bmi: number) => bmi * 1.8 ** 2;
        expect(notes({ startKg: 76, targetKg: kgAt(21.99), headlineGainSecPerKm: 9 })).toContain('bigOrLean');
        expect(notes({ startKg: 76, targetKg: kgAt(22), headlineGainSecPerKm: 9 })).not.toContain('bigOrLean');
    });
    it('flags the assumed rate only without a usable date, and a missing distance only when blank', () => {
        expect(full(run({ weeklyKm: 0 })).notes).toEqual(['assumedRate']);
        expect(full(run({ targetDate: dateIn(-5), weeklyKm: 20 })).notes).toEqual(['assumedRate']);
        expect(full(run({ targetDate: dateIn(280), weeklyKm: 0 })).notes).toEqual([]);
        expect(full(run({ targetDate: dateIn(280) })).notes).toEqual(['addKm']);
    });
    it('keeps a stable order', () => {
        const r = full(run({ ...FIXTURE_L1, startKg: 80, targetKg: 79.5, heightCm: 195, headlineGainSecPerKm: 1 }));
        expect(r.notes).toEqual(['assumedRate', 'addKm', 'bigOrLean', 'tiny']);
    });
});

describe('integration with the calculator', () => {
    const user: UserInput = { gender: 'male', heightCm: 175, weightKg: 60, bodyFatPercentage: null, thresholdPaceMin: 5, thresholdPaceSec: 0, paceFactorSecPerKg: 2, bmiFloor: 20 };
    const none = { weeklyKm: null, weeklyKmError: null };

    it('uses the entered weight, not the heavier floor row, as the starting point', () => {
        const rows = calculateWeightPaceEstimates(user).resultsTable;
        expect(rows[0].targetWeightKg).toBeGreaterThan(user.weightKg); // the floor quirk
        expect(computeTraining(trainingInputFor(user, rows[0], none, ''), today).withheld).toBe('lowBmi');
        // Starting from rows[0] instead would have hidden the problem.
        const wrong = { ...trainingInputFor(user, rows[0], none, ''), startKg: rows[0].targetWeightKg };
        expect(computeTraining(wrong, today).display).toBe('idle');
    });

    it('never shows a figure below the BMI floor, even when the Advanced floor allows it', () => {
        let withheldRows = 0;
        for (const heightCm of [150, 165, 175, 190]) {
            for (const weightKg of [55, 70, 95]) {
                for (const gender of ['male', 'female'] as const) {
                    const input: UserInput = { ...user, gender, heightCm, weightKg, bmiFloor: 18.5 };
                    const rows = calculateWeightPaceEstimates(input).resultsTable;
                    for (const row of rows) {
                        const r = computeTraining(trainingInputFor(input, row, none, ''), today);
                        const bmi = Math.min(weightKg, row.targetWeightKg) / (heightCm / 100) ** 2;
                        if (bmi < TRAINING.BMI_FLOOR - TRAINING.BMI_TOLERANCE) {
                            withheldRows++;
                            expect(r.display, `${heightCm} cm, ${weightKg} kg, row ${row.targetWeightKg}`).toBe('withheld');
                            expect(r.withheld).toBe('lowBmi');
                            expect(r.gains).toBeNull();
                        }
                    }
                }
            }
        }
        expect(withheldRows).toBeGreaterThan(20);
    });

    it('its headline saving equals the race cards’ saving', () => {
        for (const weightKg of [80, 75.296, 62.37]) {
            const input: UserInput = { ...user, heightCm: 180, weightKg };
            const rows = calculateWeightPaceEstimates(input).resultsTable;
            for (const i of [2, 5, 9]) {
                if (!rows[i]) continue;
                const r = computeTraining(trainingInputFor(input, rows[i], none, ''), today);
                if (r.display !== 'full') continue;
                const cards = rows[0].estimated10kTimeSec! - rows[i].estimated10kTimeSec!;
                expect(r.savings10k!.headline).toBeCloseTo(cards, 6);
                // Table weights are rounded to 0.1 kg; that must not read as a reduction.
                expect(r.reduced, `${weightKg} kg, row ${i}`).toBe(false);
                expect(r.gains!.realistic).toBe(r.gains!.headline);
            }
        }
    });

    it('stays within the capped headline when the pace cap binds', () => {
        const input: UserInput = { ...user, heightCm: 180, weightKg: 75, thresholdPaceMin: 2, thresholdPaceSec: 50 };
        const rows = calculateWeightPaceEstimates(input).resultsTable;
        const capped = rows.find((r) => r.paceLimited)!;
        expect(capped).toBeDefined();
        for (const targetDate of ['', dateIn(60)]) {
            const r = computeTraining(trainingInputFor(input, capped, none, targetDate), today);
            expect(r.display).toBe('full');
            expect(r.gains!.headline).toBe(10); // 170 s/km down to the 160 s/km limit
            expect(r.gains!.realistic).toBeLessThanOrEqual(10);
            expect(r.gains!.conservative).toBeLessThanOrEqual(r.gains!.realistic);
        }
    });

    it('is hidden for a runner already faster than the model’s limit', () => {
        const input: UserInput = { ...user, heightCm: 180, weightKg: 75, thresholdPaceMin: 2, thresholdPaceSec: 30 };
        const rows = calculateWeightPaceEstimates(input).resultsTable;
        expect(computeTraining(trainingInputFor(input, rows[6], none, ''), today).display).toBe('hidden');
    });

    it('maps the row flag, the invalid field and the default factor', () => {
        const rows = calculateWeightPaceEstimates({ ...user, weightKg: 80, heightCm: 180 }).resultsTable;
        const i = trainingInputFor({ ...user, paceFactorSecPerKg: undefined }, { ...rows[4], isPotentiallyUnhealthyFat: true }, { weeklyKm: null, weeklyKmError: 'training.err.weeklyKm.metric' }, dateIn(10));
        expect(i).toMatchObject({ centralFactor: 2, rowUnhealthyFat: true, weeklyKmInvalid: true, targetDate: dateIn(10), baselinePaceSec: 300 });
    });
});

describe('properties', () => {
    // Deterministic pseudo-random numbers (mulberry32).
    const rng = (seed: number) => () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const deepFreeze = <T extends object>(o: T): T => (Object.values(o).forEach((v) => v && typeof v === 'object' && deepFreeze(v)), Object.freeze(o));

    function sample(rand: () => number): TrainingInput {
        const between = (a: number, b: number) => a + rand() * (b - a);
        const startKg = between(40, 160);
        const lost = rand() < 0.1 ? between(0, 0.4) : between(0, startKg * 0.2);
        const c = between(0.1, 5);
        const km = [null, 0, between(0, 60), between(40, 110), between(0, 250)][Math.floor(rand() * 5)];
        return {
            startKg, targetKg: startKg - lost, heightCm: between(145, 200), baselinePaceSec: between(150, 500),
            headlineGainSecPerKm: rand() < 0.3 ? between(0, c * lost) : c * lost,
            centralFactor: c, rowUnhealthyFat: rand() < 0.1, weeklyKm: km, weeklyKmInvalid: rand() < 0.05,
            targetDate: rand() < 0.3 ? '' : dateIn(1 + Math.floor(rand() * 700)),
        };
    }

    it('keeps every figure between the conservative end and the headline, and leaks nothing when withheld', () => {
        const rand = rng(42);
        const seen = { full: 0, withheld: 0, idle: 0, hidden: 0 };
        for (let n = 0; n < 4000; n++) {
            const input = sample(rand);
            const frozen = deepFreeze(structuredClone(input));
            const r = computeTraining(frozen, today);
            expect(computeTraining(frozen, today)).toEqual(r); // deterministic
            expect(frozen).toEqual(input); // untouched
            seen[r.display]++;
            if (r.display !== 'full') {
                expect(r.factors).toBeNull();
                expect(r.gains).toBeNull();
                expect(r.savings10k).toBeNull();
                expect(r.reduced).toBe(false);
                expect(r.reducedBy).toBeNull();
                expect(r.notes).toEqual([]);
                continue;
            }
            const { factors, gains, savings10k } = r;
            const eps = 1e-9;
            expect(factors!.lowest).toBeLessThanOrEqual(factors!.realistic + eps);
            expect(factors!.realistic).toBeLessThanOrEqual(factors!.headline + eps);
            expect(factors!.lowest).toBe(lowestFactor(input.centralFactor));
            expect(gains!.conservative).toBeLessThanOrEqual(gains!.realistic + eps);
            expect(gains!.realistic).toBeLessThanOrEqual(gains!.headline + eps);
            expect(gains!.headline).toBeLessThanOrEqual(input.headlineGainSecPerKm + eps);
            expect(savings10k!.conservative).toBeLessThanOrEqual(savings10k!.realistic + eps);
            expect(savings10k!.realistic).toBeLessThanOrEqual(savings10k!.headline + eps);
            for (const v of [...Object.values(factors!), ...Object.values(gains!), ...Object.values(savings10k!)]) {
                expect(Number.isFinite(v)).toBe(true);
                expect(v).toBeGreaterThanOrEqual(0);
            }
        }
        // The sweep must actually exercise every outcome.
        expect(seen.full).toBeGreaterThan(300);
        expect(seen.withheld).toBeGreaterThan(300);
        expect(seen.idle).toBeGreaterThan(30);
    });

    /** A withheld result counts as the lowest figure there is. */
    const score = (r: TrainingResult) => (r.display === 'full' ? r.factors!.realistic : -1);

    it('never offers more when the pace of weight change goes up', () => {
        const rand = rng(7);
        for (let n = 0; n < 300; n++) {
            const input = { ...sample(rand), rowUnhealthyFat: false, weeklyKmInvalid: false };
            let previous = Infinity;
            for (let days = 800; days >= 1; days -= 13) {
                const r = computeTraining({ ...input, targetDate: dateIn(days) }, today);
                if (r.display !== 'full' && r.display !== 'withheld') break; // idle or hidden does not depend on the date
                expect(score(r)).toBeLessThanOrEqual(previous + 1e-9);
                previous = score(r);
            }
        }
    });

    it('never offers more when the weekly running goes up', () => {
        const rand = rng(11);
        for (let n = 0; n < 300; n++) {
            const input = { ...sample(rand), rowUnhealthyFat: false, weeklyKmInvalid: false };
            let previous = Infinity;
            for (const weeklyKm of [null, 0, 20, 49.99, 50, 75, 99.99, 100, 250]) {
                const r = computeTraining({ ...input, weeklyKm }, today);
                if (r.display !== 'full' && r.display !== 'withheld') break;
                expect(score(r)).toBeLessThanOrEqual(previous + 1e-9);
                previous = score(r);
            }
        }
    });
});

describe('constants', () => {
    it('are deliberate (change this test together with the explainer and the review sign-off)', () => {
        expect(TRAINING).toEqual({
            CONSERVATIVE_FACTOR: 1,
            REDUCTION_FRACTION: 0.5,
            HIGH_LOAD_KM: 50,
            VERY_HIGH_LOAD_KM: 100,
            RATE_RULES_MIN_LOSS_KG: 1,
            MIN_LOSS_KG: 0.25,
            BMI_FLOOR: 20,
            BMI_TOLERANCE: 0.05,
            LEAN_BMI: 22,
            BIG_CHANGE_PCT: 10,
            TINY_LOSS_KG: 1,
            TINY_LOSS_PCT: 1,
            MIN_HEADLINE_GAIN_SEC_PER_KM: 0.05,
            WEEKLY_KM_MAX: 250,
            REFERENCE_RACE_KM: 10,
        });
    });
    it('lowers a factor below the band to itself', () => {
        expect(lowestFactor(0.4)).toBe(0.4);
        expect(lowestFactor(2)).toBe(1);
        expect(lowestFactor(4)).toBe(1);
    });
});
