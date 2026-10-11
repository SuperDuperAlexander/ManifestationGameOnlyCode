import { Color3 } from '@babylonjs/core/Maths/math.color';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE, SHADES, color3 } from '../config/palette';
import { TUNING } from '../config/tuning';

/**
 * A citizen's torch, made in code: an umber stick and a flame of three small
 * unlit cones (orange outside, gold middle, pale core). No real lights.
 * Intensity 0 = small calm flame, 1 = tall flare. Materials are shared by all torches.
 */

interface TorchMaterials {
  stick: StandardMaterial;
  flame: StandardMaterial;
}

const materialCache = new WeakMap<Scene, TorchMaterials>();

function unlitMaterial(name: string, scene: Scene, hex: string): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.disableLighting = true;
  mat.diffuseColor = color3(hex);
  mat.emissiveColor = color3(hex);
  mat.specularColor = new Color3(0, 0, 0);
  mat.backFaceCulling = false;
  return mat;
}

function materialsFor(scene: Scene): TorchMaterials {
  let mats = materialCache.get(scene);
  if (!mats) {
    mats = {
      stick: unlitMaterial('torchStick', scene, SHADES.umber),
      flame: unlitMaterial('torchFlame', scene, '#FFFFFF'),
    };
    materialCache.set(scene, mats);
  }
  return mats;
}

export class Torch {
  private readonly meshes: Mesh[] = [];
  private flame!: Mesh;
  private target = 0;
  private current = 0;
  private time = 0;

  constructor(scene: Scene, parent: TransformNode) {
    const cfg = TUNING.torch;
    const mats = materialsFor(scene);

    const stick = MeshBuilder.CreateCylinder(
      'torchStick',
      {
        height: cfg.stickLength,
        diameterTop: cfg.stickTopDiameter,
        diameterBottom: cfg.stickBottomDiameter,
        tessellation: 6,
      },
      scene,
    );
    stick.material = mats.stick;
    stick.position.y = cfg.stickLength / 2;
    stick.parent = parent;
    this.meshes.push(stick);

    // Three nested cones merged into ONE mesh (vertex colours): one draw call for the flame.
    const defs: { hex: string; hs: number; ws: number }[] = [
      { hex: SHADES.heatOrange, hs: 1, ws: 1 },
      { hex: PALETTE.gold, hs: 0.78, ws: 0.72 },
      { hex: SHADES.flameCore, hs: 0.5, ws: 0.45 },
    ];
    const cones = defs.map((d) => {
      const cone = MeshBuilder.CreateCylinder('c', { height: d.hs, diameterTop: 0, diameterBottom: d.ws, tessellation: 6 }, scene);
      cone.position.y = d.hs / 2;
      const c = color3(d.hex);
      const n = cone.getTotalVertices();
      const col = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b, 1], i * 4);
      cone.setVerticesData(VertexBuffer.ColorKind, col);
      return cone;
    });
    const flame = Mesh.MergeMeshes(cones, true, true)!;
    flame.name = 'torchFlame';
    flame.material = mats.flame;
    flame.parent = parent;
    flame.isPickable = false;
    this.meshes.push(flame);
    this.flame = flame;

    this.layoutFlames();
  }

  /** Sets the wanted flame size: 0 = small calm flame, 1 = tall flare. */
  setIntensity(v: number): void {
    this.target = Math.min(1, Math.max(0, v));
  }

  update(dt: number): void {
    const cfg = TUNING.torch;
    this.time += dt;
    const k = Math.min(1, cfg.intensityEase * dt);
    this.current += (this.target - this.current) * k;
    this.layoutFlames();
  }

  dispose(): void {
    for (const m of this.meshes) m.dispose();
    this.meshes.length = 0;
    // Shared materials stay alive for the other torches of this scene.
  }

  private layoutFlames(): void {
    const cfg = TUNING.torch;
    const wave = Math.sin(this.time * cfg.flickerSpeed) * 0.6 + Math.sin(this.time * cfg.flickerSpeed * 1.7) * 0.4;
    const flick = 1 + cfg.flickerAmount * wave;
    const h = (cfg.flameBaseHeight + cfg.flameExtraHeight * this.current) * flick;
    const w = (cfg.flameBaseWidth + cfg.flameExtraWidth * this.current) * (2 - flick);
    this.flame.scaling.set(w, h, w);
    this.flame.position.set(0, cfg.stickLength - 0.03, 0);
  }
}
