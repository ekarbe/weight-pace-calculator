import type { Measure, Prim, ShareImageModel } from '@/lib/share-image';

const FALLBACK_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const WEIGHTS = [500, 600, 800, 900];

let fontFamily: Promise<string> | null = null;

/** The page's own font stack (read from <body> once fonts have loaded) plus a safe fallback. */
export function resolveFontFamily(): Promise<string> {
  fontFamily ??= (async () => {
    try {
      await document.fonts.ready;
    } catch {
      /* no FontFaceSet: fall through to whatever the browser has */
    }
    const computed = getComputedStyle(document.body).fontFamily.trim();
    const family = computed ? `${computed}, ${FALLBACK_STACK}` : FALLBACK_STACK;
    try {
      await Promise.all(WEIGHTS.map((w) => document.fonts.load(`${w} 32px ${family}`, 'Aa0:−')));
    } catch {
      /* an unloadable face just means the fallback is used */
    }
    return family;
  })();
  return fontFamily;
}

const font = (weight: number, size: number, family: string) => `${weight} ${size}px ${family}`;

export function makeMeasure(ctx: CanvasRenderingContext2D, family: string): Measure {
  return (text, weight, size) => {
    ctx.font = font(weight, size, family);
    return ctx.measureText(text).width;
  };
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function paintPrim(ctx: CanvasRenderingContext2D, p: Prim, family: string) {
  switch (p.kind) {
    case 'rect':
      if (p.radius) roundedRect(ctx, p.x, p.y, p.w, p.h, p.radius);
      else {
        ctx.beginPath();
        ctx.rect(p.x, p.y, p.w, p.h);
      }
      if (p.fill) {
        ctx.fillStyle = p.fill;
        ctx.fill();
      }
      if (p.stroke) {
        ctx.lineWidth = p.strokeWidth ?? 1;
        ctx.strokeStyle = p.stroke;
        ctx.stroke();
      }
      break;
    case 'circle':
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
      if (p.fill) {
        ctx.fillStyle = p.fill;
        ctx.fill();
      }
      if (p.stroke) {
        ctx.lineWidth = p.strokeWidth ?? 1;
        ctx.strokeStyle = p.stroke;
        ctx.stroke();
      }
      break;
    case 'line':
      ctx.beginPath();
      p.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.lineWidth = p.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = p.color;
      ctx.stroke();
      break;
    case 'text':
      ctx.font = font(p.weight, p.size, family);
      ctx.textAlign = p.align;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      break;
  }
}

/** Paints the model onto a canvas that is width*scale by height*scale pixels. */
export function paintShareImage(ctx: CanvasRenderingContext2D, model: ShareImageModel, family: string) {
  ctx.save();
  ctx.setTransform(model.scale, 0, 0, model.scale, 0, 0);
  ctx.clearRect(0, 0, model.width, model.height);
  for (const p of model.prims) paintPrim(ctx, p, family);
  ctx.restore();
}
