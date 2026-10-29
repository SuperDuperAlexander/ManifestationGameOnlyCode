import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/?debug';
const outDir = 'screenshots/touch-gestures';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
const check = (ok, message) => { if (!ok) throw new Error(message); };

try {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${url}${url.includes('?') ? '&' : '?'}touch`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__lw);
  await page.locator('.ss-begin').click();
  await page.locator('.start-screen').waitFor({ state: 'detached', timeout: 5000 });
  await page.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y })) });
  const state = () => page.evaluate(() => ({ cam: window.__lw.cameraState(), pos: window.__lw.playerPos() }));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const settle = () => page.waitForTimeout(500);

  // (1) Quick swipe turns the camera, the player stays.
  let s0 = await state();
  await touch('touchStart', [[1, 120, 400]]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[1, 120 + i * 20, 400]]); await page.waitForTimeout(12); }
  await touch('touchEnd', []);
  await settle();
  let s1 = await state();
  const dYaw = Math.abs(s1.cam.yaw - s0.cam.yaw);
  check(dYaw > 0.2, `swipe did not turn the camera (dYaw=${dYaw.toFixed(3)})`);
  check(dist(s0.pos, s1.pos) < 0.3, `swipe moved the player (${dist(s0.pos, s1.pos).toFixed(2)} m)`);
  await page.screenshot({ path: `${outDir}/1-swipe-look.png` });

  // (2) Hold 300 ms, then drag: the player walks.
  s0 = await state();
  await touch('touchStart', [[1, 200, 700]]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/2-hold-joystick.png` });
  for (let i = 1; i <= 15; i++) { await touch('touchMove', [[1, 200, 700 - i * 4]]); await page.waitForTimeout(60); }
  await page.waitForTimeout(500);
  await touch('touchEnd', []);
  s1 = await state();
  check(dist(s0.pos, s1.pos) > 0.8, `hold+drag did not walk (${dist(s0.pos, s1.pos).toFixed(2)} m)`);
  check(Math.abs(s1.cam.yaw - s0.cam.yaw) < 0.2, 'hold+drag turned the camera too much');
  await settle();

  // (3) Walk finger + second finger swipe: both work.
  s0 = await state();
  await touch('touchStart', [[1, 120, 750]]);
  await page.waitForTimeout(300);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', [[1, 120, 750 - i * 8]]); await page.waitForTimeout(40); }
  await touch('touchStart', [[1, 120, 710], [2, 300, 300]]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[1, 120, 710 - i * 3], [2, 300 - i * 20, 300]]); await page.waitForTimeout(60); }
  await page.screenshot({ path: `${outDir}/3-walk-and-look.png` });
  await page.waitForTimeout(500);
  await touch('touchEnd', []);
  s1 = await state();
  check(dist(s0.pos, s1.pos) > 0.8, `walk + look: player did not move (${dist(s0.pos, s1.pos).toFixed(2)} m)`);
  check(Math.abs(s1.cam.yaw - s0.cam.yaw) > 0.2, 'walk + look: camera did not turn');
  await settle();

  // (4) Pinch changes the camera distance.
  s0 = await state();
  await touch('touchStart', [[1, 150, 450], [2, 260, 450]]);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[1, 150 - i * 10, 450], [2, 260 + i * 10, 450]]); await page.waitForTimeout(25); }
  await touch('touchEnd', []);
  await page.waitForTimeout(1500);
  s1 = await state();
  check(s0.cam.dist - s1.cam.dist > 0.5, `pinch out did not zoom in (${s0.cam.dist.toFixed(2)} -> ${s1.cam.dist.toFixed(2)})`);
  await page.screenshot({ path: `${outDir}/4-pinch.png` });
  const s2 = s1;
  await touch('touchStart', [[1, 40, 450], [2, 370, 450]]);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[1, 40 + i * 12, 450], [2, 370 - i * 12, 450]]); await page.waitForTimeout(25); }
  await touch('touchEnd', []);
  await page.waitForTimeout(2000);
  s1 = await state();
  check(s1.cam.dist - s2.cam.dist > 0.5, `pinch in did not zoom out (${s2.cam.dist.toFixed(2)} -> ${s1.cam.dist.toFixed(2)})`);

  check(!errors.length, `browser errors: ${errors.join(' | ')}`);
  console.log(`touch-gestures: PASS; swipe dYaw=${dYaw.toFixed(2)}, errors=0; screenshots=${outDir}`);
} finally {
  await browser.close();
}
