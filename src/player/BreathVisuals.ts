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
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * What breathing looks like around the player:
 * - inhale: soft gold/ivory motes spiral in from a ring and arrive at the chest (a vortex
 *   that comes TO you); a faint halo on the ground tightens with them,
 * - peak: a gentle warm glow at the chest,
 * - exhale: the same halo softly widens and dissolves; nothing flies away.
 * Motes are one pooled mesh (1 draw call); halo ring and chest glow add 1 each (+2 total).
 */
export class BreathVisuals {
  private readonly ring: Mesh;
  private readonly ringMat: PaperMaterial;
  private readonly halo: Mesh;
  private readonly haloMat: PaperMaterial;
  private readonly chest: Mesh;
  private readonly chestMat: PaperMaterial;
  private readonly rays: Mesh;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly n: number;
  private readonly slow: number;
  private inMix = 0;
  private inClock = 0;
  private lastState = 'idle';
  private ringAlpha = 0;
  private ringRadius = 1;
  private haloA = 0;
  private haloR = 3;
  private chestA = 0;
  private peak = 0;
  private time = 0;
  private readonly head: number[] = [0, 0, 0];
  private readonly gold = Color3.FromHexString(PALETTE.gold);
  private readonly ivory = Color3.FromHexString(PALETTE.ivory);
  private readonly sand = Color3.FromHexString(PALETTE.sandstone);
  /** Smoothed glow for the figure, 0..1. */
  glow = 0;

