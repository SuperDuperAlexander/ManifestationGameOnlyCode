import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import type { Events } from '../core/Events';
import type { Sound } from '../core/Sound';
import { clamp01, smoothstep } from '../core/Random';
import type { BridgeSpec } from '../types/chapter';
import { createPaperMaterial, curveDrop } from '../shaders/paperShader';
import { procTexture } from '../world/ProceduralTextures';
import type { Segment, Walkability } from '../world/Walkability';

interface Plank {
  /** 0 = not there, 1 = fully there. */
  shown: number;
  target: number;
  delay: number;
}

/**
 * The bridge of light over the chasm. Every released blockade becomes one plank.
 * Planks appear one by one when the player is at the chasm.
 * With `planksRequired` planks the bridge can be walked; a soft thread of light fills any gap.
 */
export class LightBridge {
  readonly root: TransformNode;
  private readonly planks: Plank[] = [];
  private readonly surface: Mesh;
  private readonly glow: Mesh;
  private readonly ghost: Mesh;
  private readonly sparkle: ParticleSystem;
  private readonly sparkleEmitter = new Vector3();
  private earned = 0;
  private placed = 0;
  private walkable = false;
  private readonly corridor: Segment;
  private readonly slotLength: number;
  private readonly dir: Vector3;
  private readonly width: number;
  private time = 0;
  private readonly buffers: Record<'surf' | 'surfC' | 'glow' | 'glowC' | 'ghost' | 'ghostC', Float32Array>;
  /** True while the player is close enough to watch planks appear. */
  playerNear = false;

  constructor(
    scene: Scene,
    private readonly spec: BridgeSpec,
    private readonly walk: Walkability,
    private readonly events: Events,
    private readonly sound: Sound,
  ) {
    this.root = new TransformNode('bridge', scene);
    const [ax, az] = spec.from;
    const [bx, bz] = spec.to;
    const len = Math.hypot(bx - ax, bz - az);
    this.dir = new Vector3((bx - ax) / len, 0, (bz - az) / len);
    this.slotLength = len / spec.planksTotal;
    this.width = spec.width ?? TUNING.bridge.plankWidth;
    this.corridor = { ax, az, bx, bz, halfWidth: this.width / 2 };
    for (let i = 0; i < spec.planksTotal; i++) this.planks.push({ shown: 0, target: 0, delay: 0 });

    // Plank surfaces: warm gold boards with bright centres.
    this.surface = MeshBuilder.CreateGround('bridge.surface', { width: 1, height: 1 }, scene);
    this.surface.material = createPaperMaterial('bridge.surfaceMat', scene, {
      texture: procTexture(scene, 'plank'),
      additive: true,
      haze: false,
    });
    // Soft halos above each plank.
    this.glow = MeshBuilder.CreatePlane('bridge.glow', { size: 1 }, scene);
    this.glow.material = createPaperMaterial('bridge.glowMat', scene, {
      texture: procTexture(scene, 'halo'),
      additive: true,
      haze: false,
    });
    // Faint outlines where planks will be: a promise of the bridge.
    this.ghost = MeshBuilder.CreateGround('bridge.ghost', { width: 1, height: 1 }, scene);
    this.ghost.material = createPaperMaterial('bridge.ghostMat', scene, {
      texture: procTexture(scene, 'plank'),
      additive: true,
      haze: false,
    });
    for (const m of [this.surface, this.glow, this.ghost]) {
      m.parent = this.root;
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
    }
    const n = spec.planksTotal;
    this.buffers = {
      surf: new Float32Array(n * 16),
      surfC: new Float32Array(n * 4),
      glow: new Float32Array(n * 16),
      glowC: new Float32Array(n * 4),
      ghost: new Float32Array(n * 16),
      ghostC: new Float32Array(n * 4),
    };
    this.writeInstances();
    const b = this.buffers;
    this.surface.thinInstanceSetBuffer('matrix', b.surf, 16, false);
    this.surface.thinInstanceSetBuffer('color', b.surfC, 4, false);
    this.glow.thinInstanceSetBuffer('matrix', b.glow, 16, false);
    this.glow.thinInstanceSetBuffer('color', b.glowC, 4, false);
    this.ghost.thinInstanceSetBuffer('matrix', b.ghost, 16, false);
    this.ghost.thinInstanceSetBuffer('color', b.ghostC, 4, false);

    const ps = new ParticleSystem('bridge.sparkle', 120, scene);
    ps.particleTexture = procTexture(scene, 'dot');
    ps.emitter = this.sparkleEmitter;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.color1 = new Color4(1, 0.95, 0.8, 1);
    ps.color2 = new Color4(0.92, 0.77, 0.48, 1);
    ps.colorDead = new Color4(0.92, 0.77, 0.48, 0);
    ps.minSize = 0.06;
    ps.maxSize = 0.16;
    ps.minLifeTime = 1;
    ps.maxLifeTime = 2.2;
    ps.direction1 = new Vector3(-0.1, 0.4, -0.1);
    ps.direction2 = new Vector3(0.1, 0.9, 0.1);
    ps.emitRate = 0;
    ps.startPositionFunction = (_m, pos) => {
      const t = Math.random() * (this.placed / this.planks.length);
      const x = ax + (bx - ax) * t + (Math.random() - 0.5) * this.width;
      const z = az + (bz - az) * t;
      pos.set(x, 0.05 - curveDrop(z), z);
    };
    ps.start();
    this.sparkle = ps;
  }

