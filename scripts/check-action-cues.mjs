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
  await desktopContext.addInitScript(() => {
    localStorage.setItem('lw.lantern.save.v1', JSON.stringify({ beat: 3, flags: { bumped: true } }));
    localStorage.setItem('light-within-breath-preferences', JSON.stringify({ inhaleSeconds: 1, exhaleSeconds: 1 }));
  });
  const desktop = await desktopContext.newPage();
  errorsOn(desktop);
  await waitStarted(desktop, '.ss-continue');
  await desktop.waitForFunction(() => window.__lw.interactionContext() === 'push');
  await waitForCue(desktop);
  await desktop.waitForFunction(() => ['.push-action', '.breathe-action', '.breath-secondary']
    .every((selector) => document.querySelector(selector)?.classList.contains('thought-choice-pop')));
  check(await desktop.locator('.thought-push-choice').isVisible(), 'desktop Push away choice is not visible');
  check(await desktop.locator('.thought-breathe-choice').isVisible(), 'desktop Breathe choice is not visible beside Push away');
  check(await desktop.locator('.breathe-action').isVisible() && await desktop.locator('.breath-secondary').isVisible(), 'desktop inhale and exhale controls are missing');
  check((await desktop.locator('.thought-choice-title').textContent())?.trim() === 'Breathe', 'desktop breathing choice is not labeled clearly');
  check(await desktop.locator('.breath-hint').isHidden(), 'long breath instruction overlaps the active choice cue');
  check(await desktop.locator('.push-action').getAttribute('aria-label') === 'Push away (E)', 'desktop action label or E cue is missing');
  check(await desktop.locator('.push-action kbd').textContent() === 'E', 'desktop keycap is not E');
  await desktop.screenshot({ path: `${outDir}/desktop-thought-choices.png` });
  const level = await desktop.evaluate(() => window.__lw.pushLevel());
  const choiceBounds = await desktop.locator('.thought-push-choice, .thought-breathe-choice, .look-action').evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }));
  check(choiceBounds[0].right <= choiceBounds[1].left && choiceBounds[1].right <= choiceBounds[2].left, 'desktop Push/Breathe choices overlap each other or Q');
  check(choiceBounds[0].left >= 0 && choiceBounds[2].right <= 1280 && choiceBounds[0].bottom <= 720, 'desktop choices clip outside the screen');
  await desktop.keyboard.press('KeyE');
  await desktop.waitForFunction((n) => window.__lw.pushLevel() > n, level);
  await desktop.waitForFunction(() => !document.querySelector('.controls-hint')?.classList.contains('thought-choice-active'));
  await desktop.waitForFunction(() => document.querySelector('.push-shell')?.classList.contains('off') === true);

  await desktop.keyboard.press('KeyQ');
  await desktop.waitForFunction(() => window.__lw.transitioning());
  await desktop.waitForFunction(() => document.querySelector('.push-shell')?.classList.contains('off'));
  check(await desktop.locator('.push-shell').isHidden(), 'push action remains visible during world transition');
  await desktop.waitForFunction(() => window.__lw.world() === 'inner' && !window.__lw.transitioning());
  await desktop.evaluate(() => window.__lw.setAnger(1));
  await waitForCue(desktop);
  await desktop.waitForFunction(() => document.querySelector('.push-action')?.classList.contains('thought-choice-pop'));
  check(await desktop.evaluate(() => window.__lw.world()) === 'inner', 'inner push cue appeared in the wrong world');
  await desktop.screenshot({ path: `${outDir}/desktop-inner-thought-choice.png` });
  const innerLevel = await desktop.evaluate(() => window.__lw.pushLevel());
  await desktop.keyboard.press('KeyE');
  await desktop.waitForFunction((n) => window.__lw.pushLevel() > n, innerLevel);
  await desktop.keyboard.down('Space');
  await desktop.waitForFunction(() => window.__lw.breathState() === 'inhale');
  await desktop.waitForTimeout(1100);
  await desktop.keyboard.up('Space');
  await desktop.keyboard.down('Shift');
  await desktop.waitForFunction(() => window.__lw.breathState() === 'exhale');
  await desktop.waitForTimeout(1100);
  await desktop.keyboard.up('Shift');
  await desktop.waitForFunction(() => window.__lw.breathState() === 'idle');
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
  await touch.waitForFunction(() => document.querySelector('.hand-button')?.classList.contains('thought-choice-pop')
    && [...document.querySelectorAll('.breath-button')].some((el) => el.getBoundingClientRect().width > 0 && el.classList.contains('thought-choice-pop')));
  check(await touch.locator('.breath-button:visible').count() === 1, 'touch Breathe control is not visible beside the hand action');
  check(await touch.locator('.hand-button').getAttribute('aria-label') === 'Push away', 'touch action label is missing');
  check((await touch.locator('.hand-button .control-hint').textContent()) === 'Tap', 'touch action cue is missing');
  const fitsTouchAction = async () => touch.locator('.hand-button').evaluate((button) => {
    const r = button.getBoundingClientRect();
    const children = [...button.querySelectorAll('svg, .control-label, .control-hint')].map((el) => el.getBoundingClientRect());
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
      && children.every((q) => q.left >= r.left && q.right <= r.right && q.top >= r.top && q.bottom <= r.bottom);
  });
  const fitsTouchBreath = async () => touch.locator('.breath-button:visible').evaluate((button) => {
    const r = button.getBoundingClientRect();
    const children = [...button.querySelectorAll('svg, .control-label, .control-hint')].map((el) => el.getBoundingClientRect());
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
      && children.every((q) => q.left >= r.left && q.right <= r.right && q.top >= r.top && q.bottom <= r.bottom);
  });
  check(await fitsTouchAction(), 'portrait touch action clips or its cue text escapes the button');
  check(await fitsTouchBreath(), 'portrait touch breathing cue clips or its instruction escapes the button');
  check(await touch.locator('.hand-button').evaluate((el) => el.classList.contains('thought-choice-active')), 'reduced-motion touch highlight is missing');
  const touchPairFits = async () => touch.evaluate(() => {
    const hand = document.querySelector('.hand-button')?.getBoundingClientRect();
    const breath = [...document.querySelectorAll('.breath-button')].find((el) => el.getBoundingClientRect().width > 0)?.getBoundingClientRect();
    const look = document.querySelector('.look-button')?.getBoundingClientRect();
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return !!hand && !!breath && !!look && hand.left >= 0 && breath.right <= innerWidth && hand.right < breath.left
      && !overlaps(hand, look) && !overlaps(breath, look);
  });
  check(await touchPairFits(), 'portrait touch choices overlap each other or Q, or leave the viewport');
  await touch.screenshot({ path: `${outDir}/touch-portrait.png` });
  await touch.setViewportSize({ width: 915, height: 412 });
  check(await fitsTouchAction(), 'landscape touch action clips or its cue text escapes the button');
  check(await fitsTouchBreath(), 'landscape touch breathing cue clips or its instruction escapes the button');
  check(await touch.locator('.hand-button').evaluate((el) => el.classList.contains('thought-choice-active')), 'landscape touch highlight is missing');
  check(await touchPairFits(), 'landscape touch choices overlap each other or Q, or leave the viewport');
  await touch.screenshot({ path: `${outDir}/touch-landscape.png` });
  const beforeTouch = await touch.evaluate(() => window.__lw.pushLevel());
  const breathControl = touch.locator('.breath-button:visible');
  await breathControl.hover();
  await touch.mouse.down();
  await touch.waitForFunction(() => window.__lw.breathState() === 'inhale');
  await touch.waitForTimeout(350);
  await touch.mouse.up();
  await touch.waitForFunction(() => window.__lw.breathState() === 'exhale');
  await touch.waitForTimeout(1100);
  await touch.waitForFunction(() => window.__lw.breathState() === 'idle');
  await touch.locator('.hand-button').click();
  await touch.waitForFunction((n) => window.__lw.pushLevel() > n, beforeTouch);
  await touch.waitForFunction(() => window.__lw.pushCueToken() === '' && document.querySelector('.hand-button')?.getAttribute('aria-disabled') === 'true');
  check((await touch.locator('.hand-button .control-hint').textContent()) === '', 'inactive touch action still advertises Tap');
  check(!errors.length, `browser errors: ${errors.join(' | ')}`);
  console.log(`action-cues: PASS; no cue without a thought, desktop outer/inner E cues, touch tap label/action in portrait/landscape, errors=0; screenshots=${outDir}`);
} finally {
  await browser.close();
}
