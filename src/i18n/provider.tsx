'use client';

import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, MESSAGES, STORAGE_KEY, detectLocale, interpolate, parseRich, pluralSuffix, speakDuration, type Locale, type Params } from './core';
import type { MessageKey } from './messages/en';
import type { Warning } from '@/lib/calculations';

export type Translate = (key: MessageKey, params?: Params) => string;

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translate;
  /** Picks `<key>.one` / `<key>.other` for `n` and fills `{n}`. */
  plural: (key: 'plan.weeks', n: number) => string;
  /** Like `t`, but renders <b>, <r> and <g> tags as styled elements. */
  rich: (key: MessageKey, params?: Params, classes?: { r?: string }) => ReactNode;
  warning: (w: Warning) => string;
  num: (n: number, digits?: number) => string;
  date: (d: Date) => string;
  list: (items: string[]) => string;
  /** Spoken form of a duration in seconds, for screen-reader-only text. */
  speak: (seconds: number) => string;
}

const Ctx = createContext<I18n | null>(null);

function safeStorage<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null; // private mode / blocked storage
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const detected = detectLocale({
      query: window.location.search,
      stored: safeStorage(() => window.localStorage.getItem(STORAGE_KEY)),
      languages: navigator.languages?.length ? navigator.languages : [navigator.language],
    });
    // One-time detection from browser state; the static export always renders the default language first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(detected);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    safeStorage(() => window.localStorage.setItem(STORAGE_KEY, l));
  }, []);

  const value = useMemo<I18n>(() => {
    const dict = MESSAGES[locale];
    const t: Translate = (key, params) => interpolate(dict[key], params, locale);
    return {
      locale,
      setLocale,
      t,
      plural: (key, n) => t(`${key}.${pluralSuffix(locale, n)}`, { n }),
      rich: (key, params, classes) =>
        parseRich(interpolate(dict[key], params, locale)).map((p, i) => {
          if (!p.tag) return <Fragment key={i}>{p.text}</Fragment>;
          const cls = p.tag === 'b' ? 'font-semibold text-foreground' : p.tag === 'g' ? 'font-semibold text-primary-ink' : classes?.r ?? 'font-semibold text-foreground';
          return <strong key={i} className={cls}>{p.text}</strong>;
        }),
      warning: (w) => {
        const sex = w.params?.sex;
        const key = (typeof sex === 'string' ? `warn.${w.code}.${sex}` : `warn.${w.code}`) as MessageKey;
        return interpolate(dict[key], w.params, locale);
      },
      num: (n, digits = 1) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n),
      date: (d) => d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
      speak: (seconds) => speakDuration(seconds, locale),
      list: (items) => new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items),
    };
  }, [locale, setLocale]);

  return (
    <Ctx.Provider value={value}>
      {/* React 19 hoists this into <head>; setting document.title directly gets overwritten. */}
      <title>{MESSAGES[locale]['meta.title']}</title>
      {/* Rendered rather than patched into the DOM: React owns the hoisted element, and a patched copy left a second, English one behind. */}
      <meta name="description" content={MESSAGES[locale]['meta.description']} />
      {children}
    </Ctx.Provider>
  );
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
}
