'use client';

import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/ui/header';
import { Footer } from '@/components/ui/footer';
import { InputPanel } from '@/components/calculator/input-panel';
import { RaceCards } from '@/components/calculator/race-cards';
import { ShareImageCard } from '@/components/calculator/share-image-card';
import { PaceChart } from '@/components/calculator/pace-chart';
import { PlanCard } from '@/components/calculator/plan-card';
import { TrainingCard } from '@/components/calculator/training-card';
import { ResultsTable } from '@/components/calculator/results-table';
import { PrintButton, PrintFooter, PrintInputs } from '@/components/calculator/print';
import { calculateWeightPaceEstimates, DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM, DEFAULT_TARGET_BMI_FLOOR } from '@/lib/calculations';
import { calculateBand } from '@/lib/band';
import { useI18n } from '@/i18n/provider';
import type { MessageKey } from '@/i18n/messages/en';
import { buildInput, buildTraining, convertWeeklyDistance, type AdvancedState } from '@/lib/form';
import { convertRaceDistance } from '@/lib/race-result';
import { decodeForm, emptyForm, encodeForm, type FormState } from '@/lib/share';
import { computeTraining, trainingInputFor } from '@/lib/training';
import { KM_PER_MILE, cmToIn, inToCm, kgToLb, lbToKg, secPerKmToSecPerMile, secPerMileToSecPerKm, type UnitSystem } from '@/lib/units';

const round1 = (n: number) => String(Math.round(n * 10) / 10);
const convert = (v: string, fn: (n: number) => number) => {
  const n = parseFloat(v);
  return isNaN(n) ? v : round1(fn(n));
};

