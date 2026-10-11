import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Material } from '@babylonjs/core/Materials/material';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { noise2 } from '../inner/noise';
import { mixRgb, rgb, type Rgb } from '../inner/colors';
import { procTexture } from './ProceduralTextures';
import type { TreeShape } from './TreeShape';

export interface RootSample {
  /** Local to the tree root node, already multiplied by the scale. */
  x: number;
  y: number;
  z: number;
  r: number;
}

export interface TreeOptions {
  position?: Vector3;
  /** Materials that read vertex colours. Default: a shared unlit one with baked light. */
  woodMaterial?: Material;
  leafMaterial?: Material;
  /** Only these get their own mesh and can change health. All others stay healthy and are merged. */
  dynamicBranches?: number[];
  dynamicRoots?: number[];
  /** Start health (0..1) of the dynamic ones. Default 1. */
  branchHealth?: number;
  rootHealth?: number;
}

export interface TreeHandle {
  root: TransformNode;
  setBranchHealth(i: number, v: number): void;
  setRootHealth(i: number, v: number): void;
  update(dt: number): void;
  /** Centre line of root i in local space (scaled by the tree scale). */
  rootSamples(i: number): RootSample[];
  dispose(): void;
}

const LIGHT = new Vector3(...(TUNING.valley.lightDir as unknown as [number, number, number])).normalize();
const WOOD_LO = rgb('#9C6444');
const WOOD_HI = rgb('#C68A5E');
const DRY_LO = rgb('#2B2220');
const DRY_HI = rgb('#4A3A33');
const EMBER = rgb('#E26A2A');
const LEAF_LO = rgb('#6D7B52');
const LEAF_HI = rgb('#B3B67A');

interface Part {
  mesh: Mesh;
  healthy: Float32Array;
  dry: Float32Array;
}

function sharedUnlit(scene: Scene, name: string): StandardMaterial {
  const key = `tree.${name}`;
  const hit = scene.getMaterialByName(key);
  if (hit) return hit as StandardMaterial;
  const m = new StandardMaterial(key, scene);
  m.disableLighting = true;
  m.diffuseColor = Color3.Black();
  m.emissiveColor = Color3.White();
  m.specularColor = Color3.Black();
  return m;
}

/** Soft baked light so the unlit fallback material still shows form. */
function shade(nx: number, ny: number, nz: number): number {
  return 0.72 + 0.28 * Math.max(0, nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z);
}

function colorsFor(mesh: Mesh, lo: Rgb, hi: Rgb, root: boolean, bake: boolean, cracks: boolean): Float32Array {
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  const nor = mesh.getVerticesData(VertexBuffer.NormalKind)!;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < pos.length; i += 3) {
    minY = Math.min(minY, pos[i]!);
    maxY = Math.max(maxY, pos[i]!);
  }
  const out = new Float32Array((pos.length / 3) * 4);
  for (let v = 0; v < pos.length / 3; v++) {
    const x = pos[v * 3]!;
    const y = pos[v * 3 + 1]!;
    const z = pos[v * 3 + 2]!;
    let c = mixRgb(lo, hi, (y - minY) / Math.max(1e-4, maxY - minY));
    if (cracks) {
      const n = noise2(x * 55 + 3, z * 55 + y * 40);
      if (n > 0.62) c = n > 0.78 && root ? mixRgb(c, EMBER, 0.9) : mixRgb(c, lo, 0.6);
    }
    const s = bake ? shade(nor[v * 3]!, nor[v * 3 + 1]!, nor[v * 3 + 2]!) : 1;
    out.set([c[0] * s, c[1] * s, c[2] * s, 0], v * 4);
  }
  return out;
}

function roundNormals(mesh: Mesh, cx: number, cy: number, cz: number, amount: number): void {
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  const nor = mesh.getVerticesData(VertexBuffer.NormalKind)!;
  const out = new Float32Array(nor.length);
  for (let i = 0; i < pos.length; i += 3) {
    let dx = pos[i]! - cx;
    let dy = pos[i + 1]! - cy;
    let dz = pos[i + 2]! - cz;
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l;
    dy /= l;
    dz /= l;
    const nx = nor[i]! * (1 - amount) + dx * amount;
    const ny = nor[i + 1]! * (1 - amount) + dy * amount;
    const nz = nor[i + 2]! * (1 - amount) + dz * amount;
    const nl = Math.hypot(nx, ny, nz) || 1;
    out[i] = nx / nl;
    out[i + 1] = ny / nl;
    out[i + 2] = nz / nl;
  }
  mesh.setVerticesData(VertexBuffer.NormalKind, out);
}

interface RootPoint {
  x: number;
  y: number;
  z: number;
  r: number;
}

