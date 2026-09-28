import { test, expect } from '@playwright/test';
import { LAYOUT } from '../../src/content/chapter1';
import { answerQuestions, beginChapter, call, snap, startChapter, waitForSnap, walkTo } from './helpers';

/**
 * A full run of chapter 1, from the start screen to the chapter end screen,
 * with automatic calm breathing. It takes one screenshot per scene.
 */
test('plays chapter 1 from start to end', async ({ page }, info) => {
  test.setTimeout(900_000);
  const tag = info.project.name;
  const shot = async (name: string): Promise<void> => {
    await page.screenshot({ path: `screenshots/${name}-${tag}.png` });
  };

  const t0 = Date.now();
  let mark = t0;
  const phase = async (name: string): Promise<void> => {
    const now = Date.now();
    const s = await snap(page);
    // eslint-disable-next-line no-console
    console.log(
      `PHASE ${name} +${((now - mark) / 1000).toFixed(1)}s total=${((now - t0) / 1000).toFixed(1)}s fps=${String(s.fps)}`,
    );
    mark = now;
  };

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await startChapter(page, '/?autobreathe=1&debug=1&quality=low');

  // ---- start screen ----
  await expect(page.locator('button[data-chapter="1"]')).toBeVisible();
  await shot('scene0-start');
  await beginChapter(page);

  // ---- the two opening questions ----
  await expect(page.getByText('Your answers stay on this device.')).toBeVisible();
  await shot('scene0-questions');
  await answerQuestions(page, 3);
  await phase('questions');

  // ---- scene 1: wake up. Three calm breaths bring the glow. ----
  await waitForSnap(page, (s) => s.scene === 1 && s.phase === 'playing', 'scene 1');
  await page.waitForTimeout(2500);
  await shot('scene1-wake');
  const wake = await waitForSnap(page, (s) => s.scene >= 2, 'the glow after three calm breaths');
  expect(wake.calm).toBeGreaterThan(0);
  await phase('scene1');

  // ---- scene 2: the dry spring gives 3 light ----
  await walkTo(page, LAYOUT.spring1.x, LAYOUT.spring1.z + 2.2);
  await page.waitForTimeout(1500);
  await shot('scene2-spring');
  const spring1 = await waitForSnap(page, (s) => s.scene >= 3, 'the first spring to empty');
  expect(spring1.springs[0]?.left).toBe(0);
  await waitForSnap(page, (s) => s.light >= 3, 'three light carried');
  await phase('scene2');

  // ---- scene 3: the hidden spring ----
  await walkTo(page, LAYOUT.spring2.x, LAYOUT.spring2.z + 2.2);
  await waitForSnap(page, (s) => s.springs[1]?.revealed === true, 'the hidden spring to appear');
  await shot('scene3-hidden-spring');
  await waitForSnap(page, (s) => s.scene >= 4, 'the second spring to empty');
  await waitForSnap(page, (s) => s.light >= 6, 'six light carried');
  await phase('scene3');

  // ---- scene 4: the fog ----
  await walkTo(page, LAYOUT.fog.x, LAYOUT.fog.z + 7);
  await waitForSnap(page, (s) => s.fogStep >= 1, 'the fog to be seen');
  await page.waitForTimeout(2200);
  await shot('scene4-fog');
  // Push never works. It only adds a calm breath to the last step.
  await call(page, 'push');
  const pushed = await snap(page);
  expect(pushed.pushCount).toBe(1);
  expect(pushed.fogStep).toBeLessThan(4);

  await waitForSnap(page, (s) => s.fogStep >= 2, 'the fog to be felt');
  await walkTo(page, LAYOUT.fog.x, LAYOUT.fog.z);
  await waitForSnap(page, (s) => s.fogStep >= 3, 'the middle of the fog');
  await page.waitForTimeout(1200);
  await shot('scene4-fog-center');
  await waitForSnap(page, (s) => s.fogStep === 4, 'the fog to dissolve', 200_000);
  await waitForSnap(page, (s) => s.light >= 8, 'eight light carried');
  await phase('scene4');

  // ---- scene 5: the seed and the bridge ----
  await waitForSnap(page, (s) => s.scene >= 5, 'scene 5');
  await walkTo(page, LAYOUT.seedSpot.x, LAYOUT.seedSpot.z + 2);
  await page.waitForTimeout(800);
  await shot('scene5-seed-spot');

  await page.getByRole('button', { name: 'Plant' }).first().click();
  await expect(page.getByRole('button', { name: /Bridge/ })).toBeVisible();
  await shot('scene5-seed-choice');
  // Tree, House and Well are shown but disabled in chapter 1.
  await expect(page.getByRole('button', { name: /Tree/ })).toBeDisabled();
  await page.getByRole('button', { name: /Bridge/ }).click();
  await phase('walk-to-seed');
  const planted = await waitForSnap(page, (s) => s.seed === 'growing', 'the seed to be planted');
  expect(planted.light).toBe(3);

  // The seed only grows while the player is far away, so the walk out to the
  // third spring and back is what makes it grow.
  await walkTo(page, LAYOUT.spring3.x, LAYOUT.spring3.z + 2.2);
  await waitForSnap(page, (s) => s.springs[2]?.revealed === true, 'the third spring to appear');
  await waitForSnap(page, (s) => s.light >= 6, 'six light carried again');
  await shot('scene5-side-path');
  await waitForSnap(page, (s) => s.seed === 'complete', 'the bridge to grow', 200_000);
  await phase('scene5');
  await page.waitForTimeout(3500);

  // ---- scene 6: thanks on the bridge ----
  await walkTo(page, LAYOUT.bridge.x, LAYOUT.bridge.z + 6);
  await walkTo(page, LAYOUT.bridge.x, LAYOUT.bridge.z);
  await shot('scene6-bridge');
  await waitForSnap(page, (s) => s.thanks >= 1, 'the first thanks breath');
  await waitForSnap(page, (s) => s.globalColor >= 0.6, 'colour to flow across the valley', 200_000);
  await phase('scene6');
  await page.waitForTimeout(1200);
  await shot('scene6-full-colour');

  // ---- the learning cycle ----
  await expect(page.getByText('What happened when you stopped?')).toBeVisible({ timeout: 60_000 });
  await shot('after1-reflect');
  await page.getByRole('button', { name: 'I felt calm.' }).click();
  await expect(page.getByText('Thank you for noticing.')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText(/Dr\. Rulin Xiu teaches/)).toBeVisible();
  await shot('after2-understand');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText(/Your practice for today/)).toBeVisible();
  await shot('after3-apply');
  await page.getByRole('button', { name: 'Next' }).click();

  // The closing questions are asked once, after the last chapter in the build,
  // so chapter 1 now goes straight to its end screen.
  await expect(page.getByText('Chapter 1 complete.')).toBeVisible();
  await shot('after4-chapter-end');
  // And the end screen offers the walk on into chapter 2.
  await expect(page.locator('button[data-next-chapter="2"]')).toBeEnabled();

  expect(errors, `page errors: ${errors.join(' | ')}`).toEqual([]);
});
