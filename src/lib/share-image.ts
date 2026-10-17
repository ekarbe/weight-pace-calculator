import { estimateRaceTimeSec, type ResultRow } from './calculations';
import { kgToLb, unitLabels, type UnitSystem } from './units';
import { formatDelta, formatTime } from './utils';
import type { Params } from '../i18n/core';
import type { MessageKey } from '../i18n/messages/en';

/** Logical size of the shareable image; it is painted at IMAGE_SCALE x for a sharp 2400x1260 PNG. */
export const IMAGE_WIDTH = 1200;
export const IMAGE_HEIGHT = 630;
export const IMAGE_SCALE = 2;
export const IMAGE_FILE_NAME = 'weight-pace-result.png';

/** Fixed light palette, independent of the page theme so the picture looks the same everywhere. */
export const PALETTE = {
    backdrop: '#34c759',
    paper: '#ffffff',
    card: '#f3f8f4',
    ink: '#1d1d1f',
    inkSoft: '#515156',
    good: '#117a35',
    onBackdrop: '#08230f',
    rule: '#d1d1d6',
} as const;

const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) throw new Error(`Expected #rrggbb, got ${hex}`);
    const n = parseInt(m[1], 16);
    return 0.2126 * toLinear((n >> 16) & 255) + 0.7152 * toLinear((n >> 8) & 255) + 0.0722 * toLinear(n & 255);
}

/** WCAG contrast ratio (1 to 21) between two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/* ---------- text measuring and fitting ---------- */

/** Width in logical px of `text` set at `size` px in the image font; supplied by the canvas (or a fake in tests). */
export type Measure = (text: string, weight: number, size: number) => number;

export interface FitOptions {
    weight: number;
    maxWidth: number;
    maxSize: number;
    minSize: number;
    /** Lines allowed before the text is shrunk further. Default 1. */
    maxLines?: number;
    /** Font-size decrement per attempt. Default 1. */
    step?: number;
}

export interface FitResult {
    size: number;
    lines: string[];
    /** True only when even the smallest size needed an ellipsis. */
    truncated: boolean;
    /** Width of the widest line. */
    width: number;
}

const ELLIPSIS = '…';

/** Splits one word into the longest chunks that fit (at least one character each). */
function splitToWidth(measure: Measure, word: string, weight: number, size: number, maxWidth: number): string[] {
    const chunks: string[] = [];
    let cur = '';
    for (const ch of Array.from(word)) {
        if (cur && measure(cur + ch, weight, size) > maxWidth) {
            chunks.push(cur);
            cur = ch;
        } else {
            cur += ch;
        }
    }
    if (cur) chunks.push(cur);
    return chunks;
}

/** Greedy word wrap. A word wider than the line is broken by characters, so no line is ever wider than maxWidth (unless one character is). */
export function wrapText(measure: Measure, text: string, weight: number, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    let cur = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const candidate = cur ? `${cur} ${word}` : word;
        if (measure(candidate, weight, size) <= maxWidth) {
            cur = candidate;
            continue;
        }
        if (cur) lines.push(cur);
        cur = '';
        if (measure(word, weight, size) <= maxWidth) {
            cur = word;
            continue;
        }
        const chunks = splitToWidth(measure, word, weight, size, maxWidth);
        lines.push(...chunks.slice(0, -1));
        cur = chunks[chunks.length - 1];
    }
    if (cur) lines.push(cur);
    return lines;
}

/** Shortens `text` until `text + …` fits. */
export function ellipsize(measure: Measure, text: string, weight: number, size: number, maxWidth: number): string {
    if (measure(text, weight, size) <= maxWidth) return text;
    const chars = Array.from(text.trimEnd());
    while (chars.length > 0) {
        chars.pop();
        const candidate = chars.join('').trimEnd() + ELLIPSIS;
        if (measure(candidate, weight, size) <= maxWidth) return candidate;
    }
    return ELLIPSIS;
}

/**
  * Picks the largest font size (between maxSize and minSize) at which `text` wraps to at most `maxLines`
  * lines of at most `maxWidth`. At minSize the text is truncated with an ellipsis as a last resort.
  */
