import { describe, expect, it } from 'vitest';
import { buildInput } from './form';
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
});
