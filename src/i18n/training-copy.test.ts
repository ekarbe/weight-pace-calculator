import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES, MESSAGES, interpolate } from './core';
import { en } from './messages/en';
import { training } from './messages/parts/training';
import { explainerFigures, TRAINING, TRAINING_HISTORIES, type IdleKind, type LowBmiAt, type NoteCode, type ReducedReason, type WithheldReason } from '../lib/training';

const keys = Object.keys(training.en);
const english = Object.entries(training.en) as [string, string][];
const text = (k: string) => (training.en as Record<string, string>)[k];

// Compile-time exhaustiveness: adding a code without listing it here fails the typecheck, and so does a missing message below.
const WITHHELD: Record<WithheldReason, true> = { lowBmi: true, lowBodyFat: true, inputError: true, tooFast: true, fastAndHeavy: true };
const NOTES: Record<NoteCode, true> = { assumedRate: true, addKm: true, highLoad: true, bigOrLean: true };
const REDUCED: Record<ReducedReason, true> = { brisk: true, veryHigh: true, factor: true };
const IDLE: Record<IdleKind, true> = { none: true, tiny: true };
const LOW_BMI_AT: Record<LowBmiAt, true> = { current: true, selected: true };

/** Strings that must be numberless: whatever number they mention arrives as a placeholder. */
const NUMBERLESS = /^training\.(state|withheld|context|reduced|help|signs|idle|keep|pointer|output)\b/;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const bolds = (s: string) => (s.match(/<b>/g) ?? []).length;

