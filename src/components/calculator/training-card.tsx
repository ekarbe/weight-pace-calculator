'use client';

import { Activity, EyeOff, Info, TriangleAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM, type UserInput } from '@/lib/calculations';
import type { TrainingFields } from '@/lib/form';
import type { FormState } from '@/lib/share';
import { TRAINING, chooseSummary, explainerFigures, type TrainingHistory, type TrainingResult } from '@/lib/training';
import { unitLabels, type UnitSystem } from '@/lib/units';
import { cn, formatDelta } from '@/lib/utils';
import { useI18n } from '@/i18n/provider';

interface Props {
  /** Computed once by the page, so the race cards and the share image follow the same result as this card. */
  result: TrainingResult;
  input: UserInput;
  units: UnitSystem;
  weeklyKmText: string;
  history: FormState['trainingHistory'];
  fields: TrainingFields;
  onChange: (patch: Partial<Pick<FormState, 'weeklyKm' | 'trainingHistory'>>) => void;
}

const AMBER = 'text-amber-800 dark:text-amber-400';
const STATE = {
  same: { Icon: Info, cls: 'text-muted-foreground' },
  reduced: { Icon: TriangleAlert, cls: AMBER },
  withheld: { Icon: EyeOff, cls: AMBER },
} as const;

const HISTORY_ITEMS = ['new', 'some', 'veteran'] as const satisfies readonly TrainingHistory[];
/** Fixed ids: there is exactly one Training card on the page, and the race cards link to #training. */
const ID = { section: 'training', heading: 'training-heading', km: 'training-km', hint: 'training-km-hint', err: 'training-km-err', history: 'training-history' } as const;

/** Decimals needed to show a typed number as typed (at most two). */
const decimals = (n: number) => (Number.isInteger(n) ? 0 : Number.isInteger(n * 10) ? 1 : 2);

/**
 * Sets the headline pace gain against the pace of weight change and the weekly running. It only ever
 * qualifies what the rest of the page shows: it never raises a figure, and in some situations shows none.
 */
