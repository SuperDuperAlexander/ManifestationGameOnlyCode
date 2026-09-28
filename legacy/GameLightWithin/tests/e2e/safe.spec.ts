import { test, expect } from '@playwright/test';

/**
 * Safe mode: the scene straight to the canvas, with no post-processing.
 *
 * It exists because a phone showed a black screen that no machine here could
 * reproduce. A device that is black through the composer and correct in safe
 * mode has a problem with the render targets; one that is black either way
 * has a problem with the world's own shaders. The test holds the thing that
 * makes the answer worth having: that safe mode really does draw the world.
 */
test('safe mode draws the world without the composer', async ({ page }, info) => {
  test.setTimeout(240_000);
  const tag = info.project.name;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?scene=3&safe=1&debug=1&quality=low');
  await page.waitForFunction(() => document.body.dataset.ready === '1');
  // Wait for real frames: on a machine with no graphics card the first few
  // seconds are spent compiling shaders.
  await page.waitForFunction(
    () => ((window.__lw?.['snapshot']?.() as { fps: number } | undefined)?.fps ?? 0) > 0,
    undefined,
    { timeout: 120_000 },
  );
  await page.waitForTimeout(3000);

  // The picture is read from a page screenshot, not from the canvas itself.
  // The canvas has no preserveDrawingBuffer, so drawing it into a 2d context
  // after the frame has gone gives nothing back and every test passes or
  // fails on an empty image.
  const shot = await page.screenshot({ path: `screenshots/render-safe-${tag}.png` });
  const result = await page.evaluate(async (bytes: number[]) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = 140;
    c.height = 90;
    const ctx = c.getContext('2d');
    if (!ctx) return { range: -1, darkShare: 1 };
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let min = 255;
    let max = 0;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
      min = Math.min(min, lum);
      max = Math.max(max, lum);
      if (lum < 12) dark++;
    }
    return { range: max - min, darkShare: dark / (data.length / 4) };
  }, Array.from(shot));

  expect(result.range, 'the picture has light and shade in it').toBeGreaterThan(30);
  expect(result.darkShare, 'the picture is not mostly black').toBeLessThan(0.4);
  expect(errors).toEqual([]);
});
