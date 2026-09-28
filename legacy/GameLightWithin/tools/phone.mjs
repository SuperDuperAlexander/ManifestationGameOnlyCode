import { chromium, devices } from '@playwright/test';
const cases = [
  { name: 'pixel7', vp: { width: 390, height: 844 }, dpr: 2.625 },
  { name: 'narrow', vp: { width: 360, height: 640 }, dpr: 3 },
];
const browser = await chromium.launch();
for (const c of cases) {
  const ctx = await browser.newContext({
    viewport: c.vp, deviceScaleFactor: c.dpr, isMobile: true, hasTouch: true,
    userAgent: devices['Pixel 7'].userAgent,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('http://127.0.0.1:4173/?chapter=2&scene=3&debug=1&quality=low');
  await page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 40000 });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `screenshots/phone-${c.name}.png` });
  const box = await page.evaluate(() => {
    const q = (s) => { const e = document.querySelector(s); if (!e) return null;
      const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    return { joy: q('.lw-joystick'), inBtn: q('.lw-touch-left'), outBtn: q('.lw-touch-right'),
      actions: q('.lw-touch-actions'), canvas: q('#scene'), win: { w: innerWidth, h: innerHeight } };
  });
  console.log(c.name, JSON.stringify(box));
  console.log(c.name, errs.length ? errs.join(' | ') : 'no errors');
  await ctx.close();
}
await browser.close();
