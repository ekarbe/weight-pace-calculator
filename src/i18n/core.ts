import { en, type MessageKey } from './messages/en';
import { de } from './messages/de';
import { es } from './messages/es';
import { fr } from './messages/fr';

export const LOCALES = ['en', 'de', 'es', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', de: 'Deutsch', es: 'Español', fr: 'Français' };
export const STORAGE_KEY = 'wpc-locale';

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, de, es, fr };

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);

/** Picks a locale: ?lang= wins, then the stored choice, then the browser's preferred languages. */
export function detectLocale(opts: { query?: string; stored?: string | null; languages?: readonly string[] }): Locale {
    const fromQuery = new URLSearchParams(opts.query ?? '').get('lang');
    if (isLocale(fromQuery)) return fromQuery;
    if (isLocale(opts.stored)) return opts.stored;
    for (const lang of opts.languages ?? []) {
        const base = lang.toLowerCase().split('-')[0];
        if (isLocale(base)) return base;
    }
    return DEFAULT_LOCALE;
}

export type Params = Record<string, string | number>;

/** Replaces `{name}`. Numbers are formatted for the locale; unknown names are left visible so bugs show up. */
export function interpolate(template: string, params: Params | undefined, locale: Locale): string {
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
        if (!params || !(name in params)) return whole;
        const v = params[name];
        return typeof v === 'number' ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(v) : v;
    });
}

export type RichPart = { text: string; tag: 'b' | 'r' | 'g' | null };

/** Splits `a <b>b</b> c` into tagged parts. Tags are <b>, <r> (risk colour) and <g> (positive colour); they don't nest. */
export function parseRich(text: string): RichPart[] {
    const parts: RichPart[] = [];
    const re = /<([brg])>(.*?)<\/\1>/g;
    let last = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
        if (m.index > last) parts.push({ text: text.slice(last, m.index), tag: null });
        parts.push({ text: m[2], tag: m[1] as 'b' | 'r' | 'g' });
        last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ text: text.slice(last), tag: null });
    return parts;
}

export function pluralSuffix(locale: Locale, n: number): 'one' | 'other' {
    return new Intl.PluralRules(locale).select(n) === 'one' ? 'one' : 'other';
}

/** "1 hour, 47 minutes and 31 seconds" in the user's language, so screen readers don't spell out "01:47:31". */
export function speakDuration(totalSeconds: number, locale: Locale): string {
    const s = Math.round(Math.abs(totalSeconds));
    const units = [
        [Math.floor(s / 3600), 'hour'],
        [Math.floor((s % 3600) / 60), 'minute'],
        [s % 60, 'second'],
    ] as const;
    const parts = units.filter(([n]) => n > 0).map(([n, unit]) => new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(n));
    if (parts.length === 0) parts.push(new Intl.NumberFormat(locale, { style: 'unit', unit: 'second', unitDisplay: 'long' }).format(0));
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(parts);
}