export function TrainingCard({ result, input, units, weeklyKmText, history, fields, onChange }: Props) {
  const { t, rich, num, speak } = useI18n();
  const labels = unitLabels(units);
  const metric = units === 'metric';

  if (result.display === 'hidden') return null;

  const heading = (
    <h2 id={ID.heading} tabIndex={-1} className="flex items-center gap-2 text-sm! font-bold uppercase tracking-widest text-muted-foreground">
      <Activity className="h-4 w-4" aria-hidden /> {t('training.heading')}
    </h2>
  );
  const shell = 'scroll-mt-20 rounded-3xl border bg-card glassmorphism p-5 sm:p-6 break-words hyphens-auto';

  if (result.display === 'idle') {
    return (
      <section id={ID.section} aria-labelledby={ID.heading} className={shell}>
        {heading}
        <p className="mt-2 text-sm">{t(result.idleKind === 'tiny' ? 'training.idle.tiny' : 'training.idle.none')}</p>
      </section>
    );
  }

  const { withheld, rate, savings10k } = result;
  const variant = withheld ? 'withheld' : result.reduced ? 'reduced' : 'same';
  const { Icon, cls } = STATE[variant];
  const summaryKind = chooseSummary(result);
  const showIntro = result.display === 'full' || withheld === 'inputError';
  // Typed values stay in the form state while the fields are hidden; they only matter where they can change the outcome.
  const showInputs = result.display === 'full' || withheld === 'fastAndHeavy' || withheld === 'inputError';
  const showStatus = result.display === 'full' || withheld === 'tooFast' || withheld === 'fastAndHeavy';

  const typedKm = Number(weeklyKmText);
  const statusParams = rate && {
    risk: t(`plan.risk.${rate.risk}`),
    pct: num(rate.pct, 1),
    km: num(typedKm, decimals(typedKm)),
    unit: metric ? 'km' : 'mi',
  };

  // Round once to a whole second; the eye gets m:ss and a screen reader gets the same number as words.
  const summary = (fmt: (sec: number) => string) =>
    summaryKind && savings10k && rich(`training.summary.${summaryKind}`, {
      race: t('race.10k'),
      realistic: fmt(Math.round(savings10k.realistic)),
      conservative: fmt(Math.round(savings10k.conservative)),
      headline: fmt(Math.round(savings10k.headline)),
    });

  const withheldKey = withheld === 'lowBmi' ? (`training.withheld.lowBmi.${result.lowBmiAt ?? 'selected'}` as const) : withheld && (`training.withheld.${withheld}` as const);

  const error = fields.weeklyKmError;
  const figures = explainerFigures({
    units,
    startKg: input.weightKg,
    centralFactor: input.paceFactorSecPerKg ?? DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM,
    baselinePaceSec: input.thresholdPaceMin * 60 + input.thresholdPaceSec,
  });
  /** A factor with the decimals it needs: 2.0, 1.0, 3.0, but also 2.25. */
  const factor = (v: number) => num(v, Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2);
  const unit = metric ? 'km' : 'mi';
  /** Printed distances: whole km, but miles keep the tenth they were rounded up to (31.1, 62.2). */
  const dist = (v: number) => num(v, metric ? 0 : 1);
  const how: [string, string][] = [
    [t('training.how.start', { central: factor(figures.central), lowest: factor(figures.lowest), ceiling: factor(figures.ceiling) }), 'start'],
    [t('training.how.check', { central: factor(figures.central), elasticity: num(figures.elasticityPct, 2) }), 'check'],
    [t('training.how.rate', { sust: figures.sust, max: figures.max }), 'rate'],
    [t('training.how.load', { high: dist(figures.high), veryHigh: dist(figures.veryHigh), unit }), 'load'],
    [t('training.how.small', { minChange: `${num(figures.minChange, 1)} ${labels.weight}` }), 'small'],
    [t('training.how.floor', { bmi: num(figures.bmi, 0) }), 'floor'],
    [t('training.how.proxy'), 'proxy'],
    [t('training.how.limits'), 'limits'],
  ];

  return (
    <section id={ID.section} aria-labelledby={ID.heading} className={shell}>
      {heading}
      {showIntro && <p className="mt-2 text-sm">{t('training.intro')}</p>}

      {/* The only live region: its text depends on the state alone, never on slider-driven numbers. */}
      <p role="status" aria-live="polite" aria-atomic="true" className={cn('mt-3 flex items-center gap-2 text-sm font-semibold', cls)}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden /> {t(`training.state.${variant}`)}
      </p>

      {withheldKey ? (
        <p className="mt-2 text-sm">{t(withheldKey)}</p>
      ) : (
        <>
          <p aria-hidden="true" className="mt-2 text-base">{summary((s) => formatDelta(s))}</p>
          <p className="sr-only">{summary(speak)}</p>
          {result.reasons.map((r) => (
            <p key={r} className="mt-2 text-sm">{t(`training.reduced.${r}`, { max: figures.ceiling })}</p>
          ))}
        </>
      )}

      {showStatus && statusParams && (
        <p className="mt-2 text-xs text-muted-foreground">{rich(result.load === 'unknown' ? 'training.status.unknown' : 'training.status.known', statusParams)}</p>
      )}

      {result.notes.length > 0 && (
        <ul className="mt-2 space-y-2">
          {result.notes.map((n) => (
            <li key={n} className="text-xs text-muted-foreground">{t(`training.note.${n}`, { pct: figures.sust })}</li>
          ))}
        </ul>
      )}

      {result.display === 'full' && (
        <>
          <p className="mt-2 text-sm">{t(`training.context.${fields.history ?? 'unknown'}`)}</p>
          <p className="mt-2 text-xs">{t('training.keep')}</p>
        </>
      )}

      {result.showHelp && <p className="mt-2 text-sm">{t('training.help')}</p>}
      {result.showSigns && <p className="mt-2 text-sm">{t('training.signs')}</p>}

      {showInputs && (
        <fieldset className="mt-4 min-w-0 print:hidden">
          <legend className="text-sm font-semibold">{t('training.inputs.legend')}</legend>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={ID.km} className="mb-1 leading-snug">
                {t('training.weeklyKm.label', { unit })} <span className="text-xs text-muted-foreground">{t('optional')}</span>
              </Label>
              <Input
                id={ID.km}
                type="number"
                inputMode="decimal"
                min="0"
                max={metric ? TRAINING.WEEKLY_KM_MAX : 155}
                step="1"
                placeholder={metric ? '40' : '25'}
                value={weeklyKmText}
                onChange={(e) => onChange({ weeklyKm: e.target.value })}
                aria-invalid={!!error}
                aria-describedby={error ? `${ID.hint} ${ID.err}` : ID.hint}
                className={cn('pointer-coarse:h-11 pointer-coarse:text-base', error && 'border-destructive')}
              />
              <p id={ID.hint} className="mt-1 text-xs text-muted-foreground">{t('training.weeklyKm.hint')}</p>
              {error && <p id={ID.err} role="alert" className="mt-1 text-xs text-red-700 dark:text-destructive">{t(error)}</p>}
            </div>
            <div>
              <Label htmlFor={ID.history} className="mb-1 leading-snug">{t('training.history.label')}</Label>
              <Select value={history} onValueChange={(v) => onChange({ trainingHistory: v === 'none' ? '' : (v as TrainingHistory) })}>
                <SelectTrigger
                  id={ID.history}
                  className="w-full text-left whitespace-normal data-[size=default]:h-auto data-[size=default]:min-h-9 pointer-coarse:data-[size=default]:min-h-11 pointer-coarse:text-base *:data-[slot=select-value]:line-clamp-none"
                >
                  <SelectValue placeholder={t('training.history.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('training.history.none')}</SelectItem>
                  {HISTORY_ITEMS.map((h) => <SelectItem key={h} value={h}>{t(`training.history.${h}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </fieldset>
      )}

      <details className="mt-4 print:hidden">
        <summary className="cursor-pointer text-sm font-medium">{t('training.how.summary')}</summary>
        <div className="mt-2 space-y-2">
          {how.map(([text, key]) => <p key={key} className="text-xs">{text}</p>)}
        </div>
      </details>

      <p className="mt-4 text-xs">{t('training.scope')}</p>
    </section>
  );
}
