import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES, MESSAGES } from './core';
import { en } from './messages/en';
import { training } from './messages/parts/training';
import { TRAINING_HISTORIES, type NoteCode, type WithheldReason } from '../lib/training';

const keys = Object.keys(training.en);
const english = Object.entries(training.en) as [string, string][];

// Compile-time exhaustiveness: adding a reason or a note without listing it here fails the typecheck.
const WITHHELD: Record<WithheldReason, true> = { lowBmi: true, lowBodyFat: true, inputError: true, tooFast: true, fastAndHeavy: true };
const NOTES: Record<NoteCode, true> = { assumedRate: true, addKm: true, bigOrLean: true, tiny: true };

describe('training messages: structure', () => {
    it('are all namespaced and part of the app dictionary in every language', () => {
        expect(keys.length).toBeGreaterThanOrEqual(40);
        for (const locale of LOCALES) {
            expect(Object.keys(training[locale]).sort(), locale).toEqual([...keys].sort());
            for (const k of keys) expect(MESSAGES[locale], `${locale}:${k}`).toHaveProperty(k);
        }
        for (const k of keys) expect(k.startsWith('training.'), k).toBe(true);
        expect(en).toHaveProperty('training.heading');
    });

    it('have a message for every state, reason, note, history and field error the card can show', () => {
        const wanted = [
            ...['same', 'reduced', 'withheld'].map((s) => `training.state.${s}`),
            ...['same', 'reduced'].map((s) => `training.summary.${s}`),
            ...['known', 'unknown'].map((s) => `training.status.${s}`),
            ...['brisk', 'veryHigh'].map((s) => `training.reduced.${s}`),
            ...Object.keys(WITHHELD).map((r) => `training.withheld.${r}`),
            ...Object.keys(NOTES).map((n) => `training.note.${n}`),
            ...[...TRAINING_HISTORIES, 'unknown'].map((h) => `training.context.${h}`),
            ...[...TRAINING_HISTORIES, 'none'].map((h) => `training.history.${h}`),
            'training.err.weeklyKm.metric', 'training.err.weeklyKm.imperial',
            'training.heading', 'training.intro', 'training.idle', 'training.keep', 'training.help', 'training.signs',
            ...['start', 'rate', 'load', 'proxy', 'limits'].map((h) => `training.how.${h}`),
        ];
        for (const k of wanted) expect(keys, k).toContain(k);
    });

    it('is referenced by the card or the form builder (no dead strings)', () => {
        const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
        const source = read('../components/calculator/training-card.tsx') + read('../lib/form.ts');
        const templatePrefixes = [...source.matchAll(/(training\.[\w.]*?)\$\{/g)].map((m) => m[1]);
        for (const k of keys) {
            expect(source.includes(k) || templatePrefixes.some((p) => k.startsWith(p)), `unused: ${k}`).toBe(true);
        }
    });
});

describe('training messages: safety copy lint (English)', () => {
    const banned = /calorie|kcal|deficit|\bdiet(s|ing)?\b|\bburn|\bshed\b|\blose (more|weight|fat)|goal weight|ideal weight|overweight|obese|skinny|diagnos|you have |you are suffering|\btreat|\bcure\b|prescri|RED-?S|!/i;
    const wording = /target weight|\bgoal\b|\bideal\b|\bperfect\b|\bwell done\b|\bgreat\b|congrat|all clear|you are fine|you’re fine|\bok\b|no problem/i;

    it('contains no calorie, diet, diagnosis, praise or exclamation wording', () => {
        for (const [k, v] of english) {
            expect(v, k).not.toMatch(banned);
            expect(v, k).not.toMatch(wording);
        }
    });
    it('contains no emoji and stays short', () => {
        for (const [k, v] of english) {
            expect(v, k).not.toMatch(/\p{Extended_Pictographic}/u);
            expect(v.length, k).toBeLessThan(360);
        }
    });
    it('shows no number where none is allowed: states, withheld reasons and context carry only placeholders', () => {
        for (const [k, v] of english) {
            if (/^training\.(state|withheld|context|reduced|help|signs|idle|keep)\b/.test(k)) expect(v, k).not.toMatch(/\d/);
        }
        // The tooFast rate threshold is passed in, not typed.
        expect(training.en['training.withheld.tooFast']).toContain('{max}');
    });
    it('never offers a numeric training gain or claims weight is the bigger lever', () => {
        for (const [k, v] of english) {
            if (k.startsWith('training.context.')) expect(v, k).not.toMatch(/%|\d|bigger lever|larger lever|more than training/i);
        }
        expect(training.en['training.context.veteran']).toMatch(/not a shortcut/);
    });
    it('keeps the assumption and the supportive help line', () => {
        expect(training.en['training.keep']).toMatch(/steady/);
        expect(training.en['training.keep']).toMatch(/enough energy/);
        expect(training.en['training.help']).toMatch(/doctor/);
        expect(training.en['training.help']).toMatch(/dietitian/);
        expect(training.en['training.help']).toMatch(/eating-disorder/);
        expect(training.en['training.signs']).toMatch(/cannot assess/);
    });
});

describe('training messages: banned vocabulary in the other languages', () => {
    const banned = {
        de: /Diät|Kalorie|abnehm|Idealgewicht|Wunschgewicht|Zielgewicht|Übergewicht|fettleibig|Magersucht|diagnos|!/i,
        es: /\bdieta\b|\bdietas\b|calor[ií]as?|adelgaz|peso ideal|peso objetivo|sobrepeso|obes|diagnóstic|!/i,
        fr: /\brégime\b|calories?|maigr|poids idéal|poids cible|surpoids|obès|diagnostic|!/i,
    } as const;
    for (const locale of ['de', 'es', 'fr'] as const) {
        it(`${locale} avoids diet, calorie and body-ideal wording`, () => {
            for (const [k, v] of Object.entries(training[locale])) {
                expect(v, `${locale}:${k}`).not.toMatch(banned[locale]);
                expect(v, `${locale}:${k}`).not.toMatch(/\p{Extended_Pictographic}/u);
            }
        });
    }
});
