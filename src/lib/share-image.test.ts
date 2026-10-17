import { describe, expect, it } from 'vitest';
import { calculateWeightPaceEstimates, type ResultRow } from './calculations';
import {
    BIB, CONTENT, IMAGE_FILE_NAME, IMAGE_HEIGHT, IMAGE_SCALE, IMAGE_WIDTH, PALETTE,
    appUrl, buildShareContent, contrastRatio, ellipsize, fitText, layoutShareImage, luminance, shareBlockReason, textExtent, wrapText,
    type BuildShareOptions, type Measure, type Prim, type ShareI18n, type TextPrim,
} from './share-image';
import { formatTime } from './utils';
import { LOCALES, MESSAGES, interpolate, speakDuration, type Locale } from '../i18n/core';

/** Fixed-width fake: every character is `0.5 * size` wide. */
const mono: Measure = (text, _weight, size) => Array.from(text).length * size * 0.5;

/** Deliberately pessimistic proportional face (wider than Inter) so passing here means real fonts fit too. */
const wide: Measure = (text, weight, size) => {
    const bold = weight >= 800 ? 1.08 : 1;
    let em = 0;
    for (const ch of Array.from(text)) {
        if (ch === ' ') em += 0.3;
        else if (/[0-9]/.test(ch)) em += 0.66;
        else if (ch === ':' || ch === '.' || ch === ',' || ch === '’' || ch === 'i' || ch === 'l' || ch === 'I') em += 0.34;
        else if (ch === ch.toLocaleUpperCase() && ch !== ch.toLocaleLowerCase()) em += 0.78;
        else em += 0.6;
    }
    return em * size * bold;
};

const rowsFor = () =>
    calculateWeightPaceEstimates({ gender: 'male', heightCm: 180, weightKg: 80, bodyFatPercentage: null, thresholdPaceMin: 4, thresholdPaceSec: 30 }).resultsTable;

const i18nFor = (locale: Locale): ShareI18n => ({
    locale,
    t: (key, params) => interpolate(MESSAGES[locale][key], params, locale),
    num: (n, digits = 1) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n),
    speak: (s) => speakDuration(s, locale),
});

const options = (over: Partial<BuildShareOptions> = {}, locale: Locale = 'en'): BuildShareOptions => {
    const rows = rowsFor();
    return {
        base: rows[0],
        sel: rows[20],
        units: 'metric',
        customKm: null,
        customLabel: '15 km',
        includeWeights: false,
        enteredWeight: '80',
        url: 'https://example.github.io/weight-pace-calculator/',
        i18n: i18nFor(locale),
        ...over,
    };
};

const texts = (prims: Prim[]) => prims.filter((p): p is TextPrim => p.kind === 'text');