/** Root centre line in tree units (height 1). */
function rootLine(shape: TreeShape, i: number): RootPoint[] {
  const rt = shape.roots[i]!;
  const out: RootPoint[] = [];
  const n = 14;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const a = rt.angle + Math.sin(t * 3.2 + rt.wobble) * 0.13 * t;
    const d = shape.trunkRadiusBase * 0.5 + rt.length * t;
    const r = rt.radius * (1 - 0.72 * t);
    const y = rt.hump * (1 - Math.pow(t, 1.7)) + 0.012 - r * 0.95 * t * t;
    out.push({ x: Math.cos(a) * d, y, z: Math.sin(a) * d, r });
  }
  return out;
}

function branchStart(shape: TreeShape, i: number): Vector3 {
  const f = shape.branches[i]!.start;
  return new Vector3(shape.lean[0] * f * f, shape.trunkHeight * f, shape.lean[1] * f * f);
}

function branchTip(shape: TreeShape, i: number): Vector3 {
  const b = shape.branches[i]!;
  const s = branchStart(shape, i);
  const h = Math.sin(b.tilt) * b.length;
  return new Vector3(s.x + Math.cos(b.angle) * h, s.y + Math.cos(b.tilt) * b.length, s.z + Math.sin(b.angle) * h);
}

interface DynRoot {
  part: Part;
  ember: ParticleSystem | null;
  mid: Vector3;
  len: number;
  health: number;
}

