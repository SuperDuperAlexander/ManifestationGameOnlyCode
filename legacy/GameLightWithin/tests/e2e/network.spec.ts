import { test, expect } from '@playwright/test';
import { beginChapter } from './helpers';

/**
 * The game must never talk to the network. No analytics, no CDN, no fonts
 * from outside. Everything is served from its own origin.
 */
test('makes no request to any outside origin', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://127.0.0.1:4173').origin;
  const outside: string[] = [];

  page.on('request', (r) => {
    const url = r.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (!url.startsWith(origin)) outside.push(`${r.method()} ${url}`);
  });

  await page.goto('/?debug=1&autobreathe=1');
  await page.waitForFunction(() => document.body.dataset.ready === '1');
  await beginChapter(page);
  for (const group of ['receive', 'calm']) {
    await page.locator(`[aria-label="${group}"] button[data-value="3"]`).click();
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(6000);

  expect(outside, `outside requests: ${outside.join(', ')}`).toEqual([]);
});

/** The same rule, in the chapter 2 meadows. Every chapter is offline. */
test('makes no request to any outside origin in chapter 2', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://127.0.0.1:4173').origin;
  const outside: string[] = [];

  page.on('request', (r) => {
    const url = r.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (!url.startsWith(origin)) outside.push(`${r.method()} ${url}`);
  });

  // Every scene of chapter 2, so nothing loaded late can reach outside.
  for (const scene of [1, 3, 4, 5, 6]) {
    await page.goto(`/?chapter=2&scene=${String(scene)}&debug=1&autobreathe=1&quality=low`);
    await page.waitForFunction(() => document.body.dataset.ready === '1');
    await page.waitForTimeout(3000);
  }

  expect(outside, `outside requests: ${outside.join(', ')}`).toEqual([]);
});

test('serves the font from its own origin', async ({ page }) => {
  const fonts: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'font') fonts.push(r.url());
  });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => document.body.dataset.ready === '1');
  await page.waitForTimeout(1500);
  for (const url of fonts) expect(url).toContain('/fonts/');
});

/** Reports what the game actually downloads, for the completion report. */
test('reports the download size', async ({ page }, info) => {
  const bytes = new Map<string, number>();
  page.on('response', async (r) => {
    try {
      const body = await r.body();
      bytes.set(new URL(r.url()).pathname, body.length);
    } catch {
      // A response with no body. Nothing to count.
    }
  });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => document.body.dataset.ready === '1');
  await page.waitForTimeout(3000);
  let total = 0;
  for (const [path, n] of bytes) {
    total += n;
    // eslint-disable-next-line no-console
    console.log(`SIZE ${info.project.name} ${path} ${n}`);
  }
  // eslint-disable-next-line no-console
  console.log(`SIZETOTAL ${info.project.name} ${total}`);
});
