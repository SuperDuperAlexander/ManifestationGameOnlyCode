// Converts every PNG in public/assets/ into a WebP next to it.
// PNG = art original (never changed). WebP = what the game loads.
// Usage: node scripts/convert-assets.mjs [--watch] [--force]
import { readdirSync, statSync, existsSync, watch } from 'node:fs';
import { join, relative, sep } from 'node:path';
import sharp from 'sharp';

const ROOT = join(process.cwd(), 'public', 'assets');
const MAX_SIDE = 2048;
const TRIM_BORDER = 4;
// Alpha at or below this is invisible dust from the art tool. It counts as transparent.
const ALPHA_DUST = 4;
const FORCE = process.argv.includes('--force');

function findPngs(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...findPngs(path));
    else if (name.toLowerCase().endsWith('.png')) out.push(path);
  }
  return out;
}

function kindOf(path) {
  const parts = relative(ROOT, path).split(sep);
  if (parts.includes('textures')) return 'texture';
  if (parts.includes('props')) return 'prop';
  if (parts.includes('bg') && parts[parts.length - 1] === 'sky.png') return 'sky';
  return 'bg';
}

/** RGBA raw pixels. A solid magenta background (#FF00FF) is keyed out to transparency. */
async function loadRgba(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const isMagenta = (i) => data[i] > 235 && data[i + 1] < 40 && data[i + 2] > 235 && data[i + 3] > 200;
  const corners = [0, (width - 1) * 4, (height - 1) * width * 4, ((height - 1) * width + width - 1) * 4];
  let keyed = false;
  if (corners.every(isMagenta)) {
    keyed = true;
    for (let i = 0; i < data.length; i += 4) {
      // Distance from pure magenta. A soft band keeps the paper edge smooth.
      const d = Math.max(255 - data[i], data[i + 1], 255 - data[i + 2]);
      if (d < 40) data[i + 3] = 0;
      else if (d < 90) data[i + 3] = Math.round(data[i + 3] * ((d - 40) / 50));
    }
  }
  // Clear invisible dust so trimming and alpha testing see clean edges.
  for (let i = 3; i < data.length; i += 4) if (data[i] <= ALPHA_DUST) data[i] = 0;
  return { data, width, height, keyed };
}

/** Box around all pixels that are not fully transparent, plus a small border. */
function opaqueBounds(data, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_DUST) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const left = Math.max(0, minX - TRIM_BORDER);
  const top = Math.max(0, minY - TRIM_BORDER);
  return {
    left,
    top,
    width: Math.min(width, maxX + TRIM_BORDER + 1) - left,
    height: Math.min(height, maxY + TRIM_BORDER + 1) - top,
  };
}

async function convert(path) {
  const out = path.slice(0, -4) + '.webp';
  if (!FORCE && existsSync(out) && statSync(out).mtimeMs > statSync(path).mtimeMs) {
    return { path, out, skipped: true, keyed: false };
  }
  const kind = kindOf(path);
  const { data, width, height, keyed } = await loadRgba(path);
  let img = sharp(data, { raw: { width, height, channels: 4 } });
  if (kind === 'prop') {
    const box = opaqueBounds(data, width, height);
    if (box) img = sharp(await img.extract(box).png().toBuffer());
  }
  // Never upscale. Textures are square, so "inside 2048" keeps them seamless.
  img = img.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
  if (kind === 'sky') img = img.flatten({ background: '#F4EEDF' }).webp({ quality: 80 });
  else if (kind === 'texture') img = img.flatten({ background: '#F4EEDF' }).webp({ quality: 85 });
  else img = img.webp({ quality: 85, alphaQuality: 90 });
  await img.toFile(out);
  return { path, out, skipped: false, keyed };
}

const kb = (bytes) => (bytes / 1024).toFixed(0).padStart(6) + ' KB';

async function runAll() {
  const rows = [];
  for (const p of findPngs(ROOT)) {
    try {
      rows.push(await convert(p));
    } catch (err) {
      console.error(`convert-assets: failed on ${p}: ${err.message}`);
      process.exitCode = 1;
    }
  }
  let totalPng = 0, totalWebp = 0;
  const lines = rows.map((r) => {
    const a = statSync(r.path).size;
    const b = statSync(r.out).size;
    totalPng += a;
    totalWebp += b;
    const note = r.skipped ? '  (up to date)' : r.keyed ? '  (magenta keyed)' : '';
    return `${relative(ROOT, r.path).padEnd(34)} ${kb(a)} ${kb(b)} ${(100 * (1 - b / a)).toFixed(0).padStart(4)} %${note}`;
  });
  console.log(`${'file'.padEnd(34)} ${'PNG'.padStart(9)} ${'WebP'.padStart(9)} saving`);
  console.log(lines.join('\n'));
  if (rows.length) {
    const save = (100 * (1 - totalWebp / totalPng)).toFixed(0).padStart(4);
    console.log(`${'total'.padEnd(34)} ${kb(totalPng)} ${kb(totalWebp)} ${save} %`);
  }
}

await runAll();

if (process.argv.includes('--watch')) {
  console.log('convert-assets: watching public/assets for PNG changes...');
  let timer = null;
  watch(ROOT, { recursive: true }, (_event, file) => {
    if (!file || !file.toLowerCase().endsWith('.png')) return;
    clearTimeout(timer);
    timer = setTimeout(() => void runAll(), 300);
  });
}