export default function HomePage() {
  const { t, locale, list, warning } = useI18n();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [adv, setAdv] = useState<AdvancedState>({
    paceFactor: String(DEFAULT_PACE_FACTOR_SEC_PER_KG_PER_KM),
    bmiFloor: String(DEFAULT_TARGET_BMI_FLOOR),
  });
  const [sliderIndex, setSliderIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const f = decodeForm(window.location.search);
    if (!f.height && !f.weight && !f.paceMin && !f.gender) return;
    // One-time hydration from the URL; can't use lazy initial state because the page is statically exported.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(f);
  }, []);

  const built = useMemo(() => buildInput(form, adv), [form, adv]);
  const training = useMemo(() => buildTraining(form), [form]);
  const results = useMemo(() => (built.input ? calculateWeightPaceEstimates(built.input) : null), [built.input]);
  const rows = useMemo(() => results?.resultsTable ?? [], [results]);
  const band = useMemo(() => (built.input ? calculateBand(built.input) : null), [built.input]);

  const defaultIndex = useMemo(() => {
    if (rows.length === 0) return 0;
    const target = rows[0].targetWeightKg * 0.95;
    let best = 0;
    rows.forEach((r, i) => {
      if (Math.abs(r.targetWeightKg - target) < Math.abs(rows[best].targetWeightKg - target)) best = i;
    });
    return best;
  }, [rows]);
  const index = Math.min(sliderIndex ?? defaultIndex, Math.max(rows.length - 1, 0));

  // One result for the whole page: the card shows it, the race cards point at it and the share image obeys it.
  const today = useMemo(() => new Date(), []);
  const trainingResult = useMemo(
    () => (built.input && rows[index] ? computeTraining(trainingInputFor(built.input, rows[index], rows[0].targetWeightKg, training, form.targetDate), today) : null),
    [built.input, rows, index, training, form.targetDate, today],
  );

  const change = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setSliderIndex(null);
  };

  const switchUnits = (next: UnitSystem) => {
    if (next === form.units) return;
    const toImp = next === 'imperial';
    setForm((f) => {
      const min = parseInt(f.paceMin, 10);
      const sec = parseInt(f.paceSec, 10);
      let paceMin = f.paceMin;
      let paceSec = f.paceSec;
      if (!isNaN(min) && !isNaN(sec)) {
        const total = min * 60 + sec;
        const conv = Math.round(toImp ? secPerKmToSecPerMile(total) : secPerMileToSecPerKm(total));
        paceMin = String(Math.floor(conv / 60));
        paceSec = String(conv % 60);
      }
      return {
        ...f,
        units: next,
        height: convert(f.height, toImp ? cmToIn : inToCm),
        weight: convert(f.weight, toImp ? kgToLb : lbToKg),
        paceMin,
        paceSec,
        distance: convert(f.distance, toImp ? (n) => n / KM_PER_MILE : (n) => n * KM_PER_MILE),
        raceCustom: convertRaceDistance(f.raceCustom, toImp),
        weeklyKm: convertWeeklyDistance(f.weeklyKm, toImp),
      };
    });
    setSliderIndex(null);
  };

  const share = async () => {
    const params = new URLSearchParams(encodeForm(form));
    params.set('lang', locale);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable; the address bar now holds the link */
    }
  };

  const customLabel = form.distance ? `${parseFloat(form.distance)} ${form.units === 'metric' ? 'km' : 'mi'}` : '';

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" tabIndex={-1} className="container mx-auto flex-grow px-4 py-8 sm:py-12">
        <div className="mb-8 max-w-3xl print:hidden">
          <h1 className="text-4xl! sm:text-6xl! font-black uppercase">{t('hero.title')}</h1>
          <p className="mt-3 text-base sm:text-lg">{t('hero.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[22rem_1fr] lg:items-start print:block">
          <div className="rounded-3xl border bg-card glassmorphism p-5 sm:p-6 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto print:hidden">
            <InputPanel form={form} adv={adv} errors={built.errors} copied={copied} onChange={change} onUnits={switchUnits} onAdv={(p) => setAdv((a) => ({ ...a, ...p }))} onShare={share} />
          </div>

          <div className="min-w-0 space-y-6">
            <p role="status" className="sr-only">{rows.length > 0 ? t('sr.ready') : ''}</p>
            {results && rows.length > 0 ? (
              <>
                <PrintInputs form={form} adv={adv} startKg={rows[0].targetWeightKg} targetKg={rows[index].targetWeightKg} />
                <RaceCards rows={rows} index={index} onIndex={setSliderIndex} units={form.units} enteredWeight={form.weight} customKm={built.customDistanceKm} customLabel={customLabel} band={band} trainingPointer={trainingResult?.pointer} />
                <ShareImageCard rows={rows} index={index} units={form.units} enteredWeight={form.weight} customKm={built.customDistanceKm} customLabel={customLabel} trainingBlocked={trainingResult?.blocksOutputs} trainingReduced={trainingResult?.reduced} />
                <PaceChart rows={rows} index={index} onIndex={setSliderIndex} units={form.units} customKm={built.customDistanceKm} customLabel={customLabel} band={band} />
                <PlanCard startKg={rows[0].targetWeightKg} targetKg={rows[index].targetWeightKg} units={form.units} targetDate={form.targetDate} onDate={(d) => setForm((f) => ({ ...f, targetDate: d }))} />
                {built.input && trainingResult && <TrainingCard result={trainingResult} input={built.input} units={form.units} weeklyKmText={form.weeklyKm} history={form.trainingHistory} fields={training} onChange={(p) => setForm((f) => ({ ...f, ...p }))} />}
                <ResultsTable rows={rows} warnings={results.warnings} units={form.units} enteredWeight={form.weight} selected={index} />
                <PrintButton />
              </>
            ) : (
              <div className="rounded-3xl border-2 border-dashed p-8 text-center">
                {results ? (
                  <>
                    <p className="font-semibold text-foreground">{t('empty.noResults')}</p>
                    <ul className="mt-2 space-y-1 text-sm">{results.warnings.slice(0, 3).map((w, i) => <li key={i}>{warning(w)}</li>)}</ul>
                  </>
                ) : (
                  <p>
                    {built.missing.length > 0
                      ? t('empty.missing', { fields: list(built.missing.map((m) => t(`missing.${m}` as MessageKey))) })
                      : t('empty.fix')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
      <PrintFooter />
    </div>
  );
}
