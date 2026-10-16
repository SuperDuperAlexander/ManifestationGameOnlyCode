import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { createPaperMaterial } from '../shaders/paperShader';
import { SHADES } from '../config/palette';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { TUNING } from '../config/tuning';
import { Random, smoothstep } from '../core/Random';
import type { Anger } from '../game/Anger';
import type { World } from '../game/World';
import { ThoughtWave, type WaveHooks } from './ThoughtWave';
import { createWaveMaterial } from './waveShader';

const TEX_W = 1024;
const TEX_H = 376; // matches the ribbon shape (6 x 2.2 m)

/** Something that sends waves, e.g. the Anger Imp: waves start at its mouth after a short roar. */
export interface WaveEmitter {
  /** False while it is hidden: the field then uses its fixed source. */
  ready(): boolean;
  /** Start the roar pose and flare. */
  roar(): void;
  /** World point where a wave starts. */
  mouth(): { x: number; y: number; z: number };
}

/**
 * The Thought Waves of one world: a pool of ribbons, the spawn rhythm and the contact rules.
 * Breathe = pass, push (E) = comes back stronger, nothing = hit (GAME_DESIGN 7.3).
 * Only the active world's field is updated.
 */
export class WaveField implements WaveHooks {
  private readonly waves: ThoughtWave[] = [];
  private readonly byMesh = new Map<object, ThoughtWave>();
  private readonly tex: DynamicTexture;
  private readonly mat: ShaderMaterial;
  private readonly clock = { time: 0 };
  private readonly rng = new Random(0x5eed);
  private spawnProgress = 0.55;
  private relief = 0;
  private returnPending = false;
  private text = '';
  private readonly trails: Mesh[] = [];
  private readonly tmpV = new Vector3();
  private pending: { returning: boolean; t: number } | null = null;

