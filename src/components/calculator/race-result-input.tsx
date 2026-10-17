'use client';

import { Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatPace } from '@/lib/utils';
import type { FormState } from '@/lib/share';
import type { FieldErrors } from '@/lib/form';
import { PACE_SOURCES, RACE_DISTANCE_KEYS, deriveRacePace, type RaceDistanceKey } from '@/lib/race-result';
import { useI18n } from '@/i18n/provider';
import type { MessageKey } from '@/i18n/messages/en';

interface Props {
  form: FormState;
  errors: FieldErrors;
  onChange: (patch: Partial<FormState>) => void;
}

const DISTANCE_LABELS = {
  '5k': 'race.5k',
  '10k': 'race.10k',
  hm: 'race.hm',
  m: 'race.m',
  custom: 'raceResult.distance.custom',
} as const satisfies Record<RaceDistanceKey, MessageKey>;

const TIME_FIELDS = [
  { id: 'race-hours', field: 'raceH', label: 'raceResult.time.hours', placeholder: '0', max: 99 },
  { id: 'race-minutes', field: 'raceM', label: 'raceResult.time.minutes', placeholder: '00' },
  { id: 'race-seconds', field: 'raceS', label: 'raceResult.time.seconds', placeholder: '00', max: 59 },
] as const satisfies readonly { id: string; field: keyof FormState; label: MessageKey; placeholder: string; max?: number }[];

function FieldError({ id, message }: { id: string; message?: MessageKey }) {
  const { t } = useI18n();
  return message ? <p id={id} role="alert" className="text-destructive-ink text-xs mt-1">{t(message)}</p> : null;
}

/** aria-describedby must only point at an element that exists. */
const describedBy = (id: string, error?: MessageKey) => (error ? id : undefined);

/** Segmented control plus, in race mode, the race distance / finishing time fields and the derived threshold pace. */
export function RaceResultInput({ form, errors, onChange }: Props) {
  const { t, rich, speak } = useI18n();
  const race = form.paceSource === 'race';
  const metric = form.units === 'metric';
  const derived = deriveRacePace(form);
  const invalid = (e?: string) => (e ? 'border-destructive' : '');

  return (
    <div className={cn('space-y-3', !race && 'mb-3')}>
      <div role="group" aria-label={t('raceResult.source.group')} className="grid grid-cols-2 gap-1 rounded-full border p-1">
        {PACE_SOURCES.map((s) => (
          <Button key={s} type="button" size="sm" className="h-auto min-h-8 min-w-0 whitespace-normal px-2 py-1 leading-tight [overflow-wrap:anywhere] hyphens-auto" variant={form.paceSource === s ? 'default' : 'ghost'} aria-pressed={form.paceSource === s} onClick={() => onChange({ paceSource: s })}>
            {t(s === 'race' ? 'raceResult.source.race' : 'raceResult.source.threshold')}
          </Button>
        ))}
      </div>

      {race && (
        <fieldset className="min-w-0 space-y-3">
          <legend className="mb-1 text-sm font-medium leading-none">{t('raceResult.legend')}</legend>
          <p className="text-xs text-muted-foreground">{t('raceResult.hint')}</p>

          <div>
            <Label htmlFor="race-distance">{t('raceResult.distance.label')}</Label>
            <Select value={form.raceDist} onValueChange={(v) => onChange({ raceDist: v as RaceDistanceKey })}>
              <SelectTrigger id="race-distance" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RACE_DISTANCE_KEYS.map((k) => <SelectItem key={k} value={k}>{t(DISTANCE_LABELS[k])}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.raceDist === 'custom' && (
            <div>
              <Label htmlFor="race-custom">{t('raceResult.distance.customLabel', { unit: metric ? 'km' : 'mi' })}</Label>
              <Input id="race-custom" type="number" inputMode="decimal" min="0" step="0.1" placeholder={metric ? '8' : '5'} value={form.raceCustom}
                onChange={(e) => onChange({ raceCustom: e.target.value })} aria-invalid={!!errors.raceDistance} aria-describedby={describedBy('race-custom-err', errors.raceDistance)} className={invalid(errors.raceDistance)} />
              <FieldError id="race-custom-err" message={errors.raceDistance} />
            </div>
          )}

          <fieldset className="min-w-0" aria-describedby={describedBy('race-time-err', errors.raceTime)}>
            <legend className="mb-1 text-sm font-medium leading-none">{t('raceResult.time.legend')}</legend>
            <div className="flex items-end gap-2">
              {TIME_FIELDS.map((f, i) => (
                <Fragment key={f.id}>
                  {i > 0 && <span aria-hidden className="pb-1.5">:</span>}
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={f.id} className="mb-1 text-xs text-muted-foreground">{t(f.label)}</Label>
                    <Input id={f.id} type="number" inputMode="numeric" min="0" max={'max' in f ? f.max : undefined} step="1" placeholder={f.placeholder} value={form[f.field]}
                      onChange={(e) => onChange({ [f.field]: e.target.value })} aria-invalid={!!errors.raceTime} className={invalid(errors.raceTime)} />
                  </div>
                </Fragment>
              ))}
            </div>
            <FieldError id="race-time-err" message={errors.raceTime} />
          </fieldset>

          {/* Always rendered so screen readers announce the pace when it appears or changes. */}
          <div role="status" className={cn('text-sm', derived.displaySec !== null && 'rounded-2xl bg-muted/50 px-3 py-2')}>
            {derived.displaySec !== null && (
              <>
                <span aria-hidden>{rich('raceResult.derived', { pace: formatPace(derived.displaySec), unit: metric ? 'km' : 'mi' })}</span>
                <span className="sr-only">
                  {t('raceResult.derived.sr', { pace: speak(derived.displaySec), unitName: t(metric ? 'raceResult.unitName.metric' : 'raceResult.unitName.imperial') })}
                </span>
              </>
            )}
          </div>
        </fieldset>
      )}
    </div>
  );
}