export function fitText(measure: Measure, text: string, o: FitOptions): FitResult {
    const maxLines = Math.max(1, o.maxLines ?? 1);
    const step = Math.max(0.5, o.step ?? 1);
    const minSize = Math.min(o.minSize, o.maxSize);
    const widest = (lines: string[], size: number) => lines.reduce((w, l) => Math.max(w, measure(l, o.weight, size)), 0);

    const sizes: number[] = [];
    for (let s = o.maxSize; s > minSize; s -= step) sizes.push(s);
    sizes.push(minSize);

    for (const size of sizes) {
        const lines = wrapText(measure, text, o.weight, size, o.maxWidth);
        if (lines.length <= maxLines) return { size, lines, truncated: false, width: widest(lines, size) };
    }
    const lines = wrapText(measure, text, o.weight, minSize, o.maxWidth);
    const kept = lines.slice(0, maxLines - 1);
    kept.push(ellipsize(measure, lines.slice(maxLines - 1).join(' '), o.weight, minSize, o.maxWidth));
    return { size: minSize, lines: kept, truncated: true, width: widest(kept, minSize) };
}

/* ---------- race data ---------- */

export type RaceKey = '5K' | '10K' | 'HM' | 'M';

const RACES: { key: RaceKey; label: MessageKey; time: (r: ResultRow) => number | null }[] = [
    { key: '5K', label: 'race.5k', time: (r) => r.estimated5kTimeSec },
    { key: '10K', label: 'race.10k', time: (r) => r.estimated10kTimeSec },
    { key: 'HM', label: 'race.hm', time: (r) => r.estimatedHmTimeSec },
    { key: 'M', label: 'race.m', time: (r) => r.estimatedMTimeSec },
];

/** Below this many seconds saved, a result counts as "same as now". */
export const SAVED_EPSILON_SEC = 0.5;

/**
  * Why no image may be made for this target weight, or null when it may.
  * An image would put a flagged target (below healthy body fat, or beyond the model's pace limit) in front of other people.
  */
export function shareBlockReason(sel: ResultRow): 'unhealthy' | 'capped' | null {
    if (sel.isPotentiallyUnhealthyFat) return 'unhealthy';
    if (sel.paceLimited) return 'capped';
    return null;
}

/** Origin + path of the app, never the query string (which can hold height, weight and body fat). */
export function appUrl(loc: { origin: string; pathname: string }): string {
    return `${loc.origin}${loc.pathname}`;
}

/* ---------- content (everything the picture says, already localised) ---------- */

export interface ShareCard {
    chip: string;
    label: string;
    time: string;
    /** "−2:10 faster" or "same as now". */
    delta: string;
    improved: boolean;
    custom: boolean;
}

export interface ShareContent {
    locale: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    cards: ShareCard[];
    /** Present only when the user opted in. `to` is null when the target equals the current weight. */
    weights: { from: string; to: string | null } | null;
    note: string;
    url: string;
}

export interface ShareI18n {
    locale: string;
    t: (key: MessageKey, params?: Params) => string;
    num: (n: number, digits?: number) => string;
    speak: (seconds: number) => string;
}

export interface BuildShareOptions {
    base: ResultRow;
    sel: ResultRow;
    units: UnitSystem;
    customKm: number | null;
    customLabel: string;
    /** Off unless the user ticked the box. Body measurements never enter the picture otherwise. */
    includeWeights: boolean;
    /** The weight as typed, shown exactly for the current weight (like the race cards do). */
    enteredWeight: string;
    url: string;
    i18n: ShareI18n;
    /** True while the Training context card shows no estimate for this scenario: the picture would contradict it. */
    trainingBlocked?: boolean;
}

export interface ShareBuild {
    content: ShareContent;
    /** Plain-text description of the picture, for the preview's accessible name. */
    alt: string;
}

