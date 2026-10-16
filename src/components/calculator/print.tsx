'use client';

import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WeightScaleIcon } from '@/components/icons/weight-scale-icon';
import { useI18n } from '@/i18n/provider';
import { parseISODate } from '@/lib/plan';
import type { AdvancedState } from '@/lib/form';
import { appUrl, createDetailsExpander, printFacts } from '@/lib/print';
import type { FormState } from '@/lib/share';
import { unitLabels } from '@/lib/units';

export function PrintButton() {
  const { t } = useI18n();
  return (
    <div className="flex justify-end print:hidden">
      <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => window.print()}>
        <Printer className="h-4 w-4" aria-hidden /> {t('print.button')}
      </Button>
    </div>
  );
}

/** Print-only title and "Your stats" summary (the form itself is not printed). Hidden on screen. */
export function PrintInputs({ form, adv, startKg, targetKg }: { form: FormState; adv: AdvancedState; startKg: number; targetKg: number }) {
  const { t, locale, date } = useI18n();
  const today = useMemo(() => new Date(), []);
  const facts = useMemo(() => printFacts(form, adv, { startKg, targetKg }, today), [form, adv, startKg, targetKg, today]);
  const labels = unitLabels(facts.units);
  const dist = facts.units === 'metric' ? 'km' : 'mi';
  const fmt = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
  const target = facts.target.lost > 0
    ? t('print.targetValue', { weight: fmt(Math.round(facts.target.weight * 10) / 10), unit: labels.weight, lost: fmt(Math.round(facts.target.lost * 10) / 10) })
    : t('print.targetSame', { weight: fmt(Math.round(facts.target.weight * 10) / 10), unit: labels.weight });
  const targetDate = facts.targetDate ? parseISODate(facts.targetDate) : null;

  const rows = ([
    [t('units.group'), t(facts.units === 'metric' ? 'units.metric' : 'units.imperial')],
    facts.sex && [t('sex.label'), t(facts.sex === 'male' ? 'sex.male' : 'sex.female')],
    facts.height !== null && [t('height.label', { unit: labels.height }), fmt(facts.height)],
    facts.weight !== null && [t('weight.label', { unit: labels.weight }), fmt(facts.weight)],
    facts.bodyFat !== null && [t('bodyFat.label'), fmt(facts.bodyFat)],
    facts.pace !== null && [t('pace.label', { unit: labels.pace }), facts.pace],
    facts.distance !== null && [t('distance.label', { unit: dist }), fmt(facts.distance)],
    [t('target.heading'), target],
    targetDate && [t('print.targetDate'), date(targetDate)],
    facts.paceGain !== null && [t('adv.paceGain'), fmt(facts.paceGain)],
    facts.bmiFloor !== null && [t('adv.bmiFloor'), fmt(facts.bmiFloor)],
  ] as const).filter((r): r is Exclude<typeof r, false | null> => !!r);

  return (
    <section aria-labelledby="print-stats-h" className="hidden print:block">
      <div className="flex items-center gap-2 text-foreground">
        <WeightScaleIcon className="h-7 w-7 text-primary-ink" aria-hidden="true" />
        <span className="text-xl font-extrabold tracking-tight">{t('header.title')}</span>
      </div>
      <p className="mt-1 text-sm">{t('meta.description')}</p>
      <h2 id="print-stats-h" className="mt-4 text-sm! font-bold uppercase tracking-widest text-muted-foreground">{t('inputs.heading')}</h2>
      <dl className="mt-2 grid grid-cols-4 gap-x-4 gap-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Print-only footer (app address without the query, date, health note), always mounted so that it also
 * owns the print lifecycle: expand every closed <details> before printing and put them back afterwards.
 */
export function PrintFooter() {
  const { t, date } = useI18n();
  const [stamp, setStamp] = useState<{ when: Date; url: string } | null>(null);

  useEffect(() => {
    const expander = createDetailsExpander();
    const before = () => {
      expander.open(document.querySelectorAll('details'));
      // The page is laid out for printing as soon as this returns, so the date must already be in the DOM.
      flushSync(() => setStamp({ when: new Date(), url: appUrl(window.location.href) }));
    };
    const after = () => expander.restore();
    // Safari and some embedded browsers only report printing through the media query.
    const mq = window.matchMedia('print');
    const onMedia = (e: MediaQueryListEvent) => (e.matches ? before() : after());

    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    if (mq.addEventListener) mq.addEventListener('change', onMedia);
    else mq.addListener(onMedia);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      if (mq.removeEventListener) mq.removeEventListener('change', onMedia);
      else mq.removeListener(onMedia);
      expander.restore();
    };
  }, []);

  return (
    <footer className="print-footer hidden print:block">
      {stamp && (
        <p className="text-[11px] font-semibold text-foreground">
          {t('print.printedOn', { date: date(stamp.when) })} · {stamp.url}
        </p>
      )}
      <p className="mt-1 text-[11px]">{t('health.note')}</p>
    </footer>
  );
}