export function buildTree(scene: Scene, shape: TreeShape, scale: number, opts: TreeOptions = {}): TreeHandle {
  const root = new TransformNode('tree.root', scene);
  root.scaling.setAll(scale);
  if (opts.position) root.position.copyFrom(opts.position);
  const bake = !opts.woodMaterial;
  const wood = opts.woodMaterial ?? sharedUnlit(scene, 'wood');
  const leaf = opts.leafMaterial ?? sharedUnlit(scene, 'leaf');
  const dynB = new Set(opts.dynamicBranches ?? []);
  const dynR = new Set(opts.dynamicRoots ?? []);

  const makePart = (mesh: Mesh, isRoot: boolean): Part => ({
    mesh,
    healthy: colorsFor(mesh, WOOD_LO, WOOD_HI, isRoot, bake, false),
    dry: colorsFor(mesh, DRY_LO, DRY_HI, isRoot, bake, true),
  });
  const tube = (name: string, path: Vector3[], radius: (i: number, d: number) => number, tess: number): Mesh =>
    MeshBuilder.CreateTube(name, { path, radiusFunction: radius, tessellation: tess, cap: Mesh.CAP_END }, scene);
  /** A soft clump. `atOrigin`: geometry around (0,0,0) and the mesh moved there, so it can scale in place. */
  const blob = (name: string, p: Vector3, r: number, atOrigin: boolean): Mesh => {
    const c = MeshBuilder.CreateSphere(name, { diameter: r * 2, segments: 6 }, scene);
    c.scaling.y = 0.78;
    if (!atOrigin) c.position.copyFrom(p);
    c.bakeCurrentTransformIntoVertices();
    roundNormals(c, atOrigin ? 0 : p.x, atOrigin ? 0 : p.y, atOrigin ? 0 : p.z, 0.85);
    if (atOrigin) c.position.copyFrom(p);
    return c;
  };

  // Trunk (always static).
  const trunkPath: Vector3[] = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    trunkPath.push(new Vector3(shape.lean[0] * t * t, shape.trunkHeight * t - 0.02, shape.lean[1] * t * t));
  }
  const trunk = tube('tree.trunk', trunkPath, (_i, d) => shape.trunkRadiusBase + (shape.trunkRadiusTop - shape.trunkRadiusBase) * d, 9);

  const staticWood: Mesh[] = [trunk];
  const staticLeaves: Mesh[] = [];
  const branchPart = new Map<number, { part: Part; leaf: Mesh }>();
  const rootPart = new Map<number, DynRoot>();

  shape.branches.forEach((b, i) => {
    const from = branchStart(shape, i);
    const tip = branchTip(shape, i);
    const mid = Vector3.Lerp(from, tip, 0.5);
    mid.y += 0.02;
    const m = tube(`tree.branch${i}`, [from, mid, tip], (_k, d) => b.radius * (1 - 0.6 * d), 5);
    const leafAt = tip.add(new Vector3(0, 0.03, 0));
    if (dynB.has(i)) branchPart.set(i, { part: makePart(m, false), leaf: blob(`tree.leaf${i}`, leafAt, 0.07, true) });
    else {
      staticWood.push(m);
      staticLeaves.push(blob(`tree.leaf${i}`, leafAt, 0.07, false));
    }
  });

  shape.roots.forEach((rt, i) => {
    const line = rootLine(shape, i);
    const m = tube(`tree.root${i}`, line.map((p) => new Vector3(p.x, p.y, p.z)), (k) => line[Math.min(line.length - 1, k)]!.r, 6);
    if (dynR.has(i)) {
      const p = line[Math.floor(line.length * 0.5)]!;
      rootPart.set(i, { part: makePart(m, true), ember: null, mid: new Vector3(p.x, p.y, p.z), len: rt.length, health: 1 });
    } else staticWood.push(m);
  });

  // Crown blobs + static leaves in one mesh.
  const crownParts = shape.crown.map(([x, y, z, r], k) => blob(`tree.crown${k}`, new Vector3(x, y, z), r, false));
  const crownMesh = Mesh.MergeMeshes([...crownParts, ...staticLeaves], true)!;
  crownMesh.name = 'tree.crown';
  paintLeaf(crownMesh, bake);
  crownMesh.material = leaf;
  crownMesh.parent = root;

  // Static wood: one mesh, healthy.
  for (const m of staticWood) m.setVerticesData(VertexBuffer.ColorKind, colorsFor(m, WOOD_LO, WOOD_HI, false, bake, false));
  const woodMesh = Mesh.MergeMeshes(staticWood, true)!;
  woodMesh.name = 'tree.wood';
  woodMesh.material = wood;
  woodMesh.parent = root;

  for (const m of [crownMesh, woodMesh]) {
    m.isPickable = false;
    m.freezeWorldMatrix();
  }
  for (const [, v] of branchPart) {
    v.part.mesh.material = wood;
    v.part.mesh.parent = root;
    v.part.mesh.isPickable = false;
    paintLeaf(v.leaf, bake);
    v.leaf.material = leaf;
    v.leaf.parent = root;
    v.leaf.isPickable = false;
  }
  for (const [, v] of rootPart) {
    v.part.mesh.material = wood;
    v.part.mesh.parent = root;
    v.part.mesh.isPickable = false;
  }

  const apply = (p: Part, health: number): void => {
    const out = new Float32Array(p.healthy.length);
    for (let i = 0; i < out.length; i++) out[i] = p.dry[i]! + (p.healthy[i]! - p.dry[i]!) * health;
    p.mesh.setVerticesData(VertexBuffer.ColorKind, out, true);
  };
  const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

  const setBranchHealth = (i: number, v: number): void => {
    const b = branchPart.get(i);
    if (!b) return;
    const h = clamp01(v);
    apply(b.part, h);
    // Leaves grow back from nothing; none at all while the branch is dry.
    const k = Math.max(0, (h - 0.25) / 0.75);
    b.leaf.scaling.setAll(Math.max(0.001, k));
    b.leaf.setEnabled(k > 0.02);
  };

  const makeEmbers = (len: number): ParticleSystem => {
    const e = TUNING.tree.ember;
    const ps = new ParticleSystem('tree.embers', e.capacity, scene);
    ps.particleTexture = procTexture(scene, 'dot');
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.color1 = new Color4(1, 0.55, 0.2, 0.9);
    ps.color2 = new Color4(1, 0.35, 0.12, 0.7);
    ps.colorDead = new Color4(0.6, 0.15, 0.05, 0);
    ps.minSize = e.size * 0.6 * scale;
    ps.maxSize = e.size * scale;
    ps.minLifeTime = 1.2;
    ps.maxLifeTime = 2.4;
    ps.direction1 = new Vector3(-0.2, 1, -0.2);
    ps.direction2 = new Vector3(0.2, 1.5, 0.2);
    ps.minEmitPower = e.rise * scale;
    ps.maxEmitPower = e.rise * 2 * scale;
    ps.gravity = new Vector3(0, 0.05 * scale, 0);
    const half = len * 0.25 * scale;
    ps.minEmitBox = new Vector3(-half, 0, -half);
    ps.maxEmitBox = new Vector3(half, 0.02 * scale, half);
    ps.emitter = new Vector3();
    ps.emitRate = 0;
    ps.start();
    return ps;
  };

  const setRootHealth = (i: number, v: number): void => {
    const r = rootPart.get(i);
    if (!r) return;
    r.health = clamp01(v);
    apply(r.part, r.health);
    if (r.health < 0.98 && !r.ember) r.ember = makeEmbers(r.len);
    if (r.ember) r.ember.emitRate = r.health < 0.98 ? TUNING.tree.ember.rate * (1 - r.health) : 0;
  };

  const tmp = new Vector3();
  const handle: TreeHandle = {
    root,
    setBranchHealth,
    setRootHealth,
    update(): void {
      for (const [, r] of rootPart) {
        if (!r.ember) continue;
        tmp.copyFrom(r.mid).scaleInPlace(scale);
        (r.ember.emitter as Vector3).copyFrom(root.getAbsolutePosition()).addInPlace(tmp);
      }
    },
    rootSamples(i: number): RootSample[] {
      return rootLine(shape, i).map((p) => ({ x: p.x * scale, y: p.y * scale, z: p.z * scale, r: p.r * scale }));
    },
    dispose(): void {
      for (const [, r] of rootPart) r.ember?.dispose();
      root.dispose(false, false);
    },
  };

  for (const i of dynB) setBranchHealth(i, opts.branchHealth ?? 1);
  for (const i of dynR) setRootHealth(i, opts.rootHealth ?? 1);
  return handle;
}

function paintLeaf(mesh: Mesh, bake: boolean): void {
  mesh.setVerticesData(VertexBuffer.ColorKind, colorsFor(mesh, LEAF_LO, LEAF_HI, false, bake, false));
}
