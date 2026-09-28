import { test, expect } from '@playwright/test';
import { LAYOUT } from '../../src/content/chapter1';
import { answerQuestions, beginChapter, call, snap, startChapter, waitForSnap } from './helpers';

/**
 * The valley is one open place. A player may reach any part of it in any
 * order, so no mechanic may be gated on how far they have come.
 *
 * This is a regression test. The fog, the seed and the bridge all used to be
 * gated on the scene number, and the scene number only moved when the *hidden*
 * second spring was emptied. A player who walked straight past that spring
 * found a fog that did nothing, and with it no transform, no seed and no
 * bridge: everything except breathing looked unimplemented.
 */
test('the fog works even when the hidden spring was never found', async ({ page }) => {
  test.setTimeout(600_000);

  await startChapter(page, '/?autobreathe=1&debug=1&quality=low&nopaint=1');
  await beginChapter(page);
  await answerQuestions(page, 3);

  // Scene 1 ends after three calm breaths, wherever the player stands.
  await waitForSnap(page, (s) => s.scene >= 2, 'the glow after three calm breaths');

  // Go straight to the fog, skipping the hidden spring entirely.
  await call(page, 'teleport', LAYOUT.fog.x, LAYOUT.fog.z + 7);
  const seen = await waitForSnap(page, (s) => s.fogStep >= 1, 'the fog to be seen', 60_000);
  // The hidden spring is still untouched, so the scene number is still low.
  expect(seen.springs[1]?.revealed).toBe(false);
  expect(seen.scene).toBeLessThan(4);

  await waitForSnap(page, (s) => s.fogStep >= 2, 'the fog to be felt', 60_000);
  await call(page, 'teleport', LAYOUT.fog.x, LAYOUT.fog.z);
  await waitForSnap(page, (s) => s.fogStep >= 3, 'the middle of the fog', 90_000);
  const gone = await waitForSnap(page, (s) => s.fogStep === 4, 'the fog to dissolve', 120_000);
  expect(gone.springs[1]?.revealed, 'still never found the hidden spring').toBe(false);

  // The light from the fog is enough to plant the seed on its own.
  await waitForSnap(page, (s) => s.light >= 2, 'light from the fog');
});

/** The seed can be planted the moment the player reaches the spot. */
test('the seed spot works as soon as the player has the light', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/?scene=2&debug=1&quality=low&nopaint=1');
  await page.waitForFunction(() => document.body.dataset.ready === '1');
  await call(page, 'addLight', 6);
  await call(page, 'teleport', LAYOUT.seedSpot.x, LAYOUT.seedSpot.z + 1.5);
  await page.waitForTimeout(1500);

  // The plant button is offered although the player is nominally in scene 2.
  const before = await snap(page);
  expect(before.scene).toBeLessThan(5);
  await expect(page.getByRole('button', { name: 'Plant' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Plant' }).first().click();
  await page.getByRole('button', { name: /Bridge/ }).click();
  await waitForSnap(page, (s) => s.seed === 'growing', 'the planted seed');
});
