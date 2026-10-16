import { describe, expect, it } from 'vitest';
import { LOCALES, MESSAGES, detectLocale, interpolate, parseRich, pluralSuffix, speakDuration } from './core';
import { en } from './messages/en';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<\/?([brg])>/g)].map((m) => m[0]).sort();

describe('dictionaries', () => {
    for (const locale of LOCALES) {
        it(`${locale} has exactly the English keys`, () => {
            expect(Object.keys(MESSAGES[locale]).sort()).toEqual(Object.keys(en).sort());
        });
        it(`${locale} keeps placeholders and tags intact and has no empty strings`, () => {
            for (const key of Object.keys(en) as (keyof typeof en)[]) {
                const msg = MESSAGES[locale][key];
                expect(msg.trim(), `${locale}:${key}`).not.toBe('');
                expect(placeholders(msg), `${locale}:${key} placeholders`).toEqual(placeholders(en[key]));
                expect(tags(msg), `${locale}:${key} tags`).toEqual(tags(en[key]));
            }
        });
    }
    it('every warning code has a message (with sex variants where used)', () => {
        const codes = ['selectGender', 'invalidHeight', 'invalidWeight', 'bodyFatOutOfRange', 'bodyFatMissing', 'invalidPace', 'leanMassNonPositive', 'paceImprovementTooLarge', 'zeroFat', 'belowFloor', 'disclaimerModel', 'disclaimerHealth'];
        for (const c of codes) expect(en).toHaveProperty(`warn.${c}`);
        for (const c of ['unhealthyFat', 'paceCapped']) {
            expect(en).toHaveProperty(`warn.${c}.male`);
            expect(en).toHaveProperty(`warn.${c}.female`);
        }
    });
});

describe('detectLocale', () => {
    it('prefers ?lang=, then storage, then browser languages', () => {
        expect(detectLocale({ query: '?lang=fr', stored: 'de', languages: ['es'] })).toBe('fr');
        expect(detectLocale({ query: '', stored: 'de', languages: ['es'] })).toBe('de');
        expect(detectLocale({ languages: ['pt-BR', 'es-MX', 'en'] })).toBe('es');
    });
    it('ignores unsupported values and falls back to English', () => {
        expect(detectLocale({ query: '?lang=xx', stored: 'zz', languages: ['ja'] })).toBe('en');
        expect(detectLocale({ query: '?lang=<script>' })).toBe('en');
    });
});

describe('interpolate / parseRich / plural', () => {
    it('formats numbers per locale and leaves unknown params visible', () => {
        expect(interpolate('{a}', { a: 1234.5 }, 'de')).toBe('1.234,5');
        expect(interpolate('{a} {b}', { a: 'x' }, 'en')).toBe('x {b}');
    });
    it('parses tags', () => {
        expect(parseRich('a <b>b</b> c <r>d</r>')).toEqual([
            { text: 'a ', tag: null }, { text: 'b', tag: 'b' }, { text: ' c ', tag: null }, { text: 'd', tag: 'r' },
        ]);
    });
    it('selects plural forms', () => {
        expect(pluralSuffix('en', 1)).toBe('one');
        expect(pluralSuffix('en', 11)).toBe('other');
        expect(pluralSuffix('fr', 0)).toBe('one');
    });
});

describe('speakDuration', () => {
    it('spells durations out', () => {
        expect(speakDuration(6451, 'en')).toBe('1 hour, 47 minutes, and 31 seconds');
        expect(speakDuration(29, 'en')).toBe('29 seconds');
        expect(speakDuration(60, 'en')).toBe('1 minute');
        expect(speakDuration(0, 'en')).toBe('0 seconds');
    });
    it('is localised', () => {
        expect(speakDuration(6451, 'de')).toMatch(/Stunde.*Minuten.*Sekunden/);
        expect(speakDuration(90, 'fr')).toMatch(/minute.*seconde/);
        expect(speakDuration(90, 'es')).toMatch(/minuto.*segundo/);
    });
});
