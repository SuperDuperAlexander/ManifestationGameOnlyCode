import type { Page } from '@playwright/test';

export interface Snapshot {
  phase: string;
  scene: number;
  calm: number;
  light: number;
  fogStep: number;
  pushCount: number;
  fleeCount: number;
  seed: string;
  seedRemaining: number;
  thanks: number;
  globalColor: number;
  zones: number;
  springs: { id: string; left: number; revealed: boolean }[];
  birdShown: boolean;
  fps: number;
  px: number;
  pz: number;
  yaw: number;
  breathPhase: string;
  breathsTotal: number;
  breathsCalm: number;
  stride: number;
  speed: number;
  mist: number;
  butterflyShown: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Api = Record<string, (...args: any[]) => any>;

declare global {
  interface Window {
    __lw?: Api;
  }
}

export async function snap(page: Page): Promise<Snapshot> {
  return page.evaluate(() => window.__lw?.['snapshot']?.() as unknown) as Promise<Snapshot>;
}

export async function call(page: Page, name: string, ...args: unknown[]): Promise<unknown> {
  return page.evaluate(([n, a]) => window.__lw?.[n as string]?.(...(a as unknown[])), [
    name,
    args,
  ] as const);
}

/** Walks the player to a point and waits until they arrive. */
export async function walkTo(page: Page, x: number, z: number, timeout = 90_000): Promise<void> {
  await call(page, 'walkTo', x, z);
  await page.waitForFunction(() => window.__lw?.['walking']?.() === false, undefined, { timeout });
}

/** Waits until a value read from the snapshot satisfies a test. */
export async function waitForSnap(
  page: Page,
  check: (s: Snapshot) => boolean,
  label: string,
  timeout = 150_000,
): Promise<Snapshot> {
  const start = Date.now();
  for (;;) {
    const s = await snap(page);
    if (check(s)) return s;
    if (Date.now() - start > timeout) {
      throw new Error(`timed out waiting for ${label}; last snapshot: ${JSON.stringify(s)}`);
    }
    await page.waitForTimeout(400);
  }
}

/** Starts a fresh run and answers the two opening questions. */
export async function startChapter(page: Page, query: string): Promise<void> {
  await page.addInitScript(() => {
    // The easy rhythm keeps the automatic run inside a sensible time.
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
    localStorage.removeItem('lightwithin.save.v1');
    localStorage.removeItem('lightwithin.checks.v1');
  });
  await page.goto(query);
  await page.waitForFunction(() => document.body.dataset.ready === '1');
}

/**
 * Clicks a chapter on the start screen. The button is found by its data
 * attribute, so a change to the chapter's name does not break every test.
 */
export async function beginChapter(page: Page, id = 1): Promise<void> {
  await page.locator(`button[data-chapter="${String(id)}"]`).click();
}

export async function answerQuestions(page: Page, value = 3): Promise<void> {
  for (const group of ['receive', 'calm']) {
    await page.locator(`[aria-label="${group}"] button[data-value="${value}"]`).click();
  }
  await page.getByRole('button', { name: 'Continue' }).click();
}
