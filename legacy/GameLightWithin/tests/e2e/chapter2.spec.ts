import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { BODY, LAYOUT2, SPRING2, STORM } from '../../src/content/chapter2';
import { answerQuestions } from './helpers';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Snap2 {
  chapter: number;
  scene: number;
  phase: string;
  calm: number;
  light: number;
  fps: number;
  px: number;
  pz: number;
  speed: number;
  breathsTotal: number;
  breathsCalm: number;
  springLeft: number;
  bodyLit: string[];
  cloudIntensity: number;
  cloudNamed: boolean;
  rainStep: number;
  soundUnlocked: boolean;
  soundCount: number;
  stormStep: number;
  stormDone: boolean;
  seedA: string;
  seedB: string;
  night: number;
  globalColor: number;
  thanks: number;
  naming: boolean;
}

declare global {
  interface Window {
    __lw?: Record<string, (...args: any[]) => any>;
  }
}

async function snap2(page: Page): Promise<Snap2> {
  return page.evaluate(() => window.__lw?.['snapshot']?.() as unknown) as Promise<Snap2>;
}

async function call2(page: Page, name: string, ...args: unknown[]): Promise<unknown> {
  return page.evaluate(([n, a]) => window.__lw?.[n as string]?.(...(a as unknown[])), [
    name,
    args,
  ] as const);
}

async function walk(page: Page, x: number, z: number, timeout = 120_000): Promise<void> {
  await call2(page, 'walkTo', x, z);
  await page.waitForFunction(() => window.__lw?.['walking']?.() === false, undefined, { timeout });
}

async function until(
  page: Page,
  check: (s: Snap2) => boolean,
  label: string,
  timeout = 180_000,
): Promise<Snap2> {
  const start = Date.now();
  for (;;) {
    const s = await snap2(page);
    if (check(s)) return s;
    if (Date.now() - start > timeout) {
      throw new Error(`timed out waiting for ${label}; last: ${JSON.stringify(s)}`);
    }
    await page.waitForTimeout(400);
  }
}

async function openChapter2(page: Page, query: string): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'lightwithin.settings.v1',
      JSON.stringify({
        rhythm: 'easy',
        quality: 'auto',
        volume: 0.7,
        muted: true,
        reducedMotion: false,
        softStorm: false,
      }),
    );
    localStorage.removeItem('lightwithin.save.v1');
    localStorage.removeItem('lightwithin.checks.v1');
  });
  await page.goto(query);
  await page.waitForFunction(() => document.body.dataset.ready === '1');
}

/**
 * A full walk through chapter 2, from the meadows to the end screen, with
 * automatic calm breathing and automatic naming. One screenshot per scene.
 */
