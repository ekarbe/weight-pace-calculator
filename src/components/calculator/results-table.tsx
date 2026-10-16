import { AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResultRow } from '@/lib/calculations';
import { useI18n } from '@/i18n/provider';
import type { Warning } from '@/lib/calculations';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { kgToLb, secPerKmToSecPerMile, unitLabels, type UnitSystem } from '@/lib/units';
import { formatPace } from '@/lib/utils';

export function ResultsTable({ rows, warnings, units, enteredWeight, selected }: { rows: ResultRow[]; warnings: Warning[]; units: UnitSystem; enteredWeight: string; selected: number }) {
  const { t, num, warning } = useI18n();
  const labels = unitLabels(units);
  const w = (kg: number, i: number) => num(i === 0 && enteredWeight ? parseFloat(enteredWeight) : units === 'metric' ? kg : kgToLb(kg), 1);
  const p = (s: number | null) => (s === null ? '–' : formatPace(units === 'metric' ? s : secPerKmToSecPerMile(s)));
  return (
    <div className="space-y-3">
      <details className="rounded-2xl border bg-card glassmorphism p-4">
        <summary className="cursor-pointer font-semibold">{t('table.summary', { n: rows.length })}</summary>
        <div className="mt-3 max-h-[28rem] overflow-auto" role="region" aria-label={t('table.summary', { n: rows.length })} tabIndex={0}>
          {/* The wrapper above is the single, keyboard-focusable scroll container (also makes the sticky header work). */}
          <Table containerClassName="overflow-visible">
            <TableCaption className="sr-only">{t('table.summary', { n: rows.length })}</TableCaption>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="text-center">{t('table.weight', { unit: labels.weight })}</TableHead>
                <TableHead className="text-center">{t('table.bf')}</TableHead>
                <TableHead className="text-center">{t('table.pace', { unit: labels.pace })}</TableHead>
                <TableHead className="text-center">{t('table.5k')}</TableHead>
                <TableHead className="text-center">{t('table.10k')}</TableHead>
                <TableHead className="text-center">{t('table.hm')}</TableHead>
                <TableHead className="text-center">{t('table.m')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i} aria-current={i === selected ? 'true' : undefined} className={cn('tabular-nums', i === selected && 'bg-primary/10', r.isPotentiallyUnhealthyFat && 'text-destructive')}>
                  <TableCell className="text-center font-medium">{w(r.targetWeightKg, i)}</TableCell>
                  <TableCell className="text-center">
                    {r.estimatedBodyFatPercentage !== null ? num(r.estimatedBodyFatPercentage, 1) : '–'}
                    {r.isPotentiallyUnhealthyFat && <AlertCircle aria-label={t('table.bfLow')} className="ml-1 inline h-3 w-3" />}
                  </TableCell>
                  <TableCell className="text-center">{p(r.estimatedThresholdPaceSec)}{r.paceLimited && ' *'}</TableCell>
                  <TableCell className="text-center">{r.estimated5kTimeFormatted}</TableCell>
                  <TableCell className="text-center">{r.estimated10kTimeFormatted}</TableCell>
                  <TableCell className="text-center">{r.estimatedHmTimeFormatted}</TableCell>
                  <TableCell className="text-center">{r.estimatedMTimeFormatted}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-xs">{t('table.capNote')}</p>
      </details>

      {warnings.length > 0 && (
        <details className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold text-amber-800 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" aria-hidden /> {t('notes.summary', { n: warnings.length })}
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-900 dark:text-amber-300">
            {warnings.map((m, i) => <li key={i}>{warning(m)}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
