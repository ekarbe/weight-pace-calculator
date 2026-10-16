'use client';

import { Languages } from 'lucide-react';
import { LOCALES, LOCALE_NAMES, isLocale } from '@/i18n/core';
import { useI18n } from '@/i18n/provider';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{t('lang.label')}</span>
      <Languages className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" aria-hidden />
      <select
        value={locale}
        onChange={(e) => isLocale(e.target.value) && setLocale(e.target.value)}
        className="h-9 appearance-none rounded-full border border-border bg-background/50 py-1 pl-9 pr-4 text-sm font-medium text-foreground glassmorphism"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>{LOCALE_NAMES[l]}</option>
        ))}
      </select>
    </label>
  );
}
