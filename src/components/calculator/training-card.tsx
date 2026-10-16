'use client';

import { useId, useMemo } from 'react';
import { Activity, EyeOff, Info, TriangleAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM, type ResultRow, type UserInput } from '@/lib/calculations';
import type { TrainingFields } from '@/lib/form';
import { MAX_PCT_PER_WEEK, SUSTAINABLE_PCT_PER_WEEK } from '@/lib/plan';
import type { FormState } from '@/lib/share';
import { TRAINING, computeTraining, lowestFactor, trainingInputFor, type TrainingHistory } from '@/lib/training';
import { KM_PER_MILE, kgToLb, unitLabels, type UnitSystem } from '@/lib/units';
import { cn, formatDelta } from '@/lib/utils';
import { useI18n } from '@/i18n/provider';

interface Props {
  input: UserInput;
  /** The selected table row. */
  row: ResultRow;
  units: UnitSystem;
  targetDate: string;
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

/**
 * Sets the headline pace gain against the pace of weight change and the weekly running. It only ever
 * qualifies what the rest of the page shows: it never raises a figure, and in some situations shows none.
 */
export function TrainingCard({ input, row, units, targetDate, weeklyKmText, history, fields, onChange }: Props) {
  const { t, rich, num, speak } = useI18n();
  const id = useId();
  const labels = unitLabels(units);
  const metric = units === 'metric';
  const today = useMemo(() => new Date(), []);
  const result = useMemo(
    () => computeTraining(trainingInputFor(input, row, fields, targetDate), today),
    [input, row, fields, targetDate, today],
  );

  if (result.display === 'hidden') return null;

  const heading = (
    <h2 id={`${id}-h`} className="flex items-center gap-2 text-sm! font-bold uppercase tracking-widest text-muted-foreground">
      <Activity className="h-4 w-4" aria-hidden /> {t('training.heading')}
    </h2>
  );
  const shell = 'rounded-3xl border bg-card glassmorphism p-5 sm:p-6 break-words hyphens-auto';

  if (result.display === 'idle') {
    return (
      <section aria-labelledby={`${id}-h`} className={shell}>
        {heading}
        <p className="mt-2 text-sm">{t('training.idle')}</p>
      </section>
    );
  }

  const { withheld, rate, savings10k } = result;
  const variant = withheld ? 'withheld' : result.reduced ? 'reduced' : 'same';
  const { Icon, cls } = STATE[variant];
  const known = result.load !== 'unknown';
  const typedKm = Number(weeklyKmText);
  const statusParams = rate && {
    risk: t(`plan.risk.${rate.risk}`),
    pct: num(rate.pct, 1),
    km: num(typedKm, Number.isInteger(typedKm) ? 0 : 1),
    unit: metric ? 'km' : 'mi',
  };
  const showStatus = result.display === 'full' || withheld === 'tooFast' || withheld === 'fastAndHeavy';
  const showInputs = result.display === 'full' || withheld === 'tooFast' || withheld === 'fastAndHeavy' || withheld === 'inputError';

  const hintId = `${id}-km-hint`;
  const errId = `${id}-km-err`;
  const error = fields.weeklyKmError;

  const summaryKey = variant === 'reduced' ? 'training.summary.reduced' : 'training.summary.same';
  const summary = (fmt: (sec: number) => string) =>
    savings10k && rich(summaryKey, {
      race: t('race.10k'),
      realistic: fmt(savings10k.realistic),
      conservative: fmt(savings10k.conservative),
      headline: fmt(savings10k.headline),
    });

  const central = input.paceFactorSecPerKg ?? DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM;
  const km = (v: number) => num(metric ? v : v / KM_PER_MILE, 0);

  return (
    <section aria-labelledby={`${id}-h`} className={shell}>
      {heading}
      <p className="mt-2 text-sm">{t('training.intro')}</p>

      {/* The only live region: its text depends on the state alone, never on slider-driven numbers. */}
      <p role="status" aria-live="polite" aria-atomic="true" className={cn('mt-3 flex items-center gap-2 text-sm font-semibold', cls)}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden /> {t(`training.state.${variant}`)}
      </p>

      {withheld ? (
        <p className="mt-2 text-sm">{t(`training.withheld.${withheld}`, { max: MAX_PCT_PER_WEEK })}</p>
      ) : (
        <>
          <p aria-hidden="true" className="mt-2 text-base">{summary((s) => formatDelta(Math.round(s)))}</p>
          <p className="sr-only">{summary(speak)}</p>
        </>
      )}

      {showStatus && statusParams && (
        <p className="mt-2 text-xs text-muted-foreground">{rich(known ? 'training.status.known' : 'training.status.unknown', statusParams)}</p>
      )}

      {result.reducedBy && <p className="mt-2 text-sm">{t(`training.reduced.${result.reducedBy}`)}</p>}

      {result.display === 'full' && (
        <>
          {result.notes.map((n) => (
            <p key={n} className="mt-2 text-xs text-muted-foreground">
              {t(`training.note.${n}`, { pct: SUSTAINABLE_PCT_PER_WEEK })}
            </p>
          ))}
          <p className="mt-2 text-sm">{t(`training.context.${fields.history ?? 'unknown'}`)}</p>
          <p className="mt-2 text-xs">{t('training.keep')}</p>
        </>
      )}

      {result.showHelp && <p className="mt-2 text-sm">{t('training.help')}</p>}
      {(result.showHelp || result.reduced) && <p className="mt-2 text-sm">{t('training.signs')}</p>}

      {showInputs && (
        <fieldset className="mt-4 min-w-0 print:hidden">
          <legend className="text-sm font-semibold">{t('training.inputs.legend')}</legend>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${id}-km`} className="mb-1 leading-snug">
                {t('training.weeklyKm.label', { unit: metric ? 'km' : 'mi' })} <span className="text-xs text-muted-foreground">{t('optional')}</span>
              </Label>
              <Input
                id={`${id}-km`}
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                placeholder={metric ? '40' : '25'}
                value={weeklyKmText}
                onChange={(e) => onChange({ weeklyKm: e.target.value })}
                aria-invalid={!!error}
                aria-describedby={error ? `${hintId} ${errId}` : hintId}
                className={error ? 'border-destructive' : ''}
              />
              <p id={hintId} className="mt-1 text-xs text-muted-foreground">{t('training.weeklyKm.hint')}</p>
              {error && <p id={errId} role="alert" className="mt-1 text-xs text-red-700 dark:text-destructive">{t(error)}</p>}
            </div>
            <div>
              <Label htmlFor={`${id}-hist`} className="mb-1 leading-snug">{t('training.history.label')}</Label>
              <Select value={history} onValueChange={(v) => onChange({ trainingHistory: v === 'none' ? '' : (v as TrainingHistory) })}>
                <SelectTrigger
                  id={`${id}-hist`}
                  className="w-full text-left whitespace-normal data-[size=default]:h-auto data-[size=default]:min-h-9 *:data-[slot=select-value]:line-clamp-none"
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

      <details className="mt-4 text-xs">
        <summary className="cursor-pointer text-sm font-medium">{t('training.how.summary')}</summary>
        <div className="mt-2 space-y-2">
          <p>{t('training.how.start', { central: num(central, 1), lowest: num(lowestFactor(central), 1) })}</p>
          <p>
            {t('training.how.rate', {
              sust: SUSTAINABLE_PCT_PER_WEEK,
              max: MAX_PCT_PER_WEEK,
              minLoss: `${num(metric ? TRAINING.RATE_RULES_MIN_LOSS_KG : kgToLb(TRAINING.RATE_RULES_MIN_LOSS_KG), 1)} ${labels.weight}`,
            })}
          </p>
          <p>{t('training.how.load', { high: km(TRAINING.HIGH_LOAD_KM), veryHigh: km(TRAINING.VERY_HIGH_LOAD_KM), unit: metric ? 'km' : 'mi' })}</p>
          <p>{t('training.how.proxy')}</p>
          <p>{t('training.how.limits')}</p>
        </div>
      </details>
    </section>
  );
}
