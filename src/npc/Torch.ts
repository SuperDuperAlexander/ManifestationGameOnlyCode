import { Color3 } from '@babylonjs/core/Maths/math.color';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE, SHADES, color3 } from '../config/palette';
import { TUNING } from '../config/tuning';

/** Two shared-material draws: wrapped wood and layered flame tongues. No lights. */
interface TorchMaterials { stick: StandardMaterial; flame: StandardMaterial }
const materialCache = new WeakMap<Scene, TorchMaterials>();

function unlitMaterial(name: string, scene: Scene): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.disableLighting = true;
  mat.diffuseColor = new Color3(1, 1, 1);
  mat.emissiveColor = new Color3(1, 1, 1);
  mat.specularColor = new Color3(0, 0, 0);
  mat.backFaceCulling = false;
  return mat;
}
function materialsFor(scene: Scene): TorchMaterials {
  let mats = materialCache.get(scene);
  if (!mats) {
    mats = { stick: unlitMaterial('torchStick', scene), flame: unlitMaterial('torchFlame', scene) };
    materialCache.set(scene, mats);
  }
  return mats;
}
function painted(mesh: Mesh, hex: string): Mesh {
  const c = color3(hex);
  const colours = new Float32Array(mesh.getTotalVertices() * 4);
  for (let i = 0; i < mesh.getTotalVertices(); i++) colours.set([c.r, c.g, c.b, 1], i * 4);
  mesh.setVerticesData(VertexBuffer.ColorKind, colours);
  return mesh;
}

/** Crossed, double-sided tongues keep the gold and core visible from both sides.
 * The inner colours sit on exposed surfaces instead of inside an opaque cone.
 */
function flameMesh(scene: Scene): Mesh {
  const positions: number[] = [], normals: number[] = [], colours: number[] = [], indices: number[] = [];
  // y, centre, half width. The sideways bend gives a soft flame tip.
  const outline = [[0, 0, 0.13], [0.13, -0.035, 0.45], [0.38, 0.025, 0.37], [0.68, 0.10, 0.20], [1, -0.045, 0]] as const;
  const layers = [
    { hex: SHADES.heatOrange, height: 1, width: 1, depth: 0 },
    { hex: PALETTE.gold, height: 0.79, width: 0.71, depth: 0.045 },
    { hex: SHADES.flameCore, height: 0.49, width: 0.39, depth: 0.085 },
  ];
  for (const angle of [0, Math.PI / 2]) {
    const c = Math.cos(angle), s = Math.sin(angle);
    for (const layer of layers) {
      const colour = color3(layer.hex);
      for (const side of layer.depth === 0 ? [1] : [-1, 1]) {
        const start = positions.length / 3;
        for (const [y, centre, width] of outline) {
          for (const edge of [-1, 1]) {
            const x = (centre + edge * width) * layer.width;
            const depth = layer.depth * side;
            positions.push(x * c - depth * s, y * layer.height, x * s + depth * c);
            normals.push(-s * side, 0, c * side);
            colours.push(colour.r, colour.g, colour.b, 1);
          }
        }
        for (let i = 0; i < outline.length - 1; i++) {
          const a = start + i * 2;
          indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
        }
      }
    }
  }
  const data = new VertexData();
  data.positions = positions; data.normals = normals; data.colors = colours; data.indices = indices;
  const mesh = new Mesh('torchFlame', scene);
  data.applyToMesh(mesh);
  return mesh;
}

export class Torch {
  private readonly meshes: Mesh[] = [];
  private readonly flame: Mesh;
  private target = 0;
  private current = 0;
  private time = 0;

  constructor(scene: Scene, parent: TransformNode) {
    const cfg = TUNING.torch;
    const mats = materialsFor(scene);
    const shaft = painted(MeshBuilder.CreateCylinder('torchShaft', {
      height: cfg.stickLength, diameterTop: cfg.stickTopDiameter,
      diameterBottom: cfg.stickBottomDiameter, tessellation: 6,
    }, scene), SHADES.umber);
    shaft.position.y = cfg.stickLength / 2;
    const wrap = painted(MeshBuilder.CreateCylinder('torchWrap', {
      height: cfg.stickLength * 0.18, diameterTop: cfg.stickTopDiameter * 1.9,
      diameterBottom: cfg.stickTopDiameter * 1.4, tessellation: 6,
    }, scene), SHADES.timber);
    wrap.position.y = cfg.stickLength * 0.91;
    const rim = painted(MeshBuilder.CreateCylinder('torchWrapRim', {
      height: cfg.stickLength * 0.045, diameter: cfg.stickTopDiameter * 2.05, tessellation: 6,
    }, scene), SHADES.timberDark);
    rim.position.y = cfg.stickLength * 0.975;
    const stick = Mesh.MergeMeshes([shaft, wrap, rim], true, true)!;
    stick.name = 'torchStick';
    stick.material = mats.stick;
    stick.parent = parent;
    stick.isPickable = false;
    this.meshes.push(stick);
    this.flame = flameMesh(scene);
    this.flame.material = mats.flame;
    this.flame.parent = parent;
    this.flame.isPickable = false;
    this.meshes.push(this.flame);
    this.layoutFlames();
  }

  /** Sets the wanted flame size: 0 = small calm flame, 1 = tall flare. */
  setIntensity(v: number): void { this.target = Math.min(1, Math.max(0, v)); }
  setVisible(v: boolean): void {
    for (const mesh of this.meshes) if (mesh.isEnabled() !== v) mesh.setEnabled(v);
  }
  update(dt: number): void {
    const cfg = TUNING.torch;
    this.time += dt;
    this.current += (this.target - this.current) * Math.min(1, cfg.intensityEase * dt);
    this.layoutFlames();
  }
  dispose(): void {
    for (const mesh of this.meshes) mesh.dispose();
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