describe('training messages: structure', () => {
  it('are all namespaced and part of the app dictionary in every language', () => {
    expect(keys.length).toBeGreaterThanOrEqual(55);
    for (const locale of LOCALES) {
      expect(Object.keys(training[locale]).sort(), locale).toEqual([...keys].sort());
      for (const k of keys) expect(MESSAGES[locale], `${locale}:${k}`).toHaveProperty(k);
    }
    for (const k of keys) expect(k.startsWith('training.'), k).toBe(true);
    expect(en).toHaveProperty('training.heading');
  });

  it('have a message for every state, reason, note, history and field error the UI can show', () => {
    const wanted = [
      ...['same', 'reduced', 'withheld'].map((s) => `training.state.${s}`),
      ...['same', 'flat', 'reduced', 'unchecked'].map((s) => `training.summary.${s}`),
      ...['known', 'unknown'].map((s) => `training.status.${s}`),
      ...Object.keys(REDUCED).map((r) => `training.reduced.${r}`),
      ...Object.keys(WITHHELD).filter((r) => r !== 'lowBmi').map((r) => `training.withheld.${r}`),
      ...Object.keys(LOW_BMI_AT).map((r) => `training.withheld.lowBmi.${r}`),
      ...Object.keys(NOTES).map((n) => `training.note.${n}`),
      ...Object.keys(IDLE).map((n) => `training.idle.${n}`),
      ...[...TRAINING_HISTORIES, 'unknown'].map((h) => `training.context.${h}`),
      ...[...TRAINING_HISTORIES, 'none'].map((h) => `training.history.${h}`),
      ...['reduced', 'withheld'].map((p) => `training.pointer.${p}`),
      'training.err.weeklyKm.metric', 'training.err.weeklyKm.imperial',
      'training.heading', 'training.intro', 'training.keep', 'training.help', 'training.signs', 'training.scope', 'training.output.shareBlocked',
      ...['start', 'check', 'rate', 'load', 'small', 'floor', 'proxy', 'limits'].map((h) => `training.how.${h}`),
    ];
    for (const k of wanted) expect(keys, k).toContain(k);
  });

  it('has none of the removed keys', () => {
    for (const k of ['training.idle', 'training.withheld.lowBmi', 'training.note.tiny']) {
      for (const locale of LOCALES) expect(MESSAGES[locale], `${locale}:${k}`).not.toHaveProperty(k);
    }
  });

  it('is referenced by the card, the race cards, the share card or the form builder (no dead strings)', () => {
    const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
    const source = ['../components/calculator/training-card.tsx', '../components/calculator/race-cards.tsx', '../components/calculator/share-image-card.tsx', '../lib/form.ts']
      .map(read).join('\n');
    const templatePrefixes = [...source.matchAll(/(training\.[\w.]*?)\$\{/g)].map((m) => m[1]);
    for (const k of keys) {
      expect(source.includes(k) || templatePrefixes.some((p) => k.startsWith(p)), `unused: ${k}`).toBe(true);
    }
  });

  it('keeps the same placeholders and the same emphasis tags in every language', () => {
    for (const k of keys) {
      for (const locale of LOCALES) {
        expect(placeholders(training[locale][k as keyof typeof training.en]), `${locale}:${k}`).toEqual(placeholders(text(k)));
        expect(bolds(training[locale][k as keyof typeof training.en]), `${locale}:${k} <b>`).toBe(bolds(text(k)));
        expect(training[locale][k as keyof typeof training.en], `${locale}:${k}`).not.toMatch(/<[rg]>|<\/?(?!b>)[a-z]+>/);
      }
    }
  });

  it('only asks for placeholders that the card supplies', () => {
    const supplied: Record<string, string[]> = {
      'training.summary': ['race', 'realistic', 'conservative', 'headline', 'veryHigh', 'unit'],
      'training.status': ['risk', 'pct', 'km', 'unit'],
      'training.reduced.factor': ['max'],
      'training.note.assumedRate': ['pct'],
      'training.weeklyKm.label': ['unit'],
      'training.how': ['central', 'lowest', 'ceiling', 'elasticity', 'sust', 'max', 'high', 'veryHigh', 'unit', 'minChange', 'bmi'],
    };
    for (const [k, v] of english) {
      const group = Object.keys(supplied).filter((p) => k.startsWith(p)).sort((a, b) => b.length - a.length)[0];
      for (const p of placeholders(v)) expect(group && supplied[group], `${k} {${p}}`).toContain(p);
      if (!group) expect(placeholders(v), k).toEqual([]);
    }
  });
});

describe('training messages: safety copy lint (English)', () => {
  // Ed-sensitive vocabulary (weight loss as a goal, restriction, reward and blame) and body-ideal wording.
  const banned = /\b(lose|loses|losing|lost|shed|shedding|cut|cuts|cutting|burn|burning|slim|thin|skinny|overweight|obese|clean|cheat|guilt|guilty|junk|earn|deserve|reward|punish|willpower|discipline|strict|fasting|diet|diets|dieting|calories?|kcal|deficit|macros?)\b|target weight|\bgoals?\b|\bideal\b|race weight|diagnos|\byou have |you are suffering|\btreat|\bcure\b|prescri|RED-?S|!/i;
  // Praise, clearance and reassurance. Comparatives ("safer") are allowed.
  const praise = /\b(ok|okay|fine|safe|healthy|all clear|great|well done|on track|congrat\w*|perfect|no problem|good job|nice|amazing)\b/i;

  it('contains no calorie, diet, restriction, ideal-weight, diagnosis, praise or exclamation wording', () => {
    for (const [k, v] of english) {
      expect(v, k).not.toMatch(banned);
      expect(v, k).not.toMatch(praise);
    }
  });
  it('passes its own lint on the words it is allowed to use', () => {
    // Guards the regular expressions themselves: word boundaries, so "dietitian", "shortcut" and "safer" are fine.
    for (const ok of ['a sports dietitian', 'not a shortcut', 'a safer scenario', 'the safer choice', 'target date']) {
      expect(ok).not.toMatch(banned);
      expect(ok).not.toMatch(praise);
    }
    for (const bad of ['lose weight', 'cutting back', 'a calorie deficit', 'your target weight', 'that is fine', 'Great!', 'stay on track', 'a healthy weight']) {
      expect(banned.test(bad) || praise.test(bad), bad).toBe(true);
    }
  });
  it('contains no emoji and stays short', () => {
    for (const [k, v] of english) {
      expect(v, k).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(v.length, k).toBeLessThan(360);
    }
  });
  it('shows no number where none is allowed: states, refusals, context and support carry only placeholders', () => {
    for (const [k, v] of english) if (NUMBERLESS.test(k)) expect(v, k).not.toMatch(/\d/);
    expect(text('training.withheld.tooFast')).not.toContain('{max}');
    for (const k of ['training.withheld.tooFast', 'training.withheld.lowBmi.current', 'training.withheld.lowBmi.selected']) {
      expect(text(k), k).not.toMatch(/\d|\{\w+\}/);
    }
  });
  it('never offers a numeric training gain or claims weight is the bigger lever', () => {
    for (const [k, v] of english) {
      if (k.startsWith('training.context.')) expect(v, k).not.toMatch(/%|\d|bigger lever|larger lever|more than training/i);
    }
    expect(text('training.context.veteran')).toMatch(/not a shortcut/);
  });
  it('keeps the assumption, the support lines and the scope', () => {
    expect(text('training.keep')).toMatch(/steady/);
    expect(text('training.keep')).toMatch(/enough energy/);
    expect(text('training.help')).toMatch(/doctor/);
    expect(text('training.help')).toMatch(/dietitian/);
    expect(text('training.help')).toMatch(/eating-disorder/);
    expect(text('training.help')).toMatch(/never too early to ask/);
    expect(text('training.signs')).toMatch(/cannot assess/);
    expect(text('training.scope')).toMatch(/adults/);
    expect(text('training.scope')).toMatch(/18/);
    expect(text('training.scope')).toMatch(/doctor/);
  });
  it('names a next step in every refusal that is not a typo, and says the headline should not be relied on', () => {
    expect(text('training.withheld.tooFast')).toMatch(/later date/);
    expect(text('training.withheld.tooFast')).toMatch(/smaller change/);
    expect(text('training.withheld.tooFast')).toMatch(/should not be relied on/);
    expect(text('training.withheld.fastAndHeavy')).toMatch(/slower pace/);
    expect(text('training.withheld.fastAndHeavy')).toMatch(/should not be relied on/);
    expect(text('training.withheld.lowBmi.current')).toMatch(/doctor/);
    expect(text('training.pointer.withheld')).toMatch(/should not be relied on/);
  });
  it('does not name a BMI value, an underweight verdict or a ranking word in a refusal', () => {
    for (const k of Object.keys(WITHHELD).map((r) => (r === 'lowBmi' ? 'training.withheld.lowBmi.current' : `training.withheld.${r}`))) {
      expect(text(k), k).not.toMatch(/BMI|underweight|too low|dangerous|unhealthy|thin/i);
    }
    expect(text('training.withheld.lowBodyFat')).not.toMatch(/healthy|dangerous|unsafe/i);
  });
  it('does not name a syndrome or condition anywhere', () => {
    for (const [k, v] of english) expect(v, k).not.toMatch(/\bREDs?\b|RED-S|anorexia|bulimia|orthorexia|female athlete triad|amenorrh/i);
  });
});

describe('training messages: the other languages', () => {
  const banned = {
    de: /Diät|Kalorie|abnehm|Gewichtsverlust|verlier|Idealgewicht|Wunschgewicht|Zielgewicht|Übergewicht|fettleibig|Magersucht|diagnos|\bdünn|Fasten|Disziplin|Willenskraft|Belohn|bestraf|Defizit|Makro|\bsicher\b|\bgesund(e[nmrs]?)?\b|in Ordnung|\bOK\b|okay|\bsuper\b|\btoll\b|großartig|!/i,
    es: /\bdietas?\b|calor[ií]as?|adelgaz|peso ideal|peso objetivo|sobrepeso|obes|diagnóstic|delgad|ayuno|disciplina|recompens|castig|déficit|macro|perder peso|pérdida de peso|\bsaludables?\b|(?<!más )\bseguros?\b|\bgenial\b|\bperfect[oa]\b|!/i,
    fr: /\brégime\b|calori|maigr|poids idéal|poids cible|surpoids|obès|diagnostic|\bmince\b|jeûne|discipline|récompens|punit|déficit|macro|perdre du poids|perte de poids|\bsains?\b|\bsaines?\b|(?<!plus )\bsûrs?\b|\bparfait|\bgénial|!/i,
  } as const;
  for (const locale of ['de', 'es', 'fr'] as const) {
    it(`${locale} avoids diet, calorie, body-ideal, praise and exclamation wording, emoji and digits where none are allowed`, () => {
      for (const [k, v] of Object.entries(training[locale])) {
        expect(v, `${locale}:${k}`).not.toMatch(banned[locale]);
        expect(v, `${locale}:${k}`).not.toMatch(/\p{Extended_Pictographic}/u);
        if (NUMBERLESS.test(k)) expect(v, `${locale}:${k}`).not.toMatch(/\d/);
      }
    });
    it(`${locale} keeps a no-break space before every percent sign`, () => {
      const withPercent = Object.entries(training[locale]).filter(([, v]) => v.includes('%'));
      expect(withPercent.length).toBeGreaterThanOrEqual(5);
      for (const [k, v] of withPercent) expect(v, `${locale}:${k}`).not.toMatch(/(?<! )%/);
    });
    it(`${locale} names the people to ask in the help and signs lines and keeps the scope sentence`, () => {
      const help = {
        de: /Ärztin|Arzt/, es: /médico/, fr: /médecin/,
      }[locale];
      for (const k of ['training.help', 'training.signs', 'training.scope'] as const) expect(training[locale][k], `${locale}:${k}`).toMatch(help);
      expect(training[locale]['training.scope']).toMatch(/18/);
    });
  }
  it('the English lint patterns do not hit the single-word statements of the other languages by accident', () => {
    for (const locale of ['de', 'es', 'fr'] as const) {
      expect(training[locale]['training.heading'].length).toBeGreaterThan(5);
    }
  });
});

describe('training messages: the explainer prints only what the constants say', () => {
  const render = (k: string, o: Parameters<typeof explainerFigures>[0], constants = TRAINING) => {
    const f = explainerFigures(o, constants);
    return interpolate(text(k), { ...f, ceiling: f.ceiling, elasticity: f.elasticityPct, unit: o.units === 'metric' ? 'km' : 'mi' }, 'en');
  };
  const metric = { units: 'metric' as const, startKg: 80, centralFactor: 2, baselinePaceSec: 300 };

  it('states the thresholds from the constants, so a changed constant changes the text', () => {
    expect(render('training.how.load', metric)).toContain('Running 50 km a week or more counts as high and 100 km or more as very high.');
    const changed = { ...TRAINING, HIGH_LOAD_KM: 60, VERY_HIGH_LOAD_KM: 120 };
    expect(render('training.how.load', metric, changed)).toContain('Running 60 km a week or more counts as high and 120 km or more as very high.');
    expect(render('training.how.start', metric)).toContain('counts at most 3 s/km per kg');
    expect(render('training.how.start', metric, { ...TRAINING, FACTOR_CEILING: 2.5 })).toContain('counts at most 2.5 s/km per kg');
  });
  it('rounds the imperial thresholds up, so the text is never more permissive than the logic', () => {
    expect(render('training.how.load', { ...metric, units: 'imperial' })).toContain('Running 31.1 mi a week or more counts as high and 62.2 mi or more as very high.');
  });
});
