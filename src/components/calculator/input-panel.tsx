'use client';

import { Info, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RaceResultInput } from '@/components/calculator/race-result-input';
import { cn } from '@/lib/utils';
import type { FormState } from '@/lib/share';
import type { AdvancedState, FieldErrors } from '@/lib/form';
import { unitLabels, type UnitSystem } from '@/lib/units';
import { useI18n } from '@/i18n/provider';
import type { MessageKey } from '@/i18n/messages/en';

interface Props {
  form: FormState;
  adv: AdvancedState;
  errors: FieldErrors;
  copied: boolean;
  onChange: (patch: Partial<FormState>) => void;
  onUnits: (u: UnitSystem) => void;
  onAdv: (patch: Partial<AdvancedState>) => void;
  onShare: () => void;
}

function FieldError({ id, message }: { id: string; message?: MessageKey }) {
  const { t } = useI18n();
  return message ? <p id={id} role="alert" className="text-destructive text-xs mt-1">{t(message)}</p> : null;
}

/** aria-describedby must only point at an element that exists. */
const describedBy = (id: string, error?: MessageKey) => (error ? id : undefined);

export function InputPanel({ form, adv, errors, copied, onChange, onUnits, onAdv, onShare }: Props) {
  const { t } = useI18n();
  const labels = unitLabels(form.units);
  const metric = form.units === 'metric';
  const invalid = (e?: string) => (e ? 'border-destructive' : '');

  return (
    <section aria-labelledby="inputs-heading" className="space-y-5">
      <h2 id="inputs-heading" className="text-2xl! font-extrabold uppercase tracking-tight">{t('inputs.heading')}</h2>

      <div role="group" aria-label={t('units.group')} className="grid grid-cols-2 gap-1 rounded-full border p-1">
        {(['metric', 'imperial'] as const).map((u) => (
          <Button key={u} type="button" size="sm" className="rounded-full" variant={form.units === u ? 'default' : 'ghost'} aria-pressed={form.units === u} onClick={() => onUnits(u)}>
            {t(u === 'metric' ? 'units.metric' : 'units.imperial')}
          </Button>
        ))}
      </div>

      <div>
        <Label htmlFor="gender">{t('sex.label')}</Label>
        <Select value={form.gender} onValueChange={(v) => onChange({ gender: v as FormState['gender'] })}>
          <SelectTrigger id="gender" aria-describedby="sex-hint"><SelectValue placeholder={t('sex.placeholder')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="male">{t('sex.male')}</SelectItem>
            <SelectItem value="female">{t('sex.female')}</SelectItem>
          </SelectContent>
        </Select>
        <p id="sex-hint" className="text-xs text-muted-foreground mt-1">{t('sex.hint')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="height">{t('height.label', { unit: labels.height })}</Label>
          <Input id="height" type="number" inputMode="decimal" min="0" step="0.1" placeholder={metric ? '180' : '71'} value={form.height}
            onChange={(e) => onChange({ height: e.target.value })} aria-invalid={!!errors.height} aria-describedby={describedBy('height-err', errors.height)} className={invalid(errors.height)} />
          <FieldError id="height-err" message={errors.height} />
        </div>
        <div>
          <Label htmlFor="weight">{t('weight.label', { unit: labels.weight })}</Label>
          <Input id="weight" type="number" inputMode="decimal" min="0" step="0.1" placeholder={metric ? '75.5' : '166'} value={form.weight}
            onChange={(e) => onChange({ weight: e.target.value })} aria-invalid={!!errors.weight} aria-describedby={describedBy('weight-err', errors.weight)} className={invalid(errors.weight)} />
          <FieldError id="weight-err" message={errors.weight} />
        </div>
      </div>

      <div>
        <Label htmlFor="bfp">{t('bodyFat.label')} <span className="text-muted-foreground text-xs">{t('optional')}</span></Label>
        <Input id="bfp" type="number" inputMode="decimal" step="0.1" placeholder="15" value={form.bodyFat}
          onChange={(e) => onChange({ bodyFat: e.target.value })} aria-invalid={!!errors.bodyFat} aria-describedby={describedBy('bfp-err', errors.bodyFat)} className={invalid(errors.bodyFat)} />
        <FieldError id="bfp-err" message={errors.bodyFat} />
      </div>

      <RaceResultInput form={form} errors={errors} onChange={onChange} />

      <fieldset hidden={form.paceSource === 'race'} aria-describedby={describedBy('pace-err', errors.pace)}>
        <legend className="mb-1 flex items-center gap-1 text-sm font-medium leading-none">
          {t('pace.label', { unit: labels.pace })}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label={t('pace.help')} className="text-muted-foreground"><Info className="w-4 h-4" /></button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs"><p>{t('pace.tooltip')}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </legend>
        <div className="flex items-center gap-2">
          <Input id="pace-min" type="number" inputMode="numeric" min="0" placeholder={t('pace.minPlaceholder')} value={form.paceMin}
            onChange={(e) => onChange({ paceMin: e.target.value })} aria-label={t('pace.minutes')} aria-invalid={!!errors.pace} className={invalid(errors.pace)} />
          <span aria-hidden>:</span>
          <Input id="pace-sec" type="number" inputMode="numeric" min="0" max="59" placeholder={t('pace.secPlaceholder')} value={form.paceSec}
            onChange={(e) => onChange({ paceSec: e.target.value })} aria-label={t('pace.seconds')} aria-invalid={!!errors.pace} className={invalid(errors.pace)} />
        </div>
        <FieldError id="pace-err" message={errors.pace} />
      </fieldset>

      <div>
        <Label htmlFor="distance">{t('distance.label', { unit: metric ? 'km' : 'mi' })} <span className="text-muted-foreground text-xs">{t('optional')}</span></Label>
        <Input id="distance" type="number" inputMode="decimal" min="0" step="0.1" placeholder={metric ? '15' : '9.3'} value={form.distance}
          onChange={(e) => onChange({ distance: e.target.value })} aria-invalid={!!errors.distance} aria-describedby={describedBy('distance-err', errors.distance)} className={invalid(errors.distance)} />
        <FieldError id="distance-err" message={errors.distance} />
      </div>

      <details className="rounded-2xl border p-3 text-sm">
        <summary className="cursor-pointer font-medium">{t('adv.summary')}</summary>
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="pace-factor">{t('adv.paceGain')}</Label>
            <Input id="pace-factor" type="number" inputMode="decimal" min="0" max="5" step="0.1" value={adv.paceFactor} onChange={(e) => onAdv({ paceFactor: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="bmi-floor">{t('adv.bmiFloor')}</Label>
            <Input id="bmi-floor" aria-describedby="bmi-hint" type="number" inputMode="decimal" min="18.5" max="30" step="0.5" value={adv.bmiFloor} onChange={(e) => onAdv({ bmiFloor: e.target.value })} />
            <p id="bmi-hint" className="text-xs text-muted-foreground mt-1">{t('adv.bmiHint')}</p>
          </div>
          <FieldError id="adv-err" message={errors.advanced} />
        </div>
      </details>

      <Button type="button" variant="outline" className={cn('w-full rounded-full')} onClick={onShare} disabled={!form.height && !form.weight}>
        <Link2 className="w-4 h-4 mr-2" aria-hidden /> {copied ? t('share.copied') : t('share.copy')}
      </Button>
      <p role="status" className="sr-only">{copied ? t('share.copied') : ''}</p>
    </section>
  );
}
