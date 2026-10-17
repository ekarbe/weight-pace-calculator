'use client';

import { useId, type MouseEvent } from 'react';
import { AlertTriangle, EyeOff, HeartPulse, Info } from 'lucide-react';
import { cn, formatDelta, formatPace, formatTime } from '@/lib/utils';
import { estimateRaceTimeSec, type ResultRow } from '@/lib/calculations';
import { bandValue, timeSavedRange, type Band, type BandMetric } from '@/lib/band';
import { kgToLb, secPerKmToSecPerMile, unitLabels, type UnitSystem } from '@/lib/units';
import type { TrainingPointer } from '@/lib/training';
import { useI18n } from '@/i18n/provider';
import type { MessageKey } from '@/i18n/messages/en';

interface Props {
  rows: ResultRow[];
  index: number;
  onIndex: (i: number) => void;
  units: UnitSystem;
  /** Weight the user typed, shown exactly for row 0. */
  enteredWeight: string;
  customKm: number | null;
  customLabel: string;
  band: Band | null;
  /** What the Training context card (further down the page) says about this scenario. */
  trainingPointer?: TrainingPointer;
}

const RACES = [
  { key: '5K', long: 'race.5k', time: (r: ResultRow) => r.estimated5kTimeSec, text: (r: ResultRow) => r.estimated5kTimeFormatted },
  { key: '10K', long: 'race.10k', time: (r: ResultRow) => r.estimated10kTimeSec, text: (r: ResultRow) => r.estimated10kTimeFormatted },
  { key: 'HM', long: 'race.hm', time: (r: ResultRow) => r.estimatedHmTimeSec, text: (r: ResultRow) => r.estimatedHmTimeFormatted },
  { key: 'M', long: 'race.m', time: (r: ResultRow) => r.estimatedMTimeSec, text: (r: ResultRow) => r.estimatedMTimeFormatted },
] as const satisfies readonly { key: string; long: MessageKey; time: (r: ResultRow) => number | null; text: (r: ResultRow) => string }[];

const STRIPE = 'bg-[repeating-linear-gradient(90deg,var(--foreground)_0_8px,transparent_8px_16px)]';

type Range = { low: number; high: number } | null;
/** A range is only worth printing when there is a saving and the two ends read differently. */
const rangeShown = (range: Range, saved: number): range is { low: number; high: number } =>
  range !== null && saved > 0.5 && formatDelta(range.low) !== formatDelta(range.high);

function RaceFace({ chip, chipClass, sub, timeSec, time, saved, srLabel, range, muted }: { chip: string; chipClass: string; sub: string; timeSec: number; time: string; saved: number; srLabel: string; range: Range; muted: boolean }) {
  const { t, speak } = useI18n();
  const showRange = rangeShown(range, saved);
  return (
    <>
      <p className="sr-only">
        {saved > 0.5 ? t('race.srFaster', { race: srLabel, time: speak(timeSec), delta: speak(saved) }) : t('race.srSame', { race: srLabel, time: speak(timeSec) })}
        {showRange && `. ${t('band.card.srRange', { low: speak(range.low), high: speak(range.high) })}`}
      </p>
      <div aria-hidden>
        <span className={cn('inline-block rounded-md px-2 py-0.5 text-lg font-black tracking-tight', chipClass)}>{chip}</span>
        <span className="mt-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{sub}</span>
        {/* Sized from the card: an 8-character time is about 4.2 em wide, so 22 % of the card keeps even 03:47:26 inside it at any width. */}
        <p className="mt-2 text-[clamp(1.125rem,22cqw,2.25rem)] font-black tabular-nums tracking-tight text-foreground">{time}</p>
        <p className={cn('mt-1 text-sm font-semibold tabular-nums', saved > 0.5 && !muted ? 'text-primary-ink' : 'text-muted-foreground')}>
          {saved > 0.5 ? `−${formatDelta(saved)}` : t('race.baseline')}
          {showRange && <span className="block text-xs font-normal text-muted-foreground">{t('band.card.range', { low: formatDelta(range.low), high: formatDelta(range.high) })}</span>}
        </p>
      </div>
      <div aria-hidden className={cn('absolute inset-x-0 bottom-0 h-1.5 opacity-70', STRIPE)} />
    </>
  );
}

