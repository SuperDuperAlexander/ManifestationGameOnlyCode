import { test, expect } from '@playwright/test';
import { beginChapter, startChapter } from './helpers';

/**
 * The start screen lists the chapters. A chapter that has not been reached
 * yet is shown but cannot be opened, so the shape of the whole thing is
 * visible from the first screen without giving it away.
 */
test('the start screen lists the chapters and locks the ones not reached', async ({ page }) => {
  await startChapter(page, '/?debug=1');
  const one = page.locator('button[data-chapter="1"]');
  const two = page.locator('button[data-chapter="2"]');
  const three = page.locator('button[data-chapter="3"]');

  await expect(one).toBeEnabled();
  await expect(two).toBeDisabled();
  await expect(three).toBeDisabled();
  await expect(three).toContainText('Coming soon');
});

/** A finished chapter 1 opens chapter 2 on the start screen. */
test('finishing chapter 1 unlocks chapter 2', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    localStorage.setItem(
      'lightwithin.save.v1',
      JSON.stringify({
        version: 2,
        chapters: { 1: { scene: 6, light: 12, completed: true } },
        current: 1,
        startAnswers: { receive: 3, calm: 3 },
        endAnswers: { receive: null, calm: null },
      }),
    );
  });
  await page.goto('/?debug=1');
  await page.waitForFunction(() => document.body.dataset.ready === '1');

  const two = page.locator('button[data-chapter="2"]');
  await expect(two).toBeEnabled();
  await two.click();
  // Opening chapter 2 reloads the page at the chapter 2 address. The fade
  // runs first, and then a whole world is built again, which on a machine
  // with no graphics card is measured in tens of seconds, not milliseconds.
  await page.waitForURL(/chapter=2/, { timeout: 120_000 });
  await page.waitForFunction(() => document.body.dataset.ready === '1', undefined, {
    timeout: 120_000,
  });
  await expect(page.locator('button[data-chapter="2"]')).toBeVisible();
});

/** Chapter 2 opens directly from its own address, with its own light. */
test('chapter 2 starts with its own light', async ({ page }) => {
  await startChapter(page, '/?chapter=2&debug=1&quality=low');
  await beginChapter(page, 2);
  const light = await page.evaluate(
    () => (window.__lw?.['snapshot']?.() as { chapter: number; light: number }).light,
  );
  expect(light).toBe(3);
});
