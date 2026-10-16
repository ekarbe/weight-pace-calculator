import { describe, expect, it } from 'vitest';
import { cmToIn, inToCm, kgToLb, lbToKg, secPerKmToSecPerMile, secPerMileToSecPerKm } from './units';
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
        const f = { ...emptyForm, gender: 'female' as const, height: '170', weight: '60.5', paceMin: '4', paceSec: '5', units: 'imperial' as const };
        expect(decodeForm(encodeForm(f))).toEqual(f);
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