export function RaceCards({ rows, index, onIndex, units, enteredWeight, customKm, customLabel, band, trainingPointer = 'none' }: Props) {
  const { t, num, speak } = useI18n();
  const headingId = useId();
  const labels = unitLabels(units);
  const base = rows[0];
  const sel = rows[index];
  const disp = (kg: number, i: number) =>
    num(i === 0 && enteredWeight ? parseFloat(enteredWeight) : units === 'metric' ? kg : kgToLb(kg), 1);
  const lostKg = base.targetWeightKg - sel.targetWeightKg;
  const lost = units === 'metric' ? lostKg : kgToLb(lostKg);
  const pace = sel.estimatedThresholdPaceSec;
  const paceText = pace === null ? '–' : formatPace(units === 'metric' ? pace : secPerKmToSecPerMile(pace));
  const tenKSaved = (base.estimated10kTimeSec ?? 0) - (sel.estimated10kTimeSec ?? 0);
  const edges = band?.rows[index];
  // Where the Training context card says the estimate should not be relied on, the cards stop dressing it up: the
  // saving loses its green and the range goes (the range assumes the healthy case and its low end reads as a floor).
  const muted = trainingPointer === 'withheld';
  const rangeOf = (baseSec: number, metric: BandMetric) =>
    edges && !muted ? timeSavedRange(baseSec, bandValue(edges.conservative, metric, customKm), bandValue(edges.optimistic, metric, customKm)) : null;
  const customPace = (row: ResultRow) => estimateRaceTimeSec(row.estimatedThresholdPaceSec ?? 0, customKm ?? 0);
  const faces = [
    ...RACES.map((race) => {
      const baseSec = race.time(base) ?? 0;
      const timeSec = race.time(sel) ?? 0;
      return { key: race.key, custom: false, chip: race.key, chipClass: 'bg-foreground text-background', sub: t(race.long), timeSec, time: race.text(sel), saved: baseSec - timeSec, srLabel: t(race.long), range: rangeOf(baseSec, race.key) };
    }),
    ...(customKm !== null
      ? [{ key: 'custom', custom: true, chip: customLabel, chipClass: 'bg-primary text-primary-foreground', sub: t('race.yours'), timeSec: customPace(sel), time: formatTime(customPace(sel)), saved: customPace(base) - customPace(sel), srLabel: customLabel, range: rangeOf(customPace(base), 'custom') }]
      : []),
  ];
  const sliderText =
    index === 0
      ? t('target.sliderNow', { weight: disp(sel.targetWeightKg, index), unit: labels.weight })
      : t('target.sliderValue', { weight: disp(sel.targetWeightKg, index), unit: labels.weight, lost: num(lost, 1), delta: speak(tenKSaved) });

  return (
    <section aria-labelledby={headingId} className="space-y-6">
      <div className="rounded-3xl border bg-card glassmorphism p-5 sm:p-8">
        <h2 id={headingId} className="text-sm! font-bold uppercase tracking-widest text-muted-foreground">{t('target.heading')}</h2>
        <p className="mt-2 text-5xl sm:text-6xl font-black tracking-tight tabular-nums text-foreground" aria-hidden>
          {disp(sel.targetWeightKg, index)} <span className="text-2xl text-muted-foreground">{labels.weight}</span>
        </p>
        <p className="mt-1 text-sm">
          {index === 0
            ? t('target.idle')
            : <>
                <DetailLine lost={num(lost, 1)} unit={labels.weight} pace={paceText} perUnit={units === 'metric' ? 'km' : 'mi'} delta={tenKSaved > 0 ? formatDelta(tenKSaved) : null} />
              </>}
        </p>
        <input
          type="range"
          min={0}
          max={rows.length - 1}
          step={1}
          value={index}
          onChange={(e) => onIndex(Number(e.target.value))}
          aria-labelledby={headingId}
          aria-valuetext={sliderText}
          className="mt-5 h-3 w-full cursor-pointer accent-primary"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums" aria-hidden>
          <span>{t('target.now', { weight: disp(base.targetWeightKg, 0), unit: labels.weight })}</span>
          <span>{disp(rows[rows.length - 1].targetWeightKg, rows.length - 1)} {labels.weight}</span>
        </div>

        {/* The live region is always in the page and the box comes and goes inside it, so the warning is announced when it appears. */}
        <div role="status">
          {(sel.isPotentiallyUnhealthyFat || sel.paceLimited) && (
            <div className="mt-4 flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-ink">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
              <span>
                {sel.isPotentiallyUnhealthyFat && `${t('alert.unhealthyFat')} `}
                {sel.paceLimited && t('alert.paceCapped')}
              </span>
            </div>
          )}
        </div>

        {trainingPointer !== 'none' && <TrainingPointerLine kind={trainingPointer} />}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {faces.map((f) => (
          <li key={f.key} className={cn('@container relative overflow-hidden rounded-2xl border-2 border-foreground/80 bg-card glassmorphism p-4', f.custom && 'col-span-2 lg:col-span-4')}>
            <RaceFace chip={f.chip} chipClass={f.chipClass} sub={f.sub} timeSec={f.timeSec} time={f.time} saved={f.saved} srLabel={f.srLabel} range={f.range} muted={muted} />
          </li>
        ))}
      </ul>

      {/* What the range beside the saving assumes, at the cards themselves (the longer note is under the chart). */}
      {faces.some((f) => rangeShown(f.range, f.saved)) && <p className="text-xs">{t('band.card.note')}</p>}

      <p className="flex gap-2 text-xs"><HeartPulse className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />{t('health.note')}</p>
    </section>
  );
}

/** Tells the reader that the card further down qualifies, or withholds, the figures above it. */
function TrainingPointerLine({ kind }: { kind: 'reduced' | 'withheld' }) {
  const { t } = useI18n();
  const Icon = kind === 'reduced' ? Info : EyeOff;
  const jump = (e: MouseEvent<HTMLAnchorElement>) => {
    // No hash in the address bar (it would not survive the share link anyway): scroll, then move focus to the heading.
    e.preventDefault();
    document.getElementById('training')?.scrollIntoView({ block: 'start' });
    document.getElementById('training-heading')?.focus({ preventScroll: true });
  };
  return (
    <p data-testid="training-pointer" className="mt-4 flex gap-2 text-sm">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', kind === 'reduced' ? 'text-muted-foreground' : 'text-amber-800 dark:text-amber-400')} aria-hidden />
      <a href="#training" onClick={jump} className="font-medium text-foreground underline underline-offset-2">{t(`training.pointer.${kind}`)}</a>
    </p>
  );
}

function DetailLine({ lost, unit, pace, perUnit, delta }: { lost: string; unit: string; pace: string; perUnit: string; delta: string | null }) {
  const { rich } = useI18n();
  return (
    <>
      {rich('target.detail', { lost, unit, pace, perUnit })}
      {delta && rich('target.tenK', { delta })}
    </>
  );
}
