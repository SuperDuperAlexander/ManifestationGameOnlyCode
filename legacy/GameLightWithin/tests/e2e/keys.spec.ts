import { test, expect } from '@playwright/test';
import { RHYTHM_PRESETS } from '../../src/content/chapter1';
import { snap, waitForSnap } from './helpers';

// Read the rhythm from the preset the test selects, so retuning the game
// changes the game and not the test.
const EASY = RHYTHM_PRESETS.easy;

test('space and shift make a breath, and the stride opens up', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    localStorage.setItem(
      'lightwithin.settings.v1',
      JSON.stringify({
        rhythm: 'easy',
        quality: 'low',
        volume: 0,
        muted: true,
        reducedMotion: false,
      }),
    );
  });
  await page.goto('/?scene=1&debug=1&quality=low&nopaint=1');
  await page.waitForFunction(() => document.body.dataset.ready === '1');
  // Wait for the renderer to actually be running before timing anything.
  await waitForSnap(page, (s) => s.fps > 0, 'the first frames', 90_000);
  await page.waitForTimeout(1200);

  // The player can walk straight away, but slowly.
  //
  // Both walks are measured as the time to cover the same distance, not as
  // the distance covered in the same time. This machine renders in software
  // and its frame rate wanders by a factor of four depending on what else is
  // running, which makes any fixed-stopwatch reading of a speed meaningless.
  const DISTANCE = 3;

  /** Walks forward until the player has covered `DISTANCE`, and times it. */
  async function walkFor(): Promise<number> {
    const from = await snap(page);
    const started = Date.now();
    await page.keyboard.down('KeyW');
    const deadline = started + 90_000;
    for (;;) {
      await page.waitForTimeout(250);
      const now = await snap(page);
      if (Math.abs(now.pz - from.pz) >= DISTANCE) break;
      if (Date.now() > deadline) throw new Error('the player never walked');
    }
    const took = Date.now() - started;
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(400);
    return took;
  }

  const slowMs = await walkFor();
  expect(slowMs, 'the player is never held still').toBeLessThan(90_000);

  // One breath: hold space, then hold shift, then let go.
  await page.keyboard.down('Space');
  await page.waitForTimeout(EASY.inhale * 1000);
  await page.keyboard.up('Space');
  await page.keyboard.down('Shift');
  await page.waitForTimeout(EASY.exhale * 1000);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(800);

  const c = await snap(page);
  expect(c.breathsTotal, 'the two keys completed a breath').toBeGreaterThanOrEqual(1);
  expect(c.breathsCalm, 'and it was calm').toBeGreaterThanOrEqual(1);
  expect(c.scene, 'one calm breath is enough to wake the valley').toBeGreaterThanOrEqual(2);

  // After that breath the stride opens up: the same distance takes less time.
  await page.waitForTimeout(3000);
  const fastMs = await walkFor();
  expect(
    fastMs,
    `${String(DISTANCE)} m took ${String(slowMs)} ms inside the mist and ${String(fastMs)} ms after the breath`,
  ).toBeLessThan(slowMs * 0.8);
});
