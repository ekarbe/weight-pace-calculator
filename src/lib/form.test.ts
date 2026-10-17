import { describe, expect, it } from 'vitest';
import { buildInput, buildTraining } from './form';
import { emptyForm } from './share';

const adv = { paceFactor: '2', bmiFloor: '20' };
const ok = { ...emptyForm, gender: 'male' as const, height: '180', weight: '80', paceMin: '4', paceSec: '30' };

describe('buildInput', () => {
    it('builds a metric input', () => {
        const { input } = buildInput(ok, adv);
        expect(input).toMatchObject({ heightCm: 180, weightKg: 80, thresholdPaceMin: 4, thresholdPaceSec: 30 });
    });
    it('converts imperial input', () => {
        const { input } = buildInput({ ...ok, units: 'imperial', height: '70.9', weight: '176', paceMin: '7', paceSec: '15' }, adv);
        expect(input!.heightCm).toBeCloseTo(180.1, 0);
        expect(input!.weightKg).toBeCloseTo(79.8, 1);
        expect(input!.thresholdPaceMin * 60 + input!.thresholdPaceSec).toBe(270);
    });
    it('reports missing fields without errors', () => {
        const r = buildInput(emptyForm, adv);
        expect(r.input).toBeNull();
        expect(r.missing).toEqual(['gender', 'height', 'weight', 'pace']);
        expect(r.errors).toEqual({});
    });
    it('reports field errors', () => {
        const r = buildInput({ ...ok, height: '20', bodyFat: '3', paceSec: '75' }, adv);
        expect(r.input).toBeNull();
        expect(Object.keys(r.errors).sort()).toEqual(['bodyFat', 'height', 'pace']);
    });
    it('rejects out-of-range advanced values', () => {
        expect(buildInput(ok, { paceFactor: '9', bmiFloor: '20' }).errors.advanced).toBeTruthy();
        expect(buildInput(ok, { paceFactor: '2', bmiFloor: '15' }).input).toBeNull();
    });
    it('validates the optional custom distance in the selected units', () => {
        expect(buildInput({ ...ok, distance: '15' }, adv).customDistanceKm).toBe(15);
        expect(buildInput({ ...ok, units: 'imperial', height: '71', weight: '176', paceMin: '7', paceSec: '0', distance: '10' }, adv).customDistanceKm).toBeCloseTo(16.09, 2);
        expect(buildInput({ ...ok, distance: '500' }, adv).errors.distance).toBeTruthy();
        expect(buildInput({ ...ok, distance: '' }, adv).customDistanceKm).toBeNull();
    });
});

describe('buildTraining', () => {
    const km = (weeklyKm: string, extra: Partial<typeof ok> = {}) => buildTraining({ ...ok, ...extra, weeklyKm });
    it('treats a blank distance as unknown, not as an error', () => {
        expect(km('')).toEqual({ weeklyKm: null, weeklyKmError: null, history: null });
        expect(km('  ')).toEqual({ weeklyKm: null, weeklyKmError: null, history: null });
    });
    it('accepts 0 to 250 km in metric', () => {
        expect(km('0').weeklyKm).toBe(0);
        expect(km('30').weeklyKm).toBe(30);
        expect(km('42.5').weeklyKm).toBe(42.5);
        expect(km('250').weeklyKm).toBe(250);
        expect(km('250').weeklyKmError).toBeNull();
    });
    it('rejects anything else with the metric message, and returns no distance', () => {
        for (const bad of ['250.1', '251', '-1', '-0.5', 'abc', '1e3', '1e2', '30abc', 'Infinity', '--5', '40.', '1,5', 'NaN', '0x10', '1234', '4 0', '+5', '.', '1.234']) {
            expect(km(bad), bad).toEqual({ weeklyKm: null, weeklyKmError: 'training.err.weeklyKm.metric', history: null });
        }
    });
    it('accepts a leading or trailing space, a bare fraction and two decimals', () => {
        expect(km(' 40 ').weeklyKm).toBe(40);
        expect(km('.5').weeklyKm).toBe(0.5);
        expect(km('12.34').weeklyKm).toBeCloseTo(12.34, 9);
        expect(km('0.0').weeklyKm).toBe(0);
        expect(km('999').weeklyKmError).toBe('training.err.weeklyKm.metric'); // three digits, over the maximum
    });
    it('converts miles to km and limits to 155.3 mi', () => {
        expect(km('30', { units: 'imperial' }).weeklyKm).toBeCloseTo(48.28, 2);
        expect(km('155', { units: 'imperial' }).weeklyKm).toBeCloseTo(249.45, 2);
        expect(km('155.3', { units: 'imperial' }).weeklyKm).toBeCloseTo(249.93, 2); // still within 250 km
        expect(km('155.3', { units: 'imperial' }).weeklyKmError).toBeNull();
        expect(km('155.4', { units: 'imperial' })).toMatchObject({ weeklyKm: null, weeklyKmError: 'training.err.weeklyKm.imperial' }); // 250.09 km
        expect(km('156', { units: 'imperial' })).toMatchObject({ weeklyKm: null, weeklyKmError: 'training.err.weeklyKm.imperial' });
        expect(km('-1', { units: 'imperial' }).weeklyKmError).toBe('training.err.weeklyKm.imperial');
        expect(km('1e2', { units: 'imperial' }).weeklyKmError).toBe('training.err.weeklyKm.imperial');
    });
    it('whitelists the running history', () => {
        for (const h of ['new', 'some', 'veteran'] as const) expect(buildTraining({ ...ok, trainingHistory: h }).history).toBe(h);
        expect(buildTraining({ ...ok, trainingHistory: '' }).history).toBeNull();
        expect(buildTraining({ ...ok, trainingHistory: 'expert' as never }).history).toBeNull();
    });
    it('never blanks the main results', () => {
        expect(buildInput({ ...ok, weeklyKm: '999' }, adv).input).not.toBeNull();
        expect(buildInput({ ...ok, weeklyKm: '999' }, adv).errors).toEqual({});
        expect(buildInput({ ...ok, weeklyKm: '40', trainingHistory: 'some' }, adv)).toEqual(buildInput(ok, adv));
    });
});
