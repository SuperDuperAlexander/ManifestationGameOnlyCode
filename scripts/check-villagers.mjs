import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const baseUrl = process.argv[2] ?? 'http://localhost:5173';
const outDir = process.argv[3] ?? 'screenshots/villager-pack';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runViewport(name, viewport, mobile) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2.6 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack ?? error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('requestfailed', (request) => errors.push(`requestfailed: ${request.url()}`));
  await page.goto(`${baseUrl}/villager-kit/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__villagers, null, { timeout: 5000 }).catch(async () => {
    console.error(`${name} preview hook timeout; title=${await page.title()} errors=${JSON.stringify(errors)} body=${(await page.locator('body').innerText()).slice(0, 400)}`);
    throw new Error(`${name}: preview test hook did not load`);
  });
  await wait(2300);

  const initial = await page.evaluate(() => window.__villagers.snapshot());
  await page.screenshot({ path: join(outDir, `${name}-initial.png`), fullPage: true });
  await page.locator('.stage').screenshot({ path: join(outDir, `${name}-stage.png`) });
  console.log(`screenshots: ${join(outDir, `${name}-initial.png`)}, ${join(outDir, `${name}-stage.png`)}`);
  const layout = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const controls = document.querySelector('.controls');
    const cr = canvas.getBoundingClientRect(), ur = controls.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      canvasVisible: cr.width > 0 && cr.height > 0 && cr.left >= 0 && cr.right <= innerWidth && cr.top < innerHeight,
      controlsVisible: ur.width > 0 && ur.left >= 0 && ur.right <= innerWidth && ur.top < innerHeight,
    };
  });
  check(initial.states.left === 'Peaceful' && initial.states.right === 'Angry', `${name}: peaceful and angry states show at start`);
  check(initial.figures.length === 2 && initial.figures.every((f) => f.bodyVertexCount > 0), `${name}: two body meshes exist`);
  check(new Set(initial.figures.map((f) => f.bodyMeshId)).size === 2, `${name}: each figure has one stable body mesh id`);
  check(layout.canvasVisible && layout.controlsVisible && !layout.overflow, `${name}: canvas and controls fit with no horizontal overflow`);
  check(initial.drawCallCount < 100, `${name}: actual draw calls ${initial.drawCallCount} < 100`);
  const palettes = ['muted', 'deep', 'market', 'dusk', 'clay', 'earthy'];
  let prior = initial.figures.map((f) => f.vertexColorChecksum);
  for (const palette of palettes) {
    await page.evaluate((value) => window.__villagers.setPalette(value), palette);
    await wait(80);
    const snap = await page.evaluate(() => window.__villagers.snapshot());
    check(snap.figures.every((f, i) => f.vertexColorChecksum !== prior[i]), `${name}: ${palette} recolors both vertex buffers`);
    prior = snap.figures.map((f) => f.vertexColorChecksum);
  }
  const stableIds = (await page.evaluate(() => window.__villagers.snapshot())).figures.map((f) => f.bodyMeshId);
  const meshCount = (await page.evaluate(() => window.__villagers.snapshot())).meshCount;
  for (const [key, value] of Object.entries({ tunic: '#2547d9', scarf: '#d42d8a', hair: '#246b32', skin: '#b54f24' })) {
    const before = await page.evaluate(() => window.__villagers.snapshot());
    await page.evaluate(({ key, value }) => window.__villagers.setAppearance({ [key]: value }), { key, value });
    await wait(80);
    const after = await page.evaluate(() => window.__villagers.snapshot());
    check(after.figures.every((f, i) => f.vertexColorChecksum !== before.figures[i].vertexColorChecksum), `${name}: custom ${key} changes both buffers`);
    check(after.figures.every((f, i) => f.bodyMeshId === stableIds[i]) && after.meshCount === meshCount, `${name}: custom ${key} keeps mesh ids and count`);
  }

  const beforeSwap = await page.evaluate(() => window.__villagers.snapshot());
  await page.evaluate(() => window.__villagers.setStateSwapped(true));
  await wait(2300);
  const swapped = await page.evaluate(() => window.__villagers.snapshot());
  check(swapped.states.left === 'Angry' && swapped.states.right === 'Peaceful', `${name}: state swap updates labels and state`);
  check(swapped.figures[0].torchPosition.y > swapped.figures[1].torchPosition.y + 0.15, `${name}: torch hand rises with angry state`);
  check(swapped.figures.every((f, i) => f.bodyMeshId === beforeSwap.figures[i].bodyMeshId && f.vertexColorChecksum === beforeSwap.figures[i].vertexColorChecksum), `${name}: swap keeps body ids and colors`);
  await page.evaluate(() => window.__villagers.setStateSwapped(false));
  await wait(2300);
  const restored = await page.evaluate(() => window.__villagers.snapshot());
  check(restored.figures[1].torchPosition.y > restored.figures[0].torchPosition.y + 0.15, `${name}: torch lowers again when anger clears`);
  check(restored.figures.every((f, i) => f.bodyMeshId === stableIds[i]) && restored.meshCount === meshCount, `${name}: state changes keep mesh ids and count`);
  check(restored.drawCallCount < 100, `${name}: actual draw calls ${restored.drawCallCount} < 100 after changes`);

  // Read the exact scene created by the preview without adding a production test hook.
  const sceneFacts = await page.evaluate(() => window.__villagers.snapshot());
  check(sceneFacts.finiteVertices, `${name}: scene vertex positions are finite`);
  check(sceneFacts.sceneTriangleCount > 0, `${name}: scene has ${sceneFacts.sceneTriangleCount} triangles`);
  check(sceneFacts.figures.every((figure) => figure.bodyTriangleCount > 0), `${name}: both body meshes have triangles`);
  check(sceneFacts.steamInstanceCount >= 12, `${name}: steam cloud uses pooled thin instances`);
  check(sceneFacts.torchesAttached === 4, `${name}: all four torch meshes attach to hand mounts`);

  await page.evaluate(() => {
    window.__villagers.setPalette('earthy');
    window.__villagers.setStateSwapped(false);
  });
  await wait(2300);

  await page.evaluate(() => window.__villagers.setStateSwapped(true));
  await wait(2300);
  const femaleBase = await page.evaluate(() => window.__villagers.snapshot());
  const genderMeshCount = femaleBase.meshCount;
  const genderColors = JSON.stringify(femaleBase.colors);
  check(femaleBase.gender === 'female', `${name}: preview starts with female villagers`);
  for (const gender of ['male', 'female', 'male', 'female']) {
    await page.evaluate((value) => window.__villagers.setGender(value), gender);
    await wait(2300);
    const genderSnap = await page.evaluate(() => window.__villagers.snapshot());
    check(genderSnap.gender === gender, `${name}: gender changes to ${gender}`);
    check(genderSnap.figures.length === 2 && genderSnap.figures.every((figure) => figure.bodyVertexCount > 0), `${name}: ${gender} figures keep one body mesh each`);
    check(new Set(genderSnap.figures.map((figure) => figure.bodyMeshId)).size === 2, `${name}: ${gender} body mesh ids stay unique`);
    check(genderSnap.meshCount === genderMeshCount, `${name}: repeated gender changes do not grow scene meshes`);
    check(JSON.stringify(genderSnap.colors) === genderColors, `${name}: gender change preserves colors`);
    check(genderSnap.states.left === femaleBase.states.left && genderSnap.states.right === femaleBase.states.right, `${name}: gender change preserves state`);
    check(genderSnap.figures[0].torchPosition.y > genderSnap.figures[1].torchPosition.y + 0.15, `${name}: ${gender} swap keeps torch poses`);
    check(genderSnap.finiteVertices && genderSnap.figures.every((figure) => Number.isFinite(figure.torchPosition.x + figure.torchPosition.y + figure.torchPosition.z)), `${name}: ${gender} poses and torch positions are finite`);
  }
  await page.evaluate(() => window.__villagers.setStateSwapped(false));
  await wait(2300);

  if (mobile) {
    await page.screenshot({ path: join(outDir, `${name}-phone.png`), fullPage: true });
  } else {
    await page.locator('.stage').screenshot({ path: join(outDir, 'female-calm-angry-front.png') });
    console.log(`screenshot: ${join(outDir, 'female-calm-angry-front.png')}`);
    await page.mouse.move(viewport.width / 2, 400);
    await page.mouse.down();
    await page.mouse.move(viewport.width / 2 + 260, 430, { steps: 12 });
    await page.mouse.up();
    await page.mouse.wheel(0, -200);
    await wait(500);
    await page.locator('.stage').screenshot({ path: join(outDir, 'female-calm-angry-side-close.png') });
    console.log(`screenshot: ${join(outDir, 'female-calm-angry-side-close.png')}`);
    await page.screenshot({ path: join(outDir, `${name}-rear-orbit.png`), fullPage: true });
  }
  check(errors.length === 0, `${name}: no browser errors${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await page.evaluate(() => window.__villagers.dispose());
  await context.close();
}

try {
  await runViewport('desktop', { width: 1280, height: 900 }, false);
  await runViewport('phone', { width: 412, height: 915 }, true);
} finally {
  await browser.close();
}

console.log(`Villager checks: ${failures.length ? 'FAIL' : 'PASS'} (${failures.length} failed assertion(s))`);
if (failures.length) process.exitCode = 1;
