import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

// Control spotlight + callout at the later story beats, desktop and touch portrait.
// Usage: node scripts/check-spotlight-beats.mjs [url]   (dev server must be running)
const url = process.argv[2] ?? 'http://localhost:5173/?debug';
const outDir = 'screenshots/action-cues';
mkdirSync(outDir, { recursive: true });
const en = JSON.parse(readFileSync('public/data/dialogue/en.json', 'utf8'));
const text = (k) => { const v = en[k]; return typeof v === 'string' ? v : v?.text ?? v?.line ?? JSON.stringify(v); };

const SAVE = 'lw.lantern.save.v1';
const base = { bumped: true, sawImp: true };
// setup: save + how to reach the beat once the game is running.
const BEATS = {
  firstInside: { save: { beat: 1, flags: {} }, text: 'spotLook', target: 'look' },
  angry: { save: { beat: 3, flags: { bumped: true } }, text: 'spotLook', target: 'look' },
  apples: { save: { beat: 3, flags: { ...base } }, text: 'spotApples', target: 'hand', setup: async (p) => {
    const a = await p.evaluate(() => window.__lw.alleyApplePositions());
    await p.evaluate((q) => window.__lw.teleport(q.x, q.z), a[0]);
  } },
  inside: { save: { beat: 6, flags: { ...base, helped: true } }, text: 'spotLook', target: 'look' },
  return: { save: { beat: 2, flags: {} }, text: 'spotGoOut', target: 'look', setup: async (p) => { await toInner(p); } },
  impApproach: { save: { beat: 7, flags: { ...base, helped: true } }, text: 'spotImp', target: 'breathe', setup: async (p) => {
    await toInner(p);
    const i = await p.evaluate(() => window.__lw.impPos());
    await p.evaluate((q) => window.__lw.teleport(q.x + 2, q.z - 17), i);
  } },
  imp: { save: { beat: 7, flags: { ...base, helped: true } }, text: 'spotImp', target: 'breathe', setup: async (p) => {
    await toInner(p);
    const i = await p.evaluate(() => window.__lw.impPos());
    await p.evaluate((q) => window.__lw.teleport(q.x + 2, q.z - 7), i);
  } },
  tree: { save: { beat: 8, flags: { ...base, helped: true, impCalm: true, lanternRelit: true } }, text: 'spotTree', target: 'hand', setup: async (p, device) => {
    // Desktop shows the E control only near the tree; touch always shows the hand button.
    if (device === 'desktop') await p.evaluate(() => { const t = window.__lw.oldTreeNiche(); window.__lw.teleport(t.x, t.z); });
  } },
};
const SEL = {
  desktop: { look: '.look-action', hand: '.push-action', breathe: '.breathe-action' },
  touch: { look: '.look-button', hand: '.hand-button', breathe: '.breath-button' },
};

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
const results = [];
async function toInner(p) {
  await p.evaluate(() => window.__lw.toggle());
  await p.waitForFunction(() => window.__lw.world() === 'inner' && !window.__lw.transitioning(), null, { timeout: 10000 });
}

/** Runs in the page: returns a snapshot the first frame the callout is shown with a lit control. */
const snapshotFn = (expectedSel) => {
  const c = document.querySelector('.control-callout.show');
  const lit = [...document.querySelectorAll('.spotlit')];
  if (!c || !lit.length) return null;
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'; };
  const cr = c.getBoundingClientRect();
  const lr = lit[0].getBoundingClientRect();
  return {
    litCount: lit.length,
    litMatches: lit[0].matches(expectedSel),
    litVisible: vis(lit[0]),
    calloutText: c.querySelector('.control-callout-text')?.textContent ?? '',
    inside: cr.left >= 16 - 0.5 && cr.top >= 16 - 0.5 && cr.right <= innerWidth - 16 + 0.5 && cr.bottom <= innerHeight - 16 + 0.5,
    overlap: cr.left < lr.right && cr.right > lr.left && cr.top < lr.bottom && cr.bottom > lr.top,
    cr: [cr.left, cr.top, cr.right, cr.bottom].map(Math.round), lr: [lr.left, lr.top, lr.right, lr.bottom].map(Math.round),
    vw: innerWidth, vh: innerHeight,
  };
};

async function run(device, name, beat) {
  const touch = device === 'touch';
  const ctx = await browser.newContext(touch
    ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [SAVE, beat.save]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const label = `${device}-${name}`;
  try {
    await page.goto(touch ? `${url}${url.includes('?') ? '&' : '?'}touch` : url, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__lw);
    await page.locator('.ss-continue').click();
    await page.waitForFunction(() => !document.querySelector('.start-screen'));
    if (beat.setup) await beat.setup(page, device);
    const sel = SEL[device][beat.target];
    const handle = await page.waitForFunction(`(${snapshotFn.toString()})(${JSON.stringify(sel)})`, null, { timeout: 25000, polling: 100 });
    const snap = await handle.jsonValue();
    await page.screenshot({ path: `${outDir}/${device === 'touch' ? 'touch-portrait' : 'desktop'}-spotlight-${name}.png` });
    const fails = [];
    if (snap.litCount !== 1) fails.push(`spotlit count ${snap.litCount}`);
    if (!snap.litMatches) fails.push(`lit control is not ${sel}`);
    if (!snap.litVisible) fails.push('lit control not visible');
    if (snap.calloutText !== text(beat.text)) fails.push(`text "${snap.calloutText}" != "${text(beat.text)}"`);
    if (!snap.inside) fails.push(`callout outside 16px viewport ${JSON.stringify(snap.cr)} in ${snap.vw}x${snap.vh}`);
    if (snap.overlap) fails.push(`callout overlaps lit button ${JSON.stringify(snap.cr)} vs ${JSON.stringify(snap.lr)}`);
    if (errs.length) fails.push(`console errors: ${errs.join(' | ')}`);
    results.push({ label, ok: !fails.length, detail: fails.join('; ') });
  } catch (e) {
    await page.screenshot({ path: `${outDir}/${device === 'touch' ? 'touch-portrait' : 'desktop'}-spotlight-${name}-FAIL.png` }).catch(() => {});
    const st = await page.evaluate(() => ({ flags: window.__lw.flags(), world: window.__lw.world(), line: window.__lw.line(), callout: document.querySelector('.control-callout')?.className })).catch(() => null);
    results.push({ label, ok: false, detail: `${e.message.split('\n')[0]} state=${JSON.stringify(st)} errs=${errs.join(' | ')}` });
  }
  await ctx.close();
}

try {
  for (const device of ['desktop', 'touch']) {
    for (const [name, beat] of Object.entries(BEATS)) await run(device, name, beat);
  }
} finally {
  await browser.close();
}
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.label}${r.detail ? ' - ' + r.detail : ''}`);
if (results.some((r) => !r.ok)) process.exit(1);
console.log(`spotlight-beats: PASS; screenshots=${outDir}`);
