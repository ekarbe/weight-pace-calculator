import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateWeightPaceEstimates, type UserInput } from './calculations';
import { MAX_PCT_PER_WEEK, SUSTAINABLE_PCT_PER_WEEK, classifyRate, dateAtRate, planByDate } from './plan';
import { inToCm, lbToKg } from './units';
import {
    TRAINING, ceilTenth, chooseSummary, classifyLoad, computeTraining, explainerFigures, impliedElasticityPct, lowestFactor,
    raceSavingSec, resolveLossRate, trainingInputFor, type TrainingInput, type TrainingResult,
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
const gainsOf = (r: ReturnType<typeof full>) => [r.gains.conservative, r.gains.realistic, r.gains.headline];
const savingsOf = (r: ReturnType<typeof full>) => [r.savings10k.conservative, r.savings10k.realistic, r.savings10k.headline];

/** Nothing but the state: no figure, no note, no reason. */
function expectNoNumbers(r: TrainingResult) {
    expect(r.factors).toBeNull();
    expect(r.gains).toBeNull();
    expect(r.savings10k).toBeNull();
    expect(r.reduced).toBe(false);
    expect(r.reasons).toEqual([]);
    expect(r.notes).toEqual([]);
    expect(r.factorCapped).toBe(false);
}

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
    it('uses the date when it is valid and in the future, with the Timeline card’s own plan', () => {
        const r = resolveLossRate(80, 4, dateIn(42), today);
        const p = planByDate(80, 4, dateIn(42), today)!;
        expect(r).toEqual({ pct: p.pctPerWeek, risk: p.risk, source: 'targetDate' });
        expect(r.pct).toBeCloseTo(0.8333, 3);
        expect(r.risk).toBe('brisk');
    });
    it('assumes the sustainable rate without a usable date', () => {
        for (const d of ['', dateIn(0), dateIn(-3), '2026-13-40', 'soon', '2026-1-5']) {
            expect(resolveLossRate(80, 4, d, today), d).toEqual({ pct: 0.5, risk: 'sustainable', source: 'assumed' });
        }
    });
    it('has the class boundaries of the Timeline card', () => {
        expect(classifyRate(0.5)).toBe('sustainable');
        expect(classifyRate(0.5000000001)).toBe('sustainable');
        expect(classifyRate(0.51)).toBe('brisk');
        expect(classifyRate(1.0)).toBe('brisk');
        expect(classifyRate(1.01)).toBe('aggressive');
    });
    it('takes the limits from plan.ts rather than redefining them', () => {
        const src = readFileSync(new URL('./training.ts', import.meta.url), 'utf8');
        expect(src).toMatch(/import \{[^}]*SUSTAINABLE_PCT_PER_WEEK[^}]*\} from '\.\/plan'/);
        expect(src).toMatch(/import \{[^}]*MAX_PCT_PER_WEEK[^}]*\} from '\.\/plan'/);
        expect(src).not.toMatch(/(const|let)\s+\w*(SUSTAINABLE|MAX)_PCT\w*\s*=/);
        expect(Object.keys(TRAINING).filter((k) => /PCT_PER_WEEK|RATE/.test(k))).toEqual([]);
    });
});

describe('raceSavingSec and the elasticity', () => {
    it('saves 78.4 s over 10 km for 8 s/km at 5:00/km, which is 9.8 x the gain', () => {
        expect(raceSavingSec(300, 8, 10)).toBeCloseTo(78.4, 6);
        for (const gain of [0.5, 3, 11.25]) expect(raceSavingSec(300, gain, 10)).toBeCloseTo(9.8 * gain, 6);
    });
    it('is zero without a gain and never negative or NaN near the baseline', () => {
        expect(raceSavingSec(300, 0, 10)).toBe(0);
        const s = raceSavingSec(300, 299.5, 10);
        expect(Number.isFinite(s)).toBe(true);
        expect(s).toBeGreaterThan(0);
        const huge = raceSavingSec(300, 400, 10);
        expect(Number.isFinite(huge)).toBe(true);
        expect(huge).toBeGreaterThanOrEqual(0);
    });
    it('gives the percent change of pace per 1 % of body weight', () => {
        expect(impliedElasticityPct(2, 70, 300)).toBeCloseTo(0.4667, 4);
        expect(impliedElasticityPct(2, 80, 300)).toBeCloseTo(0.5333, 4);
        expect(impliedElasticityPct(1, 60, 270)).toBeCloseTo(0.2222, 4);
        expect(impliedElasticityPct(3, 90, 360)).toBeCloseTo(0.75, 4);
    });
});