  get isWalkable(): boolean {
    return this.walkable;
  }

  get plankCount(): number {
    return this.placed;
  }

  /** Planks earned so far (released blockades), shown or not. */
  setEarned(count: number, instant = false): void {
    this.earned = Math.min(count, this.planks.length);
    if (instant) {
      for (let i = 0; i < this.earned; i++) {
        this.planks[i]!.target = 1;
        this.planks[i]!.shown = 1;
      }
      this.placed = this.earned;
      this.checkWalkable(true);
    }
  }

  update(dt: number): void {
    this.time += dt;
    // Bring pending planks in one after another while the player watches.
    if (this.playerNear && this.placed < this.earned) {
      const p = this.planks[this.placed]!;
      if (p.target === 0) {
        p.target = 1;
        p.delay = this.placed === 0 ? 0.6 : TUNING.bridge.plankStagger;
      }
    }
    let changed = false;
    for (let i = 0; i < this.planks.length; i++) {
      const p = this.planks[i]!;
      if (p.target > p.shown) {
        if (p.delay > 0) {
          p.delay -= dt;
          continue;
        }
        if (p.shown === 0) {
          this.sound.plank(i);
          this.events.emit('plankAdded', { index: i, count: i + 1 });
        }
        p.shown = Math.min(1, p.shown + dt / TUNING.bridge.plankAppearTime);
        changed = true;
        if (p.shown >= 1 && i === this.placed) {
          this.placed++;
          this.checkWalkable(false);
        }
        break;
      }
    }
    if (changed || this.time % 0.1 < dt) {
      this.writeInstances();
      for (const mesh of [this.surface, this.glow, this.ghost]) {
        mesh.thinInstanceBufferUpdated('matrix');
        mesh.thinInstanceBufferUpdated('color');
      }
    }
    this.sparkle.emitRate = this.placed > 0 ? 10 + 6 * this.placed : 0;
  }

  private checkWalkable(silent: boolean): void {
    if (this.walkable || this.placed < this.spec.planksRequired) return;
    this.walkable = true;
    this.walk.corridors.push(this.corridor);
    if (!silent) this.events.emit('bridgeWalkable', {});
  }

  /** Writes plank transforms and brightness into the thin-instance buffers. */
  private writeInstances(): void {
    const n = this.planks.length;
    const { surf, surfC, glow, glowC, ghost, ghostC } = this.buffers;
    const lean = Quaternion.FromEulerAngles((TUNING.cards.leanBackDeg * Math.PI) / 180, 0, 0);
    const m = new Matrix();
    const yaw = Math.atan2(this.dir.x, this.dir.z);
    const q = Quaternion.FromEulerAngles(0, yaw, 0);
    const [ax, az] = this.spec.from;
    for (let i = 0; i < n; i++) {
      const p = this.planks[i]!;
      const t = (i + 0.5) * this.slotLength;
      const x = ax + this.dir.x * t;
      const z = az + this.dir.z * t;
      const e = smoothstep(0, 1, p.shown);
      const pulse = 0.9 + 0.1 * Math.sin(this.time * 2 + i * 0.8);
      // Planks grow from the middle outward as they appear.
      const len = this.slotLength * 0.92 * (0.3 + 0.7 * e);
      Matrix.ComposeToRef(new Vector3(this.width * (0.6 + 0.4 * e), 1, len), q, new Vector3(x, 0.02 + (1 - e) * 0.5, z), m);
      m.copyToArray(surf, i * 16);
      surfC.set([1, 1, 1, e * pulse], i * 4);
      const g = 2.4 + e * 0.6;
      Matrix.ComposeToRef(new Vector3(g, g, g), lean, new Vector3(x, 0.5, z), m);
      m.copyToArray(glow, i * 16);
      glowC.set([1, 1, 1, e * 0.35 * pulse], i * 4);
      // Ghost: faint outline before; a soft thread of light in a gap once the bridge is walkable.
      const ghostAlpha = p.shown >= 1 ? 0 : this.walkable ? 0.45 : 0.1 + 0.05 * Math.sin(this.time * 1.5 + i);
      Matrix.ComposeToRef(new Vector3(this.width * 0.8, 1, this.slotLength * 0.85), q, new Vector3(x, 0.015, z), m);
      m.copyToArray(ghost, i * 16);
      ghostC.set([1, 1, 1, clamp01(ghostAlpha)], i * 4);
    }
  }

  setVisible(v: boolean): void {
    this.root.setEnabled(v);
  }
}