test('plays chapter 2 from the meadows to the end', async ({ page }, info) => {
  test.setTimeout(1_500_000);
  const tag = info.project.name;
  const shot = async (name: string): Promise<void> => {
    await page.screenshot({ path: `screenshots/${name}-${tag}.png` });
  };

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await openChapter2(page, '/?chapter=2&scene=1&autobreathe=1&autoname=1&debug=1&quality=low');
  await until(page, (s) => s.fps > 0, 'the first frame');

  // ---- scene 1: the spring in the meadows ----
  let s = await snap2(page);
  expect(s.chapter).toBe(2);
  expect(s.light).toBe(3);
  await shot('c2-scene1-meadows');

  await walk(page, LAYOUT2.spring.x, LAYOUT2.spring.z + 1.5);
  s = await until(page, (x) => x.springLeft === 0, 'the spring to be drawn dry');
  expect(s.light).toBeGreaterThanOrEqual(3 + SPRING2.light);

  // ---- scene 2: the four body stones ----
  for (const stone of LAYOUT2.bodyStones) {
    await walk(page, stone.x, stone.z + 1.2);
    await until(page, (x) => x.bodyLit.includes(stone.point), `the ${stone.point} stone to light`);
  }
  s = await snap2(page);
  expect(s.bodyLit).toEqual(['feet', 'belly', 'heart', 'head']);
  expect(s.light).toBeGreaterThanOrEqual(3 + SPRING2.light + 4 * BODY.lightPerStone);
  await shot('c2-scene2-body-stones');

  // ---- scene 3: the rain cloud ----
  await walk(page, LAYOUT2.rain.x, LAYOUT2.rain.z + 3);
  await until(page, (x) => x.cloudNamed, 'the cloud to be named');
  await until(page, (x) => x.rainStep >= 3, 'the rain to let go');
  // The rainbow, which is what the player sees when the rain lets go.
  await shot('c2-scene3-rainbow');

  // ---- scene 4a: the singing stone ----
  await walk(page, LAYOUT2.singingStone.x + 1.5, LAYOUT2.singingStone.z + 1.5);
  await until(page, (x) => x.soundUnlocked, 'the singing stone to answer');
  await shot('c2-scene4a-singing-stone');

  // ---- scene 4: the storm ----
  await walk(page, LAYOUT2.storm.x, LAYOUT2.storm.z + 8);
  await until(page, (x) => x.stormStep >= 2, 'the storm to show its thought');
  await shot('c2-scene4-storm');
  await walk(page, LAYOUT2.storm.x, LAYOUT2.storm.z + 3);
  await until(page, (x) => x.stormStep >= 4, 'the storm to be felt through');
  await until(page, (x) => x.soundCount >= STORM.tonesNeeded, 'five sound breaths');
  await walk(page, LAYOUT2.storm.x, LAYOUT2.storm.z);
  await until(page, (x) => x.stormDone, 'the storm to let go');

  // ---- scene 5: the two seeds ----
  await walk(page, LAYOUT2.seedB.x, LAYOUT2.seedB.z);
  await until(page, (x) => x.light >= 5, 'enough light for a seed');
  await until(page, (x) => x.calm >= 0.6, 'a calm heart');
  await page.getByRole('button', { name: 'Plant' }).first().click();
  await page.locator('button[data-seed="tree"]').click();
  await shot('c2-scene5-seeds');
  // The seed grows only while the player is away from it.
  await walk(page, LAYOUT2.lightWell.x, LAYOUT2.lightWell.z);
  await until(page, (x) => x.seedB.includes('grown'), 'the heart tree to grow', 300_000);

  // ---- scene 6: night, thanks, the dream ----
  await until(page, (x) => x.night >= 1, 'night to fall');
  // The picture of scene 6 is the player standing under the tree they grew,
  // so it is taken there and not wherever they happened to be at nightfall.
  // Standing here is already under the tree, close enough to give thanks, so
  // there is no second walk: the chapter can finish while one is still running.
  await walk(page, LAYOUT2.seedB.x, LAYOUT2.seedB.z + 3);
  await page.waitForTimeout(2500);
  await shot('c2-scene6-night');
  await until(page, (x) => x.globalColor >= 0.999, 'the meadows to turn to full colour');
  await until(page, (x) => x.phase === 'dream', 'the dream');
  // The player lies down first, and the dream fades in over the top of that.
  // The wait also puts the bird over the village rather than off the edge:
  // it makes its first crossing in the first four tenths of the dream.
  await page.waitForTimeout(4200);
  await expect(page.locator('.lw-dream')).toBeVisible();
  await shot('c2-dream');

  // ---- the learning cycle ----
  await expect(page.getByRole('button', { name: 'Sadness' })).toBeVisible({ timeout: 40_000 });
  await page.getByRole('button', { name: 'Sadness' }).click();
  // Reflect, then the Understand card, then the Apply card.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();
  // Chapter 2 is the last chapter in this build, so the closing questions are
  // asked here rather than at the end of chapter 1.
  await expect(page.getByText('Two questions')).toBeVisible({ timeout: 40_000 });
  await answerQuestions(page, 4);
  await expect(page.getByText('Chapter 2 complete.')).toBeVisible({ timeout: 40_000 });
  // The end screen names the chapter that is coming, not the one just played.
  await expect(page.getByRole('button', { name: /Chapter 3/ })).toBeDisabled();
  await shot('c2-end');

  expect(errors).toEqual([]);
});