describe('worked examples', () => {
    it('A: no date, no distance matches the headline and says what it assumed', () => {
        const r = full(run());
        expect(r.rate).toMatchObject({ pct: 0.5, risk: 'sustainable', source: 'assumed' });
        expect(r.load).toBe('unknown');
        expect(r.factors).toEqual({ lowest: 1, headline: 2, realistic: 2 });
        expect(gainsOf(r)).toEqual([4, 8, 8]);
        savingsOf(r).forEach((v, k) => expect(v).toBeCloseTo([39.2, 78.4, 78.4][k], 6));
        expect(r.reduced).toBe(false);
        expect(r.reasons).toEqual([]);
        expect(r.notes).toEqual(['assumedRate', 'addKm']);
        expect(r.showHelp).toBe(false);
        expect(r.showSigns).toBe(false);
        expect(r.blocksOutputs).toBe(false);
        expect(r.pointer).toBe('none');
        expect(chooseSummary(r)).toBe('same');
    });

    it('B: a brisk plan lowers the figure halfway to the lowest, says why and points from the race cards', () => {
        const r = full(run({ targetDate: dateIn(42), weeklyKm: 30 }));
        expect(r.rate.risk).toBe('brisk');
        expect(r.load).toBe('normal');
        expect(r.factors.realistic).toBe(1.5);
        expect(gainsOf(r)).toEqual([4, 6, 8]);
        savingsOf(r).forEach((v, k) => expect(v).toBeCloseTo([39.2, 58.8, 78.4][k], 6));
        expect(r.reduced).toBe(true);
        expect(r.reasons).toEqual(['brisk']);
        expect(r.notes).toEqual([]);
        expect(r.showSigns).toBe(true);
        expect(r.showHelp).toBe(false);
        expect(r.pointer).toBe('reduced');
        expect(r.blocksOutputs).toBe(true); // the picture would show the higher headline figure
        expect(chooseSummary(r)).toBe('reduced');
    });

    it('B2: the same without a distance gives the same numbers plus the addKm note', () => {
        const a = full(run({ targetDate: dateIn(42), weeklyKm: 30 }));
        const b = full(run({ targetDate: dateIn(42), weeklyKm: null }));
        expect(b.gains).toEqual(a.gains);
        expect(b.savings10k).toEqual(a.savings10k);
        expect(b.notes).toEqual(['addKm']);
    });

    it('C: brisk with 50 km a week or more is withheld; 49.99 km is lowered', () => {
        const r = run({ targetDate: dateIn(42), weeklyKm: 50 });
        expect(r.display).toBe('withheld');
        expect(r.withheld).toBe('fastAndHeavy');
        expect(r.rate?.risk).toBe('brisk');
        expect(r.load).toBe('high');
        expect(r.showHelp && r.showSigns && r.blocksOutputs).toBe(true);
        expect(r.pointer).toBe('withheld');
        expectNoNumbers(r);
        const just = full(run({ targetDate: dateIn(42), weeklyKm: 49.99 }));
        expect(gainsOf(just)).toEqual([4, 6, 8]);
        expect(just.reasons).toEqual(['brisk']);
    });

    it('D: too fast is withheld, with or without a valid distance, and says nothing numeric', () => {
        for (const o of [{}, { weeklyKm: 40 }, { weeklyKmInvalid: true, weeklyKm: null }, { weeklyKm: 120 }]) {
            const r = run({ targetDate: dateIn(21), ...o });
            expect(r.withheld, JSON.stringify(o)).toBe('tooFast');
            expect(r.rate?.risk).toBe('aggressive');
            expect(r.rate?.pct).toBeCloseTo(1.6667, 3);
            expect(r.showHelp && r.showSigns && r.blocksOutputs).toBe(true);
            expect(r.pointer).toBe('withheld');
            expectNoNumbers(r);
        }
    });

    it('E: a very high load halves the figure at a sustainable rate; 99.99 km only adds a note', () => {
        const r = full(run({ targetDate: dateIn(280), weeklyKm: 100 }));
        expect(r.rate.risk).toBe('sustainable');
        expect(r.rate.pct).toBeCloseTo(0.125, 6);
        expect(r.load).toBe('veryHigh');
        expect(r.reasons).toEqual(['veryHigh']);
        expect(r.notes).toEqual([]);
        expect(gainsOf(r)).toEqual([4, 6, 8]);
        const lower = full(run({ targetDate: dateIn(280), weeklyKm: 99.99 }));
        expect(gainsOf(lower)).toEqual([4, 8, 8]);
        expect(lower.reduced).toBe(false);
        expect(lower.notes).toEqual(['highLoad']);
    });

    it('F: 60 km at a sustainable pace stays unchanged and says so in a note', () => {
        const r = full(run({ targetDate: dateIn(280), weeklyKm: 60 }));
        expect(gainsOf(r)).toEqual([4, 8, 8]);
        expect(r.reduced).toBe(false);
        expect(r.notes).toEqual(['highLoad']);
        expect(r.pointer).toBe('none');
    });

    it('G: a headline factor of 0.5 cannot be lowered further and reads flat', () => {
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
                expect(gainsOf(f)).toEqual([2, 2, 2]);
                savingsOf(f).forEach((v) => expect(v).toBeCloseTo(19.6, 6));
                expect(f.reduced).toBe(false);
                expect(f.reasons).toEqual([]);
                expect(chooseSummary(f)).toBe('flat');
            }
        }
    });

    it('H1: a factor above the ceiling is counted as the ceiling, and says so', () => {
        const at = { centralFactor: 4, headlineGainSecPerKm: 16 };
        const r = full(run(at));
        expect(r.factorCapped).toBe(true);
        expect(r.factors).toEqual({ lowest: 1, headline: 4, realistic: 3 });
        expect(gainsOf(r)).toEqual([4, 12, 16]);
        savingsOf(r).forEach((v, k) => expect(v).toBeCloseTo([39.2, 117.6, 156.8][k], 6));
        expect(r.reduced).toBe(true);
        expect(r.reasons).toEqual(['factor']);
        expect(r.showSigns).toBe(true);
        expect(r.pointer).toBe('reduced');
    });

    it('H2: brisk and a factor above the ceiling lowers it halfway to the ceiling and lists both reasons', () => {
        const r = full(run({ centralFactor: 4, headlineGainSecPerKm: 16, targetDate: dateIn(42), weeklyKm: 30 }));
        expect(r.factors.realistic).toBe(2);
        expect(gainsOf(r)).toEqual([4, 8, 16]);
        expect(r.reasons).toEqual(['brisk', 'factor']);
    });

    it('I: the main model’s pace cap bounds every figure and is not announced as a reduction', () => {
        for (const o of [{}, { targetDate: dateIn(42) }]) {
            const r = full(run({ headlineGainSecPerKm: 5, ...o }));
            expect(gainsOf(r)).toEqual([4, 5, 5]);
            savingsOf(r).forEach((v, k) => expect(v).toBeCloseTo([39.2, 49, 49][k], 6));
            expect(r.reduced).toBe(false);
            expect(r.reasons).toEqual([]);
            expect(r.pointer).toBe('none');
        }
    });

    it('J: a weight under the BMI line is withheld, by which weight is under it', () => {
        const selected = run({ startKg: 70, targetKg: 60.5, heightCm: 175, headlineGainSecPerKm: 19 }); // BMI 19.76
        expect(selected).toMatchObject({ display: 'withheld', withheld: 'lowBmi', lowBmiAt: 'selected', blocksOutputs: true, pointer: 'withheld', showHelp: true, showSigns: true });
        expectNoNumbers(selected);
        const current = run({ startKg: 60, targetKg: 60, heightCm: 175, headlineGainSecPerKm: 0 });
        expect(current).toMatchObject({ withheld: 'lowBmi', lowBmiAt: 'current', blocksOutputs: false, pointer: 'none', showHelp: true, showSigns: true });
        // The runner is under the line already and the slider asks for less: the scenario is blocked.
        expect(run({ startKg: 60, targetKg: 58, heightCm: 175, headlineGainSecPerKm: 4 })).toMatchObject({ lowBmiAt: 'current', blocksOutputs: true, pointer: 'withheld' });
    });

    it('K: a change under 1 kg or 1 % of body weight is idle, and tiny only when there is a change at all', () => {
        expect(run({ targetKg: 79.2, headlineGainSecPerKm: 1.6 })).toMatchObject({ display: 'idle', idleKind: 'tiny' });
        for (const targetKg of [79.97, 80, 85]) expect(run({ targetKg, headlineGainSecPerKm: 0 })).toMatchObject({ display: 'idle', idleKind: 'none' });
        const one = full(run({ targetKg: 79, headlineGainSecPerKm: 2 }));
        expect(gainsOf(one)).toEqual([1, 2, 2]);
        savingsOf(one).forEach((v, k) => expect(v).toBeCloseTo([9.8, 19.6, 19.6][k], 6));
        const heavy = { startKg: 130, heightCm: 190, headlineGainSecPerKm: 2.4 };
        expect(run({ ...heavy, targetKg: 128.8 })).toMatchObject({ display: 'idle', idleKind: 'tiny' });
        expect(run({ ...heavy, targetKg: 128.7 }).display).toBe('full');
    });

    it('L: a cut the rounded times do not show is not announced', () => {
        const at = { targetKg: 79, targetDate: dateIn(14), weeklyKm: 10 }; // 0.625 % a week: brisk
        const small = full(run({ ...at, centralFactor: 1.05, headlineGainSecPerKm: 1.05 }));
        expect(small.rate.risk).toBe('brisk');
        expect(small.savings10k.headline).toBeCloseTo(10.29, 6);
        expect(small.savings10k.realistic).toBeCloseTo(10.045, 6);
        expect(small.reduced).toBe(false);
        expect(small.reasons).toEqual([]);
        expect(small.showSigns).toBe(false);
        expect(small.pointer).toBe('none');
        const visible = full(run({ ...at, centralFactor: 1.1, headlineGainSecPerKm: 1.1 }));
        expect(visible.savings10k.headline).toBeCloseTo(10.78, 6);
        expect(visible.savings10k.realistic).toBeCloseTo(10.29, 6);
        expect(visible.reduced).toBe(true);
        expect(visible.reasons).toEqual(['brisk']);
    });

    it('M: a big change is a note at exactly 10 % of body weight and never changes a number', () => {
        const ten = full(run({ targetKg: 72, headlineGainSecPerKm: 16 }));
        expect(ten.notes).toEqual(['assumedRate', 'addKm', 'bigOrLean']);
        expect(run({ targetKg: 72.1, headlineGainSecPerKm: 15.8 }).notes).toEqual(['assumedRate', 'addKm']);
        expect(ten.reduced).toBe(false);
        expect(gainsOf(ten)).toEqual([8, 16, 16]);
    });

    it('N: the rate class boundaries are the Timeline’s', () => {
        expect(full(run({ targetDate: dateIn(70) })).rate).toMatchObject({ risk: 'sustainable', source: 'targetDate' }); // exactly 0.5 %
        expect(gainsOf(full(run({ targetDate: dateIn(70) })))).toEqual([4, 8, 8]);
        const justOver = full(run({ targetDate: dateIn(69) }));
        expect(justOver.rate.risk).toBe('brisk');
        expect(justOver.rate.pct).toBeCloseTo(0.5072, 4);
        const exactlyOne = full(run({ targetDate: dateIn(35) })); // exactly 1.0 %
        expect(exactlyOne.rate.risk).toBe('brisk');
        expect(gainsOf(exactlyOne)).toEqual([4, 6, 8]);
        const over = run({ targetDate: dateIn(34) });
        expect(over.withheld).toBe('tooFast');
        expect(over.rate?.pct).toBeCloseTo(1.0294, 4);
    });

    it('O: there must be something to qualify: the lowest figure has to read at least half a second', () => {
        expect(run({ centralFactor: 0.01, headlineGainSecPerKm: 0.04 }).display).toBe('hidden'); // 0.39 s
        const shown = full(run({ centralFactor: 0.02, headlineGainSecPerKm: 0.08 })); // 0.78 s
        expect(shown.savings10k.conservative).toBeCloseTo(0.784, 6);
        expect(run({ headlineGainSecPerKm: 0 }).display).toBe('hidden');
        expect(run({ headlineGainSecPerKm: -3 }).display).toBe('hidden');
        // Exactly half a second is shown: 0.5 / 9.8 s/km.
        expect(run({ centralFactor: 0.5 / 9.8, headlineGainSecPerKm: 0.5 / 9.8 }).display).toBe('full');
    });
});

