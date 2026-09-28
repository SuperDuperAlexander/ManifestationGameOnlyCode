import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LAYOUT } from '../../src/content/chapter1';
import { beginChapter, call, snap, waitForSnap } from './helpers';

/**
 * One screenshot per scene, on desktop and on mobile.
 *
 * These use `?scene=N`, the documented jump that starts a scene with the right
 * amount of light, so each picture shows the scene at its own place in the
 * valley at the high quality tier. The full play-through lives in
 * `chapter1.spec.ts`.
 */
test.describe('scene screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'lightwithin.settings.v1',
        JSON.stringify({
          rhythm: 'easy',
          quality: 'auto',
          volume: 0.7,
          muted: true,
          reducedMotion: false,
        }),
      );
    });
  });

  const open = async (page: Page, query: string): Promise<void> => {
    await page.goto(query);
    await page.waitForFunction(() => document.body.dataset.ready === '1');
    await page.waitForTimeout(2500);
  };

  test('start and settings', async ({ page }, info) => {
    test.setTimeout(180_000);
    const tag = info.project.name;
    await open(page, '/?quality=high');
    await page.screenshot({ path: `screenshots/start-screen-${tag}.png` });
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/settings-${tag}.png` });
    await page.getByRole('button', { name: 'Back' }).click();
    await beginChapter(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/start-questions-${tag}.png` });
  });

  test('scene 1 wake up', async ({ page }, info) => {
    test.setTimeout(180_000);
    await open(page, '/?scene=1&quality=high');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `screenshots/scene1-wake-${info.project.name}.png` });
  });

  test('scene 2 the dry spring', async ({ page }, info) => {
    test.setTimeout(180_000);
    await open(page, '/?scene=2&quality=high');
    await call(page, 'teleport', LAYOUT.spring1.x - 1, LAYOUT.spring1.z + 6.5);
    await call(page, 'lookAt', Math.PI, 0.16);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `screenshots/scene2-dry-spring-${info.project.name}.png` });
  });

  test('scene 3 the hidden spring', async ({ page }, info) => {
    test.setTimeout(180_000);
    await open(page, '/?scene=3&quality=high');
    await call(page, 'revealSpring', 'spring2');
    await call(page, 'teleport', LAYOUT.spring2.x + 1, LAYOUT.spring2.z + 7);
    await call(page, 'lookAt', Math.PI, 0.16);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `screenshots/scene3-hidden-spring-${info.project.name}.png` });
  });

  test('scene 4 the first fog', async ({ page }, info) => {
    test.setTimeout(180_000);
    await open(page, '/?scene=4&quality=high&autobreathe=1');
    await call(page, 'teleport', LAYOUT.fog.x, LAYOUT.fog.z + 6.5);
    await call(page, 'lookAt', Math.PI, 0.1);
    // Wait for the thought to be fully written inside the fog.
    await waitForSnap(page, (s) => s.fogStep >= 2, 'the fog thought', 60_000);
    await page.screenshot({ path: `screenshots/scene4-fog-${info.project.name}.png` });
  });

  test('scene 5 the first seed', async ({ page }, info) => {
    test.setTimeout(180_000);
    await open(page, '/?scene=5&quality=high');
    await call(page, 'teleport', LAYOUT.seedSpot.x - 1, LAYOUT.seedSpot.z + 5);
    await call(page, 'lookAt', Math.PI, 0.13);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `screenshots/scene5-seed-spot-${info.project.name}.png` });

    await call(page, 'teleport', LAYOUT.seedSpot.x, LAYOUT.seedSpot.z + 1.5);
    await call(page, 'plantNow');
    await waitForSnap(page, (s) => s.seed === 'growing', 'the planted seed', 30_000);
    await call(page, 'teleport', LAYOUT.seedSpot.x - 1, LAYOUT.seedSpot.z + 5);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `screenshots/scene5-seed-planted-${info.project.name}.png` });
  });

  test('scene 6 thanks and full colour', async ({ page }, info) => {
    test.setTimeout(180_000);
    const tag = info.project.name;
    await open(page, '/?scene=6&quality=high');
    await call(page, 'teleport', LAYOUT.bridge.x, LAYOUT.bridge.z + 7);
    await call(page, 'lookAt', Math.PI, 0.14);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `screenshots/scene6-bridge-${tag}.png` });

    await call(page, 'setGlobalColor', 1);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `screenshots/scene6-full-colour-${tag}.png` });
    const s = await snap(page);
    if (s.globalColor < 0.9) throw new Error(`colour did not flow: ${JSON.stringify(s)}`);
  });

  test('the learning cycle and the end screen', async ({ page }, info) => {
    test.setTimeout(240_000);
    const tag = info.project.name;
    await open(page, '/?scene=6&quality=medium&autobreathe=1');
    await call(page, 'teleport', LAYOUT.bridge.x, LAYOUT.bridge.z);
    await waitForSnap(page, (s) => s.phase === 'reflect', 'the reflect panel', 200_000);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `screenshots/after1-reflect-${tag}.png` });

    await page.getByRole('button', { name: 'I felt calm.' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/after1-reflect-reply-${tag}.png` });
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/after2-understand-${tag}.png` });
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `screenshots/after3-apply-${tag}.png` });
    // The closing questions moved to the end of the last chapter in the build,
    // so chapter 1 goes from Apply straight to its end screen.
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `screenshots/after4-chapter-end-${tag}.png` });
  });

  test('the pause screen and the seed choice', async ({ page }, info) => {
    test.setTimeout(180_000);
    const tag = info.project.name;
    await open(page, '/?scene=5&quality=high');
    await call(page, 'teleport', LAYOUT.seedSpot.x, LAYOUT.seedSpot.z + 1.5);
    await page.waitForTimeout(800);
    await call(page, 'interact');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `screenshots/seed-choice-${tag}.png` });
    await page.getByRole('button', { name: 'Not now' }).click();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `screenshots/pause-${tag}.png` });
  });
});