/**
 * A player whose calm is low plants a mind seed. It grows fast, then fades,
 * and gives its light back, so the chapter can still be finished.
 */
test('a low calm plants a mind seed and the chapter still finishes', async ({ page }) => {
  test.setTimeout(900_000);
  await openChapter2(
    page,
    '/?chapter=2&scene=5&autobreathe=1&autoname=1&debug=1&quality=low&calm=0.2',
  );
  await until(page, (s) => s.fps > 0, 'the first frame');

  await walk(page, LAYOUT2.seedA.x, LAYOUT2.seedA.z);
  await page.getByRole('button', { name: 'Plant' }).first().click();
  await page.locator('button[data-seed="tree"]').click();
  const planted = await snap2(page);
  expect(planted.seedA).toContain('mind');

  await walk(page, LAYOUT2.lightWell.x, LAYOUT2.lightWell.z);
  await until(page, (s) => s.seedA.includes('grown'), 'the mind tree to grow', 200_000);
  // It does not stay.
  await until(page, (s) => s.seedA.includes('faded'), 'the mind tree to fade', 200_000);
  const after = await snap2(page);
  // The light comes back, so the player is never stuck.
  expect(after.light).toBeGreaterThanOrEqual(2);
});

/** The light well never lets a player run out of light for a seed. */
test('the light well gives light only while the player is short', async ({ page }) => {
  test.setTimeout(400_000);
  await openChapter2(page, '/?chapter=2&scene=5&autobreathe=1&debug=1&quality=low');
  await until(page, (s) => s.fps > 0, 'the first frame');
  await walk(page, LAYOUT2.lightWell.x, LAYOUT2.lightWell.z);
  const at = await until(page, (s) => s.light >= 5, 'the well to fill the player up');
  expect(at.light).toBeGreaterThanOrEqual(5);
  // It stops once they have enough: the well is a floor, not a tap.
  await page.waitForTimeout(12_000);
  const later = await snap2(page);
  expect(later.light).toBeLessThanOrEqual(at.light + 1);
});

/**
 * The naming panel, with the cloud still overhead.
 *
 * This runs without `?autoname=1`, so the panel really opens and is really
 * answered. It is also where the screenshot of scene 3 comes from: the cloud
 * raining on the player, with the question in front of it.
 */
test('the naming panel asks what the weather is, and never says wrong', async ({ page }, info) => {
  test.setTimeout(600_000);
  const tag = info.project.name;
  await openChapter2(page, '/?chapter=2&scene=3&autobreathe=1&debug=1&quality=low');
  await until(page, (s) => s.fps > 0, 'the first frame');

  await walk(page, LAYOUT2.rain.x, LAYOUT2.rain.z + 2);
  await until(page, (s) => s.naming, 'the naming panel to open');
  await expect(page.getByText('What is this weather?')).toBeVisible();
  await page.screenshot({ path: `screenshots/c2-scene3-rain-${tag}.png` });

  // A name that does not fit is never called wrong.
  await page.locator('button[data-feeling="anger"]').click();
  await expect(page.getByText('Look again.')).toBeVisible({ timeout: 20_000 });
  const after = await snap2(page);
  expect(after.cloudNamed).toBe(false);

  // The panel stays shut for a few seconds, then the player may try again.
  await until(page, (s) => s.naming, 'the panel to open again', 120_000);
  await page.locator('button[data-feeling="sadness"]').click();
  await until(page, (s) => s.cloudNamed, 'the cloud to be named');
  const named = await snap2(page);
  // A name that fits takes 40 percent off, and nothing else happens.
  expect(named.cloudIntensity).toBeLessThan(after.cloudIntensity);
});
