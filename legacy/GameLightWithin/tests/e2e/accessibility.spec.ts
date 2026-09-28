import { test, expect } from '@playwright/test';

/** The UI has to work from the keyboard, with visible focus. */
test('the start screen works from the keyboard', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => document.body.dataset.ready === '1');

  // The first control is focused when the panel opens.
  const begin = page.locator('button[data-chapter="1"]');
  await expect(begin).toBeFocused();

  // Tab reaches every control in the panel.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();

  // A focused control shows a visible outline.
  const outline = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement;
    return getComputedStyle(active).outlineWidth;
  });
  expect(parseFloat(outline)).toBeGreaterThan(0);

  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
});

test('the settings panel changes the rhythm and reduced motion', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => document.body.dataset.ready === '1');
  await page.getByRole('button', { name: 'Settings' }).click();

  await page.locator('[aria-label="Breath rhythm"] button', { hasText: 'Slow' }).click();
  await page.locator('[aria-label="Reduced motion"] button', { hasText: 'On' }).click();

  const stored = await page.evaluate(() => localStorage.getItem('lightwithin.settings.v1'));
  expect(stored).toContain('"rhythm":"slow"');
  expect(stored).toContain('"reducedMotion":true');
});

test('every panel button is at least 48 px tall', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => document.body.dataset.ready === '1');
  const heights = await page
    .locator('.lw-panel button')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(48);
});
