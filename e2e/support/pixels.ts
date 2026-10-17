import type { Page } from '@playwright/test';

export type RGB = [number, number, number];

/**
 * Reads the colour of real, rendered pixels. Computed styles cannot tell what a translucent or blurred surface looks like
 * on screen, nor how a focus ring or a 1px border actually comes out, so contrast checks that must be true of the picture
 * sample the picture: a screenshot of the viewport is decoded in the page (no image library needed) and the points are
 * given in CSS pixels. Scroll the elements into view first; points outside the viewport throw.
 */
export async function samplePixels(page: Page, points: { x: number; y: number }[]): Promise<RGB[]> {
  const png = (await page.screenshot({ type: 'png' })).toString('base64');
  return page.evaluate(
    async ({ png, points }) => {
      const blob = await (await fetch(`data:image/png;base64,${png}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const scale = bitmap.width / window.innerWidth;
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(bitmap, 0, 0);
      return points.map(({ x, y }) => {
        const px = Math.floor(x * scale);
        const py = Math.floor(y * scale);
        if (px < 0 || py < 0 || px >= bitmap.width || py >= bitmap.height) throw new Error(`pixel (${x}, ${y}) is outside the viewport`);
        const [r, g, b] = context.getImageData(px, py, 1, 1).data;
        return [r, g, b] as [number, number, number];
      });
    },
    { png, points },
  );
}

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG contrast ratio of two opaque colours. */
export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The best contrast any of `candidates` has against `against`: for an edge that may fall on either of two pixel columns. */
export const bestContrast = (candidates: RGB[], against: RGB) => Math.max(...candidates.map((c) => contrast(c, against)));
