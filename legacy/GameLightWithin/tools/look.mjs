import { chromium } from '@playwright/test';
const scenes = process.argv[2] ? process.argv[2].split(',') : ['1'];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
for (const s of scenes) {
  await page.goto(`http://127.0.0.1:4173/?chapter=2&scene=${s}&debug=1&quality=low&nopaint=0`);
  await page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 30000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `screenshots/c2-look-scene${s}.png` });
  const snap = await page.evaluate(() => window.__lw?.snapshot?.());
  console.log('scene', s, JSON.stringify(snap));
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