describe('gate order', () => {
    // Each gate as a patch that makes it fire. Patches are relative to the current weights, so any two can be combined.
    type Patch = (i: TrainingInput) => TrainingInput;
    const lostOf = (i: TrainingInput) => i.startKg - i.targetKg;
    const daysForPct = (i: TrainingInput, pct: number) => Math.round((7 * lostOf(i)) / ((pct / 100) * i.startKg));
    const gates: { name: string; patch: Patch; expected: Partial<TrainingResult> }[] = [
        { name: 'hidden', patch: (i) => ({ ...i, baselinePaceSec: 0 }), expected: { display: 'hidden' } },
        { name: 'lowBmi', patch: (i) => ({ ...i, heightCm: 175, startKg: 60, targetKg: 55 }), expected: { display: 'withheld', withheld: 'lowBmi' } },
        { name: 'idle', patch: (i) => ({ ...i, targetKg: i.startKg - 0.5, headlineGainSecPerKm: 1 }), expected: { display: 'idle', idleKind: 'tiny' } },
        { name: 'nothing to qualify', patch: (i) => ({ ...i, centralFactor: 0.01, headlineGainSecPerKm: 0.04 }), expected: { display: 'hidden' } },
        { name: 'lowBodyFat', patch: (i) => ({ ...i, rowUnhealthyFat: true }), expected: { display: 'withheld', withheld: 'lowBodyFat' } },
        { name: 'tooFast', patch: (i) => ({ ...i, targetDate: dateIn(daysForPct(i, 2)) }), expected: { display: 'withheld', withheld: 'tooFast' } },
        { name: 'inputError', patch: (i) => ({ ...i, weeklyKmInvalid: true, weeklyKm: null }), expected: { display: 'withheld', withheld: 'inputError' } },
        { name: 'fastAndHeavy', patch: (i) => ({ ...i, targetDate: dateIn(daysForPct(i, 0.8)), weeklyKm: 60 }), expected: { display: 'withheld', withheld: 'fastAndHeavy' } },
    ];

    it('each gate fires alone', () => {
        for (const g of gates) expect(computeTraining(g.patch(base), today), g.name).toMatchObject(g.expected);
    });

    it('the earlier gate always wins over the later one (every ordered pair)', () => {
        gates.forEach((earlier, a) => {
            gates.slice(a + 1).forEach((later) => {
                // Both conditions are present. The weights of an earlier BMI gate go first (the later patches are relative
                // to them); otherwise the earlier patch goes last so that it also wins any field both of them set.
                const i = earlier.name === 'lowBmi' ? later.patch(earlier.patch(base)) : earlier.patch(later.patch(base));
                expect(computeTraining(i, today), `${earlier.name} beats ${later.name}`).toMatchObject(earlier.expected);
            });
        });
    });

    it('a typo in the distance never hides a more serious message, and a missing distance never helps', () => {
        expect(run({ targetDate: dateIn(21), weeklyKmInvalid: true }).withheld).toBe('tooFast');
        expect(run({ rowUnhealthyFat: true, weeklyKmInvalid: true }).withheld).toBe('lowBodyFat');
        expect(run({ weeklyKmInvalid: true, weeklyKm: null }).withheld).toBe('inputError');
        expect(run({ weeklyKmInvalid: true, weeklyKm: 0 }).withheld).toBe('inputError');
        const typo = run({ weeklyKmInvalid: true });
        expect(typo).toMatchObject({ showHelp: false, showSigns: false, blocksOutputs: false, pointer: 'none', rate: null });
    });

    it('every withheld result except a typo shows the support lines, points from the race cards and blocks the outputs', () => {
        const reasons = ['lowBodyFat', 'tooFast', 'fastAndHeavy'];
        for (const g of gates.filter((x) => reasons.includes(x.expected.withheld ?? ''))) {
            expect(computeTraining(g.patch(base), today), g.name).toMatchObject({ showHelp: true, showSigns: true, blocksOutputs: true, pointer: 'withheld' });
        }
    });

    it('idle and hidden carry no support lines, no pointer and no block', () => {
        for (const r of [run({ targetKg: 79.5, headlineGainSecPerKm: 1 }), run({ baselinePaceSec: 0 }), run({ headlineGainSecPerKm: 0 })]) {
            expect(r).toMatchObject({ showHelp: false, showSigns: false, blocksOutputs: false, pointer: 'none', withheld: null });
            expectNoNumbers(r);
        }
    });

    it('is hidden for non-finite or non-positive inputs, without throwing', () => {
        const bad = [NaN, Infinity, -Infinity, 0, -5];
        for (const key of ['startKg', 'targetKg', 'heightCm', 'baselinePaceSec', 'centralFactor'] as const) {
            for (const v of bad) expect(run({ [key]: v }).display, `${key}=${v}`).toBe('hidden');
        }
        for (const v of [NaN, Infinity, -Infinity]) expect(run({ headlineGainSecPerKm: v }).display).toBe('hidden');
        expect(() => run({ weeklyKm: undefined as unknown as null })).not.toThrow();
        expect(run({ weeklyKm: undefined as unknown as null }).display).toBe('full');
    });
});

