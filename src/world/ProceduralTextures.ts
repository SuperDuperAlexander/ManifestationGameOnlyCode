import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE, rgba } from '../config/palette';
import { Random } from '../core/Random';

/**
 * Soft textures painted in code with a 2D canvas: glows, blob shadows, fog puffs.
 * Made once per scene and shared.
 */
export type ProcTexName = 'dot' | 'halo' | 'aura' | 'wing' | 'shadow' | 'ring' | 'puff' | 'cliff' | 'mist' | 'plank';

const cache = new WeakMap<Scene, Map<ProcTexName, DynamicTexture>>();

export function procTexture(scene: Scene, name: ProcTexName): DynamicTexture {
  let map = cache.get(scene);
  if (!map) {
    map = new Map();
    cache.set(scene, map);
  }
  const hit = map.get(name);
  if (hit) return hit;
  const tex = paint(scene, name);
  map.set(name, tex);
  return tex;
}

function make(scene: Scene, name: string, w: number, h: number): [DynamicTexture, CanvasRenderingContext2D] {
  const tex = new DynamicTexture(`proc:${name}`, { width: w, height: h }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  tex.hasAlpha = true;
  tex.wrapU = Texture.CLAMP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, w, h);
  return [tex, ctx];
}

function radial(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, stops: [number, string][]): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

