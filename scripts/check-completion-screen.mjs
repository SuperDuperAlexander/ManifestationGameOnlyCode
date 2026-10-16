import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/?debug';
const outDir = 'screenshots/completion-screen';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
const check = (ok, message) => { if (!ok) throw new Error(message); };
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.addInitScript(() => localStorage.setItem('lw.lantern.save.v1', JSON.stringify({
  beat: 9,
  flags: { bumped: true, sawImp: true, helped: true, impCalm: true, lanternRelit: true, delivered: true },
})));
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__lw);
  await page.getByRole('button', { name: 'Continue' }).click();
  const card = page.locator('.end-card');
  await card.waitFor({ state: 'visible' });
  await page.getByRole('heading', { name: 'The Lantern' }).waitFor();
  check(await page.locator('.ec-status').textContent() === 'Chapter complete', 'completion status is missing');
  check(await page.locator('.ec-line').textContent() === 'I carried my fire home.', 'existing completion line changed');
  check(await page.getByRole('button', { name: 'Stay a while' }).isVisible(), 'continue exploring button is missing');
  const before = await page.evaluate(() => window.__lw.playerPos());
  await page.screenshot({ path: `${outDir}/desktop.png` });
  await page.keyboard.press('Tab');
  check(await page.evaluate(() => document.activeElement?.classList.contains('ec-continue')), 'Tab escaped the completion dialog');
  await page.keyboard.down('w');
  await page.waitForTimeout(350);
  await page.keyboard.up('w');
  const pausedAt = await page.evaluate(() => window.__lw.playerPos());
  check(Math.hypot(pausedAt.x - before.x, pausedAt.z - before.z) < 0.02, 'player moved behind the open completion screen');

  const fits = async () => page.locator('.ec-panel').evaluate((panel) => {
    const r = panel.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  check(await fits(), 'completion screen does not fit a portrait phone viewport');
  await page.screenshot({ path: `${outDir}/phone-portrait.png` });
  await page.setViewportSize({ width: 844, height: 390 });
  check(await fits(), 'completion screen does not fit a landscape phone viewport');
  await page.screenshot({ path: `${outDir}/phone-landscape.png` });
  await page.getByRole('button', { name: 'Stay a while' }).click();
  await card.waitFor({ state: 'hidden' });
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  const after = await page.evaluate(() => window.__lw.playerPos());
  check(Math.hypot(after.x - pausedAt.x, after.z - pausedAt.z) > 0.08, 'walking did not resume after dismissal');
  await page.keyboard.press('q');
  await page.waitForFunction(() => window.__lw.world() === 'inner' && !window.__lw.transitioning());
  await page.keyboard.press('q');
  await page.waitForFunction(() => window.__lw.world() === 'outer' && !window.__lw.transitioning());

  const escapeContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await escapeContext.addInitScript(() => localStorage.setItem('lw.lantern.save.v1', JSON.stringify({
    beat: 9,
    flags: { bumped: true, sawImp: true, helped: true, impCalm: true, lanternRelit: true, delivered: true },
  })));
  const escapePage = await escapeContext.newPage();
  escapePage.on('pageerror', (error) => errors.push(error.message));
  await escapePage.goto(url, { waitUntil: 'load' });
  await escapePage.getByRole('button', { name: 'Continue' }).click();
  await escapePage.locator('.end-card.show').waitFor();
  await escapePage.keyboard.press('Escape');
  await escapePage.locator('.end-card.show').waitFor({ state: 'hidden' });
  check(await escapePage.locator('.menu-dialog[open]').count() === 0, 'Escape opened the pause menu behind the completion screen');
  await escapeContext.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await touchContext.addInitScript(() => localStorage.setItem('lw.lantern.save.v1', JSON.stringify({
    beat: 9,
    flags: { bumped: true, sawImp: true, helped: true, impCalm: true, lanternRelit: true, delivered: true },
  })));
  const touchPage = await touchContext.newPage();
  touchPage.on('pageerror', (error) => errors.push(error.message));
  await touchPage.goto(`${url}${url.includes('?') ? '&' : '?'}touch`, { waitUntil: 'load' });
  await touchPage.getByRole('button', { name: 'Continue' }).click();
  await touchPage.locator('.end-card.show').waitFor();
  check(await touchPage.locator('body.touch').count() === 1, 'touch controls did not activate in the mobile context');
  check(await touchPage.locator('.touch-zone').evaluateAll((els) => els.every((el) => getComputedStyle(el).visibility === 'hidden')), 'touch zones remained visible through the modal');
  await touchPage.screenshot({ path: `${outDir}/touch-portrait.png` });
  await touchPage.setViewportSize({ width: 844, height: 390 });
  check(await touchPage.locator('.ec-panel').evaluate((panel) => {
    const r = panel.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  }), 'completion screen does not fit the true touch landscape viewport');
  await touchPage.screenshot({ path: `${outDir}/touch-landscape.png` });
  await touchPage.getByRole('button', { name: 'Stay a while' }).tap();
  await touchPage.locator('.end-card.show').waitFor({ state: 'hidden' });
  await touchContext.close();
  check(errors.length === 0, `browser errors: ${errors.join(' | ')}`);
  console.log(`PASS: completion card, pause, responsive desktop/touch fit, keyboard dismissal, real click/tap, walking and Q exploration. Screenshots: ${outDir}`);
} finally {
  await browser.close();
}