describe('the BMI line', () => {
    const kgAt = (bmi: number, heightCm: number) => bmi * (heightCm / 100) ** 2;

    it('withholds below 19.95 and shows from 19.95, at several heights', () => {
        for (const heightCm of [150, 165, 175, 190, 200]) {
            const at = { heightCm, startKg: kgAt(24, heightCm), headlineGainSecPerKm: 8 };
            expect(run({ ...at, targetKg: kgAt(20, heightCm) }).display, `${heightCm} cm, 20.00`).toBe('full');
            expect(run({ ...at, targetKg: kgAt(19.95, heightCm) }).display, `${heightCm} cm, 19.95`).toBe('full');
            expect(run({ ...at, targetKg: kgAt(19.94, heightCm) }), `${heightCm} cm, 19.94`).toMatchObject({ withheld: 'lowBmi', lowBmiAt: 'selected' });
        }
    });

    it('is tolerant of the 0.1 kg table rounding at the floor row and no more', () => {
        const at = { heightCm: 175, startKg: 70, headlineGainSecPerKm: 17.6 };
        expect(run({ ...at, targetKg: 61.2 }).display).toBe('full'); // BMI 19.98
        expect(run({ ...at, targetKg: 61.1 }).display).toBe('full'); // BMI 19.95
        expect(run({ ...at, targetKg: 60.5 }).withheld).toBe('lowBmi'); // BMI 19.76
    });

    it('never recommends, reduces or shows a figure for a weight under the line, whatever the other inputs say', () => {
        for (const targetDate of ['', dateIn(42), dateIn(280)]) {
            for (const weeklyKm of [null, 0, 30, 120]) {
                const r = run({ heightCm: 175, startKg: 70, targetKg: 55, headlineGainSecPerKm: 30, targetDate, weeklyKm });
                expect(r.withheld, `${targetDate} ${weeklyKm}`).toBe('lowBmi');
                expectNoNumbers(r);
                expect(r).toMatchObject({ blocksOutputs: true, pointer: 'withheld', showHelp: true, showSigns: true });
            }
        }
    });

    it('lowBmi beats a nothing-to-qualify, idle, flagged-row, too-fast or typo scenario', () => {
        const low = { heightCm: 175, startKg: 60, targetKg: 55 };
        for (const extra of [{ headlineGainSecPerKm: 0 }, { rowUnhealthyFat: true }, { targetDate: dateIn(21) }, { weeklyKmInvalid: true }, { centralFactor: 0.01, headlineGainSecPerKm: 0.04 }]) {
            expect(run({ ...low, ...extra }).withheld).toBe('lowBmi');
        }
        expect(run({ ...low, targetKg: 59.9 }).withheld).toBe('lowBmi'); // idle-sized change
        expect(run({ ...low, targetKg: 60 }).withheld).toBe('lowBmi'); // no change at all
    });
});

