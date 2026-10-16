import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/?debug';
const outDir = 'screenshots/action-cues';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
const check = (ok, message) => { if (!ok) throw new Error(message); };
const waitStarted = async (page, start) => {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__lw);
  await page.locator(start).click();
  await page.waitForFunction(() => !document.querySelector('.start-screen'));
};
const errorsOn = (page) => {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
};
const waitForCue = (page) => page.waitForFunction(() => window.__lw.pushCueToken() !== '', null, { timeout: 20000 });

try {
  const fresh = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  errorsOn(fresh);
  await waitStarted(fresh, '.ss-begin');
  check(await fresh.evaluate(() => window.__lw.pushCueToken()) === '', 'fresh Begin reports a push opportunity with no thought');
  check(await fresh.locator('.push-shell').isHidden(), 'Push Away control is visible without an eligible thought');
  await fresh.close();

  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await desktopContext.addInitScript(() => localStorage.setItem('lw.lantern.save.v1', JSON.stringify({ beat: 3, flags: { bumped: true } })));
  const desktop = await desktopContext.newPage();
  errorsOn(desktop);
  await waitStarted(desktop, '.ss-continue');
  await desktop.waitForFunction(() => window.__lw.interactionContext() === 'push');
  await waitForCue(desktop);
  await desktop.waitForFunction(() => document.querySelector('.push-shell')?.classList.contains('off') === false && document.querySelector('.push-action')?.classList.contains('push-ready-pop'));
  check(await desktop.locator('.push-action').getAttribute('aria-label') === 'Push away (E)', 'desktop action label or E cue is missing');
  check(await desktop.locator('.push-action kbd').textContent() === 'E', 'desktop keycap is not E');
  await desktop.screenshot({ path: `${outDir}/desktop-push-ready.png` });
  const level = await desktop.evaluate(() => window.__lw.pushLevel());
  await desktop.keyboard.press('KeyE');
  await desktop.waitForFunction((n) => window.__lw.pushLevel() > n, level);
  await desktop.waitForFunction(() => document.querySelector('.push-shell')?.classList.contains('off') === true);

  await desktop.keyboard.press('KeyQ');
  await desktop.waitForFunction(() => window.__lw.transitioning());
  await desktop.waitForFunction(() => document.querySelector('.push-shell')?.classList.contains('off'));
  check(await desktop.locator('.push-shell').isHidden(), 'push action remains visible during world transition');
  await desktop.waitForFunction(() => window.__lw.world() === 'inner' && !window.__lw.transitioning());
  await desktop.evaluate(() => window.__lw.setAnger(1));
  await waitForCue(desktop);
  await desktop.waitForFunction(() => document.querySelector('.push-action')?.classList.contains('push-ready-pop'));
  check(await desktop.evaluate(() => window.__lw.world()) === 'inner', 'inner push cue appeared in the wrong world');
  await desktop.screenshot({ path: `${outDir}/desktop-inner-push-ready.png` });
  const innerLevel = await desktop.evaluate(() => window.__lw.pushLevel());
  await desktop.keyboard.press('KeyE');
  await desktop.waitForFunction((n) => window.__lw.pushLevel() > n, innerLevel);
  check(!errors.length, `desktop browser errors: ${errors.join(' | ')}`);
  await desktopContext.close();

  const touchContext = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await touchContext.addInitScript(() => localStorage.setItem('lw.lantern.save.v1', JSON.stringify({ beat: 3, flags: { bumped: true } })));
  const touch = await touchContext.newPage();
  await touch.emulateMedia({ reducedMotion: 'reduce' });
  errorsOn(touch);
  await touch.goto(`${url}${url.includes('?') ? '&' : '?'}touch`, { waitUntil: 'load' });
  await touch.waitForFunction(() => !!window.__lw);
  await touch.locator('.ss-continue').click();
  await touch.locator('.start-screen').waitFor({ state: 'detached', timeout: 5000 });
  await waitForCue(touch);
  await touch.waitForFunction(() => document.querySelector('.hand-button')?.classList.contains('push-ready-pop'));
  check(await touch.locator('.hand-button').getAttribute('aria-label') === 'Push away', 'touch action label is missing');
  check((await touch.locator('.hand-button .control-hint').textContent()) === 'Tap', 'touch action cue is missing');
  const fitsTouchAction = async () => touch.locator('.hand-button').evaluate((button) => {
    const r = button.getBoundingClientRect();
    const children = [...button.querySelectorAll('svg, .control-label, .control-hint')].map((el) => el.getBoundingClientRect());
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
      && children.every((q) => q.left >= r.left && q.right <= r.right && q.top >= r.top && q.bottom <= r.bottom);
  });
  check(await fitsTouchAction(), 'portrait touch action clips or its cue text escapes the button');
  check(await touch.locator('.hand-button').evaluate((el) => el.classList.contains('push-ready-pop')), 'reduced-motion touch highlight is missing');
  await touch.screenshot({ path: `${outDir}/touch-portrait.png` });
  await touch.setViewportSize({ width: 915, height: 412 });
  check(await fitsTouchAction(), 'landscape touch action clips or its cue text escapes the button');
  check(await touch.locator('.hand-button').evaluate((el) => el.classList.contains('push-ready-pop')), 'landscape touch highlight is missing');
  await touch.screenshot({ path: `${outDir}/touch-landscape.png` });
  const beforeTouch = await touch.evaluate(() => window.__lw.pushLevel());
  await touch.locator('.hand-button').click();
  await touch.waitForFunction((n) => window.__lw.pushLevel() > n, beforeTouch);
  await touch.waitForFunction(() => window.__lw.pushCueToken() === '' && document.querySelector('.hand-button')?.getAttribute('aria-disabled') === 'true');
  check((await touch.locator('.hand-button .control-hint').textContent()) === '', 'inactive touch action still advertises Tap');
  check(!errors.length, `browser errors: ${errors.join(' | ')}`);
  console.log(`action-cues: PASS; no cue without a thought, desktop outer/inner E cues, touch tap label/action in portrait/landscape, errors=0; screenshots=${outDir}`);
} finally {
  await browser.close();
}
