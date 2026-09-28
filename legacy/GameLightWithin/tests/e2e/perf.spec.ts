import { test } from '@playwright/test';
import { beginChapter } from './helpers';

/**
 * Measures the real frame rate for each quality tier. It runs under software
 * rendering here, so the numbers are a floor, not what a real device gives.
 */
const CASES = [
  { name: 'high', url: '/?debug=1&quality=high' },
  { name: 'medium', url: '/?debug=1&quality=medium' },
  { name: 'low', url: '/?debug=1&quality=low' },
  { name: 'low-nopaint', url: '/?debug=1&quality=low&nopaint=1' },
  { name: 'high-nopaint', url: '/?debug=1&quality=high&nopaint=1' },
];

for (const c of CASES) {
  test(`frame rate: ${c.name}`, async ({ page }, info) => {
    test.setTimeout(180_000);
    await page.goto(c.url);
    await page.waitForFunction(() => document.body.dataset.ready === '1');
    await beginChapter(page);
    for (const g of ['receive', 'calm']) {
      await page.locator(`[aria-label="${g}"] button[data-value="3"]`).click();
    }
    await page.getByRole('button', { name: 'Continue' }).click();
    // Let the scene settle, then measure real frames over a fixed window.
    await page.waitForTimeout(6000);
    const frames = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let n = 0;
          const t0 = performance.now();
          const tick = (): void => {
            n++;
            if (performance.now() - t0 >= 10000) resolve(n);
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
    // eslint-disable-next-line no-console
    console.log(`FPSRESULT ${info.project.name} ${c.name} ${(frames / 10).toFixed(1)}`);
  });
}
