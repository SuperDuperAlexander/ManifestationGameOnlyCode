import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import fs from 'node:fs';

/**
 * Side by side, against a build of the version this one replaced.
 *
 * A migration is only honest if the picture and the frame rate can be put
 * next to the old ones. This opens the same address on two servers, waits
 * for both to settle, and reports the average brightness of a few regions
 * and the real frame rate of each.
 */
const GL = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-dev-shm-usage',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
];

const REGIONS = {
  all: [0, 0, 900, 560],
  ground: [60, 380, 840, 540],
  mid: [60, 200, 840, 340],
  trees: [0, 0, 260, 140],
  sky: [300, 0, 600, 60],
};

function stats(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const out = {};
  for (const [name, [x0, y0, x1, y1]] of Object.entries(REGIONS)) {
    let sum = 0;
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * png.width + x) * 4;
        sum += 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
        n++;
      }
    }
    out[name] = +(sum / n / 255).toFixed(3);
  }
  return out;
}

async function look(url, out, settle) {
  const browser = await chromium.launch({ args: GL });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForTimeout(settle);
  await page.screenshot({ path: out, timeout: 120000 });
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - t0 >= 10000) resolve(n / 10);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  await browser.close();
  return { fps: +frames.toFixed(2), errors, ...stats(out) };
}

/**
 * Usage:
 *   node tools/ab.mjs '?scene=3&quality=high' [settleMs] [thisUrl] [otherUrl]
 *
 * With one server it reports that one. With two it reports both, which is
 * how the Babylon port was checked against the Three.js version it replaced:
 * build the old revision in a git worktree, serve it on another port, and
 * read the two lines next to each other.
 */
const [, , query, settle = '9000', here = 'http://127.0.0.1:4173', there] = process.argv;
console.log(query);
console.log(
  ' this ',
  JSON.stringify(await look(`${here}/${query}`, 'screenshots/_ab-this.png', +settle)),
);
if (there) {
  console.log(
    ' other',
    JSON.stringify(await look(`${there}/${query}`, 'screenshots/_ab-other.png', +settle)),
  );
}
