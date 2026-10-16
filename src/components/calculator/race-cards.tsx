'use client';

import { useId } from 'react';
import { AlertTriangle, HeartPulse } from 'lucide-react';
import { cn, formatDelta, formatPace, formatTime } from '@/lib/utils';
import { estimateRaceTimeSec, type ResultRow } from '@/lib/calculations';
import { kgToLb, secPerKmToSecPerMile, unitLabels, type UnitSystem } from '@/lib/units';

interface Props {
  rows: ResultRow[];
  index: number;
  onIndex: (i: number) => void;
  units: UnitSystem;
  /** Weight the user typed, shown exactly for row 0. */
  enteredWeight: string;
  customKm: number | null;
  customLabel: string;
}

const RACES = [
  { key: '5K', long: '5 km', time: (r: ResultRow) => r.estimated5kTimeSec, text: (r: ResultRow) => r.estimated5kTimeFormatted },
  { key: '10K', long: '10 km', time: (r: ResultRow) => r.estimated10kTimeSec, text: (r: ResultRow) => r.estimated10kTimeFormatted },
  { key: 'HM', time: (r: ResultRow) => r.estimatedHmTimeSec, text: (r: ResultRow) => r.estimatedHmTimeFormatted, long: 'Half marathon' },
  { key: 'M', time: (r: ResultRow) => r.estimatedMTimeSec, text: (r: ResultRow) => r.estimatedMTimeFormatted, long: 'Marathon' },
] as const;

export function RaceCards({ rows, index, onIndex, units, enteredWeight, customKm, customLabel }: Props) {
  const sliderId = useId();
  const labels = unitLabels(units);
  const base = rows[0];
  const sel = rows[index];
  const disp = (kg: number, i: number) =>
    (i === 0 && enteredWeight ? parseFloat(enteredWeight) : units === 'metric' ? kg : kgToLb(kg)).toFixed(1);
  const lostKg = base.targetWeightKg - sel.targetWeightKg;
  const lost = units === 'metric' ? lostKg : kgToLb(lostKg);
  const pace = sel.estimatedThresholdPaceSec;
  const paceText = pace === null ? 'N/A' : formatPace(units === 'metric' ? pace : secPerKmToSecPerMile(pace));
  const tenKSaved = (base.estimated10kTimeSec ?? 0) - (sel.estimated10kTimeSec ?? 0);

  return (
    <section aria-labelledby="race-heading" className="space-y-6">
      <div className="rounded-3xl border bg-card glassmorphism p-5 sm:p-8">
        <h2 id="race-heading" className="text-sm! font-bold uppercase tracking-widest text-muted-foreground">Target weight</h2>
        <p className="mt-2 text-5xl sm:text-6xl font-black tracking-tight tabular-nums text-foreground" aria-live="polite">
          {disp(sel.targetWeightKg, index)} <span className="text-2xl text-muted-foreground">{labels.weight}</span>
        </p>
        <p className="mt-1 text-sm">
          {index === 0
            ? 'Drag the slider to see what a lighter you could run.'
            : <>−{lost.toFixed(1)} {labels.weight} · threshold pace <strong className="text-foreground">{paceText}</strong> /{units === 'metric' ? 'km' : 'mi'}{tenKSaved > 0 && <> · 10K <strong className="text-primary-ink">{formatDelta(tenKSaved)} faster</strong></>}</>}
        </p>
        <label htmlFor={sliderId} className="sr-only">Target weight</label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={rows.length - 1}
          step={1}
          value={index}
          onChange={(e) => onIndex(Number(e.target.value))}
          aria-valuetext={`${disp(sel.targetWeightKg, index)} ${labels.weight}`}
          className="mt-5 h-3 w-full cursor-pointer accent-primary"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{disp(base.targetWeightKg, 0)} {labels.weight} (now)</span>
          <span>{disp(rows[rows.length - 1].targetWeightKg, rows.length - 1)} {labels.weight}</span>
        </div>

        {(sel.isPotentiallyUnhealthyFat || sel.paceLimited) && (
          <div role="status" className="mt-4 flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {sel.isPotentiallyUnhealthyFat && 'Estimated body fat at this weight is below healthy levels. '}
              {sel.paceLimited && 'Pace is capped at the model’s limit here, so these times are not reliable.'}
            </span>
          </div>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {RACES.map((race) => {
          const now = race.time(base) ?? 0;
          const then = race.time(sel) ?? 0;
          const saved = now - then;
          return (
            <li key={race.key} className="relative overflow-hidden rounded-2xl border-2 border-foreground/80 bg-card glassmorphism p-4">
              <span className="inline-block rounded-md bg-foreground px-2 py-0.5 text-lg font-black tracking-tight text-background">{race.key}</span>
              <span className="mt-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{race.long}</span>
              <p className="mt-2 text-3xl sm:text-4xl font-black tabular-nums tracking-tight text-foreground">{race.text(sel)}</p>
              <p className={cn('mt-1 text-sm font-semibold tabular-nums', saved > 0.5 ? 'text-primary-ink' : 'text-muted-foreground')}>
                {saved > 0.5 ? `−${formatDelta(saved)}` : 'baseline'}
              </p>
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-[repeating-linear-gradient(90deg,var(--foreground)_0_8px,transparent_8px_16px)] opacity-70" />
            </li>
          );
        })}
        {customKm !== null && (() => {
          const now = estimateRaceTimeSec(base.estimatedThresholdPaceSec ?? 0, customKm);
          const then = estimateRaceTimeSec(sel.estimatedThresholdPaceSec ?? 0, customKm);
          const saved = now - then;
          return (
            <li className="relative col-span-2 overflow-hidden rounded-2xl border-2 border-foreground/80 bg-card glassmorphism p-4 lg:col-span-4">
              <span className="inline-block rounded-md bg-primary px-2 py-0.5 text-lg font-black tracking-tight text-primary-foreground">{customLabel}</span>
              <span className="mt-1 block text-[10px] uppercase tracking-wider text-muted-foreground">Your distance</span>
              <p className="mt-2 text-3xl sm:text-4xl font-black tabular-nums tracking-tight text-foreground">{formatTime(then)}</p>
              <p className={cn('mt-1 text-sm font-semibold tabular-nums', saved > 0.5 ? 'text-primary-ink' : 'text-muted-foreground')}>
                {saved > 0.5 ? `−${formatDelta(saved)}` : 'baseline'}
              </p>
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-[repeating-linear-gradient(90deg,var(--foreground)_0_8px,transparent_8px_16px)] opacity-70" />
            </li>
          );
        })()}
      </ul>

      <p className="flex gap-2 text-xs"><HeartPulse className="h-4 w-4 shrink-0 text-primary-ink" />
        Estimates, not a weight-loss plan. Don’t aim below a healthy weight for your height; talk to a doctor or dietitian before changing your weight.
      </p>
    </section>
  );
}
