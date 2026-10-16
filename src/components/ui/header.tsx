'use client';

import Link from 'next/link';
import { WeightScaleIcon } from '@/components/icons/weight-scale-icon';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useI18n } from '@/i18n/provider';

export function Header() {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 glassmorphism print:hidden">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between gap-2 px-4">
        <Link
          href="/"
          className="flex items-center space-x-2 text-foreground"
        >
          <WeightScaleIcon
            className="h-7 w-7 text-primary"
            aria-hidden="true"
          />
          <span className="font-bold sm:inline-block tracking-tight text-lg">
            {t('header.title')}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
