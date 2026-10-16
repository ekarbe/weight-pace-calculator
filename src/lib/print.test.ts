import { describe, expect, it } from 'vitest';
import { appUrl, createDetailsExpander, printFacts } from './print';
import { emptyForm, type FormState } from './share';
import { kgToLb } from './units';

const adv = { paceFactor: '2', bmiFloor: '20' };
const today = new Date(2026, 0, 1, 15, 30);
const form = (patch: Partial<FormState> = {}): FormState => ({
    ...emptyForm, gender: 'female', height: '170', weight: '64', bodyFat: '22', paceMin: '5', paceSec: '0', distance: '15', ...patch,
});

describe('createDetailsExpander', () => {
    it('opens everything and restores each details to its previous state', () => {
        const a = { open: false };
        const b = { open: true };
        const c = { open: false };
        const x = createDetailsExpander();
        x.open([a, b, c]);
        expect([a.open, b.open, c.open]).toEqual([true, true, true]);
        x.restore();
        expect([a.open, b.open, c.open]).toEqual([false, true, false]);
    });
    it('is idempotent: a second open (beforeprint + matchMedia fallback) must not remember the opened state', () => {
        const a = { open: false };
        const x = createDetailsExpander();
        x.open([a]);
        x.open([a]);
        x.restore();
        expect(a.open).toBe(false);
        x.restore(); // afterprint can fire twice as well
        expect(a.open).toBe(false);
    });
    it('opens details that appear between two calls and handles an empty page', () => {
        const a = { open: false };
        const late = { open: false };
        const x = createDetailsExpander();
        x.open([]);
        x.open([a]);
        x.open([a, late]);
        x.restore();
        expect([a.open, late.open]).toEqual([false, false]);
    });
    it('can be used for several print jobs in a row', () => {
        const a = { open: false };
        const x = createDetailsExpander();
        x.open([a]);
        x.restore();
        a.open = true; // the user opened it in between
        x.open([a]);
        x.restore();
        expect(a.open).toBe(true);
    });
});

describe('appUrl', () => {
    it('drops the query and hash so measurements never reach the printout', () => {
        expect(appUrl('https://eikekarbe.com/weight-pace-calculator/?g=female&h=170&w=64#x')).toBe('https://eikekarbe.com/weight-pace-calculator/');
        expect(appUrl('http://localhost:3214/weight-pace-calculator?lang=de')).toBe('http://localhost:3214/weight-pace-calculator');
    });
    it('keeps ports and tolerates garbage', () => {
        expect(appUrl('http://localhost:3000/')).toBe('http://localhost:3000/');
        expect(appUrl('not a url')).toBe('');
        expect(appUrl('')).toBe('');
    });
});

describe('printFacts', () => {
    it('lists what the user entered, in the user’s units', () => {
        const f = printFacts(form(), adv, { startKg: 64, targetKg: 60.5 }, today);
        expect(f).toMatchObject({ units: 'metric', sex: 'female', height: 170, weight: 64, bodyFat: 22, pace: '5:00', distance: 15, paceGain: 2, bmiFloor: 20 });
        expect(f.target.weight).toBe(60.5);
        expect(f.target.lost).toBeCloseTo(3.5, 5);
    });
    it('converts the target to pounds for imperial users but keeps the typed values', () => {
        const f = printFacts(form({ units: 'imperial', height: '67', weight: '141', paceMin: '8', paceSec: '5', distance: '9.3' }), adv, { startKg: 64, targetKg: 60 }, today);
        expect(f).toMatchObject({ units: 'imperial', height: 67, weight: 141, pace: '8:05', distance: 9.3 });
        expect(f.target.weight).toBeCloseTo(kgToLb(60), 5);
        expect(f.target.lost).toBeCloseTo(kgToLb(4), 5);
    });
    it('shows the typed weight (not a rounded conversion) when nothing is lost', () => {
        const f = printFacts(form({ units: 'imperial', weight: '141.3' }), adv, { startKg: 64.1, targetKg: 64.1 }, today);
        expect(f.target).toEqual({ weight: 141.3, lost: 0 });
    });
    it('treats a negative difference as no loss', () => {
        expect(printFacts(form(), adv, { startKg: 60, targetKg: 64 }, today).target.lost).toBe(0);
    });
    it('omits optional and blank values instead of printing placeholders', () => {
        const f = printFacts(form({ gender: '', bodyFat: '', distance: '', height: '', weight: '', paceMin: '', paceSec: '' }), adv, { startKg: 64, targetKg: 64 }, today);
        expect(f).toMatchObject({ sex: null, bodyFat: null, distance: null, height: null, weight: null, pace: null, targetDate: null });
    });
    it('ignores implausible body fat and impossible paces', () => {
        expect(printFacts(form({ bodyFat: '3' }), adv, { startKg: 64, targetKg: 64 }, today).bodyFat).toBeNull();
        expect(printFacts(form({ bodyFat: '71' }), adv, { startKg: 64, targetKg: 64 }, today).bodyFat).toBeNull();
        expect(printFacts(form({ bodyFat: '70' }), adv, { startKg: 64, targetKg: 64 }, today).bodyFat).toBe(70);
        expect(printFacts(form({ paceMin: '0', paceSec: '0' }), adv, { startKg: 64, targetKg: 64 }, today).pace).toBeNull();
        expect(printFacts(form({ paceMin: '4', paceSec: '75' }), adv, { startKg: 64, targetKg: 64 }, today).pace).toBeNull();
        expect(printFacts(form({ paceMin: '4', paceSec: '5' }), adv, { startKg: 64, targetKg: 64 }, today).pace).toBe('4:05');
    });
    it('only reports a target date that the timeline card also accepts', () => {
        const sel = { startKg: 70, targetKg: 66 };
        expect(printFacts(form({ targetDate: '2026-06-01' }), adv, sel, today).targetDate).toBe('2026-06-01');
        expect(printFacts(form({ targetDate: '2025-12-31' }), adv, sel, today).targetDate).toBeNull();
        expect(printFacts(form({ targetDate: '2026-02-30' }), adv, sel, today).targetDate).toBeNull();
        expect(printFacts(form({ targetDate: '2026-06-01' }), adv, { startKg: 70, targetKg: 70 }, today).targetDate).toBeNull();
    });
    it('reports the model assumptions that shaped the numbers', () => {
        const f = printFacts(form(), { paceFactor: '1.5', bmiFloor: '21.5' }, { startKg: 64, targetKg: 60 }, today);
        expect([f.paceGain, f.bmiFloor]).toEqual([1.5, 21.5]);
        expect(printFacts(form(), { paceFactor: '', bmiFloor: 'x' }, { startKg: 64, targetKg: 60 }, today)).toMatchObject({ paceGain: null, bmiFloor: null });
    });
});
