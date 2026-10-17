import { test, expect } from './support/fixtures';
import { LOCALES, form, openApp, tr, waitForHydration } from './support/app';

test.describe('language selection', () => {
  test('?lang= wins, and the switcher changes the page, keeps the form, and is remembered', async ({ page }) => {
    await openApp(page, { lang: 'de' });
    await page.getByLabel(tr('de', 'lang.label')).selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle(tr('en', 'meta.title'));

    await form(page).weight.fill('64');
    await page.getByLabel('Language').selectOption('fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page).toHaveTitle(tr('fr', 'meta.title'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(tr('fr', 'hero.title'));
    await expect(page.getByLabel(/^Poids/)).toHaveValue('64');

    expect(await page.evaluate(() => localStorage.getItem('wpc-locale'))).toBe('fr');
    await page.goto('./');
    await waitForHydration(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    // An explicit ?lang= beats the remembered choice.
    await page.goto('./?lang=es');
    await waitForHydration(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('the switcher lists every language by its own name', async ({ page }) => {
    await openApp(page);
    await expect(page.getByLabel('Language').locator('option')).toHaveText(['English', 'Deutsch', 'Español', 'Français']);
    await expect(page.getByLabel('Language').locator('option[lang="de"]')).toHaveText('Deutsch');
  });

  test.describe('from the browser language', () => {
    test.use({ locale: 'de-DE' });
    test('a German browser gets German', async ({ page }) => {
      await page.goto('./');
      await waitForHydration(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(tr('de', 'hero.title'));
    });
  });

  test.describe('unsupported browser language', () => {
    test.use({ locale: 'ja-JP' });
    test('falls back to English', async ({ page }) => {
      await page.goto('./');
      await waitForHydration(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page).toHaveTitle(tr('en', 'meta.title'));
    });
  });
});

test.describe('theme', () => {
  test.describe('dark system preference', () => {
    test.use({ colorScheme: 'dark' });

    test('starts dark and the toggle cycles light and dark, remembered across a reload', async ({ page }) => {
      await openApp(page);
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
      await page.getByRole('button', { name: 'Toggle theme' }).click();
      await expect(html).toHaveClass(/light/);
      await page.reload();
      await waitForHydration(page);
      await expect(html).toHaveClass(/light/);
      await page.getByRole('button', { name: 'Toggle theme' }).click();
      await expect(html).toHaveClass(/dark/);
    });
  });

  test.describe('light system preference', () => {
    test('the toggle goes to dark and back', async ({ page }) => {
      await openApp(page);
      const html = page.locator('html');
      await expect(html).toHaveClass(/light/);
      await page.getByRole('button', { name: 'Toggle theme' }).click();
      await expect(html).toHaveClass(/dark/);
      await page.getByRole('button', { name: 'Toggle theme' }).click();
      await expect(html).toHaveClass(/light/);
    });

    // While the stored theme is still "system", the toggle leaves the theme that is on screen, whichever it is.
    test('the first click on the toggle switches to dark', async ({ page }) => {
      await openApp(page);
      await page.getByRole('button', { name: 'Toggle theme' }).click();
      await expect(page.locator('html')).toHaveClass(/dark/);
    });
  });
});

test.describe('document head', () => {
  for (const lang of LOCALES) {
    test(`${lang}: has a single description, in the page language, that follows the language switcher`, async ({ page }) => {
      await openApp(page, { lang });
      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveCount(1);
      await expect(description).toHaveAttribute('content', tr(lang, 'meta.description'));
      const other = LOCALES.find((l) => l !== lang)!;
      await page.getByLabel(tr(lang, 'lang.label')).selectOption(other);
      await expect(page.locator('html')).toHaveAttribute('lang', other);
      await expect(description).toHaveCount(1);
      await expect(description).toHaveAttribute('content', tr(other, 'meta.description'));
    });
  }
});

test.describe('static export', () => {
  test('is served under its base path only, like on GitHub Pages', async ({ request }) => {
    expect((await request.get('/')).status()).toBe(404);
    expect((await request.get('/index.html')).status()).toBe(404);
    expect((await request.get('/weight-pace-calculator-other/')).status()).toBe(404);
    const home = await request.get('./');
    expect(home.status()).toBe(200);
    expect(home.headers()['content-type']).toContain('text/html');
    expect((await request.get('./no-such-page/')).status()).toBe(404);
  });

  test('every script and stylesheet is addressed below the base path and loads', async ({ page, request }) => {
    await openApp(page);
    const urls = await page.evaluate(() =>
      [...document.querySelectorAll('script[src], link[rel="stylesheet"][href]')].map((el) => el.getAttribute('src') ?? el.getAttribute('href') ?? ''),
    );
    expect(urls.length).toBeGreaterThan(2);
    for (const u of urls.filter((x) => x.startsWith('/'))) {
      expect(u.startsWith('/weight-pace-calculator/'), u).toBe(true);
      expect((await request.get(u)).status(), u).toBe(200);
    }
  });
});
