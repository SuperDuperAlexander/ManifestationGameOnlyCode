import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { call, snap, waitForSnap } from './helpers';

/**
 * Walking with the real keys.
 *
 * The full play-through steers the player with the auto-walk helper, which
 * sets a world direction straight away. That never touches the camera-relative
 * part of the movement, which is where A and D were swapped. These press the
 * keys the way a player does.
 */
test.describe('walking with the keyboard', () => {
  const TOLERANCE = 0.7;

  /**
   * Holds a key until the player has really moved, and reports how far.
   *
   * It waits for movement rather than for a stopwatch. This machine renders in
   * software and drops to well under one frame a second when it is busy, and a
   * fixed two second press is then a single frame of movement or none at all —
   * which is what made these tests fail in a long run and pass on their own.
   */
  async function press(page: Page, key: string): Promise<{ dx: number; dz: number }> {
    const before = await snap(page);
    await page.keyboard.down(key);
    const deadline = Date.now() + 40_000;
    for (;;) {
      await page.waitForTimeout(300);
      const now = await snap(page);
      if (Math.hypot(now.px - before.px, now.pz - before.pz) > TOLERANCE * 1.5) break;
      if (Date.now() > deadline) break;
    }
    await page.keyboard.up(key);
    await page.waitForTimeout(400);
    const after = await snap(page);
    const moved = { dx: after.px - before.px, dz: after.pz - before.pz };
    // eslint-disable-next-line no-console
    console.log(`MOVE ${key} dx=${moved.dx.toFixed(2)} dz=${moved.dz.toFixed(2)}`);
    return moved;
  }

  /** Waits for a value read from the snapshot, however slowly frames arrive. */
  async function until(
    page: Page,
    check: (s: Awaited<ReturnType<typeof snap>>) => boolean,
    label: string,
    timeout = 40_000,
  ): Promise<void> {
    const deadline = Date.now() + timeout;
    for (;;) {
      if (check(await snap(page))) return;
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
      await page.waitForTimeout(300);
    }
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/?scene=3&quality=low&nopaint=1');
    await page.waitForFunction(() => document.body.dataset.ready === '1');
    // Wait for the renderer to actually be running. The first frames compile
    // shaders and build the environment map, which on a machine with no
    // graphics card takes seconds. A fixed pause raced that and made these
    // tests read a player who had not moved yet because time had not moved.
    await waitForSnap(page, (s) => s.fps > 0, 'the first frames', 90_000);
    // Face straight down the valley, which runs toward negative z.
    await call(page, 'lookAt', Math.PI, 0.12);
    await page.waitForTimeout(1200);
  });

  test('W walks the way the camera looks', async ({ page }) => {
    const { dz } = await press(page, 'KeyW');
    expect(dz, 'W should walk toward negative z').toBeLessThan(-TOLERANCE);
  });

  test('S walks back', async ({ page }) => {
    const { dz } = await press(page, 'KeyS');
    expect(dz, 'S should walk toward positive z').toBeGreaterThan(TOLERANCE);
  });

  test('D walks right, not left', async ({ page }) => {
    const { dx } = await press(page, 'KeyD');
    expect(dx, 'facing negative z, right is positive x').toBeGreaterThan(TOLERANCE);
  });

  test('A walks left, not right', async ({ page }) => {
    const { dx } = await press(page, 'KeyA');
    expect(dx, 'facing negative z, left is negative x').toBeLessThan(-TOLERANCE);
  });

  test('the arrow keys do the same as WASD', async ({ page }) => {
    const right = await press(page, 'ArrowRight');
    expect(right.dx).toBeGreaterThan(TOLERANCE);
    const left = await press(page, 'ArrowLeft');
    expect(left.dx).toBeLessThan(-TOLERANCE);
  });

  test('walking resets the breath in progress', async ({ page }) => {
    // Each step waits for the state to arrive rather than for a stopwatch, so
    // a machine running at half a frame a second still gets there.
    await page.keyboard.down('Space');
    await until(page, (s) => s.breathPhase === 'inhale', 'the in-breath to start');
    await page.keyboard.down('KeyW');
    await until(page, (s) => s.breathPhase === 'idle', 'walking to reset the breath');
    await page.keyboard.up('KeyW');
    await page.keyboard.up('Space');
  });
});
