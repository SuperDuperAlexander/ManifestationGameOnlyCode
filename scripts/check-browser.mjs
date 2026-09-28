// Opens the running game in a real browser, collects console errors and debug stats,
// runs an optional scenario and saves screenshots.
// Usage: node scripts/check-browser.mjs [url] [--out dir] [--scenario name] [--params skipintro|autostart] [--mobile] [--headed]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const url = args.find((a) => a.startsWith('http')) ?? `http://localhost:5173/?debug&${flag('--params', 'skipintro')}`;
const outDir = flag('--out', 'screenshots');
const scenario = flag('--scenario', 'walk');
const mobile = args.includes('--mobile');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: !args.includes('--headed'),
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext(
  mobile
    ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: Number(flag('--dpr', '1')) },
);
const page = await context.newPage();
const problems = [];
const logs = [];
page.on('console', (msg) => {
  const line = `[${msg.type()}] ${msg.text()}`;
  logs.push(line);
  if (msg.type() === 'error' || msg.type() === 'warning') problems.push(line);
});
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));
page.on('requestfailed', (req) => problems.push(`[requestfailed] ${req.url()}`));

const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => {
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log(`screenshot: ${join(outDir, name)}.png`);
};
const stats = () => page.evaluate(() => window.__lw?.stats?.());
const hold = async (key, ms) => {
  await page.keyboard.down(key);
  await wait(ms);
  await page.keyboard.up(key);
};
const game = (fn, arg) => page.evaluate(fn, arg);

await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__lw?.ready === true, null, { timeout: 30000 });
await wait(2500);

const scenarios = {
  async walk() {
    await shot('01-start');
    await hold('KeyW', 1800);
    await shot('02-walk-north');
    await hold('KeyD', 1200);
    await hold('KeyS', 800);
    await shot('03-walk-east-south');
  },
};

// Extra scenarios live in scripts/scenarios.mjs when present.
try {
  const extra = await import('./scenarios.mjs');
  Object.assign(scenarios, extra.default({ page, wait, shot, stats, hold, game }));
} catch (err) {
  if (!String(err).includes('Cannot find module') && !String(err).includes('ERR_MODULE_NOT_FOUND')) throw err;
}

const run = scenarios[scenario];
if (!run) {
  console.error(`unknown scenario "${scenario}". Known: ${Object.keys(scenarios).join(', ')}`);
  process.exitCode = 1;
} else {
  await run();
}

const s = await stats();
console.log('stats:', JSON.stringify(s));
const gl = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl2');
  const ext = c?.getExtension('WEBGL_debug_renderer_info');
  return ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('renderer:', gl);
console.log(`console problems: ${problems.length}`);
for (const p of problems) console.log('  ' + p);
await browser.close();
if (problems.some((p) => p.startsWith('[error]') || p.startsWith('[pageerror]'))) process.exitCode = 2;
