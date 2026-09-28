import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { Random, clamp01, damp, smoothstep } from '../core/Random';
import { createFogMaterial, type FogMaterial } from '../shaders/fogDissolve';
import { curveDrop } from '../shaders/paperShader';
import { procTexture } from '../world/ProceduralTextures';
import { TextCard } from '../world/TextCard';
import type { Circle } from '../world/Walkability';

export interface FogBlockadeData {
  id: string;
  x: number;
  z: number;
  /** The blockade sentence inside the fog. Empty for plain fog walls. */
  text: string;
  /** The sentence that appears when it dissolves. */
  release: string;
  points: number;
  /** Size multiplier: 1 = a blockade, bigger for fog walls and the gate fog. */
  size?: number;
  /** Width / height ratio of the cloud. Fog walls are wide. */
  stretch?: number;
  /** False = cannot be breathed away (fog walls that open by story). */
  breathable?: boolean;
  /** False = drifting mist you can walk through (default: solid). */
  solid?: boolean;
}

export type FogState = 'solid' | 'dissolving' | 'released';

/**
 * A soft fog cloud with an inner blockade written inside it.
 * Force (walking into it, E) makes it wobble and grow denser. Breathing near it thins it out.
 * At zero it turns into golden light and shows the release sentence.
 */
export class FogBlockade {
  state: FogState = 'solid';
  /** 1 = full. Pushing can raise it a little above 1. */
  density = 1;
  readonly collider: Circle;
  readonly position: Vector3;
  private readonly puffs: Mesh;
  private readonly mat: FogMaterial;
  private readonly text: TextCard | null = null;
  private readonly releaseText: TextCard | null = null;
  private surge = 0;
  private wobble = 0;
  private flicker = 0;
  private time = 0;
  private dissolveTime = 0;
  private burst: ParticleSystem | null = null;
  private shownDensity = 1;

  constructor(
    private readonly scene: Scene,
    readonly data: FogBlockadeData,
  ) {
    const size = data.size ?? 1;
    const stretch = data.stretch ?? 1;
    this.position = new Vector3(data.x, 0, data.z);
    this.collider = { x: data.x, z: data.z, r: TUNING.fog.colliderRadius * size, active: data.solid !== false };

    this.mat = createFogMaterial(`fogMat:${data.id}`, scene, procTexture(scene, 'puff'));
    this.puffs = MeshBuilder.CreatePlane(`fog:${data.id}`, { size: 1 }, scene);
    this.puffs.material = this.mat;
    this.puffs.isPickable = false;
    this.puffs.alwaysSelectAsActiveMesh = true;
    this.puffs.alphaIndex = 10;

    // Puffs: a soft dome, wider than tall, back to front.
    const rnd = new Random(`fog:${data.id}`);
    const count = Math.round(17 * Math.sqrt(size * stretch));
    const lean = (TUNING.cards.leanBackDeg * Math.PI) / 180;
    const list: { x: number; y: number; z: number; s: number; tint: number[] }[] = [];
    for (let i = 0; i < count; i++) {
      const a = rnd.range(0, Math.PI * 2);
      const r = Math.sqrt(rnd.next());
      const x = Math.cos(a) * r * 1.8 * size * stretch;
      const z = Math.sin(a) * r * 1.0 * size;
      // Low, heavy fog: most puffs sit near the ground, a few rise above the words.
      const y = (rnd.range(-0.2, 1.25) * (1 - r * 0.5)) * size;
      const s = rnd.range(2.2, 3.4) * size * (1 - r * 0.25);
      const cool = rnd.range(0, 1);
      list.push({
        x,
        y,
        z,
        s,
        tint: [1 - cool * 0.1, 1 - cool * 0.05, 1, rnd.range(0.85, 1)],
      });
    }
    list.sort((p, q) => q.z - p.z);
    const matrices = new Float32Array(list.length * 16);
    const colors = new Float32Array(list.length * 4);
    const m = new Matrix();
    const q = Quaternion.FromEulerAngles(lean, 0, 0);
    list.forEach((p, i) => {
      Matrix.ComposeToRef(new Vector3(p.s, p.s * 0.8, p.s), q, new Vector3(data.x + p.x, p.y + p.s * 0.35, data.z + p.z), m);
      m.copyToArray(matrices, i * 16);
      colors.set(p.tint, i * 4);
    });
    this.puffs.thinInstanceSetBuffer('matrix', matrices, 16, true);
    this.puffs.thinInstanceSetBuffer('color', colors, 4, true);

    if (data.text) {
      this.text = new TextCard(scene, `fog:${data.id}`, data.text, 4.2, {
        color: '#3E4454',
        glow: 'rgba(252,249,241,1)',
        weight: 700,
        tracking: 0.04,
      });
      this.text.mesh.position.set(data.x, 1.8 * size, data.z - 1.1 * size);
    }
    if (data.release) {
      this.releaseText = new TextCard(scene, `release:${data.id}`, data.release, 4.6, {
        color: '#B8862E',
        glow: 'rgba(255,248,226,0.98)',
        weight: 700,
        tracking: 0.04,
      });
      this.releaseText.mesh.position.set(data.x, 1.8, data.z - 1.1);
      this.releaseText.mesh.alphaIndex = 21;
      this.releaseText.setAlpha(0);
    }
  }

