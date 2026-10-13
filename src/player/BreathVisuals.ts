import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { damp } from '../core/Random';
import { TUNING } from '../config/tuning';
import { PALETTE } from '../config/palette';
import { createPaperMaterial, setPaperColor, type PaperMaterial } from '../shaders/paperShader';
import { createRayMaterial } from '../shaders/rayShader';
import { procTexture } from '../world/ProceduralTextures';
import type { BreathSystem } from './BreathSystem';

const GOLDEN = 2.39996323;
const ease = (t: number): number => t * t * (3 - 2 * t);
const frac = (x: number): number => x - Math.floor(x);

/**
 * What breathing looks like around the player:
 * - in-breath: soft golden light rays glide in from around the figure and meet at the chest,
 * - out-breath: rays radiate out from the chest, lengthening and fading; a light ring on the ground.
 * All rays are one pooled mesh (one draw call); positions are rewritten each frame.
 */
export class BreathVisuals {
  private readonly ring: Mesh;
  private readonly ringMat: PaperMaterial;
  private readonly rays: Mesh;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly n = TUNING.breath.rays.count;
  private inMix = 0;
  private outMix = 0;
  private inClock = 0;
  private outClock = 0;
  private lastState = 'idle';
  private ringAlpha = 0;
  private ringRadius = 1;
  private readonly gold = Color3.FromHexString(PALETTE.gold);
  private readonly ivory = Color3.FromHexString(PALETTE.ivory);
  /** Smoothed glow for the figure, 0..1. */
  glow = 0;

