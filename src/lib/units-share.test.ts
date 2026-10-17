import { describe, expect, it } from 'vitest';
import { KM_PER_MILE, cmToIn, inToCm, kgToLb, lbToKg, secPerKmToSecPerMile, secPerMileToSecPerKm } from './units';
import { buildTraining, convertWeeklyDistance } from './form';
import { classifyLoad } from './training';
import { decodeForm, emptyForm, encodeForm } from './share';
import { formatPace, formatTime } from './utils';

describe('units', () => {
    it('round-trips', () => {
        expect(lbToKg(kgToLb(75))).toBeCloseTo(75);
        expect(inToCm(cmToIn(180))).toBeCloseTo(180);
        expect(secPerMileToSecPerKm(secPerKmToSecPerMile(270))).toBeCloseTo(270);
    });
    it('converts 5:00/km to ~8:03/mi', () => {
        expect(formatPace(secPerKmToSecPerMile(300))).toBe('8:03');
    });
});

describe('share', () => {
    it('round-trips form state', () => {
        const f = { ...emptyForm, gender: 'female' as const, height: '170', weight: '60.5', paceMin: '4', paceSec: '5', units: 'imperial' as const, distance: '15', targetDate: '2026-09-01' };
        expect(decodeForm(encodeForm(f))).toEqual(f);
    });
    it('round-trips the training fields and leaves empty ones out of the link', () => {
        const f = { ...emptyForm, gender: 'male' as const, height: '180', weight: '80', paceMin: '5', paceSec: '0', weeklyKm: '42.5', trainingHistory: 'some' as const };
        expect(decodeForm(encodeForm(f))).toEqual(f);
        expect(encodeForm(f)).toContain('wk=42.5');
        expect(encodeForm(f)).toContain('th=some');
        expect(encodeForm({ ...f, weeklyKm: '', trainingHistory: '' })).not.toMatch(/wk=|th=/);
    });
    it('validates the training fields in a shared link', () => {
        expect(decodeForm('th=hacker&wk=<script>')).toEqual(emptyForm);
        expect(decodeForm('wk=99999').weeklyKm).toBe('');
        expect(decodeForm('wk=-5').weeklyKm).toBe('');
        expect(decodeForm('wk=1e3').weeklyKm).toBe('');
        expect(decodeForm('th=NEW').trainingHistory).toBe('');
        expect(decodeForm('th=veteran').trainingHistory).toBe('veteran');
        expect(decodeForm('wk=40').weeklyKm).toBe('40');
    });
    it('round-trips the weekly distance in both units, and the link holds inputs only', () => {
        for (const units of ['metric', 'imperial'] as const) {
            for (const history of ['', 'new', 'some', 'veteran'] as const) {
                const f = { ...emptyForm, units, gender: 'female' as const, height: '170', weight: '64', paceMin: '5', paceSec: '0', weeklyKm: '31.1', trainingHistory: history };
                expect(decodeForm(encodeForm(f))).toEqual(f);
            }
        }
        const link = encodeForm({ ...emptyForm, units: 'imperial', gender: 'male', height: '70', weight: '170', paceMin: '8', paceSec: '0', weeklyKm: '25', trainingHistory: 'some', targetDate: '2026-09-01' });
        expect(link).toContain('wk=25');
        // Results are never stored in the link: only the keys of the form.
        expect([...new URLSearchParams(link).keys()].sort()).toEqual(['g', 'h', 'pm', 'ps', 'td', 'th', 'u', 'w', 'wk']);
        expect(link).not.toMatch(/reduced|withheld|estimate|gain|saving/i);
    });
    it('lets an out-of-range distance through so the card can flag it, and drops what is not a distance', () => {
        expect(decodeForm('wk=9999').weeklyKm).toBe('9999'); // becomes an input error in the card, never a guess
        expect(buildTraining({ ...emptyForm, weeklyKm: '9999' }).weeklyKmError).toBe('training.err.weeklyKm.metric');
        for (const bad of ['99999', '-5', '<script>', '1e2', '0x10', 'NaN', '4 0', '1,5', '12.345']) expect(decodeForm(`wk=${encodeURIComponent(bad)}`).weeklyKm, bad).toBe('');
        for (const bad of ['NEW', 'Some', 'hacker', '', ' veteran', 'veteran ']) expect(decodeForm(`th=${encodeURIComponent(bad)}`).trainingHistory, JSON.stringify(bad)).toBe('');
    });
    it('every distance the form accepts survives a round trip', () => {
        for (const units of ['metric', 'imperial'] as const) {
            for (const wk of ['0', '5', '40', '42.5', '99.99', '100', '155.3', '249', '250', '.5', '0.25']) {
                const f = { ...emptyForm, units, weeklyKm: wk };
                if (buildTraining(f).weeklyKmError) continue;
                expect(decodeForm(encodeForm(f)).weeklyKm, `${units} ${wk}`).toBe(wk);
            }
        }
    });
    it('rejects a malformed date', () => {
        expect(decodeForm('td=2026-9-1&h=180').targetDate).toBe('');
    });
    it('rejects garbage', () => {
        const f = decodeForm('h=<script>&g=alien&w=abc&u=x');
        expect(f).toEqual(emptyForm);
    });
});