describe('the factor ceiling', () => {
    it('counts the user’s factor at most 3; exactly 3 stands', () => {
        expect(run({ centralFactor: 3, headlineGainSecPerKm: 12 }).factorCapped).toBe(false);
        expect(run({ centralFactor: 3 + 1e-10, headlineGainSecPerKm: 12 }).factorCapped).toBe(false);
        expect(run({ centralFactor: 3.0000001, headlineGainSecPerKm: 12.0000004 }).factorCapped).toBe(true);
        const three = full(run({ centralFactor: 3, headlineGainSecPerKm: 12 }));
        expect(three.factors.realistic).toBe(3);
        expect(three.reasons).toEqual([]);
    });

    it('never lets any figure exceed what a factor of 3 would give', () => {
        for (const c of [3.01, 3.5, 4, 5]) {
            const r = full(run({ centralFactor: c, headlineGainSecPerKm: c * 4 }));
            expect(r.gains.realistic).toBeLessThanOrEqual(12 + 1e-9);
            expect(r.gains.conservative).toBeLessThanOrEqual(r.gains.realistic);
        }
    });

    it('does not list the factor as a reason when the pace cap already binds', () => {
        const r = full(run({ centralFactor: 4, headlineGainSecPerKm: 11 })); // capped at 11, below 3 x 4 kg
        expect(r.gains.realistic).toBe(11);
        expect(r.reduced).toBe(false);
        expect(r.reasons).toEqual([]);
    });

    it('lowers a factor below the band to itself', () => {
        expect(lowestFactor(0.4)).toBe(0.4);
        expect(lowestFactor(1)).toBe(1);
        expect(lowestFactor(2)).toBe(1);
        expect(lowestFactor(4)).toBe(1);
    });
});

describe('notes', () => {
    const notes = (o: Partial<TrainingInput>) => full(run({ targetDate: dateIn(280), weeklyKm: 30, ...o })).notes;
    const kgAt = (bmi: number) => bmi * 1.8 ** 2;

    it('flags a big change at exactly 10 % of body weight and not just under', () => {
        expect(notes({ targetKg: 72, headlineGainSecPerKm: 16 })).toContain('bigOrLean');
        expect(notes({ targetKg: 72.1, headlineGainSecPerKm: 16 })).not.toContain('bigOrLean');
    });
    it('flags a lean selected weight under BMI 22', () => {
        expect(notes({ startKg: 76, targetKg: kgAt(21.99), headlineGainSecPerKm: 9 })).toContain('bigOrLean');
        expect(notes({ startKg: 76, targetKg: kgAt(22), headlineGainSecPerKm: 9 })).not.toContain('bigOrLean');
    });
    it('flags the assumed rate only without a usable date, and a missing distance only when blank', () => {
        expect(full(run({ weeklyKm: 0 })).notes).toEqual(['assumedRate']);
        expect(full(run({ targetDate: dateIn(-5), weeklyKm: 20 })).notes).toEqual(['assumedRate']);
        expect(full(run({ targetDate: dateIn(280), weeklyKm: 0 })).notes).toEqual([]);
        expect(full(run({ targetDate: dateIn(280) })).notes).toEqual(['addKm']);
    });
    it('flags a high load at a sustainable pace from 50 km to just under 100 km, and only there', () => {
        for (const km of [50, 75, 99.99]) expect(notes({ weeklyKm: km })).toEqual(['highLoad']);
        for (const km of [0, 49.99, 100, 250]) expect(notes({ weeklyKm: km })).not.toContain('highLoad');
    });
    it('never offers highLoad next to a brisk pace: that is refused instead', () => {
        for (const km of [50, 75, 99.99]) expect(run({ targetDate: dateIn(42), weeklyKm: km }).withheld).toBe('fastAndHeavy');
    });
    it('keeps a stable order', () => {
        const r = full(run({ startKg: 80, targetKg: 72, headlineGainSecPerKm: 16, weeklyKm: null }));
        expect(r.notes).toEqual(['assumedRate', 'addKm', 'bigOrLean']);
        const high = full(run({ startKg: 80, targetKg: 72, headlineGainSecPerKm: 16, weeklyKm: 60, targetDate: dateIn(280) }));
        expect(high.notes).toEqual(['highLoad', 'bigOrLean']);
    });
    it('never changes a number', () => {
        const plain = full(run({ targetDate: dateIn(280), weeklyKm: 30 }));
        const noted = full(run({ targetDate: dateIn(280), weeklyKm: 60 }));
        expect(noted.gains).toEqual(plain.gains);
        expect(noted.savings10k).toEqual(plain.savings10k);
    });
});

describe('display helpers', () => {
    it('chooseSummary: reduced, flat when the whole seconds agree, else same', () => {
        expect(chooseSummary(full(run({ targetDate: dateIn(42) })))).toBe('reduced');
        expect(chooseSummary(full(run()))).toBe('same');
        expect(chooseSummary(full(run({ centralFactor: 0.5, headlineGainSecPerKm: 2 })))).toBe('flat');
        // Pace cap: 4 s/km at the lowest, 5 shown -> 39 s against 49 s.
        expect(chooseSummary(full(run({ headlineGainSecPerKm: 5 })))).toBe('same');
        // 1 kg change at factor 1.05: 9.8 s against 10.29 s -> 10 and 10 whole seconds.
        expect(chooseSummary(full(run({ targetKg: 79, centralFactor: 1.05, headlineGainSecPerKm: 1.05 })))).toBe('flat');
        expect(chooseSummary(run({ targetDate: dateIn(21) }))).toBeNull();
        expect(chooseSummary(run({ baselinePaceSec: 0 }))).toBeNull();
    });

    it('ceilTenth rounds up with float slack', () => {
        expect(ceilTenth(31.0686)).toBe(31.1);
        expect(ceilTenth(62.137)).toBe(62.2);
        expect(ceilTenth(1.3)).toBe(1.3);
        expect(ceilTenth(0.01 * 130)).toBe(1.3);
        expect(ceilTenth(2.2046)).toBe(2.3);
        expect(ceilTenth(50)).toBe(50);
    });

    const figures = (over: Partial<Parameters<typeof explainerFigures>[0]> = {}) =>
        explainerFigures({ units: 'metric', startKg: 80, centralFactor: 2, baselinePaceSec: 300, ...over });

    it('prints thresholds rounded UP in the user’s unit, never more permissive than the logic', () => {
        expect(figures()).toMatchObject({ central: 2, lowest: 1, ceiling: 3, high: 50, veryHigh: 100, minChange: 1, sust: 0.5, max: 1, bmi: 20 });
        expect(figures().elasticityPct).toBeCloseTo(0.5333, 4);
        expect(figures({ units: 'imperial' })).toMatchObject({ high: 31.1, veryHigh: 62.2, minChange: 2.3 });
        expect(figures({ startKg: 130 }).minChange).toBe(1.3);
        expect(figures({ startKg: 130, units: 'imperial' }).minChange).toBe(2.9); // 1.3 kg = 2.866 lb
        expect(figures({ centralFactor: 0.4 }).lowest).toBe(0.4);
    });

    it('classifies a typed imperial distance from canonical km, so the printed edges are true', () => {
        const km = (mi: number) => mi * 1.609344;
        expect(classifyLoad(km(31.0))).toBe('normal'); // 49.89 km
        expect(classifyLoad(km(31.1))).toBe('high'); // 50.05 km
        expect(classifyLoad(km(62.1))).toBe('high'); // 99.94 km
        expect(classifyLoad(km(62.2))).toBe('veryHigh'); // 100.10 km
    });

    it('derives every printed number from the constants, so changing one changes the text', () => {
        const changed = { ...TRAINING, HIGH_LOAD_KM: 60, VERY_HIGH_LOAD_KM: 120, TINY_LOSS_KG: 2, FACTOR_CEILING: 2.5, BMI_FLOOR: 21 };
        const a = explainerFigures({ units: 'metric', startKg: 80, centralFactor: 2, baselinePaceSec: 300 });
        const b = explainerFigures({ units: 'metric', startKg: 80, centralFactor: 2, baselinePaceSec: 300 }, changed);
        expect(b).toMatchObject({ high: 60, veryHigh: 120, minChange: 2, ceiling: 2.5, bmi: 21 });
        expect(b).not.toEqual(a);
    });
});

