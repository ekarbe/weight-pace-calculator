'use client';

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Download, ImageDown, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { appUrl, buildShareContent, IMAGE_FILE_NAME, IMAGE_HEIGHT, IMAGE_SCALE, IMAGE_WIDTH, layoutShareImage, shareBlockReason, type ShareBuild } from '@/lib/share-image';
import type { ResultRow } from '@/lib/calculations';
import type { UnitSystem } from '@/lib/units';
import { useI18n } from '@/i18n/provider';
import { makeMeasure, paintShareImage, resolveFontFamily } from './share-image-paint';

interface Props {
  rows: ResultRow[];
  index: number;
  units: UnitSystem;
  /** Weight as typed, shown exactly when the user opts in to weights. */
  enteredWeight: string;
  customKm: number | null;
  customLabel: string;
  /** True while the Training context card shows no estimate for this scenario, or a lowered one: no picture may be made of it. */
  trainingBlocked?: boolean;
  /** With `trainingBlocked`: the card lowers the estimate (rather than showing none), which changes what the notice says. */
  trainingReduced?: boolean;
}

type Status = { kind: 'saved' | 'failed' | 'shareFailed'; for: ShareBuild | null };

const noSubscribe = () => () => {};
const pageUrl = () => appUrl(window.location);
const canShareFiles = () => {
  try {
    const probe = new File([new Blob()], IMAGE_FILE_NAME, { type: 'image/png' });
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
};

async function paint(canvas: HTMLCanvasElement, built: ShareBuild) {
  const family = await resolveFontFamily();
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  paintShareImage(ctx, layoutShareImage(built.content, makeMeasure(ctx, family)), family);
}

export function ShareImageCard({ rows, index, units, enteredWeight, customKm, customLabel, trainingBlocked = false, trainingReduced = false }: Props) {
  const i18n = useI18n();
  const { t } = i18n;
  const id = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const working = useRef(false);
  // Opt-in is per visit on purpose: not stored, not in the share link.
  const [includeWeights, setIncludeWeights] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const url = useSyncExternalStore(noSubscribe, pageUrl, () => '');
  const canShare = useSyncExternalStore(noSubscribe, canShareFiles, () => false);

  const base = rows[0];
  const sel = rows[index];
  const flagged = sel ? shareBlockReason(sel) !== null : false;
  const blocked = flagged || trainingBlocked;
  const built = useMemo(
    () => (base && sel ? buildShareContent({ base, sel, units, customKm, customLabel, includeWeights, enteredWeight, url, i18n, trainingBlocked }) : null),
    [base, sel, units, customKm, customLabel, includeWeights, enteredWeight, url, i18n, trainingBlocked],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !built) return;
    let cancelled = false;
    void resolveFontFamily().then(() => {
      if (!cancelled) void paint(canvas, built);
    });
    return () => {
      cancelled = true;
    };
  }, [built]);

  /** Paints the current state and returns it as a PNG. */
  const render = async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas || !built) return null;
    await paint(canvas, built);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  };

  const run = async (action: (blob: Blob, b: ShareBuild) => Promise<Status['kind'] | null>) => {
    if (working.current || !built) return;
    working.current = true;
    setStatus(null);
    try {
      const blob = await render();
      const kind = blob ? await action(blob, built) : 'failed';
      if (kind) setStatus({ kind, for: built });
    } finally {
      working.current = false;
    }
  };

  const save = () =>
    run(async (blob) => {
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = IMAGE_FILE_NAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      return 'saved';
    });

  const share = () =>
    run(async (blob, b) => {
      const file = new File([blob], IMAGE_FILE_NAME, { type: 'image/png' });
      try {
        if (!navigator.canShare?.({ files: [file] })) return 'shareFailed';
        await navigator.share({ files: [file], title: b.content.title });
        return null;
      } catch (e) {
        return e instanceof DOMException && e.name === 'AbortError' ? null : 'shareFailed';
      }
    });

  const headingId = `${id}-h`;
  const weightsId = `${id}-weights`;
  const hintId = `${id}-hint`;
  const blockedId = `${id}-blocked`;
  const shown = status && status.for === built ? status.kind : null;

  return (
    <section aria-labelledby={headingId} className="rounded-3xl border bg-card glassmorphism p-5 sm:p-6 print:hidden">
      <h2 id={headingId} className="flex items-center gap-2 text-sm! font-bold uppercase tracking-widest text-muted-foreground">
        <ImageDown className="h-4 w-4" aria-hidden /> {t('shareImage.heading')}
      </h2>
      <p className="mt-2 text-sm">{t('shareImage.intro')}</p>

      <div className="mt-4 flex items-start gap-3">
        <input
          id={weightsId}
          type="checkbox"
          checked={includeWeights}
          onChange={(e) => setIncludeWeights(e.target.checked)}
          aria-describedby={hintId}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary-ink"
        />
        <div>
          <Label htmlFor={weightsId} className="cursor-pointer leading-snug">{t('shareImage.weights.label')}</Label>
          <p id={hintId} className="mt-1 text-xs">{t('shareImage.weights.hint')}</p>
        </div>
      </div>

      {built ? (
        <canvas
          ref={canvasRef}
          width={IMAGE_WIDTH * IMAGE_SCALE}
          height={IMAGE_HEIGHT * IMAGE_SCALE}
          role="img"
          aria-label={built.alt}
          className="mt-4 block h-auto w-full rounded-2xl border bg-muted"
        />
      ) : blocked ? (
        <p id={blockedId} className="mt-4 rounded-2xl border-2 border-dashed p-4 text-sm">{flagged ? t('shareImage.blocked') : t(trainingReduced ? 'training.output.shareLowered' : 'training.output.shareBlocked')}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" onClick={save} disabled={!built} aria-describedby={blocked ? blockedId : undefined}>
          <Download aria-hidden /> {t('shareImage.save')}
        </Button>
        {canShare && (
          <Button type="button" variant="outline" onClick={share} disabled={!built} aria-describedby={blocked ? blockedId : undefined}>
            <Share2 aria-hidden /> {t('shareImage.share')}
          </Button>
        )}
      </div>
      <p role="status" className="mt-3 min-h-5 text-sm font-medium text-foreground">
        {shown === 'saved' ? t('shareImage.saved') : shown === 'failed' ? t('shareImage.failed') : shown === 'shareFailed' ? t('shareImage.shareFailed') : ''}
      </p>
    </section>
  );
}
