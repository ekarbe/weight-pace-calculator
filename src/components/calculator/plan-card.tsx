'use client';

import { useId, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dateAtRate, planByDate, SUSTAINABLE_PCT_PER_WEEK, type LossRisk } from '@/lib/plan';
import { useI18n } from '@/i18n/provider';
import { kgToLb, unitLabels, type UnitSystem } from '@/lib/units';

interface Props {
  startKg: number;
  targetKg: number;
  units: UnitSystem;
  targetDate: string;
  onDate: (iso: string) => void;
}

const RISK_CLASS: Record<LossRisk, string> = {
  sustainable: 'font-semibold text-primary-ink',
  brisk: 'font-semibold text-amber-800 dark:text-amber-400',
  aggressive: 'font-semibold text-destructive',
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function PlanCard({ startKg, targetKg, units, targetDate, onDate }: Props) {
  const { t, num, rich, plural, date } = useI18n();
  const id = useId();
  const labels = unitLabels(units);
  const lostKg = startKg - targetKg;
  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)), [today]);
  const w = (kg: number) => num(units === 'metric' ? kg : kgToLb(kg), 1);

  if (lostKg < 0.25) {
    return (
      <section className="rounded-3xl border bg-card glassmorphism p-5 sm:p-6">
        <h2 className="text-sm! font-bold uppercase tracking-widest text-muted-foreground">{t('plan.heading')}</h2>
        <p className="mt-2 text-sm">{t('plan.idle')}</p>
      </section>
    );
  }

  const sustainable = dateAtRate(startKg, lostKg, today);
  const plan = targetDate ? planByDate(startKg, lostKg, targetDate, today) : null;

  return (
    <section aria-labelledby={`${id}-h`} className="rounded-3xl border bg-card glassmorphism p-5 sm:p-6">
      <h2 id={`${id}-h`} className="flex items-center gap-2 text-sm! font-bold uppercase tracking-widest text-muted-foreground">
        <CalendarDays className="h-4 w-4" aria-hidden /> {t('plan.heading')}
      </h2>
      {sustainable && (
        <p className="mt-2 text-sm">
          {rich('plan.sustainable', { amount: w(lostKg), unit: labels.weight, pct: SUSTAINABLE_PCT_PER_WEEK, weeks: plural('plan.weeks', Math.ceil(sustainable.weeks)), date: date(sustainable.date) })}
        </p>
      )}
      <div className="mt-4 max-w-xs print:hidden">
        <Label htmlFor={`${id}-date`}>{t('plan.label')}</Label>
        <Input id={`${id}-date`} type="date" min={tomorrow} value={targetDate} onChange={(e) => onDate(e.target.value)} aria-invalid={!!targetDate && !plan} aria-describedby={targetDate && !plan ? `${id}-err` : undefined} />
      </div>
      {targetDate && !plan && <p id={`${id}-err`} role="alert" className="mt-2 text-sm text-destructive">{t('plan.past')}</p>}
      {plan && (
        <div role="status" className="mt-3 text-sm">
          <p>
            {rich(
              'plan.needs',
              { rate: num(units === 'metric' ? plan.kgPerWeek : kgToLb(plan.kgPerWeek), 2), unit: labels.weight, pct: num(plan.pctPerWeek, 2), risk: t(`plan.risk.${plan.risk}`) },
              { r: RISK_CLASS[plan.risk] },
            )}
          </p>
          <p className="mt-1 text-xs">{t(`plan.hint.${plan.risk}`)}</p>
        </div>
      )}
    </section>
  );
}