/** Turns the selected result into the picture's texts, or null when no image may be made. */
export function buildShareContent(o: BuildShareOptions): ShareBuild | null {
    if (shareBlockReason(o.sel) || o.trainingBlocked) return null;
    const { t, num, speak, locale } = o.i18n;

    const entries: { chip: string; label: string; srLabel: string; nowSec: number; targetSec: number; custom: boolean }[] = [];
    for (const race of RACES) {
        const nowSec = race.time(o.base);
        const targetSec = race.time(o.sel);
        if (nowSec === null || targetSec === null) continue;
        entries.push({ chip: race.key, label: t(race.label), srLabel: t(race.label), nowSec, targetSec, custom: false });
    }
    const basePace = o.base.estimatedThresholdPaceSec;
    const selPace = o.sel.estimatedThresholdPaceSec;
    if (o.customKm !== null && basePace !== null && selPace !== null) {
        entries.push({
            chip: o.customLabel,
            label: t('race.yours'),
            srLabel: o.customLabel,
            nowSec: estimateRaceTimeSec(basePace, o.customKm),
            targetSec: estimateRaceTimeSec(selPace, o.customKm),
            custom: true,
        });
    }
    if (entries.length === 0) return null;

    const cards: ShareCard[] = entries.map((e) => {
        const saved = e.nowSec - e.targetSec;
        const improved = saved > SAVED_EPSILON_SEC;
        return {
            chip: e.chip,
            label: e.label,
            time: formatTime(e.targetSec),
            delta: improved ? t('shareImage.faster', { delta: formatDelta(saved) }) : t('shareImage.same'),
            improved,
            custom: e.custom,
        };
    });

    const lostKg = o.base.targetWeightKg - o.sel.targetWeightKg;
    const lighter = lostKg >= 0.05;
    const unit = unitLabels(o.units).weight;
    const show = (kg: number) => `${num(o.units === 'metric' ? kg : kgToLb(kg), 1)} ${unit}`;
    let weights: ShareContent['weights'] = null;
    if (o.includeWeights) {
        const typed = parseFloat(o.enteredWeight);
        const from = Number.isFinite(typed) ? `${num(typed, 1)} ${unit}` : show(o.base.targetWeightKg);
        weights = { from, to: lighter ? show(o.sel.targetWeightKg) : null };
    }

    const content: ShareContent = {
        locale,
        eyebrow: t('header.title'),
        title: t('shareImage.title'),
        subtitle: t(lighter ? 'shareImage.subtitle.lighter' : 'shareImage.subtitle.same'),
        cards,
        weights,
        note: t('health.note'),
        url: o.url,
    };

    const spoken = entries.map((e, i) =>
        cards[i].improved
            ? t('race.srFaster', { race: e.srLabel, time: speak(e.targetSec), delta: speak(e.nowSec - e.targetSec) })
            : t('race.srSame', { race: e.srLabel, time: speak(e.targetSec) }),
    );
    const weightSentence = weights
        ? weights.to
            ? t('shareImage.alt.weights', { from: weights.from, to: weights.to })
            : t('shareImage.alt.weight', { weight: weights.from })
        : t('shareImage.alt.private');
    const summary = [content.title, content.subtitle, ...spoken, weightSentence, content.note].join('. ');
    return { content, alt: t('shareImage.alt', { summary }) };
}

/* ---------- drawing model ---------- */

export interface RectPrim {
    kind: 'rect';
    x: number;
    y: number;
    w: number;
    h: number;
    radius?: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
}
export interface CirclePrim {
    kind: 'circle';
    cx: number;
    cy: number;
    r: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
}
export interface LinePrim {
    kind: 'line';
    points: [number, number][];
    color: string;
    width: number;
}
export interface TextPrim {
    kind: 'text';
    text: string;
    /** Left edge, centre or right edge depending on `align`; y is the baseline. */
    x: number;
    y: number;
    size: number;
    weight: number;
    color: string;
    /** Fill the text sits on; checked against `color` for contrast. */
    on: string;
    align: 'left' | 'center' | 'right';
    /** Width budget the layout fitted the text into. */
    maxWidth: number;
}
export type Prim = RectPrim | CirclePrim | LinePrim | TextPrim;

export interface ShareImageModel {
    width: number;
    height: number;
    scale: number;
    prims: Prim[];
}

export const BIB = { x: 24, y: 24, w: 1152, h: 582, radius: 28, border: 6 } as const;
/** Horizontal band the text lives in; keeps clear of the safety-pin holes. */
export const CONTENT = { x0: 96, x1: 1104 } as const;
const CONTENT_W = CONTENT.x1 - CONTENT.x0;
const HOLE = { inset: 40, r: 12 } as const;