describe('integration with the calculator', () => {
    const user: UserInput = { gender: 'male', heightCm: 175, weightKg: 60, bodyFatPercentage: null, thresholdPaceMin: 5, thresholdPaceSec: 0, paceFactorSecPerKg: 2, bmiFloor: 20 };
    const none = { weeklyKm: null, weeklyKmError: null };

    it('uses the entered weight, not the heavier floor row, as the starting point', () => {
        const rows = calculateWeightPaceEstimates(user).resultsTable;
        expect(rows[0].targetWeightKg).toBeGreaterThan(user.weightKg); // the floor quirk
        const r = computeTraining(trainingInputFor(user, rows[0], rows[0].targetWeightKg, none, ''), today);
        expect(r).toMatchObject({ withheld: 'lowBmi', lowBmiAt: 'current', blocksOutputs: false, pointer: 'none', showHelp: true });
        // Starting from rows[0] instead would have hidden the problem.
        const wrong = { ...trainingInputFor(user, rows[0], rows[0].targetWeightKg, none, ''), startKg: rows[0].targetWeightKg };
        expect(computeTraining(wrong, today).display).toBe('idle');
    });

    it('puts the pace of weight change in the same class as the Timeline card, for imperial entries too', () => {
        const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        let compared = 0;
        for (let lb = 120; lb <= 260; lb += 1) {
            for (const inches of [64, 70, 76]) {
                const input: UserInput = { ...user, weightKg: lbToKg(lb), heightCm: inToCm(inches), bmiFloor: 20 };
                const rows = calculateWeightPaceEstimates(input).resultsTable;
                for (let i = 2; i < Math.min(rows.length, 40); i += 3) {
                    // What the Timeline card works from: the table's 0.1 kg weights.
                    const startKg = rows[0].targetWeightKg;
                    const lostKg = startKg - rows[i].targetWeightKg;
                    if (lostKg < 0.25) continue;
                    // The dates the Timeline itself suggests, at the two class limits, where a hair of difference decides the class.
                    for (const pct of [SUSTAINABLE_PCT_PER_WEEK, MAX_PCT_PER_WEEK]) {
                        const targetDate = iso(dateAtRate(startKg, lostKg, today, pct)!.date);
                        const timeline = planByDate(startKg, lostKg, targetDate, today)!;
                        const r = computeTraining(trainingInputFor(input, rows[i], rows[0].targetWeightKg, none, targetDate), today);
                        if (!r.rate) continue;
                        compared++;
                        expect(r.rate.pct, `${lb} lb, ${inches} in, row ${i}, ${pct}%`).toBe(timeline.pctPerWeek);
                        expect(r.rate.risk, `${lb} lb, ${inches} in, row ${i}, ${pct}%`).toBe(timeline.risk);
                    }
                }
            }
        }
        expect(compared).toBeGreaterThan(1000);
    });

    it('never shows a figure below the BMI line, even when the Advanced floor allows it, and blocks the scenario', () => {
        let withheldRows = 0;
        let fullRows = 0;
        for (const heightCm of [150, 165, 175, 190]) {
            for (const weightKg of [55, 70, 95]) {
                for (const gender of ['male', 'female'] as const) {
                    const input: UserInput = { ...user, gender, heightCm, weightKg, bmiFloor: 18.5 };
                    const rows = calculateWeightPaceEstimates(input).resultsTable;
                    for (const row of rows) {
                        const r = computeTraining(trainingInputFor(input, row, rows[0].targetWeightKg, none, ''), today);
                        const bmi = Math.min(weightKg, row.targetWeightKg) / (heightCm / 100) ** 2;
                        if (bmi < TRAINING.BMI_FLOOR - TRAINING.BMI_TOLERANCE) {
                            withheldRows++;
                            expect(r.display, `${heightCm} cm, ${weightKg} kg, row ${row.targetWeightKg}`).toBe('withheld');
                            expect(r.withheld).toBe('lowBmi');
                            expect(r.gains).toBeNull();
                            if (weightKg - row.targetWeightKg >= TRAINING.UNCHANGED_KG) expect(r.blocksOutputs && r.pointer === 'withheld').toBe(true);
                        } else if (r.display === 'full') {
                            fullRows++;
                            expect(row.targetWeightKg / (heightCm / 100) ** 2).toBeGreaterThanOrEqual(TRAINING.BMI_FLOOR - TRAINING.BMI_TOLERANCE);
                        }
                    }
                }
            }
        }
        expect(withheldRows).toBeGreaterThan(20);
        expect(fullRows).toBeGreaterThan(20);
    });

    it('its headline saving equals the race cards’ saving, and table rounding never reads as a reduction', () => {
        for (const weightKg of [80, 75.296, 62.37]) {
            const input: UserInput = { ...user, heightCm: 180, weightKg };
            const rows = calculateWeightPaceEstimates(input).resultsTable;
            for (const i of [2, 5, 9]) {
                if (!rows[i]) continue;
                const r = computeTraining(trainingInputFor(input, rows[i], rows[0].targetWeightKg, none, ''), today);
                if (r.display !== 'full') continue;
                const cards = rows[0].estimated10kTimeSec! - rows[i].estimated10kTimeSec!;
                expect(r.savings10k!.headline).toBeCloseTo(cards, 6);
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
            const r = computeTraining(trainingInputFor(input, capped, rows[0].targetWeightKg, none, targetDate), today);
            expect(r.display).toBe('full');
            expect(r.gains!.headline).toBe(10); // 170 s/km down to the 160 s/km limit
            expect(r.gains!.realistic).toBeLessThanOrEqual(10);
            expect(r.gains!.conservative).toBeLessThanOrEqual(r.gains!.realistic);
        }
    });

    it('is hidden for a runner already faster than the model’s limit', () => {
        const input: UserInput = { ...user, heightCm: 180, weightKg: 75, thresholdPaceMin: 2, thresholdPaceSec: 30 };
        const rows = calculateWeightPaceEstimates(input).resultsTable;
        expect(computeTraining(trainingInputFor(input, rows[6], rows[0].targetWeightKg, none, ''), today).display).toBe('hidden');
    });

    it('maps the row flag, the invalid field and the default factor', () => {
        const rows = calculateWeightPaceEstimates({ ...user, weightKg: 80, heightCm: 180 }).resultsTable;
        const i = trainingInputFor({ ...user, paceFactorSecPerKg: undefined }, { ...rows[4], isPotentiallyUnhealthyFat: true }, rows[0].targetWeightKg, { weeklyKm: null, weeklyKmError: 'training.err.weeklyKm.metric' }, dateIn(10));
        expect(i).toMatchObject({ centralFactor: 2, rowUnhealthyFat: true, weeklyKmInvalid: true, targetDate: dateIn(10), baselinePaceSec: 300 });
    });

    it('does not take the running history as an input: it cannot change a number', () => {
        const rows = calculateWeightPaceEstimates({ ...user, weightKg: 80, heightCm: 180 }).resultsTable;
        const inputs = (['', 'new', 'some', 'veteran'] as const).map((history) =>
            trainingInputFor({ ...user, weightKg: 80, heightCm: 180 }, rows[6], rows[0].targetWeightKg, { weeklyKm: 30, weeklyKmError: null, history } as never, dateIn(42)));
        for (const i of inputs) expect(i).toEqual(inputs[0]);
        expect(Object.keys(inputs[0]).some((k) => /histor|experience|years/i.test(k))).toBe(false);
        const results = inputs.map((i) => computeTraining(i, today));
        for (const r of results) expect(r).toEqual(results[0]);
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
        const lost = rand() < 0.1 ? between(0, 1.6) : between(0, startKg * 0.2);
        const c = rand() < 0.04 ? between(0.001, 0.05) : between(0.1, 5);
        const km = [null, 0, between(0, 60), between(40, 110), between(0, 250), between(240, 300)][Math.floor(rand() * 6)];
        return {
            startKg, targetKg: startKg - lost, heightCm: between(145, 200), baselinePaceSec: between(150, 500),
            headlineGainSecPerKm: rand() < 0.3 ? between(0, c * lost) : c * lost,
            centralFactor: c, rowUnhealthyFat: rand() < 0.1, weeklyKm: km, weeklyKmInvalid: rand() < 0.05,
            targetDate: rand() < 0.3 ? '' : dateIn(1 + Math.floor(rand() * 700)),
        };
    }

    it('keeps every figure between the lowest and the headline, and leaks nothing when not full', () => {
        const rand = rng(42);
        const seen = { full: 0, withheld: 0, idle: 0, hidden: 0 };
        const reasons: Record<string, number> = {};
        const eps = 1e-9;
        for (let n = 0; n < 8000; n++) {
            const input = sample(rand);
            const frozen = deepFreeze(structuredClone(input));
            const r = computeTraining(frozen, today);
            expect(computeTraining(frozen, today)).toEqual(r); // deterministic
            expect(frozen).toEqual(input); // untouched
            seen[r.display]++;
            if (r.withheld) reasons[r.withheld] = (reasons[r.withheld] ?? 0) + 1;

            // The outputs that leave the page, and the pointer, follow the state.
            const typo = r.withheld === 'inputError';
            const noScenario = r.withheld === 'lowBmi' && input.startKg - input.targetKg < TRAINING.UNCHANGED_KG - eps;
            expect(r.blocksOutputs, JSON.stringify(input)).toBe(r.display === 'withheld' ? !typo && !noScenario : r.reduced);
            expect(r.pointer).toBe(r.display === 'withheld' ? (r.blocksOutputs ? 'withheld' : 'none') : r.reduced ? 'reduced' : 'none');
            // One rule for the card, the pointer and the image: whenever the card says anything but "matches", no image is made.
            expect(r.blocksOutputs, JSON.stringify(input)).toBe(r.pointer !== 'none');
            expect(r.showHelp).toBe(r.display === 'withheld' && !typo);
            expect(r.showSigns).toBe(r.display === 'withheld' ? !typo : r.reduced);

            if (r.display !== 'full') {
                expectNoNumbers(r);
                continue;
            }
            const { factors, gains, savings10k } = r;
            const counted = Math.min(input.centralFactor, TRAINING.FACTOR_CEILING);
            expect(factors!.lowest).toBeLessThanOrEqual(factors!.realistic + eps);
            expect(factors!.realistic).toBeLessThanOrEqual(counted + eps);
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
            // A shown conservative figure never reads 0:00, and a lowering is announced only when visible.
            expect(savings10k!.conservative).toBeGreaterThanOrEqual(TRAINING.MIN_SAVING_10K_SEC - eps);
            expect(r.reduced).toBe(Math.round(savings10k!.headline) - Math.round(savings10k!.realistic) >= 1);
            expect(r.reasons.length > 0).toBe(r.reduced);
            // Never a weight under the BMI line, never during a refused pace or load.
            expect(input.targetKg / (input.heightCm / 100) ** 2).toBeGreaterThanOrEqual(TRAINING.BMI_FLOOR - TRAINING.BMI_TOLERANCE - eps);
            expect(r.rate!.risk).not.toBe('aggressive');
            expect(r.rate!.risk === 'brisk' && (r.load === 'high' || r.load === 'veryHigh')).toBe(false);
            expect(input.rowUnhealthyFat).toBe(false);
            expect(input.weeklyKmInvalid).toBe(false);
        }
        // The sweep must actually exercise every outcome.
        expect(seen.full).toBeGreaterThan(1000);
        expect(seen.withheld).toBeGreaterThan(500);
        expect(seen.idle).toBeGreaterThan(100);
        expect(seen.hidden).toBeGreaterThan(30);
        for (const reason of ['lowBmi', 'lowBodyFat', 'tooFast', 'inputError', 'fastAndHeavy']) expect(reasons[reason], reason).toBeGreaterThan(20);
    });

    it('never throws, and shows no number, for hostile input', () => {
        const odd = [NaN, Infinity, -Infinity, 0, -1, 1e308, undefined as unknown as number];
        for (const key of ['startKg', 'targetKg', 'heightCm', 'baselinePaceSec', 'headlineGainSecPerKm', 'centralFactor', 'weeklyKm'] as const) {
            for (const v of odd) {
                expect(() => run({ [key]: v } as Partial<TrainingInput>), `${key}=${v}`).not.toThrow();
                const r = run({ [key]: v } as Partial<TrainingInput>);
                for (const n of [...Object.values(r.gains ?? {}), ...Object.values(r.savings10k ?? {}), ...Object.values(r.factors ?? {})]) expect(Number.isFinite(n)).toBe(true);
            }
        }
        expect(() => run({ targetDate: 'not a date' })).not.toThrow();
    });

    /** A withheld result counts as the lowest figure there is. */
    const score = (r: TrainingResult) => (r.display === 'full' ? r.factors!.realistic : -1);
    const clean = (rand: () => number): TrainingInput => ({ ...sample(rand), rowUnhealthyFat: false, weeklyKmInvalid: false });

    it('never offers more when the pace of weight change goes up (the date moves closer)', () => {
        const rand = rng(7);
        let compared = 0;
        for (let n = 0; n < 400; n++) {
            const input = clean(rand);
            let previous = Infinity;
            for (let days = 800; days >= 1; days -= 13) {
                const r = computeTraining({ ...input, targetDate: dateIn(days) }, today);
                if (r.display !== 'full' && r.display !== 'withheld') break; // idle or hidden does not depend on the date
                expect(score(r)).toBeLessThanOrEqual(previous + 1e-9);
                previous = score(r);
                compared++;
            }
        }
        expect(compared).toBeGreaterThan(5000);
    });

    it('never offers more when the weekly running goes up', () => {
        const rand = rng(11);
        let compared = 0;
        for (let n = 0; n < 400; n++) {
            const input = clean(rand);
            let previous = Infinity;
            for (const weeklyKm of [null, 0, 20, 49.99, 50, 75, 99.99, 100, 250]) {
                const r = computeTraining({ ...input, weeklyKm }, today);
                if (r.display !== 'full' && r.display !== 'withheld') break;
                if (weeklyKm === null) continue; // unknown is its own tier, no allowance either way
                expect(score(r)).toBeLessThanOrEqual(previous + 1e-9);
                previous = score(r);
                compared++;
            }
        }
        expect(compared).toBeGreaterThan(2000);
    });

    it('never offers more when the change grows (the same date, a lighter selected weight)', () => {
        const rand = rng(23);
        let compared = 0;
        for (let n = 0; n < 400; n++) {
            const input = clean(rand);
            let previous = Infinity;
            for (let lost = 1.05; lost < input.startKg * 0.3; lost += 0.5) {
                const r = computeTraining({ ...input, targetKg: input.startKg - lost, headlineGainSecPerKm: input.centralFactor * lost }, today);
                if (r.display === 'hidden' || r.display === 'idle') continue;
                expect(score(r)).toBeLessThanOrEqual(previous + 1e-9);
                previous = score(r);
                compared++;
            }
        }
        expect(compared).toBeGreaterThan(5000);
    });

    it('records that the gain in seconds is not monotone in kg at a tier boundary, and still never exceeds the headline', () => {
        // 80 kg in 10 weeks: 4 kg is exactly 0.5 % a week (unchanged); 4.1 kg is brisk and lowered.
        const at = { startKg: 80, centralFactor: 2, targetDate: dateIn(70), weeklyKm: 30 };
        const exactly = full(run({ ...at, targetKg: 76, headlineGainSecPerKm: 8 }));
        const slightlyMore = full(run({ ...at, targetKg: 75.9, headlineGainSecPerKm: 8.2 }));
        expect(exactly.gains.realistic).toBe(8);
        expect(slightlyMore.gains.realistic).toBeLessThan(exactly.gains.realistic);
        expect(slightlyMore.gains.realistic).toBeLessThanOrEqual(slightlyMore.gains.headline);
    });
});

describe('purity and constants', () => {
    it('reads no clock, randomness, DOM or network', () => {
        const src = readFileSync(new URL('./training.ts', import.meta.url), 'utf8');
        for (const banned of ['Date.now', 'new Date(', 'Math.random', 'window', 'document', 'localStorage', 'fetch(']) {
            expect(src.includes(banned), banned).toBe(false);
        }
    });

    it('are deliberate (change this test together with the explainer and the review sign-off)', () => {
        expect(Object.isFrozen(TRAINING)).toBe(true);
        expect(TRAINING).toEqual({
            CONSERVATIVE_FACTOR: 1,
            FACTOR_CEILING: 3,
            REDUCTION_FRACTION: 0.5,
            HIGH_LOAD_KM: 50,
            VERY_HIGH_LOAD_KM: 100,
            TINY_LOSS_KG: 1,
            TINY_LOSS_PCT: 1,
            UNCHANGED_KG: 0.05,
            BMI_FLOOR: 20,
            BMI_TOLERANCE: 0.05,
            LEAN_BMI: 22,
            BIG_CHANGE_PCT: 10,
            MIN_SAVING_10K_SEC: 0.5,
            WEEKLY_KM_MAX: 250,
            REFERENCE_RACE_KM: 10,
        });
    });
});