  constructor(private readonly scene: Scene) {
    const R = TUNING.breath.rays;
    const reduced = reducedMotion();
    this.n = Math.max(8, Math.round(R.count * (reduced ? R.reducedFactor : 1)));
    this.slow = reduced ? R.reducedSlow : 1;

    this.ringMat = createPaperMaterial('breath.ringMat', scene, {
      texture: procTexture(scene, 'softRing'),
      additive: true,
    });
    this.ring = MeshBuilder.CreateGround('breath.ring', { width: 2, height: 2 }, scene);
    this.ring.material = this.ringMat;
    this.ring.isPickable = false;
    this.ring.alwaysSelectAsActiveMesh = true;
    this.ring.isVisible = false;

    // Breath halo: same ring texture, own tint; tightens in, widens out.
    this.haloMat = createPaperMaterial('breath.haloMat', scene, {
      texture: procTexture(scene, 'softRing'),
      additive: true,
    });
    this.halo = MeshBuilder.CreateGround('breath.halo', { width: 2, height: 2 }, scene);
    this.halo.material = this.haloMat;
    this.halo.isPickable = false;
    this.halo.alwaysSelectAsActiveMesh = true;
    this.halo.isVisible = false;

    // Chest glow: soft billboard.
    this.chestMat = createPaperMaterial('breath.chestMat', scene, {
      texture: procTexture(scene, 'halo'),
      additive: true,
    });
    this.chest = MeshBuilder.CreatePlane('breath.chest', { size: 1 }, scene);
    this.chest.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.chest.material = this.chestMat;
    this.chest.isPickable = false;
    this.chest.alwaysSelectAsActiveMesh = true;
    this.chest.isVisible = false;

    const quads = this.n;
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

  /** Writes one round mote as a camera-facing quad. */
  private writeMote(
    q: number, x: number, y: number, z: number, size: number, alpha: number, heat: number,
    rx: number, ry: number, rz: number, ux: number, uy: number, uz: number,
  ): void {
    const h = size * 0.5;
    const p = this.pos, o = q * 12;
    const ax = rx * h, ay = ry * h, az = rz * h, bx = ux * h, by = uy * h, bz = uz * h;
    p[o] = x - ax - bx; p[o + 1] = y - ay - by; p[o + 2] = z - az - bz;
    p[o + 3] = x + ax - bx; p[o + 4] = y + ay - by; p[o + 5] = z + az - bz;
    p[o + 6] = x - ax + bx; p[o + 7] = y - ay + by; p[o + 8] = z - az + bz;
    p[o + 9] = x + ax + bx; p[o + 10] = y + ay + by; p[o + 11] = z + az + bz;
    const r = this.gold.r + (this.ivory.r - this.gold.r) * heat;
    const g = this.gold.g + (this.ivory.g - this.gold.g) * heat;
    const b = this.gold.b + (this.ivory.b - this.gold.b) * heat;
    const c = this.col, co = q * 16;
    for (let v = 0; v < 4; v++) {
      c[co + v * 4] = r; c[co + v * 4 + 1] = g; c[co + v * 4 + 2] = b; c[co + v * 4 + 3] = alpha;
    }
  }

  /** Position of mote i at progress t (0 = on the outer ring, 1 = at the chest). */
  private place(i: number, t: number, out: number[], cx: number, cy: number, cz: number, gy: number): void {
    const R = TUNING.breath.rays;
    const a0 = i * GOLDEN;
    const r0 = R.inStart[0] + (R.inStart[1] - R.inStart[0]) * frac(i * 0.618 + 0.13);
    const h0 = R.inHeight[0] + (R.inHeight[1] - R.inHeight[0]) * frac(i * 0.381 + 0.27);
    const tt = clamp01(t);
    const e = Math.pow(tt, R.accel) * 0.55 + ease(tt) * 0.45;
    const r = r0 * (1 - e) + 0.12;
    const a = a0 + R.swirlTurns * Math.PI * 2 * e;
    out[0] = cx + Math.cos(a) * r;
    out[1] = gy + h0 + (cy - gy - h0) * e + Math.sin(this.time * 1.1 + i * 1.7) * R.floatAmp * (1 - e);
    out[2] = cz + Math.sin(a) * r;
  }

  update(dt: number, breath: BreathSystem, playerPos: Vector3): void {
    const R = TUNING.breath.rays;
    this.time += dt;
    const inhaling = breath.state === 'inhale';
    const exhaling = breath.state === 'exhale' && breath.breathLevel > 0.001;
    const level = breath.breathLevel;
    // Glow: rises with the in-breath, softens while breathing out.
    const glowTarget = inhaling ? 0.35 + level * 0.65 : level * 0.45;
    this.glow += (glowTarget - this.glow) * damp(6, dt);

    // Ring on the ground: its size is the light radius.
    const ringTarget = breath.state === 'idle' ? level * 0.5 : 0.35 + level * 0.65;
    this.ringAlpha += (ringTarget - this.ringAlpha) * damp(5, dt);
    this.ringRadius += (breath.lightRadius - this.ringRadius) * damp(5, dt);
    this.ring.isVisible = this.ringAlpha > 0.02;
    this.ring.position.set(playerPos.x, playerPos.y + 0.05, playerPos.z);
    this.ring.scaling.set(this.ringRadius, 1, this.ringRadius);
    setPaperColor(this.ringMat, new Color4(1, 1, 1, this.ringAlpha * R.ringAlpha));

    if (breath.state !== this.lastState) {
      if (inhaling) this.inClock = 0;
      this.lastState = breath.state;
    }
    const m = damp(R.mixRate, dt);
    this.inMix += ((inhaling ? 1 : 0) - this.inMix) * m;
    if (inhaling) this.inClock += dt;

    const cx = playerPos.x, cy = playerPos.y + R.chestHeight, cz = playerPos.z;

    // Halo: tightens toward the figure on the in-breath, widens and dissolves on the out-breath.
    let haloTargetA = 0;
    let haloTargetR = this.haloR;
    if (inhaling) {
      haloTargetR = R.haloInRadius[0] + (R.haloInRadius[1] - R.haloInRadius[0]) * ease(level);
      haloTargetA = R.haloAlpha * (0.4 + 0.6 * level);
    } else if (exhaling) {
      const p = 1 - level; // 0 at the start of the out-breath, 1 when it is spent
      haloTargetR = R.haloOutRadius[0] + (R.haloOutRadius[1] - R.haloOutRadius[0]) * ease(p);
      haloTargetA = R.haloAlpha * Math.sin(Math.PI * clamp01(0.15 + p * 0.85)) * Math.max(level, 0.15);
    }
    this.haloR += (haloTargetR - this.haloR) * damp(inhaling ? 6 : 4, dt);
    this.haloA += (haloTargetA - this.haloA) * damp(4, dt);
    this.halo.isVisible = this.haloA > 0.01;
    if (this.halo.isVisible) {
      this.halo.position.set(cx, playerPos.y + R.haloHeight, cz);
      this.halo.scaling.set(this.haloR, 1, this.haloR);
      const hx = inhaling ? 0.2 : 0.55; // gold on the way in, ivory-warm on the way out
      setPaperColor(this.haloMat, new Color4(
        this.gold.r + (this.ivory.r - this.gold.r) * hx,
        this.gold.g + (this.ivory.g - this.gold.g) * hx,
        this.gold.b + (this.ivory.b - this.gold.b) * hx,
        this.haloA,
      ));
    }

    // Chest glow: swells with the breath, a small soft pulse near the peak.
    const peakTarget = clamp01((level - 0.8) / 0.2);
    this.peak += (peakTarget - this.peak) * damp(5, dt);
    const chestTarget = inhaling || exhaling ? 0.3 + 0.7 * level : level * 0.5;
    this.chestA += (chestTarget - this.chestA) * damp(5, dt);
    this.chest.isVisible = this.chestA > 0.02;
    if (this.chest.isVisible) {
      const sway = 1 + 0.05 * Math.sin(this.time * 2.2);
      const size = (R.chestSize + R.chestGain * level + R.chestPulse * ease(this.peak)) * sway;
      this.chest.position.set(cx, cy, cz);
      this.chest.scaling.set(size, size, size);
      const c = this.sand;
      const mix = 0.5 + 0.5 * this.peak;
      setPaperColor(this.chestMat, new Color4(
        c.r + (this.gold.r - c.r) * mix,
        c.g + (this.gold.g - c.g) * mix,
        c.b + (this.gold.b - c.b) * mix,
        this.chestA * R.chestAlpha,
      ));
    }

    // Motes: spiral inward, accelerating, shrinking and fading as they arrive.
    const show = this.inMix > 0.01;
    this.rays.isVisible = show;
    if (!show) return;

    const vm = this.scene.activeCamera?.getViewMatrix().m;
    const rx = vm ? vm[0]! : 1, ry = vm ? vm[4]! : 0, rz = vm ? vm[8]! : 0;
    const ux = vm ? vm[1]! : 0, uy = vm ? vm[5]! : 1, uz = vm ? vm[9]! : 0;
    const n = this.n;
    const travel = (R.inhaleTravelS * this.slow) / (0.7 + 0.6 * clamp01(level + 0.2));
    const { head } = this;
    for (let i = 0; i < n; i++) {
      const t = frac(this.inClock / travel + i / n);
      this.place(i, t, head, cx, cy, cz, playerPos.y);
      const fadeIn = ease(clamp01(t / 0.2));
      const fadeOut = 1 - ease(clamp01((t - 0.65) / 0.35));
      const tw = 1 - R.twinkle * (0.5 + 0.5 * Math.sin(this.time * R.twinkleSpeed + i * 2.3));
      const alpha = this.inMix * R.brightness * (0.6 + 0.4 * level) * fadeIn * fadeOut * tw;
      const base = R.sizeMin + (R.sizeMax - R.sizeMin) * frac(i * 0.754 + 0.31);
      const size = base * (1 - 0.6 * ease(clamp01((t - 0.5) / 0.5)));
      this.writeMote(i, head[0]!, head[1]!, head[2]!, size, alpha, 0.15 + t * 0.4, rx, ry, rz, ux, uy, uz);
    }
    this.rays.updateVerticesData(VertexBuffer.PositionKind, this.pos);
    this.rays.updateVerticesData(VertexBuffer.ColorKind, this.col);
  }

  dispose(): void {
    this.rays.material?.dispose();
    this.rays.dispose();
    this.ring.dispose();
    this.ringMat.dispose(false, false);
    this.halo.dispose();
    this.haloMat.dispose(false, false);
    this.chest.dispose();
    this.chestMat.dispose(false, false);
  }
}
