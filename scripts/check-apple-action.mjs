import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/?debug';
const outDir = 'screenshots/apple-action';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
const seedSave = () => localStorage.setItem('lw.lantern.save.v1', JSON.stringify({ beat: 6, flags: { bumped: true, sawImp: true } }));
const check = (ok, message) => { if (!ok) throw new Error(message); };
const waitForAction = (page, action) => page.waitForFunction((a) => window.__lw.interactionContext() === a, action, { timeout: 5000 });
const label = (page) => page.locator('.push-action .action-label').textContent();
const waitForLabel = (page, selector, text) => page.waitForFunction(({ s, t }) => document.querySelector(`${s} .action-label, ${s} .control-label`)?.textContent === t, { s: selector, t: text }, { timeout: 5000 });
const assertFits = async (page, selector) => {
  const rect = await page.locator(selector).boundingBox();
  const viewport = page.viewportSize();
  check(rect && viewport && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width && rect.y + rect.height <= viewport.height, `${selector} clips outside the viewport: ${JSON.stringify(rect)}`);
};
const assertLabelFits = async (page, selector) => {
  const fits = await page.locator(selector).evaluate((button) => {
    const label = button.querySelector('.action-label, .control-label');
    if (!label) return false;
    const outer = button.getBoundingClientRect();
    const text = label.getBoundingClientRect();
    return text.left >= outer.left && text.right <= outer.right;
  });
  check(fits, `${selector} label clips outside its action button`);
};

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(seedSave);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__lw);
  await page.locator('.ss-continue').click();
  await page.waitForFunction(() => !document.querySelector('.start-screen'));
  if (await page.evaluate(() => window.__lw.world()) !== 'outer') {
    await page.evaluate(() => window.__lw.toggle());
  }
  await page.waitForFunction(() => window.__lw.world() === 'outer' && !window.__lw.transitioning());

  const apples = await page.evaluate(() => window.__lw.alleyApplePositions());
  const teleport = async (p) => page.evaluate((q) => window.__lw.teleport(q.x, q.z), p);
  await teleport(apples[0]);
  await waitForAction(page, 'collectApple');
  await page.waitForFunction(() => document.querySelector('.push-action .action-label')?.textContent === 'Collect apple');
  check((await label(page)) === 'Collect apple', 'desktop action label is not Collect apple');
  check(await page.locator('.push-action .control-icon-collect').count() === 1, 'desktop apple icon is missing');
  await assertFits(page, '.push-action');
  await assertLabelFits(page, '.push-action');
  await page.screenshot({ path: `${outDir}/desktop-collect.png` });
  const beforeClick = await page.evaluate(() => window.__lw.applesLeft());
  await page.locator('.push-action').click();
  await page.waitForFunction((n) => window.__lw.applesLeft() === n - 1, beforeClick);
  await waitForAction(page, 'push');
  await waitForLabel(page, '.push-action', 'Push away');
  check((await label(page)) === 'Push away', 'action context did not recalculate after pickup');

  await teleport({ x: -26, z: 54 });
  await waitForAction(page, 'push');
  await page.waitForFunction(() => document.querySelector('.push-action .action-label')?.textContent === 'Push away');
  check((await label(page)) === 'Push away', 'push label did not return outside pickup range');
  const beforeKey = await page.evaluate(() => window.__lw.applesLeft());
  await teleport(apples[1]);
  await waitForAction(page, 'collectApple');
  await page.keyboard.press('KeyE');
  await page.waitForFunction((n) => window.__lw.applesLeft() === n - 1, beforeKey);
  await waitForAction(page, 'push');
  await waitForLabel(page, '.push-action', 'Push away');
  check((await label(page)) === 'Push away', 'apple action did not reset after E pickup outside another apple range');
  await teleport(apples[2]);
  await waitForAction(page, 'collectApple');
  await page.evaluate(() => window.__lw.toggle());
  await page.waitForFunction(() => window.__lw.world() === 'inner' && !window.__lw.transitioning());
  await page.waitForFunction(() => window.__lw.interactionContext() === 'push');
  await waitForLabel(page, '.push-action', 'Push away');
  await page.evaluate(() => window.__lw.toggle());
  await page.waitForFunction(() => window.__lw.world() === 'outer' && !window.__lw.transitioning());
  await waitForAction(page, 'collectApple');
  await waitForLabel(page, '.push-action', 'Collect apple');
  await teleport(await page.evaluate(() => window.__lw.oldTreeNiche()));
  await waitForAction(page, 'interact');
  await page.waitForFunction(() => document.querySelector('.push-action .action-label')?.textContent === 'Interact');
  check((await label(page)) === 'Interact', 'tree interaction still displays apple action');
  await page.screenshot({ path: `${outDir}/desktop-tree-interact.png` });

  const touchContext = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await touchContext.addInitScript(seedSave);
  const touchPage = await touchContext.newPage();
  touchPage.on('pageerror', (e) => errors.push(e.message));
  touchPage.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await touchPage.goto(`${url}${url.includes('?') ? '&' : '?'}touch`, { waitUntil: 'load' });
  await touchPage.waitForFunction(() => !!window.__lw);
  await touchPage.locator('.ss-continue').click();
  await touchPage.locator('.start-screen').waitFor({ state: 'detached', timeout: 5000 });
  const touchApples = await touchPage.evaluate(() => window.__lw.alleyApplePositions());
  await touchPage.evaluate((p) => window.__lw.teleport(p.x, p.z), touchApples[2]);
  await waitForAction(touchPage, 'collectApple');
  const hand = touchPage.locator('.hand-button.collect');
  await hand.waitFor();
  check((await touchPage.locator('.hand-button .control-label').textContent()) === 'Collect apple', 'touch action label is not Collect apple');
  check(await touchPage.locator('.hand-button .control-icon-collect').count() === 1, 'touch apple icon is missing');
  await assertFits(touchPage, '.hand-button');
  await assertLabelFits(touchPage, '.hand-button');
  await touchPage.screenshot({ path: `${outDir}/touch-collect.png` });
  const beforeTouch = await touchPage.evaluate(() => window.__lw.applesLeft());
  await hand.click();
  await touchPage.waitForFunction((n) => window.__lw.applesLeft() === n - 1, beforeTouch);
  await waitForAction(touchPage, 'push');
  await waitForLabel(touchPage, '.hand-button', 'Push away');
  check((await touchPage.locator('.hand-button .control-label').textContent()) === 'Push away', 'touch label did not reset after pickup');

  await touchPage.setViewportSize({ width: 915, height: 412 });
  await touchPage.evaluate((p) => window.__lw.teleport(p.x, p.z), touchApples[3]);
  await waitForAction(touchPage, 'collectApple');
  await waitForLabel(touchPage, '.hand-button', 'Collect apple');
  const landscapeHand = touchPage.locator('.hand-button.collect');
  await landscapeHand.waitFor();
  await assertFits(touchPage, '.hand-button');
  await assertLabelFits(touchPage, '.hand-button');
  await touchPage.screenshot({ path: `${outDir}/touch-landscape-collect.png` });
  let remaining = await touchPage.evaluate(() => window.__lw.applesLeft());
  await landscapeHand.click();
  await touchPage.waitForFunction((n) => window.__lw.applesLeft() === n - 1, remaining);

  for (const apple of [touchApples[4], touchApples[0], touchApples[1]]) {
    await touchPage.evaluate((p) => window.__lw.teleport(p.x, p.z), apple);
    await waitForAction(touchPage, 'collectApple');
    remaining = await touchPage.evaluate(() => window.__lw.applesLeft());
    await touchPage.locator('.hand-button.collect').click();
    await touchPage.waitForFunction((n) => window.__lw.applesLeft() === n - 1, remaining);
  }
  await touchPage.waitForFunction(() => window.__lw.flags().helped);
  await waitForAction(touchPage, 'push');
  await waitForLabel(touchPage, '.hand-button', 'Push away');
  check((await touchPage.locator('.hand-button .control-label').textContent()) === 'Push away', 'final pickup did not restore the push label');

  check(!errors.length, `browser errors: ${errors.join(' | ')}`);
  console.log(`apple-action: PASS; desktop click and E, touch portrait/landscape and final pickup; console errors=0; screenshots=${outDir}`);
} finally {
  await browser.close();
}
