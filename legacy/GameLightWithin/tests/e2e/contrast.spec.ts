import { test, expect } from '@playwright/test';
import { call } from './helpers';

/** Relative luminance of an sRGB colour, per the WCAG definition. */
const LUM = `(r, g, b) => {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}`;

/**
 * Text contrast has to meet WCAG AA (Web Content Accessibility Guidelines,
 * level AA): 4.5 to 1 for normal text, 3 to 1 for large text.
 */
test('panel text meets WCAG AA contrast', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => document.body.dataset.ready === '1');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForTimeout(400);

  const results = await page.evaluate((lumSrc) => {
    const luminance = eval(lumSrc) as (r: number, g: number, b: number) => number;
    const parse = (s: string): [number, number, number, number] => {
      const n = s.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
      return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
    };
    // Flatten every semi-transparent ancestor down to an opaque colour.
    const effectiveBackground = (el: Element): [number, number, number] => {
      let [r, g, b] = [207, 210, 214];
      const chain: Element[] = [];
      for (let n: Element | null = el; n; n = n.parentElement) chain.push(n);
      for (const node of chain.reverse()) {
        const [br, bg, bb, ba] = parse(getComputedStyle(node).backgroundColor);
        if (ba === 0) continue;
        r = br * ba + r * (1 - ba);
        g = bg * ba + g * (1 - ba);
        b = bb * ba + b * (1 - ba);
      }
      return [r, g, b];
    };

    const out: { text: string; ratio: number; size: number; bold: boolean }[] = [];
    const panel = document.querySelector('.lw-panel');
    if (!panel) return out;
    for (const el of panel.querySelectorAll('*')) {
      const own = [...el.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
      );
      if (!own) continue;
      const style = getComputedStyle(el);
      const [fr, fg, fb] = parse(style.color);
      const [br, bg, bb] = effectiveBackground(el);
      const l1 = luminance(fr, fg, fb);
      const l2 = luminance(br, bg, bb);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      out.push({
        text: (el.textContent ?? '').trim().slice(0, 30),
        ratio: Math.round(ratio * 100) / 100,
        size: parseFloat(style.fontSize),
        bold: parseInt(style.fontWeight, 10) >= 600,
      });
    }
    return out;
  }, LUM);

  expect(results.length).toBeGreaterThan(5);
  for (const r of results) {
    // Large text is 18.66px bold or 24px and up.
    const large = r.size >= 24 || (r.bold && r.size >= 18.66);
    const need = large ? 3 : 4.5;
    expect(
      r.ratio,
      `"${r.text}" at ${String(r.size)}px is ${String(r.ratio)}:1, needs ${String(need)}:1`,
    ).toBeGreaterThanOrEqual(need);
  }
});

/**
 * Colour is never the only cue. A restored area has to read as brighter than a
 * grey one even in greyscale, so the change survives colour blindness.
 */
test('restored colour also reads as brighter in greyscale', async ({ page }) => {
  await page.goto('/?scene=1&quality=medium&nopaint=1');
  await page.waitForFunction(() => document.body.dataset.ready === '1');
  // The player wakes inside a mist. It sits in front of everything and would
  // wash out both readings, so it is cleared before measuring the world.
  await call(page, 'clearMist');
  await page.waitForTimeout(2500);

  const meanGrey = async (): Promise<number> => {
    const shot = await page.screenshot({ clip: { x: 0, y: 380, width: 600, height: 260 } });
    const { createCanvas, loadImage } = { createCanvas: null, loadImage: null };
    void createCanvas;
    void loadImage;
    // Decode in the page, where a canvas is available.
    return page.evaluate(
      async (bytes) => {
        const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
        const bmp = await createImageBitmap(blob);
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext('2d');
        if (!ctx) return 0;
        ctx.drawImage(bmp, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) {
          sum += 0.299 * (d[i] ?? 0) + 0.587 * (d[i + 1] ?? 0) + 0.114 * (d[i + 2] ?? 0);
        }
        return sum / (d.length / 4);
      },
      [...shot],
    );
  };

  const grey = await meanGrey();
  await call(page, 'setGlobalColor', 1);
  await page.waitForTimeout(2000);
  const restored = await meanGrey();

  // The restored valley must be measurably brighter with the colour removed.
  expect(
    restored,
    `grey ${String(Math.round(grey))} vs restored ${String(Math.round(restored))}`,
  ).toBeGreaterThan(grey + 6);
});
