'use client';

import { Info, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { FormState } from '@/lib/share';
import type { AdvancedState, FieldErrors } from '@/lib/form';
import { unitLabels, type UnitSystem } from '@/lib/units';

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

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} role="alert" className="text-destructive text-xs mt-1">{message}</p> : null;
}

export function InputPanel({ form, adv, errors, copied, onChange, onUnits, onAdv, onShare }: Props) {
  const labels = unitLabels(form.units);
  const metric = form.units === 'metric';
  const invalid = (e?: string) => (e ? 'border-destructive' : '');

  return (
    <section aria-labelledby="inputs-heading" className="space-y-5">
      <h2 id="inputs-heading" className="text-2xl! font-extrabold uppercase tracking-tight">Your stats</h2>

      <div role="group" aria-label="Units" className="grid grid-cols-2 gap-1 rounded-full border p-1">
        {(['metric', 'imperial'] as const).map((u) => (
          <Button key={u} type="button" size="sm" className="rounded-full" variant={form.units === u ? 'default' : 'ghost'} aria-pressed={form.units === u} onClick={() => onUnits(u)}>
            {u === 'metric' ? 'kg · cm · km' : 'lb · in · mi'}
          </Button>
        ))}
      </div>

      <div>
        <Label htmlFor="gender">Biological sex</Label>
        <Select value={form.gender} onValueChange={(v) => onChange({ gender: v as FormState['gender'] })}>
          <SelectTrigger id="gender"><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">Only used for pace limits and body-fat warnings.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="height">Height ({labels.height})</Label>
          <Input id="height" type="number" inputMode="decimal" min="0" step="0.1" placeholder={metric ? '180' : '71'} value={form.height}
            onChange={(e) => onChange({ height: e.target.value })} aria-invalid={!!errors.height} aria-describedby="height-err" className={invalid(errors.height)} />
          <FieldError id="height-err" message={errors.height} />
        </div>
        <div>
          <Label htmlFor="weight">Weight ({labels.weight})</Label>
          <Input id="weight" type="number" inputMode="decimal" min="0" step="0.1" placeholder={metric ? '75.5' : '166'} value={form.weight}
            onChange={(e) => onChange({ weight: e.target.value })} aria-invalid={!!errors.weight} aria-describedby="weight-err" className={invalid(errors.weight)} />
          <FieldError id="weight-err" message={errors.weight} />
        </div>
      </div>

      <div>
        <Label htmlFor="bfp">Body fat % <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input id="bfp" type="number" inputMode="decimal" step="0.1" placeholder="15" value={form.bodyFat}
          onChange={(e) => onChange({ bodyFat: e.target.value })} aria-invalid={!!errors.bodyFat} aria-describedby="bfp-err" className={invalid(errors.bodyFat)} />
        <FieldError id="bfp-err" message={errors.bodyFat} />
      </div>

      <div>
        <div className="flex items-center gap-1">
          <Label htmlFor="pace-min">Threshold pace ({labels.pace})</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="What is threshold pace?" className="text-muted-foreground"><Info className="w-4 h-4" /></button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs"><p>The pace you could hold for about an hour in a race.</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <Input id="pace-min" type="number" inputMode="numeric" min="0" placeholder="min" value={form.paceMin}
            onChange={(e) => onChange({ paceMin: e.target.value })} aria-label="Threshold pace minutes" aria-invalid={!!errors.pace} aria-describedby="pace-err" className={invalid(errors.pace)} />
          <span aria-hidden>:</span>
          <Input id="pace-sec" type="number" inputMode="numeric" min="0" max="59" placeholder="sec" value={form.paceSec}
            onChange={(e) => onChange({ paceSec: e.target.value })} aria-label="Threshold pace seconds" aria-invalid={!!errors.pace} aria-describedby="pace-err" className={invalid(errors.pace)} />
        </div>
        <FieldError id="pace-err" message={errors.pace} />
      </div>

      <details className="rounded-2xl border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Advanced assumptions</summary>
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="pace-factor">Pace gain (s/km per kg lost)</Label>
            <Input id="pace-factor" type="number" inputMode="decimal" min="0" max="5" step="0.1" value={adv.paceFactor} onChange={(e) => onAdv({ paceFactor: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="bmi-floor">Lowest BMI to show</Label>
            <Input id="bmi-floor" type="number" inputMode="decimal" min="18.5" max="30" step="0.5" value={adv.bmiFloor} onChange={(e) => onAdv({ bmiFloor: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Never below 18.5, the underweight threshold.</p>
          </div>
          <FieldError id="adv-err" message={errors.advanced} />
        </div>
      </details>

      <Button type="button" variant="outline" className={cn('w-full rounded-full')} onClick={onShare} disabled={!form.height && !form.weight}>
        <Link2 className="w-4 h-4 mr-2" /> {copied ? 'Link copied!' : 'Copy share link'}
      </Button>
    </section>
  );
}