describe('contrast maths', () => {
    it('matches the WCAG reference values', () => {
        expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
        expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
        expect(luminance('#ffffff')).toBeCloseTo(1, 5);
        expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThan(4.5);
        expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.5);
    });
    it('rejects malformed colours', () => {
        expect(() => luminance('red')).toThrow();
    });
    it('every text/background pair of the palette meets AA for normal text (4.5:1)', () => {
        const pairs: [string, string][] = [
            [PALETTE.ink, PALETTE.paper], [PALETTE.ink, PALETTE.card], [PALETTE.inkSoft, PALETTE.paper], [PALETTE.inkSoft, PALETTE.card],
            [PALETTE.good, PALETTE.card], [PALETTE.good, PALETTE.paper], [PALETTE.paper, PALETTE.ink], [PALETTE.onBackdrop, PALETTE.backdrop],
        ];
        for (const [fg, bg] of pairs) expect(contrastRatio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
});

describe('wrapText / ellipsize / fitText', () => {
    it('wraps on spaces without exceeding the width', () => {
        const lines = wrapText(mono, 'one two three four', 400, 10, 60); // 12 chars per line
        expect(lines).toEqual(['one two', 'three four']);
        for (const l of lines) expect(mono(l, 400, 10)).toBeLessThanOrEqual(60);
    });
    it('breaks a word that is wider than the line and keeps following words attached', () => {
        const lines = wrapText(mono, 'aaaaaaaaaaaaaaaaaaaa b', 400, 10, 50); // 10 chars per line
        expect(lines).toEqual(['aaaaaaaaaa', 'aaaaaaaaaa', 'b']);
        const tail = wrapText(mono, 'aaaaaaaaaaaaaaa b', 400, 10, 50);
        expect(tail).toEqual(['aaaaaaaaaa', 'aaaaa b']);
    });
    it('copes with empty text and a single character wider than the box', () => {
        expect(wrapText(mono, '   ', 400, 10, 50)).toEqual([]);
        expect(wrapText(mono, 'WW', 400, 10, 2)).toEqual(['W', 'W']);
    });
    it('ellipsizes to fit', () => {
        const out = ellipsize(mono, 'abcdefghij', 400, 10, 30); // 6 chars
        expect(out).toBe('abcde…');
        expect(ellipsize(mono, 'abc', 400, 10, 30)).toBe('abc');
        expect(ellipsize(mono, 'abcdefghij', 400, 10, 2)).toBe('…');
    });
    it('keeps the largest size when the text already fits', () => {
        const r = fitText(mono, 'Hello', { weight: 400, maxWidth: 200, maxSize: 40, minSize: 10 });
        expect(r).toMatchObject({ size: 40, lines: ['Hello'], truncated: false, width: 100 });
    });
    it('shrinks a single line until it fits', () => {
        const r = fitText(mono, 'x'.repeat(20), { weight: 400, maxWidth: 200, maxSize: 40, minSize: 10 });
        expect(r.size).toBe(20);
        expect(r.lines).toHaveLength(1);
        expect(r.width).toBeLessThanOrEqual(200);
    });
    it('prefers wrapping to shrinking when more lines are allowed', () => {
        const r = fitText(mono, 'aaaa bbbb cccc dddd', { weight: 400, maxWidth: 100, maxSize: 20, minSize: 8, maxLines: 2 });
        expect(r.size).toBe(20); // 10 chars per line at 20px: "aaaa bbbb" + "cccc dddd"
        expect(r.lines).toEqual(['aaaa bbbb', 'cccc dddd']);
        expect(r.truncated).toBe(false);
    });
    it('truncates with an ellipsis only at the minimum size', () => {
        const r = fitText(mono, 'word '.repeat(40).trim(), { weight: 400, maxWidth: 100, maxSize: 20, minSize: 10, maxLines: 2 });
        expect(r.size).toBe(10);
        expect(r.truncated).toBe(true);
        expect(r.lines).toHaveLength(2);
        expect(r.lines[1].endsWith('…')).toBe(true);
        for (const l of r.lines) expect(mono(l, 400, 10)).toBeLessThanOrEqual(100);
    });
    it('handles inverted size limits and empty text', () => {
        expect(fitText(mono, 'abc', { weight: 400, maxWidth: 100, maxSize: 10, minSize: 30 }).size).toBe(10);
        expect(fitText(mono, '', { weight: 400, maxWidth: 100, maxSize: 20, minSize: 10 })).toMatchObject({ lines: [], size: 20, truncated: false });
    });
    it('never returns a line wider than the box, for many strings and widths', () => {
        const samples = ['Geschätzte Rennzeiten', 'Halbmarathon', 'Donaudampfschifffahrtsgesellschaftskapitän', 'a b c d e f g h i j k l m n o p', '15 km'];
        for (const s of samples) {
            for (const maxWidth of [40, 90, 208, 640, 1008]) {
                for (const maxLines of [1, 2, 3]) {
                    const r = fitText(wide, s, { weight: 800, maxWidth, maxSize: 48, minSize: 12, maxLines });
                    expect(r.lines.length).toBeLessThanOrEqual(maxLines);
                    expect(r.size).toBeGreaterThanOrEqual(12);
                    expect(r.size).toBeLessThanOrEqual(48);
                    for (const l of r.lines) expect(wide(l, 800, r.size), `${s} @${maxWidth}`).toBeLessThanOrEqual(maxWidth + 1e-9);
                }
            }
        }
    });
});

describe('appUrl', () => {
    it('is origin plus path and nothing personal', () => {
        expect(appUrl({ origin: 'https://x.github.io', pathname: '/weight-pace-calculator/' })).toBe('https://x.github.io/weight-pace-calculator/');
        const loc = new URL('https://x.github.io/weight-pace-calculator/?g=male&h=180&w=80&bf=12#top');
        const url = appUrl(loc);
        expect(url).not.toMatch(/[?#=&]/);
    });
});

describe('shareBlockReason', () => {
    const row = rowsFor()[10];
    it('allows ordinary rows', () => {
        expect(shareBlockReason(row)).toBeNull();
    });
    it('blocks targets flagged as unhealthy or beyond the pace limit', () => {
        expect(shareBlockReason({ ...row, isPotentiallyUnhealthyFat: true })).toBe('unhealthy');
        expect(shareBlockReason({ ...row, paceLimited: true })).toBe('capped');
        expect(buildShareContent(options({ sel: { ...row, isPotentiallyUnhealthyFat: true } }))).toBeNull();
        expect(buildShareContent(options({ sel: { ...row, paceLimited: true } }))).toBeNull();
    });
});

describe('buildShareContent and the training card', () => {
    it('makes no image while the training card withholds its estimate', () => {
        expect(buildShareContent(options({ trainingBlocked: true }))).toBeNull();
        expect(buildShareContent(options({ trainingBlocked: true, customKm: 15, includeWeights: true }))).toBeNull();
    });
    it('behaves exactly as before when the flag is false or omitted', () => {
        const plain = buildShareContent(options())!;
        expect(plain).not.toBeNull();
        expect(buildShareContent(options({ trainingBlocked: false }))).toEqual(plain);
        expect(buildShareContent(options({ trainingBlocked: undefined }))).toEqual(plain);
    });
});

describe('buildShareContent', () => {
    it('shows the selected times and the time saved versus now', () => {
        const o = options();
        const { content } = buildShareContent(o)!;
        expect(content.cards.map((c) => c.chip)).toEqual(['5K', '10K', 'HM', 'M']);
        expect(content.cards[1].time).toBe(formatTime(o.sel.estimated10kTimeSec!));
        const saved = o.base.estimated10kTimeSec! - o.sel.estimated10kTimeSec!;
        expect(saved).toBeGreaterThan(0);
        expect(content.cards[1].delta).toMatch(/^−\d+:\d{2} faster$/);
        expect(content.cards.every((c) => c.improved)).toBe(true);
        expect(content.title).toBe('Estimated race times');
        expect(content.note).toBe(MESSAGES.en['health.note']);
        expect(content.url).toBe(o.url);
    });
    it('adds a custom-distance card computed from the threshold pace', () => {
        const { content } = buildShareContent(options({ customKm: 15 }))!;
        const custom = content.cards.at(-1)!;
        expect(content.cards).toHaveLength(5);
        expect(custom).toMatchObject({ chip: '15 km', custom: true, improved: true });
        expect(custom.time).toMatch(/^\d{2}:\d{2}(:\d{2})?$/);
    });
    it('reports "same as now" and the current-weight subtitle when nothing changes', () => {
        const rows = rowsFor();
        const { content } = buildShareContent(options({ sel: rows[0], includeWeights: true }))!;
        expect(content.cards.every((c) => !c.improved && c.delta === 'same as now')).toBe(true);
        expect(content.subtitle).toBe('At the current weight');
        expect(content.weights).toEqual({ from: '80.0 kg', to: null });
    });
    it('contains no body measurements unless the user opts in', () => {
        const rows = rowsFor();
        const o = options({ customKm: 15, enteredWeight: '79.4', sel: rows[20] });
        for (const locale of LOCALES) {
            const built = buildShareContent({ ...o, i18n: i18nFor(locale) })!;
            expect(built.content.weights).toBeNull();
            const model = layoutShareImage(built.content, wide);
            const everything = [JSON.stringify(built.content), built.alt, ...texts(model.prims).map((p) => p.text)].join('\n');
            expect(everything, locale).not.toMatch(/\bkg\b|\blb\b/);
            for (const needle of ['79.4', '79,4', '80.0', '80,0', rows[20].targetWeightKg.toFixed(1), rows[20].targetWeightKg.toFixed(1).replace('.', ',')]) {
                expect(everything, `${locale}: ${needle}`).not.toContain(needle);
            }
            expect(built.content.url).not.toContain('?');
        }
    });
    it('adds current and target weight in the chosen units when opted in', () => {
        const rows = rowsFor();
        const metric = buildShareContent(options({ includeWeights: true, enteredWeight: '80' }))!;
        expect(metric.content.weights).toEqual({ from: '80.0 kg', to: `${rows[20].targetWeightKg.toFixed(1)} kg` });
        expect(metric.alt).toContain('Weight from 80.0 kg to');

        const imperial = buildShareContent(options({ includeWeights: true, units: 'imperial', enteredWeight: '176.4' }))!;
        expect(imperial.content.weights!.from).toBe('176.4 lb');
        expect(imperial.content.weights!.to).toMatch(/^\d+\.\d lb$/);

        const de = buildShareContent(options({ includeWeights: true, enteredWeight: '' }, 'de'))!;
        expect(de.content.weights!.from).toBe('80,0 kg');
    });
    it('describes the picture for assistive tech without raw clock times', () => {
        for (const locale of LOCALES) {
            const { alt } = buildShareContent(options({ customKm: 15 }, locale))!;
            expect(alt.length).toBeGreaterThan(80);
            expect(alt).not.toMatch(/\d{2}:\d{2}/);
            expect(alt).not.toMatch(/\{\w+\}/);
        }
    });
    it('returns null when there is nothing to show', () => {
        const row = rowsFor()[5];
        const none = { ...row, estimated5kTimeSec: null, estimated10kTimeSec: null, estimatedHmTimeSec: null, estimatedMTimeSec: null } satisfies ResultRow;
        expect(buildShareContent(options({ base: none, sel: none }))).toBeNull();
    });
});

describe('layoutShareImage', () => {
    it('renders 2400x1260 pixels from a 1200x630 logical canvas', () => {
        const model = layoutShareImage(buildShareContent(options())!.content, wide);
        expect(model.width * model.scale).toBe(2400);
        expect(model.height * model.scale).toBe(1260);
        expect([IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_SCALE]).toEqual([1200, 630, 2]);
        expect(IMAGE_FILE_NAME).toBe('weight-pace-result.png');
    });

    const variants: [string, Partial<BuildShareOptions>][] = [
        ['plain', {}],
        ['custom distance', { customKm: 42.2, customLabel: '26.2 mi' }],
        ['weights', { includeWeights: true }],
        ['weights + custom + imperial', { includeWeights: true, customKm: 15, units: 'imperial', enteredWeight: '176.4' }],
    ];

    for (const locale of LOCALES) {
        for (const [name, over] of variants) {
            it(`${locale} / ${name}: text fits its box, stays inside the bib and is never cut off`, () => {
                const built = buildShareContent(options(over, locale))!;
                const { prims } = layoutShareImage(built.content, wide);
                const all = texts(prims);
                expect(all.length).toBeGreaterThan(10);
                for (const p of all) {
                    const { left, right } = textExtent(p, wide);
                    const label = `${locale}/${name}: "${p.text}"`;
                    expect(right - left, label).toBeLessThanOrEqual(p.maxWidth + 0.5);
                    expect(left, label).toBeGreaterThanOrEqual(CONTENT.x0 - 0.5);
                    expect(right, label).toBeLessThanOrEqual(CONTENT.x1 + 0.5);
                    expect(p.y, label).toBeGreaterThan(BIB.y);
                    expect(p.y, label).toBeLessThan(BIB.y + BIB.h);
                    expect(p.size, label).toBeGreaterThanOrEqual(11);
                    expect(p.text.endsWith('…'), label).toBe(false);
                }
                // The health note survives in full (wrapped, not truncated) and the URL is shown.
                const note = all.filter((p) => p.color === PALETTE.inkSoft && p.weight === 500).map((p) => p.text).join(' ');
                expect(note).toBe(built.content.note);
                expect(all.some((p) => p.text === built.content.url)).toBe(true);
                expect(all.some((p) => p.text === built.content.title.toLocaleUpperCase(locale))).toBe(true);
            });

            it(`${locale} / ${name}: every text meets 4.5:1 against the fill it is drawn on`, () => {
                const { prims } = layoutShareImage(buildShareContent(options(over, locale))!.content, wide);
                prims.forEach((p, i) => {
                    if (p.kind !== 'text') return;
                    expect(contrastRatio(p.color, p.on), `"${p.text}"`).toBeGreaterThanOrEqual(4.5);
                    // `on` must be honest: the last filled rectangle under the text's centre has that fill.
                    const { left, right } = textExtent(p, wide);
                    const cx = (left + right) / 2;
                    const cy = p.y - p.size * 0.36;
                    let under: string | undefined;
                    for (const q of prims.slice(0, i)) {
                        if (q.kind === 'rect' && q.fill && cx >= q.x && cx <= q.x + q.w && cy >= q.y && cy <= q.y + q.h) under = q.fill;
                    }
                    expect(under, `"${p.text}" sits on ${under}`).toBe(p.on);
                });
            });
        }
    }

    it('uses a different layout for the weights pill only when asked', () => {
        const without = texts(layoutShareImage(buildShareContent(options())!.content, wide).prims).map((p) => p.text);
        const withW = texts(layoutShareImage(buildShareContent(options({ includeWeights: true }))!.content, wide).prims).map((p) => p.text);
        expect(withW).toContain('80.0 kg');
        expect(without.join('|')).not.toContain('kg');
    });
});