  constructor(
    private readonly world: World,
    private readonly anger: Anger,
    private readonly source: { x: number; z: number },
    private readonly emitter: WaveEmitter | null = null,
  ) {
    const scene = world.scene;
    this.tex = new DynamicTexture('wave.text', { width: TEX_W, height: TEX_H }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    this.tex.hasAlpha = true;
    this.mat = createWaveMaterial(scene, this.tex, (m) => this.byMesh.get(m)?.look, this.clock);
    const vd = WaveField.ribbon();
    for (let i = 0; i < TUNING.waves.maxActive; i++) {
      const mesh = new Mesh(`wave.${i}`, scene);
      vd.applyToMesh(mesh);
      mesh.material = this.mat;
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.alphaIndex = 30;
      const w = new ThoughtWave(mesh);
      this.waves.push(w);
      this.byMesh.set(mesh, w);
    }
    if (emitter) this.buildTrails(scene);
    this.drawText();
  }

  /** One thin glowing tube per wave: a faint line from the imp to its fresh wave. */
  private buildTrails(scene: World['scene']): void {
    const c = Color4.FromHexString(SHADES.heatOrange + 'FF');
    const mat = createPaperMaterial('wave.trailMat', scene, { color: new Color4(c.r, c.g, c.b, TUNING.waves.fromImp.trailAlpha), alphaBlend: true, haze: false, curve: false, depthWrite: false });
    for (let i = 0; i < this.waves.length; i++) {
      const m = MeshBuilder.CreateCylinder(`wave.trail.${i}`, { height: 1, diameter: 1, tessellation: 6, cap: Mesh.NO_CAP }, scene);
      m.bakeTransformIntoVertices(Matrix.RotationX(Math.PI / 2));
      m.material = mat;
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
      m.alphaIndex = 29;
      m.setEnabled(false);
      this.trails.push(m);
    }
  }

  /** The text inside the waves (from en.json `waveText`). */
  setText(text: string): void {
    this.text = text;
    this.drawText();
  }

  get count(): number {
    let n = 0;
    for (const w of this.waves) if (w.alive) n++;
    return n;
  }

  private pushCandidates(): ThoughtWave[] {
    const p = this.world.playerPosition();
    return this.waves.filter((w) => w.approaching && Math.hypot(w.x - p.x, w.z - p.z) - w.width * TUNING.waves.reachFactor < TUNING.waves.pushRange);
  }

  /** Stable identities for the same range-checked candidates accepted by push(). */
  get pushCueToken(): string {
    return this.pushCandidates().map((w) => w.pushCueId).join(',');
  }

  /** E pressed: the nearest approaching wave in range bursts away and will return stronger. */
  push(): boolean {
    const p = this.world.playerPosition();
    const best = this.pushCandidates().sort((a, b) =>
      (Math.hypot(a.x - p.x, a.z - p.z) - a.width * TUNING.waves.reachFactor)
      - (Math.hypot(b.x - p.x, b.z - p.z) - b.width * TUNING.waves.reachFactor),
    )[0] ?? null;
    if (!best) return false;
    best.push();
    this.anger.pushed();
    this.relief = TUNING.waves.pushRelief;
    this.returnPending = true;
    return true;
  }

  update(dt: number): void {
    this.clock.time += dt;
    const p = this.world.playerPosition();
    const breathing = this.world.breathState() !== 'idle';
    const cam = this.world.camera.position;
    for (const w of this.waves) {
      if (!w.alive) continue;
      w.update(dt, p.x, p.y, p.z, breathing, this);
      // The ribbon always shows its face to the camera, so the text stays readable.
      w.mesh.rotation.y = Math.atan2(w.x - cam.x, w.z - cam.z);
      // Fresh from the imp the ring also tips toward a high camera, so it is not seen edge-on.
      const tilt = w.look.fire;
      w.mesh.rotation.x = tilt > 0.01 ? Math.atan2(cam.y - w.y, Math.hypot(w.x - cam.x, w.z - cam.z)) * -tilt : 0;
    }
    if (this.trails.length && this.emitter) this.updateTrails();
    if (this.pending) {
      this.pending.t -= dt;
      if (this.pending.t <= 0) {
        const r = this.pending.returning;
        this.pending = null;
        this.emitWave(p.x, p.y, p.z, r);
      }
    }
    this.spawnLogic(dt, p.x, p.y, p.z);
  }

  private updateTrails(): void {
    const e = this.emitter!;
    const T = TUNING.waves.fromImp;
    const from = e.ready() ? e.mouth() : null;
    for (let i = 0; i < this.waves.length; i++) {
      const w = this.waves[i]!;
      const tr = this.trails[i]!;
      const k = w.alive && w.approaching && from && w.fromImp ? 1 : 0;
      if (k < 0.03) {
        if (tr.isEnabled()) tr.setEnabled(false);
        continue;
      }
      const dx = w.x - from!.x;
      const dy = w.y - from!.y;
      const dz = w.z - from!.z;
      const len = Math.hypot(dx, dy, dz) || 0.01;
      tr.setEnabled(true);
      tr.position.set(from!.x + dx / 2, from!.y + dy / 2, from!.z + dz / 2);
      tr.lookAt(this.tmpV.set(w.x, w.y, w.z));
      const th = T.trailWidth * smoothstep(0, 1, k);
      tr.scaling.set(th, th, len);
    }
  }

  // --- WaveHooks ---

  passed(_w: ThoughtWave): void {
    this.anger.passed();
  }

  hit(w: ThoughtWave): void {
    this.anger.hit();
    const k = this.anger.pushLevel / TUNING.waves.maxPushLevel;
    const t = TUNING.waves;
    const shove = t.hitShoveMin + (t.bigWaveShove - t.hitShoveMin) * k;
    this.world.shove(w.dirX * shove, w.dirZ * shove);
    this.world.slow(t.hitSlowFactor, t.hitSlowTime);
  }

  // --- Spawning ---

  private spawnLogic(dt: number, px: number, py: number, pz: number): void {
    if (!this.anger.active) {
      // Anger is gone: waves stop and the rest dissolve.
      this.returnPending = false;
      this.pending = null;
      for (const w of this.waves) if (w.approaching) w.dissolve();
      return;
    }
    if (this.relief > 0) {
      this.relief -= dt;
      return;
    }
    if (this.returnPending) {
      this.returnPending = false;
      this.spawnWave(px, py, pz, true);
      return;
    }
    const pr = TUNING.waves.proximity;
    const from = this.emitter?.ready() ? this.emitter.mouth() : this.source;
    const sd = Math.hypot(from.x - px, from.z - pz);
    const near = 1 - Math.min(1, Math.max(0, (sd - pr.nearDist) / (pr.farDist - pr.nearDist)));
    this.spawnProgress += dt * TUNING.waves.rateAtFullAnger * this.anger.value * (1 + pr.boost * near);
    if (this.spawnProgress >= 1) {
      this.spawnProgress = this.rng.range(0, 0.35);
      this.spawnWave(px, py, pz, false);
    }
  }

  private spawnWave(px: number, py: number, pz: number, returning: boolean): void {
    if (this.emitter?.ready()) {
      // The imp roars first; the wave leaves its mouth a moment later.
      if (this.pending || !this.waves.some((x) => !x.alive)) return;
      this.pending = { returning, t: TUNING.waves.fromImp.delayS };
      this.emitter.roar();
      return;
    }
    this.emitWave(px, py, pz, returning);
  }

  private emitWave(px: number, py: number, pz: number, returning: boolean): void {
    const w = this.waves.find((x) => !x.alive);
    if (!w) return;
    const t = TUNING.waves;
    if (this.emitter?.ready()) {
      const m = this.emitter.mouth();
      const a = this.anger.value;
      const scale = this.anger.waveScale() * (0.8 + 0.4 * a);
      const speed = t.speed * (0.85 + 0.3 * a) * (1 + t.returnSpeedGain * this.anger.pushLevel);
      w.spawn(m.x, m.y, m.z, px, pz, scale, speed, returning ? 'returning' : 'drifting', true);
      return;
    }
    let src = this.source;
    const spots = (this.world as unknown as { waveSpots?: (a: number) => { x: number; z: number }[] }).waveSpots?.(t.citizenAbove);
    if (spots && spots.length > 0 && this.rng.next() < t.citizenShare) src = spots[Math.floor(this.rng.next() * spots.length)]!;
    let dx = src.x - px;
    let dz = src.z - pz;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    // Start at spawnDistance toward the source (or at the source if it is closer).
    const run = Math.min(t.spawnDistance, d);
    const side = this.rng.jitter(3);
    const x = px + dx * run - dz * side;
    const z = pz + dz * run + dx * side;
    const a = this.anger.value;
    const scale = this.anger.waveScale() * (0.8 + 0.4 * a);
    const speed = t.speed * (0.85 + 0.3 * a) * (1 + t.returnSpeedGain * this.anger.pushLevel);
    w.spawn(x, py + 1.2, z, px, pz, scale, speed, returning ? 'returning' : 'drifting');
  }

  // --- Mesh and text ---

  /** A bent ribbon in a 1 x 1 box: 16 x 6 vertices. The shader bends and wobbles it. */
  private static ribbon(): VertexData {
    const nx = 16;
    const ny = 6;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const u = i / nx;
        const v = j / ny;
        pos.push(u - 0.5, v - 0.5, 0);
        uv.push(u, v);
      }
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        const b = a + 1;
        const c = a + nx + 1;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const vd = new VertexData();
    vd.positions = pos;
    vd.uvs = uv;
    vd.indices = idx;
    return vd;
  }

  private drawText(): void {
    const ctx = this.tex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, TEX_W, TEX_H);
    if (this.text) {
      let size = 120;
      const font = (): string => `400 ${size}px "Work Sans", system-ui, sans-serif`;
      ctx.font = font();
      while (ctx.measureText(this.text).width > TEX_W * 0.74 && size > 30) {
        size -= 4;
        ctx.font = font();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#7a2316';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#7a2316';
      ctx.fillText(this.text, TEX_W / 2, TEX_H / 2);
      ctx.shadowBlur = 8;
      ctx.fillText(this.text, TEX_W / 2, TEX_H / 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#F4EEDF';
      ctx.fillText(this.text, TEX_W / 2, TEX_H / 2);
    }
    this.tex.update();
  }
}