function paint(scene: Scene, name: ProcTexName): DynamicTexture {
  switch (name) {
    case 'dot': {
      // Particle: warm white core, gold falloff.
      const [tex, ctx] = make(scene, name, 64, 64);
      radial(ctx, 32, 32, 32, [
        [0, 'rgba(255,250,235,1)'],
        [0.25, rgba(PALETTE.gold, 0.85)],
        [1, rgba(PALETTE.gold, 0)],
      ]);
      tex.update();
      return tex;
    }
    case 'halo': {
      // Wide soft glow for additive halos (fairy, gate, bridge, player).
      const [tex, ctx] = make(scene, name, 128, 128);
      radial(ctx, 64, 64, 64, [
        [0, 'rgba(255,246,220,0.9)'],
        [0.2, 'rgba(255,236,190,0.55)'],
        [0.5, 'rgba(235,197,122,0.18)'],
        [1, 'rgba(235,197,122,0)'],
      ]);
      tex.update();
      return tex;
    }
    case 'aura': {
      // Glow around a figure: soft, with a calm centre so the figure stays readable.
      const [tex, ctx] = make(scene, name, 128, 128);
      radial(ctx, 64, 64, 64, [
        [0, 'rgba(255,240,205,0.1)'],
        [0.3, 'rgba(255,236,190,0.4)'],
        [0.55, 'rgba(240,206,140,0.22)'],
        [1, 'rgba(235,197,122,0)'],
      ]);
      tex.update();
      return tex;
    }
    case 'wing': {
      // A soft fairy wing: a rounded leaf shape, pale gold to ivory, glowing edge.
      const [tex, ctx] = make(scene, name, 128, 128);
      ctx.save();
      ctx.translate(10, 64);
      ctx.rotate(-0.35);
      const g = ctx.createLinearGradient(0, 0, 110, 0);
      g.addColorStop(0, 'rgba(255,244,214,0.95)');
      g.addColorStop(0.6, 'rgba(250,236,200,0.6)');
      g.addColorStop(1, 'rgba(235,197,122,0.15)');
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(255,236,190,0.9)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(30, -46, 100, -46, 108, -8);
      ctx.bezierCurveTo(100, 20, 40, 22, 0, 0);
      ctx.fill();
      ctx.restore();
      tex.update();
      return tex;
    }
    case 'shadow': {
      // Soft blob shadow. Warm dark olive, never black.
      const [tex, ctx] = make(scene, name, 128, 128);
      radial(ctx, 64, 64, 64, [
        [0, 'rgba(62,58,36,0.55)'],
        [0.55, 'rgba(62,58,36,0.3)'],
        [1, 'rgba(62,58,36,0)'],
      ]);
      tex.update();
      return tex;
    }
    case 'ring': {
      // Breathing light ring on the ground.
      const [tex, ctx] = make(scene, name, 256, 256);
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,240,200,0)');
      g.addColorStop(0.55, 'rgba(255,240,200,0.06)');
      g.addColorStop(0.86, 'rgba(255,238,190,0.2)');
      g.addColorStop(0.92, 'rgba(255,242,205,0.9)');
      g.addColorStop(0.96, 'rgba(255,230,170,0.35)');
      g.addColorStop(1, 'rgba(255,230,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      tex.update();
      return tex;
    }
    case 'puff': {
      // A painted cloud puff: soft round shape, lit from the right, cool shadow on the left.
      const [tex, ctx] = make(scene, name, 256, 256);
      const rnd = new Random('puff');
      const blobs: [number, number, number][] = [];
      for (let i = 0; i < 7; i++) {
        blobs.push([128 + rnd.jitter(52), 136 + rnd.jitter(30), 46 + rnd.range(0, 30)]);
      }
      for (const [x, y, r] of blobs) {
        radial(ctx, x - 8, y + 6, r * 1.15, [
          [0, 'rgba(176,190,210,0.55)'],
          [0.7, 'rgba(176,190,210,0.3)'],
          [1, 'rgba(176,190,210,0)'],
        ]);
      }
      for (const [x, y, r] of blobs) {
        radial(ctx, x + 6, y - 6, r, [
          [0, 'rgba(250,246,236,0.95)'],
          [0.55, 'rgba(240,238,232,0.6)'],
          [1, 'rgba(236,236,236,0)'],
        ]);
      }
      tex.update();
      return tex;
    }
    case 'cliff': {
      // Sandstone cliff face: warm top, cooler and darker toward the misty bottom, soft strata.
      const [tex, ctx] = make(scene, name, 512, 512);
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#E7B48C');
      g.addColorStop(0.25, '#D99E78');
      g.addColorStop(0.7, '#B99486');
      g.addColorStop(1, '#A9B4C4');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
      const rnd = new Random('cliff');
      for (let i = 0; i < 14; i++) {
        const y = rnd.range(20, 420);
        ctx.fillStyle = `rgba(120,80,60,${rnd.range(0.04, 0.1)})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 6 + rnd.jitter(3));
        ctx.lineTo(512, y + rnd.range(6, 18));
        ctx.lineTo(0, y + rnd.range(6, 18));
        ctx.fill();
      }
      // Vertical light facets, lit from the right.
      for (let x = 0; x < 512; x += rnd.range(30, 70)) {
        ctx.fillStyle = `rgba(255,236,210,${rnd.range(0.03, 0.09)})`;
        ctx.fillRect(x, 0, rnd.range(8, 26), 512);
      }
      tex.update();
      tex.wrapU = Texture.WRAP_ADDRESSMODE;
      return tex;
    }
    case 'mist': {
      // Mist deep in the chasm: powder blue into ivory, soft.
      const [tex, ctx] = make(scene, name, 256, 256);
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, 'rgba(244,238,223,0.0)');
      g.addColorStop(0.35, 'rgba(214,224,236,0.8)');
      g.addColorStop(1, 'rgba(159,184,214,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      tex.update();
      return tex;
    }
    case 'plank': {
      // A plank of light: bright core, soft golden edges.
      const [tex, ctx] = make(scene, name, 128, 256);
      const g = ctx.createLinearGradient(0, 0, 128, 0);
      g.addColorStop(0, 'rgba(235,197,122,0)');
      g.addColorStop(0.18, 'rgba(240,210,140,0.75)');
      g.addColorStop(0.5, 'rgba(255,248,226,1)');
      g.addColorStop(0.82, 'rgba(240,210,140,0.75)');
      g.addColorStop(1, 'rgba(235,197,122,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 256);
      const v = ctx.createLinearGradient(0, 0, 0, 256);
      v.addColorStop(0, 'rgba(0,0,0,0.35)');
      v.addColorStop(0.1, 'rgba(0,0,0,0)');
      v.addColorStop(0.9, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, 128, 256);
      tex.update();
      return tex;
    }
  }
}
