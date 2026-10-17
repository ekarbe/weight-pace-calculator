import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect } from './fixtures';

/** WCAG 2.1 A and AA plus axe's best practices. */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

export interface AxeOptions {
  /** Elements left out of the scan: only for defects that are already reported (say why at the call site). */
  exclude?: string[];
  /** Restrict the scan to these elements. */
  include?: string[];
  /** Rules switched off for this scan. */
  disableRules?: string[];
  /** Run only these rules (still within the WCAG tag set). */
  rules?: string[];
  /** Shown in the failure message, e.g. the theme the scan ran in. */
  label?: string;
}

/**
 * The page background is a soft radial gradient (`.mesh-background`). axe cannot work out the colour behind text that
 * sits over a gradient, so it reports almost all of it as "incomplete" instead of checking it. Hiding the gradient for
 * the duration of a scan makes the contrast check real; the gradient is only a faint tint of the same background.
 */
const FLAT_BACKGROUND = '.mesh-background { display: none !important; }';

export async function axeViolations(page: Page, opts: AxeOptions = {}): Promise<string[]> {
  const flat = await page.addStyleTag({ content: FLAT_BACKGROUND });
  try {
    return await scan(page, opts);
  } finally {
    await flat.evaluate((el) => (el as Element).remove());
  }
}

async function scan(page: Page, opts: AxeOptions): Promise<string[]> {
  let builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
  for (const selector of opts.include ?? []) builder = builder.include(selector);
  for (const selector of opts.exclude ?? []) builder = builder.exclude(selector);
  if (opts.disableRules) builder = builder.disableRules(opts.disableRules);
  if (opts.rules) builder = builder.options({ runOnly: opts.rules });
  const { violations } = await builder.analyze();
  return violations.map((v) => `${v.id} [${v.impact}] ${v.help}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

export async function expectNoAxeViolations(page: Page, opts: AxeOptions = {}) {
  expect(await axeViolations(page, opts), opts.label ? `axe violations (${opts.label})` : 'axe violations').toEqual([]);
}

/**
 * Rules that do not make sense while a Radix popup is open: Radix marks the rest of the page aria-hidden (modal
 * behaviour), which leaves the page without landmarks, a heading and with a hidden skip link by design.
 */
export const MODAL_POPUP_RULES = ['region', 'page-has-heading-one', 'aria-hidden-focus'];