describe('formatting', () => {
    it('never renders :60', () => {
        expect(formatPace(299.6)).toBe('5:00');
        expect(formatTime(3599.7)).toBe('01:00:00');
    });
});

describe('convertWeeklyDistance (the unit toggle)', () => {
    const tier = (text: string, units: 'metric' | 'imperial') => {
        const f = buildTraining({ ...emptyForm, units, weeklyKm: text });
        return f.weeklyKmError ? 'invalid' : classifyLoad(f.weeklyKm);
    };

    it('keeps 100 km very high and 50 km high across the toggle, and brings the typed value back', () => {
        expect(convertWeeklyDistance('100', true)).toBe('62.14');
        expect(tier('62.14', 'imperial')).toBe('veryHigh');
        expect(convertWeeklyDistance('62.14', false)).toBe('100');
        expect(convertWeeklyDistance('50', true)).toBe('31.07');
        expect(tier('31.07', 'imperial')).toBe('high');
        expect(convertWeeklyDistance('31.07', false)).toBe('50');
        expect(convertWeeklyDistance('40', true)).toBe('24.85');
        expect(convertWeeklyDistance('24.85', false)).toBe('40');
    });
    it('leaves a blank or unreadable value alone', () => {
        for (const v of ['', ' ', 'abc']) {
            expect(convertWeeklyDistance(v, true)).toBe(v);
            expect(convertWeeklyDistance(v, false)).toBe(v);
        }
    });
    it('never moves the load tier, or the validity of the entry, for any distance with up to two decimals', () => {
        let checked = 0;
        for (let h = 0; h <= 26000; h++) {
            const km = String(h / 100);
            const mi = String(Math.round((h / 100 / KM_PER_MILE) * 100) / 100);
            const there = convertWeeklyDistance(km, true);
            expect(tier(there, 'imperial'), `${km} km -> ${there} mi`).toBe(tier(km, 'metric'));
            const back = convertWeeklyDistance(mi, false);
            expect(tier(back, 'metric'), `${mi} mi -> ${back} km`).toBe(tier(mi, 'imperial'));
            checked += 2;
        }
        expect(checked).toBe(52002);
    });
    it('returns to the typed text for whole and one-decimal kilometres and for whole miles', () => {
        for (let t = 0; t <= 2500; t++) {
            const km = String(t / 10);
            expect(convertWeeklyDistance(convertWeeklyDistance(km, true), false), `${km} km`).toBe(km);
        }
        for (let mi = 0; mi <= 155; mi++) {
            expect(convertWeeklyDistance(convertWeeklyDistance(String(mi), false), true), `${mi} mi`).toBe(String(mi));
        }
    });
});
