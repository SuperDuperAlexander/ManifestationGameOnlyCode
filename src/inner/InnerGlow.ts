import type { Scene } from '@babylonjs/core/scene';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';
import { SHADES } from '../config/palette';
import { TUNING } from '../config/tuning';
import { OLD_TREE } from '../world/TreeShape';
import { procTexture } from '../world/ProceduralTextures';
import { LAYOUT } from './innerLayout';
import { VALLEY_UNIFORMS } from './valleyShader';
import { LightRays } from './LightRays';
import type { RootSample } from '../world/TreeBuilder';
import { paintFlat } from './colors';

/**
 * Bioluminescence of the inner world (Avatar-like, but soft and warm):
 * bloom on the whole inner scene, fireflies, slow light orbs, pond sparkles,
 * glowing footsteps and light lines spiralling up the inner tree.
 * Everything is drawn in code; particles are pooled (one system each).
 */
export class InnerGlow {
  private readonly pipeline: DefaultRenderingPipeline;
  private readonly fireflies: ParticleSystem;
  private readonly orbs: ParticleSystem;
  private readonly sparkles: ParticleSystem;
  private readonly stepPs: ParticleSystem;
  private breathSmooth = 0;
  private baseSize = TUNING.inner.motes.size;
  private readonly rays: LightRays;
  private readonly follow = new Vector3();
  private readonly orbAt = new Vector3();
  private readonly stepAt = new Vector3();
  private readonly lastStep = new Vector3(1e6, 0, 1e6);

