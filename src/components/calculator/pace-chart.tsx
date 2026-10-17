'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { cn, formatPace, formatTime } from '@/lib/utils';
import type { ResultRow } from '@/lib/calculations';
import { estimateRaceTimeSec } from '@/lib/calculations';
import { BAND_DEFAULT_FACTOR, BAND_LINEAR_LIMIT_KG, bandValue, type Band, type BandPoint } from '@/lib/band';
import { kgToLb, secPerKmToSecPerMile, unitLabels, type UnitSystem } from '@/lib/units';
import { useI18n } from '@/i18n/provider';

type Metric = 'pace' | '5K' | '10K' | 'HM' | 'M' | 'custom';

interface Props {
  rows: ResultRow[];
  index: number;
  onIndex: (i: number) => void;
  units: UnitSystem;
  customKm: number | null;
  customLabel: string;
  band: Band | null;
}

const W = 640;
const H = 260;
const PAD = { l: 56, r: 16, t: 16, b: 32 };

export function PaceChart({ rows, index, onIndex, units, customKm, customLabel, band }: Props) {
  const { t, num, speak } = useI18n();
  const [metric, setMetric] = useState<Metric>('10K');
  const [showRange, setShowRange] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const labels = unitLabels(units);
  const tabsId = useId();

  const active: Metric = metric === 'custom' && customKm === null ? '10K' : metric;
  const options: { key: Metric; label: string }[] = [
    { key: 'pace', label: t('chart.pace') },
    { key: '5K', label: t('table.5k') },
    { key: '10K', label: t('table.10k') },
    { key: 'HM', label: t('chart.half') },
    { key: 'M', label: t('chart.marathon') },
    ...(customKm !== null ? [{ key: 'custom' as const, label: customLabel }] : []),
  ];

  const value = (r: ResultRow): number => {
    const pace = r.estimatedThresholdPaceSec ?? 0;
    switch (active) {
      case 'pace': return units === 'metric' ? pace : secPerKmToSecPerMile(pace);
      case '5K': return r.estimated5kTimeSec ?? 0;
      case '10K': return r.estimated10kTimeSec ?? 0;
      case 'HM': return r.estimatedHmTimeSec ?? 0;
      case 'M': return r.estimatedMTimeSec ?? 0;
      case 'custom': return estimateRaceTimeSec(pace, customKm ?? 10);
    }
  };
  const fmt = (v: number) => (active === 'pace' ? formatPace(v) : formatTime(v));

  // No range to draw, switch or announce when the band has no width anywhere (e.g. the entered weight is below the BMI floor).
  const bandUsable = band !== null && band.rows.length === rows.length && band.rows.some((r) => r.conservative.paceSec !== r.optimistic.paceSec);
  const bandOn = showRange && bandUsable;
  const edge = (p: BandPoint) => {
    const v = bandValue(p, active, customKm);
    return active === 'pace' && units !== 'metric' ? secPerKmToSecPerMile(v) : v;
  };

  const geo = useMemo(() => {
    const vals = rows.map(value);
    const slow = bandOn ? band.rows.map((r) => edge(r.conservative)) : null;
    const fast = bandOn ? band.rows.map((r) => edge(r.optimistic)) : null;
    const min = Math.min(...vals, ...(fast ?? []));
    const max = Math.max(...vals, ...(slow ?? []));
    const span = max - min || 1;
    const lo = min - span * 0.08;
    const hi = max + span * 0.08;
    const x = (i: number) => PAD.l + (rows.length === 1 ? 0 : (i / (rows.length - 1)) * (W - PAD.l - PAD.r));
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const ticks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3);
    return { vals, slow, fast, x, y, ticks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, active, units, customKm, band, bandOn]);

  const path = geo.vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${geo.x(i).toFixed(1)},${geo.y(v).toFixed(1)}`).join(' ');
  const pts = (vs: number[]) => vs.map((v, i) => `${geo.x(i).toFixed(1)},${geo.y(v).toFixed(1)}`);
  const slowPts = geo.slow ? pts(geo.slow) : [];
  const fastPts = geo.fast ? pts(geo.fast) : [];
  const dispW = (kg: number) => num(units === 'metric' ? kg : kgToLb(kg), 0);

  const scrub = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const t = (px - PAD.l) / (W - PAD.l - PAD.r);
    onIndex(Math.min(rows.length - 1, Math.max(0, Math.round(t * (rows.length - 1)))));
  };

  const sel = rows[index];
  const selX = geo.x(index);
  const selY = geo.y(geo.vals[index]);
  const selTop = geo.slow ? geo.y(geo.slow[index]) : selY;
  const xTicks = [0, Math.round((rows.length - 1) / 2), rows.length - 1];

  return (
    <section aria-labelledby={`${tabsId}-h`} className="rounded-3xl border bg-card glassmorphism p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${tabsId}-h`} className="text-sm! font-bold uppercase tracking-widest text-muted-foreground">
          {active === 'pace' ? t('chart.heading.pace', { unit: labels.pace }) : t('chart.heading.time')}
        </h2>
        <div role="group" aria-label={t('chart.group')} className="flex flex-wrap gap-1">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={active === o.key}
              onClick={() => setMetric(o.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                active === o.key ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {band && bandUsable && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
          <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" role="switch" checked={showRange} onChange={(e) => setShowRange(e.target.checked)} className="h-4 w-4 cursor-pointer accent-primary" />
            {t('band.show')}
          </label>
          {bandOn && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <svg aria-hidden width="28" height="10" className="shrink-0"><line x1="1" x2="27" y1="5" y2="5" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" /></svg>
                {t('band.legend.estimate', { factor: band.factor })}
              </li>
              <li className="flex items-center gap-2">
                <svg aria-hidden width="28" height="12" className="shrink-0">
                  <rect x="1" y="1" width="26" height="10" fill="var(--primary)" fillOpacity="0.2" />
                  <line x1="1" x2="27" y1="1" y2="1" stroke="var(--primary-ink)" strokeWidth="1.5" strokeDasharray="5 3" />
                  <line x1="1" x2="27" y1="11" y2="11" stroke="var(--primary-ink)" strokeWidth="1.5" strokeDasharray="5 3" />
                </svg>
                {t('band.legend.range', { low: band.lowFactor, high: band.highFactor })}
              </li>
            </ul>
          )}
        </div>
      )}

      {/* Pointer scrubbing is a convenience; the slider above is the keyboard/AT control. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('chart.aria', {
          metric: t(active === 'pace' ? 'chart.metric.pace' : 'chart.metric.time'),
          weight: dispW(sel.targetWeightKg), unit: labels.weight, value: speak(geo.vals[index]),
          from: speak(geo.vals[0]), w1: dispW(rows[0].targetWeightKg), to: speak(geo.vals[rows.length - 1]), w2: dispW(rows[rows.length - 1].targetWeightKg),
        }) + (geo.slow && geo.fast ? ` ${t('band.chart.aria', { weight: dispW(sel.targetWeightKg), unit: labels.weight, fast: speak(geo.fast[index]), slow: speak(geo.slow[index]) })}` : '')}
        className="mt-4 w-full select-none"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrub(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons > 0 || e.pointerType === 'mouse') scrub(e.clientX); }}
      >
        {geo.ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(t)} y2={geo.y(t)} stroke="currentColor" strokeOpacity="0.12" />
            <text x={PAD.l - 8} y={geo.y(t) + 4} textAnchor="end" fontSize="11" className="fill-muted-foreground tabular-nums">{fmt(t)}</text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text key={i} x={geo.x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'} fontSize="11" className="fill-muted-foreground tabular-nums">
            {dispW(rows[i].targetWeightKg)} {labels.weight}
          </text>
        ))}
        {bandOn && (
          <>
            <path d={`M${[...slowPts, ...fastPts.slice().reverse()].join(' L')}Z`} fill="var(--primary)" fillOpacity="0.2" />
            <path d={`M${slowPts.join(' L')}`} fill="none" stroke="var(--primary-ink)" strokeWidth="1.5" strokeDasharray="6 4" strokeLinejoin="round" />
            <path d={`M${fastPts.join(' L')}`} fill="none" stroke="var(--primary-ink)" strokeWidth="1.5" strokeDasharray="6 4" strokeLinejoin="round" />
          </>
        )}
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <line x1={selX} x2={selX} y1={PAD.t} y2={H - PAD.b} stroke="var(--primary)" strokeOpacity="0.4" strokeDasharray="4 4" />
        {geo.slow && geo.fast && [geo.slow[index], geo.fast[index]].map((v, k) => (
          <circle key={k} cx={selX} cy={geo.y(v)} r="4" fill="var(--background)" stroke="var(--primary-ink)" strokeWidth="2" />
        ))}
        <circle cx={selX} cy={selY} r="7" fill="var(--background)" stroke="var(--primary)" strokeWidth="3" />
        <text
          x={Math.min(Math.max(selX, PAD.l + 28), W - PAD.r - 28)}
          y={Math.max(selTop - 14, PAD.t + 10)}
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          stroke="var(--background)"
          strokeWidth="4"
          strokeLinejoin="round"
          paintOrder="stroke"
          className="fill-foreground tabular-nums"
        >
          {fmt(geo.vals[index])}
        </text>
      </svg>
      {band && <p className="mt-3 text-xs">{t('band.disclaimer', { low: band.lowFactor, high: band.highFactor, default: BAND_DEFAULT_FACTOR, limit: dispW(BAND_LINEAR_LIMIT_KG), unit: labels.weight })}</p>}
    </section>
  );
}
