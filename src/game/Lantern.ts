import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Constants } from '@babylonjs/core/Engines/constants';
import type { Scene } from '@babylonjs/core/scene';
import type { PlayerVisual } from '../player/PlayerVisual';
import { SHADES, color3 } from '../config/palette';
import { TUNING } from '../config/tuning';

/**
 * The lantern the player carries. Made in code: a small cage (one merged mesh),
 * an unlit glowing core and a soft additive halo. 3 draw calls, no real lights.
 * light 1 = white-gold, 0.15 = weak flickering ember, warm = relit gold-orange.
 */
export class Lantern {
  readonly root: TransformNode;
  light = 1;
  warm = false;

  private target = 1;
  private warmMix = 0;
  private time = Math.random() * 10;
  private readonly cage: Mesh;
  private readonly core: Mesh;
  private readonly halo: Mesh;
  private readonly coreMat: StandardMaterial;
  private readonly haloMat: StandardMaterial;
  private readonly cWhite = color3(SHADES.lanternWhite);
  private readonly cEmber = color3(SHADES.lanternEmber);
  private readonly cWarm = color3(SHADES.lanternWarm);
  private readonly tmp = new Color3();

  constructor(scene: Scene, player: PlayerVisual) {
    const cfg = TUNING.lantern;
    this.root = new TransformNode('lantern', scene);
    this.root.parent = player.root;
    this.root.position.set(cfg.offset.x, cfg.offset.y, cfg.offset.z);

    // Cage: base, top, four bars and a ring merged into one mesh.
    const h = cfg.cageHeight;
    const r = cfg.cageRadius;
    const parts: Mesh[] = [];
    const base = MeshBuilder.CreateCylinder('lb', { height: 0.025, diameter: r * 2.4, tessellation: 8 }, scene);
    base.position.y = -h / 2;
    const top = MeshBuilder.CreateCylinder('lt', { height: 0.035, diameterTop: r * 0.8, diameterBottom: r * 2.4, tessellation: 8 }, scene);
    top.position.y = h / 2;
    parts.push(base, top);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const bar = MeshBuilder.CreateBox('lbar', { width: 0.014, depth: 0.014, height: h }, scene);
      bar.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      parts.push(bar);
    }
    const ring = MeshBuilder.CreateTorus('lring', { diameter: r * 1.6, thickness: 0.012, tessellation: 10 }, scene);
    ring.position.y = h / 2 + 0.05;
    ring.scaling.y = 1.4;
    parts.push(ring);
    this.cage = Mesh.MergeMeshes(parts, true, true) as Mesh;
    this.cage.name = 'lantern.cage';
    const cageMat = new StandardMaterial('lantern.cageMat', scene);
    cageMat.disableLighting = true;
    cageMat.emissiveColor = color3(SHADES.umber);
    cageMat.specularColor = new Color3(0, 0, 0);
    this.cage.material = cageMat;
    this.cage.parent = this.root;

    this.coreMat = new StandardMaterial('lantern.coreMat', scene);
    this.coreMat.disableLighting = true;
    this.coreMat.specularColor = new Color3(0, 0, 0);
    this.core = MeshBuilder.CreateSphere('lantern.core', { diameter: cfg.coreSize, segments: 6 }, scene);
    this.core.material = this.coreMat;
    this.core.parent = this.root;

    // Soft halo: radial-gradient alpha texture, additive, not hidden by the ground.
    const tex = new DynamicTexture('lantern.haloTex', 64, scene, false);
    tex.hasAlpha = true;
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    tex.update();
    this.haloMat = new StandardMaterial('lantern.haloMat', scene);
    this.haloMat.disableLighting = true;
    this.haloMat.opacityTexture = tex;
    this.haloMat.specularColor = new Color3(0, 0, 0);
    this.haloMat.alphaMode = Constants.ALPHA_ADD;
    this.haloMat.backFaceCulling = false;
    this.haloMat.depthFunction = Constants.ALWAYS;
    this.halo = MeshBuilder.CreatePlane('lantern.halo', { size: cfg.haloSize }, scene);
    this.halo.billboardMode = TransformNode.BILLBOARDMODE_ALL;
    this.halo.material = this.haloMat;
    this.halo.parent = this.root;

    for (const m of [this.cage, this.core, this.halo]) {
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
    }
    this.apply();
  }

  setLight(v: number, instant = false): void {
    this.target = Math.min(1, Math.max(0, v));
    if (instant) this.light = this.target;
  }

  /** Animate to full light in warm gold-orange. */
  relightWarm(): void {
    this.warm = true;
    this.target = 1;
  }

  /** Take the lantern off the player and put it at a world position (e.g. a tree niche). */
  detach(worldPos: Vector3): void {
    this.root.parent = null;
    this.root.position.copyFrom(worldPos);
  }

  setVisible(b: boolean): void {
    this.root.setEnabled(b);
  }

  update(dt: number): void {
    this.time += dt;
    const step = TUNING.lantern.fadeSpeed * dt;
    this.light += Math.max(-step, Math.min(step, this.target - this.light));
    const w = dt * 0.8;
    this.warmMix += Math.max(-w, Math.min(w, (this.warm ? 1 : 0) - this.warmMix));
    this.apply();
  }

  private apply(): void {
    const cfg = TUNING.lantern;
    const t = this.light;
    const weak = 1 - Math.min(1, t / 0.6);
    const flick = 1 - cfg.flicker * weak * (0.5 + 0.5 * Math.sin(this.time * 17) * Math.sin(this.time * 7.3 + 1));
    const k = t * flick;
    // Colour: ember -> white-gold by light, then blended to warm gold-orange.
    Color3.LerpToRef(this.cEmber, this.cWhite, Math.min(1, t), this.tmp);
    Color3.LerpToRef(this.tmp, this.cWarm, this.warmMix, this.tmp);
    this.coreMat.emissiveColor.copyFrom(this.tmp).scaleInPlace(0.35 + 0.65 * flick);
    this.coreMat.diffuseColor.copyFrom(this.coreMat.emissiveColor);
    this.core.scaling.setAll(0.7 + 0.3 * k);
    this.haloMat.emissiveColor.copyFrom(this.tmp);
    this.haloMat.diffuseColor.copyFrom(this.tmp);
    this.haloMat.alpha = Math.min(1, 0.9 * k);
    this.halo.scaling.setAll((0.5 + 0.5 * t) * (1 + (cfg.warmHaloScale - 1) * this.warmMix));
  }
}