  get id(): string {
    return this.data.id;
  }

  get active(): boolean {
    return this.state === 'solid';
  }

  /** Force: walking into it or striking it. */
  push(): void {
    if (this.state !== 'solid') return;
    this.surge = 1;
    this.wobble = 1;
    this.flicker = 1;
    this.density = Math.min(TUNING.fog.maxDensity, this.density + TUNING.fog.pushPermanent);
  }

  /** Exhaled light reaching the fog. Returns true when this light dissolved it. */
  receiveLight(light: number): boolean {
    if (this.state !== 'solid' || this.data.breathable === false) return false;
    this.density -= light * TUNING.fog.densityPerLight;
    if (this.density <= 0) {
      this.density = 0;
      this.startDissolve();
      return true;
    }
    return false;
  }

  /** Opens the fog without breathing (fog walls, the gate fog). */
  open(): void {
    if (this.state === 'solid') this.startDissolve();
  }

  private startDissolve(): void {
    this.state = 'dissolving';
    this.dissolveTime = 0;
    this.collider.active = false;
    this.spawnBurst();
  }

  private spawnBurst(): void {
    const size = this.data.size ?? 1;
    const ps = new ParticleSystem(`fogBurst:${this.id}`, 220, this.scene);
    ps.particleTexture = procTexture(this.scene, 'dot');
    const y = 1.1 * size - curveDrop(this.data.z);
    ps.emitter = new Vector3(this.data.x, y, this.data.z);
    ps.minEmitBox = new Vector3(-1.6 * size * (this.data.stretch ?? 1), -0.8 * size, -0.8 * size);
    ps.maxEmitBox = new Vector3(1.6 * size * (this.data.stretch ?? 1), 1.0 * size, 0.8 * size);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.color1 = new Color4(1, 0.93, 0.72, 1);
    ps.color2 = new Color4(0.92, 0.77, 0.48, 1);
    ps.colorDead = new Color4(0.92, 0.77, 0.48, 0);
    ps.minSize = 0.12;
    ps.maxSize = 0.34;
    ps.minLifeTime = 1.4;
    ps.maxLifeTime = 2.6;
    ps.direction1 = new Vector3(-0.6, 1.2, -0.4);
    ps.direction2 = new Vector3(0.6, 2.2, 0.4);
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 1.2;
    ps.gravity = new Vector3(0, 0.25, 0);
    ps.manualEmitCount = Math.round(160 * Math.min(2, size));
    ps.disposeOnStop = true;
    ps.targetStopDuration = 3;
    ps.start();
    this.burst = ps;
  }

  update(dt: number): void {
    this.time += dt;
    const t = TUNING.fog;
    this.surge = Math.max(0, this.surge - dt / t.pushSurgeTime);
    this.wobble *= Math.exp(-t.wobbleDecay * dt);
    this.flicker = Math.max(0, this.flicker - dt * 1.2);

    if (this.state === 'dissolving') {
      this.dissolveTime += dt;
      const d = this.dissolveTime;
      this.mat.fog.gold = clamp01(d * 2);
      this.mat.fog.alpha = 1 - smoothstep(0.4, 1.6, d);
      this.text?.setAlpha(1 - smoothstep(0, 0.8, d));
      if (this.releaseText) {
        const hold = t.releaseTextTime;
        const a = smoothstep(0.5, 1.0, d) * (1 - smoothstep(0.9 + hold, 1.6 + hold, d));
        this.releaseText.setAlpha(a);
        this.releaseText.mesh.position.y = 1.8 + d * 0.12;
      }
      if (d > 2.4 + t.releaseTextTime) {
        this.state = 'released';
        this.puffs.isVisible = false;
      }
    }

    // Shown density moves smoothly toward the real one.
    this.shownDensity += (this.density - this.shownDensity) * damp(4, dt);
    this.mat.fog.density = this.state === 'solid' ? this.shownDensity + this.surge * 0.25 : 0;
    this.mat.fog.wobble = this.wobble;
    this.mat.fog.surge = this.surge;

    if (this.text && this.state === 'solid') {
      // Readable until the very end; flickers when pushed.
      const base = 0.35 + 0.65 * smoothstep(0.0, 0.5, this.shownDensity);
      const flick = this.flicker > 0 ? 1 - 0.6 * Math.abs(Math.sin(this.time * 26)) * this.flicker : 1;
      this.text.setAlpha(base * flick);
      this.text.mesh.position.x = this.data.x + Math.sin(this.time * 19) * 0.08 * this.wobble;
    }
  }

  /** Hidden while its zone is off screen. */
  setVisible(v: boolean): void {
    this.puffs.setEnabled(v && this.state !== 'released');
    this.text?.mesh.setEnabled(v);
    this.releaseText?.mesh.setEnabled(v);
  }

  dispose(): void {
    this.burst?.dispose();
    this.puffs.dispose();
    this.mat.dispose(false, false);
    this.text?.dispose();
    this.releaseText?.dispose();
  }
}
