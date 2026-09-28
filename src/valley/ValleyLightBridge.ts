import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import type { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { smoothstep } from '../core/Random';
import type { Sound } from '../core/Sound';
import { createPaperMaterial, setPaperColor, type PaperMaterial } from '../shaders/paperShader';
import { procTexture } from '../world/ProceduralTextures';
import { paintGradient } from './colors';
import { LAYOUT } from './valleyLayout';

/**
 * The bridge of light over the chasm. When it is built, planks of light appear
 * one after another from the near edge to the far edge, each with a soft tone.
 */
export class ValleyLightBridge {
  /** Height of the walkable deck. */
  readonly deckY: number;
  private readonly planks: Mesh[] = [];
  private readonly glowMat: PaperMaterial;
  private readonly glow: Mesh;
  private readonly sparks: ParticleSystem;
  private building = false;
  private time = 0;
  private shown = 0;
  walkable = false;

  constructor(
    scene: Scene,
    material: ShaderMaterial,
    private readonly sound: Sound,
    lipY: number,
  ) {
    const b = LAYOUT.lightBridge;
    this.deckY = lipY + 0.1;
    const len = b.toZ - b.fromZ;
    const step = len / b.planks;
    for (let i = 0; i < b.planks; i++) {
      const p = MeshBuilder.CreateBox('valley.plank', { width: b.width, height: 0.14, depth: step * 0.82 }, scene);
      paintGradient(p, '#F2CF86', '#FFF6DE');
      p.position.set(b.x, this.deckY - 0.07, b.fromZ + step * (i + 0.5));
      p.material = material;
      p.isPickable = false;
      p.scaling.setAll(0.001);
      p.isVisible = false;
      this.planks.push(p);
    }
    // A long soft glow under the deck.
    this.glowMat = createPaperMaterial('valley.bridgeGlowMat', scene, {
      texture: procTexture(scene, 'halo'),
      additive: true,
      haze: false,
      curve: false,
    });
    this.glow = MeshBuilder.CreateGround('valley.bridgeGlow', { width: b.width * 2.6, height: len + 3 }, scene);
    this.glow.position.set(b.x, this.deckY - 0.3, (b.fromZ + b.toZ) / 2);
    this.glow.material = this.glowMat;
    this.glow.isPickable = false;
    this.glow.isVisible = false;

    const ps = new ParticleSystem('valley.bridgeSparks', 120, scene);
    ps.particleTexture = procTexture(scene, 'dot');
    ps.emitter = new Vector3(b.x, this.deckY, (b.fromZ + b.toZ) / 2);
    ps.minEmitBox = new Vector3(-b.width / 2, 0, -len / 2);
    ps.maxEmitBox = new Vector3(b.width / 2, 0.2, len / 2);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.color1 = new Color4(1, 0.95, 0.78, 0.9);
    ps.color2 = new Color4(0.95, 0.8, 0.5, 0.8);
    ps.colorDead = new Color4(0.92, 0.77, 0.48, 0);
    ps.minSize = 0.06;
    ps.maxSize = 0.16;
    ps.minLifeTime = 1.2;
    ps.maxLifeTime = 2.4;
    ps.direction1 = new Vector3(-0.1, 0.4, -0.1);
    ps.direction2 = new Vector3(0.1, 0.9, 0.1);
    ps.minEmitPower = 0.3;
    ps.maxEmitPower = 0.6;
    ps.emitRate = 0;
    ps.start();
    this.sparks = ps;
  }

  get isBuilding(): boolean {
    return this.building;
  }

  /** Planks appear one by one. Resolves when the bridge can be walked on. */
  build(): Promise<void> {
    if (this.building) return Promise.resolve();
    this.building = true;
    this.glow.isVisible = true;
    return new Promise((resolve) => {
      this.onDone = resolve;
    });
  }

  private onDone: (() => void) | null = null;

  /** True if the point is on the deck. */
  contains(x: number, z: number): boolean {
    const b = LAYOUT.lightBridge;
    return Math.abs(x - b.x) < b.width / 2 && z > b.fromZ - 0.3 && z < b.toZ + 0.3;
  }

  update(dt: number): void {
    if (!this.building) return;
    this.time += dt;
    const per = 0.32;
    for (let i = 0; i < this.planks.length; i++) {
      const t = this.time - i * per;
      if (t < 0) continue;
      const p = this.planks[i]!;
      if (!p.isVisible) {
        p.isVisible = true;
        this.sound.plank(i);
      }
      const s = smoothstep(0, 0.45, t);
      p.scaling.set(s, 1, s);
      p.position.y = this.deckY - 0.07 - (1 - s) * 0.5;
    }
    const all = this.planks.length * per + 0.5;
    this.shown = Math.min(1, this.time / all);
    setPaperColor(this.glowMat, new Color4(1, 1, 1, 0.5 * this.shown));
    this.sparks.emitRate = 40 * this.shown;
    if (!this.walkable && this.time > all) {
      this.walkable = true;
      this.onDone?.();
      this.onDone = null;
    }
  }
}
