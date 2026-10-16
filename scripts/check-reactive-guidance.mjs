import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5173/?debug';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const wait = (ms) => page.waitForTimeout(ms);
const line = () => page.evaluate(() => window.__lw.line());
const visibleLine = () => page.locator('.dialogue-line.show .dl-text').textContent().catch(() => '');
const monitorVisible = (ms) => page.evaluate(async (duration) => {
  const seen = [];
  const end = performance.now() + duration;
  while (performance.now() < end) {
    const el = document.querySelector('.dialogue-line.show .dl-text');
    const text = el?.textContent?.trim();
    if (text && seen.at(-1) !== text) seen.push(text);
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return seen;
}, ms);
const check = (condition, message) => { if (!condition) throw new Error(message); };

try {
  await page.addInitScript(() => localStorage.setItem('light-within-breath-preferences', JSON.stringify({ inhaleSeconds: 1, exhaleSeconds: 1 })));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__lw);
  await page.evaluate(() => window.__lw.clearSave());
  await page.locator('.ss-begin').waitFor();
  await page.locator('.ss-begin').click();
  await wait(400);
  const movementLines = monitorVisible(5200);
  await page.keyboard.down('KeyW');
  await wait(700);
  await page.keyboard.up('KeyW');
  const moveLines = await movementLines;
  const moveHint = 'Use W A S D to walk. Drag to look around.';
  check(!moveLines.includes(moveHint), `stale movement hint appeared after walking: ${moveLines.join(' | ')}`);

  await page.keyboard.down('Space');
  await wait(60);
  const breathLines = monitorVisible(5350);
  await page.waitForFunction(() => window.__lw.breathState() === 'inhale', null, { timeout: 3000 });
  await wait(1300);
  await page.keyboard.up('Space');
  await page.keyboard.down('Shift');
  await page.waitForFunction(() => window.__lw.breathState() === 'exhale', null, { timeout: 3000 });
  await wait(1300);
  await page.keyboard.up('Shift');
  const seenBreathLines = await breathLines;
  const breathHint = 'Hold Space to breathe in. Hold Shift to breathe out.';
  check(!seenBreathLines.includes(breathHint), `breath hint resurfaced after breathing began: ${seenBreathLines.join(' | ')}`);
  await page.waitForFunction(() => window.__lw.breathState() === 'idle', null, { timeout: 1500 });
  await page.waitForFunction(() => {
    const el = document.querySelector('.dialogue-line.show .dl-text');
    return el?.textContent === 'Calm. I am here.';
  }, null, { timeout: 3000 });

  await page.evaluate(() => window.__lw.teleport(0, 34.5));
  await page.waitForFunction(() => window.__lw.beat() >= 1, null, { timeout: 3000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('.dialogue-line.show .dl-text');
    return el?.textContent === 'There is a whole world inside me. Press Q to look within.';
  }, null, { timeout: 1000 });
  const squareLine = await visibleLine();
  check(squareLine === 'There is a whole world inside me. Press Q to look within.', `wrong square prompt: ${squareLine}`);
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.__lw.world() === 'inner' && !window.__lw.transitioning(), null, { timeout: 5000 });
  check(await line() === 'This is my inner valley. The big tree is mine too.', 'first inner visit prompt did not replace stale opening text');
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.__lw.world() === 'outer' && !window.__lw.transitioning(), null, { timeout: 5000 });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__lw);
  await page.locator('.ss-continue').waitFor();
  await page.locator('.ss-continue').click();
  await wait(350);
  const before = await page.evaluate(() => window.__lw.line());
  await page.evaluate(() => window.__lw.debugBreath());
  await wait(200);
  const after = await page.evaluate(() => window.__lw.line());
  check(after !== moveHint, 'Continue surfaced an obsolete movement hint');
  await page.evaluate(() => window.__lw.clearSave());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__lw);
  await page.locator('.ss-begin').waitFor();
  await page.locator('.ss-begin').click();
  await page.evaluate(() => window.__lw.teleport(0, 41));
  await page.waitForFunction(() => window.__lw.beat() >= 1, null, { timeout: 3000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('.dialogue-line.show .dl-text');
    return el?.textContent === 'There is a whole world inside me. Press Q to look within.';
  }, null, { timeout: 1000 });
  const earlySquareLine = await visibleLine();
  check(earlySquareLine === 'There is a whole world inside me. Press Q to look within.', `early square arrival showed ${earlySquareLine}`);
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.__lw.world() === 'inner' && !window.__lw.transitioning(), null, { timeout: 5000 });
  check(!errors.length, `browser errors: ${errors.join(' | ')}`);
  console.log(`reactive-guidance: PASS; square="${squareLine}"; Continue prior="${before}" after breath="${after}"; console errors=0`);
} finally {
  await browser.close();
}
