'use client';

import { useId, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { dateAtRate, planByDate, SUSTAINABLE_PCT_PER_WEEK, type LossRisk } from '@/lib/plan';
import { kgToLb, unitLabels, type UnitSystem } from '@/lib/units';

interface Props {
  startKg: number;
  targetKg: number;
  units: UnitSystem;
  targetDate: string;
  onDate: (iso: string) => void;
}

const RISK_TEXT: Record<LossRisk, { label: string; cls: string; hint: string }> = {
  sustainable: { label: 'Sustainable', cls: 'text-primary-ink', hint: 'At or below about 0.5% of body weight per week.' },
  brisk: { label: 'Brisk', cls: 'text-amber-800 dark:text-amber-400', hint: 'Above 0.5% per week. Hard to sustain while training and easy to under-fuel.' },
  aggressive: { label: 'Too fast', cls: 'text-destructive', hint: 'Above 1% of body weight per week. This risks injury, illness and lost performance; choose a later date or a higher target weight.' },
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function PlanCard({ startKg, targetKg, units, targetDate, onDate }: Props) {
  const id = useId();
  const labels = unitLabels(units);
  const lostKg = startKg - targetKg;
  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)), [today]);
  const w = (kg: number) => (units === 'metric' ? kg : kgToLb(kg)).toFixed(1);

  if (lostKg < 0.25) {
    return (
      <section className="rounded-3xl border bg-card glassmorphism p-5 sm:p-6">
        <h2 className="text-sm! font-bold uppercase tracking-widest text-muted-foreground">Timeline</h2>
        <p className="mt-2 text-sm">Move the slider below your current weight to see how long it would take.</p>
      </section>
    );
  }

  const sustainable = dateAtRate(startKg, lostKg, today);
  const plan = targetDate ? planByDate(startKg, lostKg, targetDate, today) : null;
  const risk = plan ? RISK_TEXT[plan.risk] : null;
  const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <section aria-labelledby={`${id}-h`} className="rounded-3xl border bg-card glassmorphism p-5 sm:p-6">
      <h2 id={`${id}-h`} className="flex items-center gap-2 text-sm! font-bold uppercase tracking-widest text-muted-foreground">
        <CalendarDays className="h-4 w-4" /> Timeline
      </h2>
      {sustainable && (
        <p className="mt-2 text-sm">
          Losing {w(lostKg)} {labels.weight} at a sustainable {SUSTAINABLE_PCT_PER_WEEK}% of body weight per week takes about{' '}
          <strong className="text-foreground">{Math.ceil(sustainable.weeks)} weeks</strong> (around {fmtDate(sustainable.date)}).
        </p>
      )}
      <div className="mt-4 max-w-xs">
        <Label htmlFor={`${id}-date`}>I want to get there by</Label>
        <Input id={`${id}-date`} type="date" min={tomorrow} value={targetDate} onChange={(e) => onDate(e.target.value)} />
      </div>
      {targetDate && !plan && <p role="alert" className="mt-2 text-sm text-destructive">Pick a date in the future.</p>}
      {plan && risk && (
        <div role="status" className="mt-3 text-sm">
          <p>
            That needs <strong className="text-foreground tabular-nums">
              {(units === 'metric' ? plan.kgPerWeek : kgToLb(plan.kgPerWeek)).toFixed(2)} {labels.weight}/week
            </strong>{' '}
            ({plan.pctPerWeek.toFixed(2)}% per week): <strong className={cn(risk.cls)}>{risk.label}</strong>.
          </p>
          <p className="mt-1 text-xs">{risk.hint}</p>
        </div>
      )}
    </section>
  );
}