/** Approximate cap height of the face as a fraction of the font size, for vertical centring. */
const CAP = 0.72;
const BOLD = 800;
const BLACK = 900;

interface CardMode {
    chipY: number;
    chipH: number;
    chipSize: number;
    labelBase: number;
    labelMax: number;
    timeBase: number;
    timeMax: number;
    deltaBase: number;
    deltaMax: number;
    stripeFromBottom: number;
}
const TALL: CardMode = { chipY: 18, chipH: 38, chipSize: 24, labelBase: 82, labelMax: 18, timeBase: 158, timeMax: 56, deltaBase: 202, deltaMax: 22, stripeFromBottom: 18 };
const COMPACT: CardMode = { chipY: 12, chipH: 34, chipSize: 22, labelBase: 68, labelMax: 16, timeBase: 112, timeMax: 44, deltaBase: 142, deltaMax: 20, stripeFromBottom: 14 };

/** Barcode-like stripes, echoing the app's race cards. */
function stripes(x: number, y: number, w: number, h: number, color: string): RectPrim[] {
    const out: RectPrim[] = [];
    for (let sx = x; sx + 8 <= x + w; sx += 16) out.push({ kind: 'rect', x: sx, y, w: 8, h, fill: color });
    return out;
}

/** Lays the content out as a flat list of shapes and text, fitting every string into its box. */
export function layoutShareImage(c: ShareContent, measure: Measure): ShareImageModel {
    const prims: Prim[] = [];
    const up = (s: string) => s.toLocaleUpperCase(c.locale);
    const fit = (text: string, o: FitOptions) => fitText(measure, text, o);
    const text = (p: Omit<TextPrim, 'kind'>) => prims.push({ kind: 'text', ...p });
    /** Vertical centre line -> baseline. */
    const baseAt = (cy: number, size: number) => cy + (CAP * size) / 2;

    // Backdrop, bib and safety-pin holes.
    prims.push({ kind: 'rect', x: 0, y: 0, w: IMAGE_WIDTH, h: IMAGE_HEIGHT, fill: PALETTE.backdrop });
    prims.push({ kind: 'rect', x: BIB.x, y: BIB.y, w: BIB.w, h: BIB.h, radius: BIB.radius, fill: PALETTE.paper, stroke: PALETTE.ink, strokeWidth: BIB.border });
    for (const cx of [BIB.x + HOLE.inset, BIB.x + BIB.w - HOLE.inset]) {
        for (const cy of [BIB.y + HOLE.inset, BIB.y + BIB.h - HOLE.inset]) {
            prims.push({ kind: 'circle', cx, cy, r: HOLE.r, fill: PALETTE.backdrop, stroke: PALETTE.ink, strokeWidth: 3 });
        }
    }

    // Header: brand, title, subtitle and (opt-in) weights.
    prims.push({ kind: 'circle', cx: CONTENT.x0 + 8, cy: 84, r: 8, fill: PALETTE.backdrop, stroke: PALETTE.ink, strokeWidth: 2 });
    const eyebrow = fit(up(c.eyebrow), { weight: BOLD, maxWidth: 640, maxSize: 20, minSize: 13 });
    text({ text: eyebrow.lines[0] ?? '', x: CONTENT.x0 + 26, y: baseAt(84, eyebrow.size), size: eyebrow.size, weight: BOLD, color: PALETTE.inkSoft, on: PALETTE.paper, align: 'left', maxWidth: 640 });

    const title = fit(up(c.title), { weight: BLACK, maxWidth: CONTENT_W, maxSize: 58, minSize: 28 });
    text({ text: title.lines[0] ?? '', x: CONTENT.x0, y: 156, size: title.size, weight: BLACK, color: PALETTE.ink, on: PALETTE.paper, align: 'left', maxWidth: CONTENT_W });

    const rowCy = 196;
    let subtitleMax = CONTENT_W;
    if (c.weights) {
        const pillH = 46;
        const pad = 20;
        const arrowW = 48;
        const budget = 400 - 2 * pad;
        let size = 28;
        const widths = (s: number) => [measure(c.weights!.from, BOLD, s), c.weights!.to ? measure(c.weights!.to, BOLD, s) : 0] as const;
        const total = (s: number) => {
            const [a, b] = widths(s);
            return a + (c.weights!.to ? arrowW + b : 0);
        };
        while (size > 14 && total(size) > budget) size -= 1;
        const [fromW] = widths(size);
        const pillW = total(size) + 2 * pad;
        const px = CONTENT.x1 - pillW;
        prims.push({ kind: 'rect', x: px, y: rowCy - pillH / 2, w: pillW, h: pillH, radius: pillH / 2, fill: PALETTE.ink });
        const ty = baseAt(rowCy, size);
        text({ text: c.weights.from, x: px + pad, y: ty, size, weight: BOLD, color: PALETTE.paper, on: PALETTE.ink, align: 'left', maxWidth: budget });
        if (c.weights.to) {
            const bx = px + pad + fromW;
            prims.push({ kind: 'line', points: [[bx + 11, rowCy], [bx + 37, rowCy]], color: PALETTE.paper, width: 3 });
            prims.push({ kind: 'line', points: [[bx + 29, rowCy - 8], [bx + 37, rowCy], [bx + 29, rowCy + 8]], color: PALETTE.paper, width: 3 });
            text({ text: c.weights.to, x: bx + arrowW, y: ty, size, weight: BOLD, color: PALETTE.paper, on: PALETTE.ink, align: 'left', maxWidth: budget });
        }
        subtitleMax = CONTENT_W - pillW - 24;
    }
    const subtitle = fit(c.subtitle, { weight: 600, maxWidth: subtitleMax, maxSize: 26, minSize: 15 });
    text({ text: subtitle.lines[0] ?? '', x: CONTENT.x0, y: baseAt(rowCy, subtitle.size), size: subtitle.size, weight: 600, color: PALETTE.inkSoft, on: PALETTE.paper, align: 'left', maxWidth: subtitleMax });

    // Cards.
    const main = c.cards.filter((card) => !card.custom);
    const custom = c.cards.find((card) => card.custom);
    const regionTop = 238;
    const regionH = 236;
    const gap = 16;
    const stripH = 60;
    const mainH = custom ? regionH - 12 - stripH : regionH;
    const mode = custom ? COMPACT : TALL;
    const cols = Math.max(main.length, 1);
    const cw = (CONTENT_W - gap * (cols - 1)) / cols;
    const inner = cw - 32;

    const timeSize = Math.min(...main.map((m) => fit(m.time, { weight: BLACK, maxWidth: inner, maxSize: mode.timeMax, minSize: 20 }).size), mode.timeMax);
    const deltaSize = Math.min(...main.map((m) => fit(m.delta, { weight: BOLD, maxWidth: inner, maxSize: mode.deltaMax, minSize: 12 }).size), mode.deltaMax);

    main.forEach((card, i) => {
        const x = CONTENT.x0 + i * (cw + gap);
        const y = regionTop;
        prims.push({ kind: 'rect', x, y, w: cw, h: mainH, radius: 20, fill: PALETTE.card, stroke: PALETTE.ink, strokeWidth: 4 });
        const chip = fit(card.chip, { weight: BLACK, maxWidth: inner - 24, maxSize: mode.chipSize, minSize: 14 });
        const chipW = Math.min(chip.width + 24, inner);
        prims.push({ kind: 'rect', x: x + 16, y: y + mode.chipY, w: chipW, h: mode.chipH, radius: 10, fill: PALETTE.ink });
        text({ text: chip.lines[0] ?? '', x: x + 16 + chipW / 2, y: baseAt(y + mode.chipY + mode.chipH / 2, chip.size), size: chip.size, weight: BLACK, color: PALETTE.paper, on: PALETTE.ink, align: 'center', maxWidth: inner - 24 });
        const label = fit(up(card.label), { weight: BOLD, maxWidth: inner, maxSize: mode.labelMax, minSize: 11 });
        text({ text: label.lines[0] ?? '', x: x + 16, y: y + mode.labelBase, size: label.size, weight: BOLD, color: PALETTE.inkSoft, on: PALETTE.card, align: 'left', maxWidth: inner });
        text({ text: card.time, x: x + 16, y: y + mode.timeBase, size: timeSize, weight: BLACK, color: PALETTE.ink, on: PALETTE.card, align: 'left', maxWidth: inner });
        text({ text: card.delta, x: x + 16, y: y + mode.deltaBase, size: deltaSize, weight: BOLD, color: card.improved ? PALETTE.good : PALETTE.inkSoft, on: PALETTE.card, align: 'left', maxWidth: inner });
        prims.push(...stripes(x + 16, y + mainH - mode.stripeFromBottom, cw - 32, 6, PALETTE.ink));
    });

    if (custom) {
        const x = CONTENT.x0;
        const y = regionTop + mainH + 12;
        const cy = y + stripH / 2;
        prims.push({ kind: 'rect', x, y, w: CONTENT_W, h: stripH, radius: 20, fill: PALETTE.card, stroke: PALETTE.ink, strokeWidth: 4 });
        const chip = fit(custom.chip, { weight: BLACK, maxWidth: 200, maxSize: 24, minSize: 14 });
        const chipW = chip.width + 28;
        prims.push({ kind: 'rect', x: x + 16, y: cy - 19, w: chipW, h: 38, radius: 10, fill: PALETTE.backdrop, stroke: PALETTE.ink, strokeWidth: 2 });
        text({ text: chip.lines[0] ?? '', x: x + 16 + chipW / 2, y: baseAt(cy, chip.size), size: chip.size, weight: BLACK, color: PALETTE.onBackdrop, on: PALETTE.backdrop, align: 'center', maxWidth: 200 });
        const right = x + CONTENT_W - 20;
        const delta = fit(custom.delta, { weight: BOLD, maxWidth: 300, maxSize: 22, minSize: 12 });
        text({ text: custom.delta, x: right, y: baseAt(cy, delta.size), size: delta.size, weight: BOLD, color: custom.improved ? PALETTE.good : PALETTE.inkSoft, on: PALETTE.card, align: 'right', maxWidth: 300 });
        const time = fit(custom.time, { weight: BLACK, maxWidth: 220, maxSize: 38, minSize: 20 });
        const timeRight = right - delta.width - 28;
        text({ text: custom.time, x: timeRight, y: baseAt(cy, time.size), size: time.size, weight: BLACK, color: PALETTE.ink, on: PALETTE.card, align: 'right', maxWidth: 220 });
        const labelX = x + 16 + chipW + 16;
        const labelMax = Math.max(timeRight - time.width - 16 - labelX, 40);
        const label = fit(up(custom.label), { weight: BOLD, maxWidth: labelMax, maxSize: 18, minSize: 11 });
        text({ text: label.lines[0] ?? '', x: labelX, y: baseAt(cy, label.size), size: label.size, weight: BOLD, color: PALETTE.inkSoft, on: PALETTE.card, align: 'left', maxWidth: labelMax });
    }

    // Footer: health note and app address.
    prims.push({ kind: 'rect', x: CONTENT.x0, y: 492, w: CONTENT_W, h: 2, fill: PALETTE.rule });
    const note = fit(c.note, { weight: 500, maxWidth: CONTENT_W, maxSize: 20, minSize: 12, maxLines: 2 });
    note.lines.forEach((line, i) => {
        text({ text: line, x: CONTENT.x0, y: 520 + i * Math.round(note.size * 1.3), size: note.size, weight: 500, color: PALETTE.inkSoft, on: PALETTE.paper, align: 'left', maxWidth: CONTENT_W });
    });
    const urlMax = CONTENT_W - 232;
    const url = fit(c.url, { weight: BOLD, maxWidth: urlMax, maxSize: 22, minSize: 12 });
    text({ text: url.lines[0] ?? '', x: CONTENT.x0, y: 578, size: url.size, weight: BOLD, color: PALETTE.ink, on: PALETTE.paper, align: 'left', maxWidth: urlMax });
    prims.push(...stripes(CONTENT.x1 - 208, 560, 208, 20, PALETTE.ink));

    return { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, scale: IMAGE_SCALE, prims };
}

/** Left and right edge of a text primitive, given its measured width. */
export function textExtent(p: TextPrim, measure: Measure): { left: number; right: number } {
    const w = measure(p.text, p.weight, p.size);
    if (p.align === 'left') return { left: p.x, right: p.x + w };
    if (p.align === 'right') return { left: p.x - w, right: p.x };
    return { left: p.x - w / 2, right: p.x + w / 2 };
}