  constructor(
    scene: Scene,
    camera: Camera,
    touch: boolean,
    treeBase: Vector3,
    ribbonMat: ShaderMaterial,
    roots: RootSample[][],
  ) {
    const G = TUNING.inner.glow;
    const M = TUNING.inner.motes;
    const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const share = reduced ? G.reducedShare : 1;
    const speed = reduced ? 0.5 : 1;
    const soft = procTexture(scene, 'soft');
    const mote = Color3.FromHexString(SHADES.innerMote);
    const water = Color3.FromHexString(SHADES.innerWater);
    const crystal = Color3.FromHexString(SHADES.innerCrystal);
    const pink = Color3.FromHexString(SHADES.innerSkyGlow);

    // Bloom (inner scene only; the outer town has its own scene).
    const B = G.bloom;
    const p = new DefaultRenderingPipeline('inner.fx', false, scene, [camera]);
    p.fxaaEnabled = false;
    p.bloomEnabled = true;
    p.bloomThreshold = B.threshold;
    p.bloomWeight = B.weight;
    p.bloomKernel = touch ? B.kernelMobile : B.kernel;
    p.bloomScale = touch ? B.scaleMobile : B.scale;
    this.pipeline = p;

    // Fireflies / spores: rise slowly, drift and twinkle.
    const count = Math.round(M.count * share * (touch ? 0.6 : 1));
    const f = new ParticleSystem('inner.motes', count, scene);
    f.particleTexture = soft;
    f.blendMode = ParticleSystem.BLENDMODE_ADD;
    f.color1 = new Color4(mote.r, mote.g, mote.b, 1);
    f.minScaleX = 1;
    f.color2 = new Color4(0.55, 0.9, 1, 1);
    f.colorDead = new Color4(pink.r, pink.g, pink.b, 0);
    f.minSize = M.size * 0.6;
    f.maxSize = M.size * 1.4;
    f.minLifeTime = 6;
    f.maxLifeTime = 11;
    f.emitter = this.follow;
    f.minEmitBox = new Vector3(-M.radius, 0, -M.radius);
    f.maxEmitBox = new Vector3(M.radius, M.height, M.radius);
    f.direction1 = new Vector3(-0.2, M.rise, -0.2);
    f.direction2 = new Vector3(0.2, M.rise * 1.6, 0.2);
    f.minEmitPower = 0.4 * speed;
    f.maxEmitPower = 0.9 * speed;
    f.emitRate = count / 8;
    f.updateSpeed = 0.01 * speed;
    f.preWarmCycles = 120;
    f.preWarmStepOffset = 4;
    f.start();
    this.fireflies = f;

    // A few larger, slow floating orbs.
    const o = new ParticleSystem('inner.orbs', Math.max(3, Math.round(G.orbs.count * share)), scene);
    o.particleTexture = soft;
    o.blendMode = ParticleSystem.BLENDMODE_ADD;
    o.color1 = new Color4(crystal.r, crystal.g, crystal.b, 0.7);
    o.color2 = new Color4(pink.r, pink.g, pink.b, 0.6);
    o.colorDead = new Color4(crystal.r, crystal.g, crystal.b, 0);
    o.minSize = G.orbs.size * 0.6;
    o.maxSize = G.orbs.size;
    o.minLifeTime = 12;
    o.maxLifeTime = 20;
    o.emitter = this.orbAt;
    o.minEmitBox = new Vector3(-G.orbs.radius, 0, -G.orbs.radius);
    o.maxEmitBox = new Vector3(G.orbs.radius, G.orbs.height, G.orbs.radius);
    o.direction1 = new Vector3(-0.1, 0.05, -0.1);
    o.direction2 = new Vector3(0.1, 0.2, 0.1);
    o.minEmitPower = 0.3 * speed;
    o.maxEmitPower = 0.6 * speed;
    o.emitRate = G.orbs.count / 14;
    o.preWarmCycles = 200;
    o.preWarmStepOffset = 4;
    o.start();
    this.orbs = o;

    // Sparkles on the pond / stream surface.
    const pts = LAYOUT.river.points;
    const xs = pts.map((q) => q[0]);
    const zs = pts.map((q) => q[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const zc = zs.reduce((a, b) => a + b, 0) / zs.length;
    const sp = new ParticleSystem('inner.sparkles', Math.max(8, Math.round(G.sparkles.count * share)), scene);
    sp.particleTexture = soft;
    sp.blendMode = ParticleSystem.BLENDMODE_ADD;
    sp.color1 = new Color4(1, 1, 1, 1);
    sp.color2 = new Color4(water.r, water.g, water.b, 1);
    sp.colorDead = new Color4(1, 1, 1, 0);
    sp.minSize = G.sparkles.size * 0.5;
    sp.maxSize = G.sparkles.size;
    sp.minLifeTime = 0.8;
    sp.maxLifeTime = 1.8;
    sp.emitter = new Vector3((x0 + x1) / 2, LAYOUT.river.level + 0.2, zc);
    sp.minEmitBox = new Vector3(-(x1 - x0) / 2, 0, -1.6);
    sp.maxEmitBox = new Vector3((x1 - x0) / 2, 0, 1.6);
    sp.direction1 = new Vector3(0, 0.02, 0);
    sp.direction2 = new Vector3(0, 0.08, 0);
    sp.minEmitPower = 0.1;
    sp.maxEmitPower = 0.2;
    sp.emitRate = (G.sparkles.count / 1.3) * share;
    sp.updateSpeed = 0.01 * speed;
    sp.start();
    this.sparkles = sp;

    // Footsteps: the ground glows softly where the player walks, then fades.
    const F = G.footstep;
    const s = new ParticleSystem('inner.steps', 14, scene);
    s.particleTexture = soft;
    s.blendMode = ParticleSystem.BLENDMODE_ADD;
    s.color1 = new Color4(water.r, water.g, water.b, 0.5);
    s.color2 = new Color4(crystal.r, crystal.g, crystal.b, 0.5);
    s.colorDead = new Color4(crystal.r, crystal.g, crystal.b, 0);
    s.minSize = F.size * 0.8;
    s.maxSize = F.size;
    s.minLifeTime = F.life;
    s.maxLifeTime = F.life;
    s.emitter = this.stepAt;
    s.minEmitBox = new Vector3(0, 0, 0);
    s.maxEmitBox = new Vector3(0, 0, 0);
    s.direction1 = new Vector3(0, 0, 0);
    s.direction2 = new Vector3(0, 0, 0);
    s.minEmitPower = 0;
    s.maxEmitPower = 0;
    s.emitRate = 0;
    s.start();
    this.stepPs = s;

    // Slowly rising gold-pink sparks around the tree of life.
    const tp = new Vector3(treeBase.x, treeBase.y + 0.5, treeBase.z);
    const tr = new ParticleSystem('inner.treeSparks', Math.round(40 * share), scene);
    tr.particleTexture = soft;
    tr.blendMode = ParticleSystem.BLENDMODE_ADD;
    tr.color1 = new Color4(1, 0.85, 0.5, 1);
    tr.color2 = new Color4(pink.r, pink.g, pink.b, 1);
    tr.colorDead = new Color4(1, 0.8, 0.5, 0);
    tr.minSize = 0.2;
    tr.maxSize = 0.45;
    tr.minLifeTime = 5;
    tr.maxLifeTime = 9;
    tr.emitter = tp;
    tr.minEmitBox = new Vector3(-6, 0, -6);
    tr.maxEmitBox = new Vector3(6, 1, 6);
    tr.direction1 = new Vector3(-0.1, 0.6, -0.1);
    tr.direction2 = new Vector3(0.1, 1.2, 0.1);
    tr.minEmitPower = 0.4 * speed;
    tr.maxEmitPower = 0.8 * speed;
    tr.emitRate = (40 * share) / 7;
    tr.updateSpeed = 0.01 * speed;
    tr.preWarmCycles = 100;
    tr.preWarmStepOffset = 4;
    tr.start();

    this.rays = new LightRays(scene, treeBase);
    this.buildRibbon(scene, treeBase, ribbonMat, roots);
  }

  /** Two light lines (gold and pink) spiralling up the inner tree trunk. */
  private buildRibbon(scene: Scene, base: Vector3, mat: ShaderMaterial, roots: RootSample[][]): void {
    const R = TUNING.inner.glow.ribbon;
    const k = TUNING.tree.innerScale;
    const T = OLD_TREE;
    const tubes: Mesh[] = [];
    for (let line = 0; line < 2; line++) {
      const path: Vector3[] = [];
      for (let i = 0; i <= 48; i++) {
        const u = R.from + ((R.to - R.from) * i) / 48;
        const a = u * R.turns * Math.PI * 2 + line * Math.PI;
        const r = (T.trunkRadiusBase + (T.trunkRadiusTop - T.trunkRadiusBase) * u) * k * 1.04;
        path.push(
          new Vector3(
            base.x + T.lean[0] * u * u * k + Math.cos(a) * r,
            base.y + (T.trunkHeight * u - 0.02) * k,
            base.z + T.lean[1] * u * u * k + Math.sin(a) * r,
          ),
        );
      }
      const t = MeshBuilder.CreateTube('inner.ribbon' + line, { path, radius: R.radius, tessellation: 4, cap: Mesh.NO_CAP }, scene);
      paintFlat(t, line === 0 ? SHADES.flameCore : SHADES.innerCrystalPink, 0);
      tubes.push(t);
    }
    // Glowing veins along the roots (not the burned one: its heat stays warm orange).
    roots.forEach((s, i) => {
      if (i === LAYOUT.burnedRoot || s.length < 4) return;
      const path = s.map((q) => new Vector3(base.x + q.x, base.y + q.y + q.r * 0.95, base.z + q.z));
      const t = MeshBuilder.CreateTube('inner.rootVein' + i, { path, radius: R.radius * 0.7, tessellation: 4, cap: Mesh.NO_CAP }, scene);
      paintFlat(t, i % 2 === 0 ? SHADES.flameCore : SHADES.innerCrystalPink, 0);
      tubes.push(t);
    });
    const m = Mesh.MergeMeshes(tubes, true)!;
    m.name = 'inner.ribbons';
    m.material = mat;
    m.isPickable = false;
    m.freezeWorldMatrix();
  }

  update(player: Vector3, breath: number, dt: number): void {
    // Breath link: glow, bloom and particles rise up to 20% while breathing in; slow and smooth.
    this.breathSmooth += (Math.min(1, Math.max(0, breath)) - this.breathSmooth) * Math.min(1, dt * 1.5);
    VALLEY_UNIFORMS.glow = this.breathSmooth;
    const lift = 1 + 0.2 * this.breathSmooth;
    this.pipeline.bloomWeight = TUNING.inner.glow.bloom.weight * lift;
    this.fireflies.minSize = this.baseSize * 0.6 * lift;
    this.fireflies.maxSize = this.baseSize * 1.4 * lift;
    this.rays.update(player);
    this.follow.set(player.x, player.y, player.z);
    this.orbAt.set(player.x, player.y + 0.5, player.z);
    const F = TUNING.inner.glow.footstep;
    if (Math.hypot(player.x - this.lastStep.x, player.z - this.lastStep.z) > F.distance) {
      this.lastStep.set(player.x, 0, player.z);
      this.stepAt.set(player.x, player.y + 0.12, player.z);
      this.stepPs.manualEmitCount = 1;
    }
  }

  dispose(): void {
    this.pipeline.dispose();
    this.fireflies.dispose();
    this.orbs.dispose();
    this.sparkles.dispose();
    this.stepPs.dispose();
    this.rays.dispose();
  }
}
