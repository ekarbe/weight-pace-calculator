import { AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResultRow } from '@/lib/calculations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { kgToLb, secPerKmToSecPerMile, unitLabels, type UnitSystem } from '@/lib/units';
import { formatPace } from '@/lib/utils';

export function ResultsTable({ rows, warnings, units, enteredWeight, selected }: { rows: ResultRow[]; warnings: string[]; units: UnitSystem; enteredWeight: string; selected: number }) {
  const labels = unitLabels(units);
  const w = (kg: number, i: number) => (i === 0 && enteredWeight ? parseFloat(enteredWeight) : units === 'metric' ? kg : kgToLb(kg)).toFixed(1);
  const p = (s: number | null) => (s === null ? 'N/A' : formatPace(units === 'metric' ? s : secPerKmToSecPerMile(s)));
  return (
    <div className="space-y-3">
      <details className="rounded-2xl border bg-card glassmorphism p-4">
        <summary className="cursor-pointer font-semibold">Full table ({rows.length} weights)</summary>
        <div className="mt-3 max-h-[28rem] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="text-center">Weight ({labels.weight})</TableHead>
                <TableHead className="text-center">BF %</TableHead>
                <TableHead className="text-center">Pace ({labels.pace})</TableHead>
                <TableHead className="text-center">5K</TableHead>
                <TableHead className="text-center">10K</TableHead>
                <TableHead className="text-center">HM</TableHead>
                <TableHead className="text-center">Marathon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i} className={cn('tabular-nums', i === selected && 'bg-primary/10', r.isPotentiallyUnhealthyFat && 'text-destructive')}>
                  <TableCell className="text-center font-medium">{w(r.targetWeightKg, i)}</TableCell>
                  <TableCell className="text-center">
                    {r.estimatedBodyFatPercentage !== null ? r.estimatedBodyFatPercentage.toFixed(1) : '–'}
                    {r.isPotentiallyUnhealthyFat && <AlertCircle aria-label="Below healthy body fat" className="ml-1 inline h-3 w-3" />}
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
        <p className="mt-2 text-xs">* pace capped at the model’s limit.</p>
      </details>

      {warnings.length > 0 && (
        <details className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" /> Notes & disclaimers ({warnings.length})
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-800 dark:text-amber-300">
            {warnings.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