  constructor(private readonly scene: Scene) {
    this.ringMat = createPaperMaterial('breath.ringMat', scene, {
      texture: procTexture(scene, 'ring'),
      additive: true,
    });
    this.ring = MeshBuilder.CreateGround('breath.ring', { width: 2, height: 2 }, scene);
    this.ring.material = this.ringMat;
    this.ring.isPickable = false;
    this.ring.alwaysSelectAsActiveMesh = true;
    this.ring.isVisible = false;

    // Rays: 2 groups (in, out) x n streaks x 4 vertices.
    const quads = this.n * 2;
    this.pos = new Float32Array(quads * 12);
    this.col = new Float32Array(quads * 16);
    const uvs: number[] = [];
    const idx: number[] = [];
    for (let q = 0; q < quads; q++) {
      uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
      const b = q * 4;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    const vd = new VertexData();
    vd.positions = this.pos;
    vd.colors = this.col;
    vd.uvs = uvs;
    vd.indices = idx;
    this.rays = new Mesh('breath.rays', scene);
    vd.applyToMesh(this.rays, true);
    this.rays.material = createRayMaterial(scene);
    this.rays.isPickable = false;
    this.rays.alwaysSelectAsActiveMesh = true;
    this.rays.isVisible = false;
  }

  /** Writes one streak (tail -> head) as a camera-facing quad. */
  private writeRay(
    q: number,
    tx: number, ty: number, tz: number,
    hx: number, hy: number, hz: number,
    w: number, alpha: number, heat: number,
    cam: Vector3,
  ): void {
    const dx = hx - tx, dy = hy - ty, dz = hz - tz;
    const mx = (tx + hx) * 0.5 - cam.x, my = (ty + hy) * 0.5 - cam.y, mz = (tz + hz) * 0.5 - cam.z;
    let sx = dy * mz - dz * my, sy = dz * mx - dx * mz, sz = dx * my - dy * mx;
    const k = w / (Math.hypot(sx, sy, sz) || 1);
    sx *= k; sy *= k; sz *= k;
    const p = this.pos, o = q * 12;
    p[o] = tx - sx; p[o + 1] = ty - sy; p[o + 2] = tz - sz;
    p[o + 3] = tx + sx; p[o + 4] = ty + sy; p[o + 5] = tz + sz;
    p[o + 6] = hx - sx; p[o + 7] = hy - sy; p[o + 8] = hz - sz;
    p[o + 9] = hx + sx; p[o + 10] = hy + sy; p[o + 11] = hz + sz;
    const r = this.gold.r + (this.ivory.r - this.gold.r) * heat;
    const g = this.gold.g + (this.ivory.g - this.gold.g) * heat;
    const b = this.gold.b + (this.ivory.b - this.gold.b) * heat;
    const c = this.col, co = q * 16;
    for (let v = 0; v < 4; v++) {
      c[co + v * 4] = r; c[co + v * 4 + 1] = g; c[co + v * 4 + 2] = b; c[co + v * 4 + 3] = alpha;
    }
  }

  update(dt: number, breath: BreathSystem, playerPos: Vector3): void {
    const R = TUNING.breath.rays;
    const inhaling = breath.state === 'inhale';
    const exhaling = breath.state === 'exhale' && breath.breathLevel > 0.001;
    // Glow: rises with the in-breath, softens while breathing out.
    const glowTarget = inhaling ? 0.35 + breath.breathLevel * 0.65 : breath.breathLevel * 0.45;
    this.glow += (glowTarget - this.glow) * damp(6, dt);

    // Ring on the ground: its size is the light radius.
    const ringTarget = breath.state === 'idle' ? breath.breathLevel * 0.5 : 0.35 + breath.breathLevel * 0.65;
    this.ringAlpha += (ringTarget - this.ringAlpha) * damp(5, dt);
    this.ringRadius += (breath.lightRadius - this.ringRadius) * damp(5, dt);
    this.ring.isVisible = this.ringAlpha > 0.02;
    this.ring.position.set(playerPos.x, playerPos.y + 0.05, playerPos.z);
    this.ring.scaling.set(this.ringRadius, 1, this.ringRadius);
    setPaperColor(this.ringMat, new Color4(1, 1, 1, this.ringAlpha * 0.6));

    // Rays.
    if (breath.state !== this.lastState) {
      if (inhaling) this.inClock = 0;
      if (breath.state === 'exhale') this.outClock = 0;
      this.lastState = breath.state;
    }
    const m = damp(R.mixRate, dt);
    this.inMix += ((inhaling ? 1 : 0) - this.inMix) * m;
    this.outMix += ((exhaling ? 1 : 0) - this.outMix) * m;
    if (inhaling) this.inClock += dt;
    if (exhaling) this.outClock += dt;
    const show = this.inMix > 0.01 || this.outMix > 0.01;
    this.rays.isVisible = show;
    if (!show) return;

    const cam = this.scene.activeCamera?.globalPosition ?? playerPos;
    const cx = playerPos.x, cy = playerPos.y + R.chestHeight, cz = playerPos.z;
    const lvl = 0.6 + 0.4 * breath.breathLevel;
    const n = this.n;
    for (let i = 0; i < n; i++) {
      // Inward: continuous stream, evenly staggered.
      {
        const t = frac(this.inClock / R.travelS + i / n);
        const a = i * GOLDEN;
        const dist = R.inStart[0] + (R.inStart[1] - R.inStart[0]) * frac(i * 0.618 + 0.13);
        const h = R.inHeight[0] + (R.inHeight[1] - R.inHeight[0]) * frac(i * 0.381 + 0.27);
        const e = ease(t);
        const sx = cx + Math.cos(a) * dist, sy = playerPos.y + h, sz = cz + Math.sin(a) * dist;
        const hx = sx + (cx - sx) * e, hy = sy + (cy - sy) * e, hz = sz + (cz - sz) * e;
        // The tail trails back toward where the ray came from.
        const back = (R.inLength * (1 - 0.6 * e)) / dist;
        const tx = hx + (sx - cx) * back, ty = hy + (sy - cy) * back, tz = hz + (sz - cz) * back;
        const fade = Math.sin(Math.PI * t);
        const alpha = this.inMix * R.brightness * lvl * fade * fade;
        this.writeRay(i, tx, ty, tz, hx, hy, hz, R.width * (0.6 + 0.6 * (1 - e)), alpha, e * 0.8, cam);
      }
      // Outward: a few soft pulses (groups of rays), lengthening and fading.
      {
        const t = frac(this.outClock / R.travelS + (i % 3) / 3);
        const a = (i + 0.5) * GOLDEN;
        const elev = 0.25 * Math.sin(i * 1.7) + 0.12;
        const ch = Math.cos(elev), sh = Math.sin(elev);
        const e = ease(t);
        const headD = 0.35 + e * R.outReach;
        const tailD = Math.max(0.2, headD - R.outLength * (0.3 + 0.7 * e));
        const ux = Math.cos(a) * ch, uy = sh, uz = Math.sin(a) * ch;
        const fade = Math.max(0, Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.4));
        const alpha = this.outMix * R.brightness * lvl * fade * fade;
        this.writeRay(
          n + i,
          cx + ux * tailD, cy + uy * tailD, cz + uz * tailD,
          cx + ux * headD, cy + uy * headD, cz + uz * headD,
          R.width * (0.8 + 0.8 * e), alpha, 1 - e, cam,
        );
      }
    }
    this.rays.updateVerticesData(VertexBuffer.PositionKind, this.pos);
    this.rays.updateVerticesData(VertexBuffer.ColorKind, this.col);
  }

  dispose(): void {
    this.rays.material?.dispose();
    this.rays.dispose();
    this.ring.dispose();
    this.ringMat.dispose(false, false);
  }
}
