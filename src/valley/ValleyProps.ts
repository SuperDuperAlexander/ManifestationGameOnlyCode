import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { Random } from '../core/Random';
import { noise2 } from './noise';
import { paintFlat, paintGradient, rgb, type Rgb } from './colors';
import { LAYOUT } from './valleyLayout';
import type { ValleyTerrain } from './ValleyTerrain';

export interface Collider {
  x: number;
  z: number;
  radius: number;
  /** False = does not block (a fog that was released). */
  active?: boolean;
}

export interface ShadowSpot {
  x: number;
  z: number;
  radius: number;
  strength: number;
}

interface Placement {
  x: number;
  y: number;
  z: number;
  scale: number;
  /** Extra stretch (x, y, z) on top of the scale. */
  stretch?: [number, number, number];
  rotY: number;
  tiltX?: number;
  tiltZ?: number;
  tint: Rgb;
}

/**
 * All plants and rocks, made from simple shapes and painted with vertex colours.
 * Each kind is one mesh drawn many times (thin instances): one draw call per kind.
 */
export class ValleyProps {
  readonly colliders: Collider[] = [];
  readonly shadows: ShadowSpot[] = [];
  readonly meshes: Mesh[] = [];
  private readonly rnd = new Random('light-within-valley-2');
  private readonly trees: { x: number; z: number }[] = [];

  constructor(
    scene: Scene,
    private readonly terrain: ValleyTerrain,
    materials: { plants: ShaderMaterial; solid: ShaderMaterial; grass: ShaderMaterial },
  ) {
    const c = TUNING.valley.counts;
    this.add(roundTree(scene), this.placeRoundTrees(c.roundTrees), materials.plants);
    this.add(cypress(scene), this.placeCypresses(c.cypresses), materials.plants);
    this.add(bush(scene), this.placeBushes(c.bushes), materials.plants);
    this.add(rock(scene, 7), this.placeRocks(c.rocks), materials.solid);
    this.add(grassTuft(scene, this.rnd), this.placeGrass(c.grassTufts), materials.grass);
    this.add(flower(scene), this.placeFlowers(c.flowers), materials.grass);
  }

  private add(template: Mesh, items: Placement[], material: ShaderMaterial): void {
    const matrices = new Float32Array(items.length * 16);
    const colors = new Float32Array(items.length * 4);
    const q = new Quaternion();
    const s = new Vector3();
    const t = new Vector3();
    const m = new Matrix();
    items.forEach((it, i) => {
      const st = it.stretch ?? [1, 1, 1];
      s.set(it.scale * st[0], it.scale * st[1], it.scale * st[2]);
      Quaternion.RotationYawPitchRollToRef(it.rotY, it.tiltX ?? 0, it.tiltZ ?? 0, q);
      t.set(it.x, it.y, it.z);
      Matrix.ComposeToRef(s, q, t, m);
      m.copyToArray(matrices, i * 16);
      colors.set([it.tint[0], it.tint[1], it.tint[2], 1], i * 4);
    });
    template.thinInstanceSetBuffer('matrix', matrices, 16, true);
    template.thinInstanceSetBuffer('color', colors, 4, true);
    template.thinInstanceRefreshBoundingInfo(false);
    template.material = material;
    template.isPickable = false;
    template.freezeWorldMatrix();
    this.meshes.push(template);
  }

  /** A random point in the valley that passes the test, or null. */
  private find(test: (x: number, z: number) => boolean, tries = 40): [number, number] | null {
    const v = TUNING.valley;
    for (let i = 0; i < tries; i++) {
      const x = this.rnd.range(-v.floorRadiusX * 1.5, v.floorRadiusX * 1.5);
      const z = this.rnd.range(-v.floorRadiusZ * 1.3, v.floorRadiusZ * 1.3);
      if (test(x, z)) return [x, z];
    }
    return null;
  }

  /** True where nothing big may stand: path, river, chasm, fogs, landmarks. */
  private open(x: number, z: number, margin: number): boolean {
    const t = this.terrain;
    if (t.pathDistance(x, z) < LAYOUT.pathWidth + margin) return false;
    if (t.riverDistance(x, z) < LAYOUT.river.halfWidth + 1 + margin) return false;
    if (Math.abs(z - LAYOUT.chasm.z) < LAYOUT.chasm.halfWidth + 1.5 + margin) return false;
    for (const c of LAYOUT.clearings) if (Math.hypot(x - c.x, z - c.z) < c.radius + margin) return false;
    return true;
  }

  private farFromTrees(x: number, z: number, gap: number): boolean {
    for (const tr of this.trees) if (Math.hypot(x - tr.x, z - tr.z) < gap) return false;
    return true;
  }

  private tint(bright: number, warm: number): Rgb {
    const b = 1 + this.rnd.jitter(bright);
    const w = this.rnd.jitter(warm);
    return [b * (1 + w), b, b * (1 - w)];
  }

  private placeRoundTrees(count: number): Placement[] {
    const t = this.terrain;
    const out: Placement[] = [];
    // The old oak on the hill: one big tree, a landmark.
    const oak = LAYOUT.oak;
    out.push({ x: oak.x, y: t.height(oak.x, oak.z) - 0.2, z: oak.z, scale: 1.9, rotY: 0.4, tint: [1.03, 1.0, 0.94] });
    this.trees.push(oak);
    this.colliders.push({ x: oak.x, z: oak.z, radius: 0.9 });
    this.shadows.push({ x: oak.x, z: oak.z, radius: 6, strength: 0.4 });
    for (let i = 0; i < count; i++) {
      const p = this.find((x, z) => {
        const q = t.rimDistance(x, z);
        return (
          q > 0.2 &&
          q < 0.97 &&
          t.slope(x, z) < 0.45 &&
          this.open(x, z, 1.8) &&
          this.farFromTrees(x, z, 4.5) &&
          noise2(x * 0.07 + 2, z * 0.07) > 0.36
        );
      });
      if (!p) continue;
      const [x, z] = p;
      const scale = this.rnd.range(0.8, 1.2);
      out.push({ x, y: t.height(x, z) - 0.15, z, scale, rotY: this.rnd.range(0, 6.28), tint: this.tint(0.07, 0.04) });
      this.trees.push({ x, z });
      this.colliders.push({ x, z, radius: 0.4 * scale });
      this.shadows.push({ x, z, radius: 2.8 * scale, strength: 0.42 });
    }
    return out;
  }

  private placeCypresses(count: number): Placement[] {
    const t = this.terrain;
    const out: Placement[] = [];
    for (let i = 0; i < count; i++) {
      // Most near the cliffs on the valley floor, some up on the ledges and the ridge.
      const high = i % 3 === 0;
      const p = this.find((x, z) => {
        const q = t.rimDistance(x, z);
        const h = t.height(x, z);
        const inRange = high ? (q > 1.0 && q < 1.5) || (h > 3 && q < 1) : q > 0.5 && q < 0.98;
        return inRange && t.slope(x, z) < 0.3 && this.open(x, z, 1) && this.farFromTrees(x, z, 2.4);
      }, 60);
      if (!p) continue;
      const [x, z] = p;
      const scale = this.rnd.range(0.75, 1.25);
      out.push({
        x,
        y: t.height(x, z) - 0.1,
        z,
        scale,
        stretch: [1, this.rnd.range(0.9, 1.25), 1],
        rotY: this.rnd.range(0, 6.28),
        tint: this.tint(0.08, 0.03),
      });
      this.trees.push({ x, z });
      this.colliders.push({ x, z, radius: 0.45 * scale });
      this.shadows.push({ x, z, radius: 1.6 * scale, strength: 0.38 });
    }
    return out;
  }

  private placeBushes(count: number): Placement[] {
    const t = this.terrain;
    const out: Placement[] = [];
    for (let i = 0; i < count; i++) {
      const p = this.find((x, z) => {
        const q = t.rimDistance(x, z);
        return q < 1.0 && t.slope(x, z) < 0.5 && this.open(x, z, 0.4) && this.farFromTrees(x, z, 1.6);
      });
      if (!p) continue;
      const [x, z] = p;
      const scale = this.rnd.range(0.7, 1.3);
      out.push({ x, y: t.height(x, z) - 0.1, z, scale, rotY: this.rnd.range(0, 6.28), tint: this.tint(0.08, 0.04) });
      this.colliders.push({ x, z, radius: 0.6 * scale });
      this.shadows.push({ x, z, radius: 1.3 * scale, strength: 0.32 });
    }
    return out;
  }

  private placeRocks(count: number): Placement[] {
    const t = this.terrain;
    const out: Placement[] = [];
    for (let i = 0; i < count; i++) {
      const nearCliff = i % 2 === 0;
      const p = this.find((x, z) => {
        const q = t.rimDistance(x, z);
        // Rocks gather at the cliff foot, along the river and at the ridge.
        const inRange = nearCliff
          ? (q > 0.84 && q < 1.02) || Math.abs(z - LAYOUT.ridge.z) < LAYOUT.ridge.halfThickness + 3
          : q > 0.2 && q < 0.9;
        return inRange && t.slope(x, z) < 0.9 && this.open(x, z, 0.3) && this.farFromTrees(x, z, 1.4);
      });
      if (!p) continue;
      const [x, z] = p;
      const big = this.rnd.next() < 0.18;
      const scale = big ? this.rnd.range(1.4, 2.3) : this.rnd.range(0.35, 1.0);
      out.push({
        x,
        y: t.height(x, z) - 0.12 * scale,
        z,
        scale,
        stretch: [this.rnd.range(0.9, 1.35), this.rnd.range(0.6, 0.95), this.rnd.range(0.85, 1.2)],
        rotY: this.rnd.range(0, 6.28),
        tiltX: this.rnd.jitter(0.12),
        tiltZ: this.rnd.jitter(0.12),
        tint: this.tint(0.06, 0.05),
      });
      if (scale > 0.55) this.colliders.push({ x, z, radius: scale * 0.8 });
      this.shadows.push({ x, z, radius: scale * 1.3, strength: 0.28 });
    }
    return out;
  }

  private placeGrass(count: number): Placement[] {
    const t = this.terrain;
    const out: Placement[] = [];
    for (let i = 0; i < count; i++) {
      const p = this.find((x, z) => {
        // Clumps first (cheap): dense in some places, bare in others.
        if (noise2(x * 0.18 + 7, z * 0.18) < 0.32 + this.rnd.next() * 0.3) return false;
        if (t.rimDistance(x, z) > 1.05 || t.pathDistance(x, z) < LAYOUT.pathWidth * 0.6) return false;
        if (t.riverDistance(x, z) < LAYOUT.river.halfWidth + 0.6 || t.isChasm(x, z)) return false;
        return t.slope(x, z) < 0.6;
      }, 20);
      if (!p) continue;
      const [x, z] = p;
      out.push({
        x,
        y: t.height(x, z) - 0.03,
        z,
        scale: this.rnd.range(0.7, 1.3),
        rotY: this.rnd.range(0, 6.28),
        tint: this.tint(0.1, 0.05),
      });
    }
    return out;
  }

  private placeFlowers(count: number): Placement[] {
    const t = this.terrain;
    const out: Placement[] = [];
    // Small clusters of white flowers, like in the painted meadow.
    while (out.length < count) {
      const p = this.find((x, z) => {
        if (noise2(x * 0.12 - 3, z * 0.12 + 8) < 0.55) return false;
        if (t.rimDistance(x, z) > 0.95 || t.pathDistance(x, z) < LAYOUT.pathWidth * 0.8) return false;
        return t.riverDistance(x, z) > LAYOUT.river.halfWidth + 1 && !t.isChasm(x, z) && t.slope(x, z) < 0.4;
      }, 30);
      if (!p) break;
      const n = 3 + Math.floor(this.rnd.next() * 5);
      for (let k = 0; k < n && out.length < count; k++) {
        const x = p[0] + this.rnd.jitter(0.9);
        const z = p[1] + this.rnd.jitter(0.9);
        out.push({
          x,
          y: t.height(x, z) - 0.02,
          z,
          scale: this.rnd.range(0.7, 1.2),
          rotY: this.rnd.range(0, 6.28),
          tiltX: this.rnd.jitter(0.2),
          tiltZ: this.rnd.jitter(0.2),
          tint: this.tint(0.04, 0.02),
        });
      }
    }
    return out;
  }
}

/**
 * Round tree, like the painted one: a warm trunk that forks into branches,
 * and a crown of soft clumps. Each clump is shaded on its own, so the crown
 * reads as layered cut-paper clouds. About 5 m tall.
 */
function roundTree(scene: Scene): Mesh {
  const wood: Mesh[] = [];
  const trunk = MeshBuilder.CreateCylinder('tree.trunk', { height: 2.4, diameterTop: 0.3, diameterBottom: 0.5, tessellation: 7 }, scene);
  trunk.position.y = 1.2;
  wood.push(trunk);
  const branches: [number, number, number, number][] = [
    // angle around y, tilt, length, start height
    [0.3, 0.55, 1.7, 2.1],
    [2.4, 0.6, 1.5, 2.0],
    [4.4, 0.5, 1.4, 2.2],
    [1.3, 0.2, 1.3, 2.3],
  ];
  const tips: Vector3[] = [];
  for (const [a, tilt, len, y0] of branches) {
    const b = MeshBuilder.CreateCylinder('tree.branch', { height: len, diameterTop: 0.1, diameterBottom: 0.24, tessellation: 5 }, scene);
    b.bakeTransformIntoVertices(Matrix.Translation(0, len / 2, 0));
    b.rotation.set(0, a, tilt);
    b.position.y = y0;
    b.computeWorldMatrix(true);
    tips.push(Vector3.TransformCoordinates(new Vector3(0, len, 0), b.getWorldMatrix()));
    wood.push(b);
  }
  const trunkMesh = Mesh.MergeMeshes(wood, true)!;
  paintGradient(trunkMesh, '#9C6444', '#C68A5E');

  const clumps: Mesh[] = [];
  const add = (p: Vector3, r: number): void => {
    const c = MeshBuilder.CreateSphere('tree.clump', { diameter: r * 2, segments: 7 }, scene);
    c.scaling.y = 0.72;
    c.position.copyFrom(p);
    c.bakeCurrentTransformIntoVertices();
    // Each clump shades as one soft round shape.
    roundNormals(c, p, 0.85);
    clumps.push(c);
  };
  for (const tip of tips) add(tip.add(new Vector3(0, 0.35, 0)), 1.25);
  add(new Vector3(0, 4.0, 0), 1.45);
  add(new Vector3(0.6, 4.55, 0.3), 1.05);
  add(new Vector3(-0.8, 3.5, -0.6), 1.1);
  const crown = Mesh.MergeMeshes(clumps, true)!;
  paintGradient(crown, '#6D7B52', '#B3B67A', 2.2);
  const tree = Mesh.MergeMeshes([trunkMesh, crown], true)!;
  tree.name = 'valley.roundTree';
  return tree;
}

/** Cypress: a tall soft flame of dark green. About 5.8 m tall. */
function cypress(scene: Scene): Mesh {
  const trunk = MeshBuilder.CreateCylinder('cyp.trunk', { height: 1.2, diameterTop: 0.14, diameterBottom: 0.24, tessellation: 6 }, scene);
  trunk.position.y = 0.6;
  trunk.bakeCurrentTransformIntoVertices();
  paintGradient(trunk, '#7E5238', '#9A6A48');
  const shape = [
    new Vector3(0, 0.8, 0),
    new Vector3(0.5, 1.05, 0),
    new Vector3(0.74, 1.9, 0),
    new Vector3(0.74, 3.0, 0),
    new Vector3(0.52, 4.4, 0),
    new Vector3(0.22, 5.4, 0),
    new Vector3(0, 5.8, 0),
  ];
  const body = MeshBuilder.CreateLathe('cyp.body', { shape, tessellation: 10 }, scene);
  roundNormals(body, new Vector3(0, 3.0, 0), 0.35);
  paintGradient(body, '#55623E', '#8F9C62', 1.0);
  const tree = Mesh.MergeMeshes([trunk, body], true)!;
  tree.name = 'valley.cypress';
  return tree;
}

/** A low bush of three to four soft clumps. About 1.2 m tall. */
function bush(scene: Scene): Mesh {
  const parts: Mesh[] = [];
  const blobs: [number, number, number, number][] = [
    [0, 0.55, 0, 0.75],
    [0.65, 0.4, 0.2, 0.55],
    [-0.6, 0.42, -0.1, 0.58],
    [0.1, 0.4, -0.55, 0.5],
  ];
  for (const [x, y, z, r] of blobs) {
    const b = MeshBuilder.CreateSphere('bush.blob', { diameter: r * 2, segments: 6 }, scene);
    b.scaling.y = 0.8;
    b.position.set(x, y, z);
    b.bakeCurrentTransformIntoVertices();
    roundNormals(b, new Vector3(x, y, z), 0.8);
    parts.push(b);
  }
  const m = Mesh.MergeMeshes(parts, true)!;
  paintGradient(m, '#66744C', '#A5AD72', 0.3);
  m.name = 'valley.bush';
  return m;
}

/** A soft, lumpy rock. About 1 m wide. */
function rock(scene: Scene, seed: number): Mesh {
  const m = MeshBuilder.CreateSphere('valley.rock', { diameter: 1, segments: 5, updatable: true }, scene);
  const pos = m.getVerticesData(VertexBuffer.PositionKind)!;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i]!;
    const y = pos[i + 1]!;
    const z = pos[i + 2]!;
    // Same bump for the same point, so the seam of the sphere stays closed.
    const k = 0.82 + 0.36 * noise2(x * 3 + seed, z * 3 + y * 2.3);
    pos[i] = x * k;
    pos[i + 1] = y < 0 ? y * 0.35 * k : y * k;
    pos[i + 2] = z * k;
  }
  m.updateVerticesData(VertexBuffer.PositionKind, pos);
  const idx = m.getIndices()!;
  const normals: number[] = [];
  VertexData.ComputeNormals(pos, idx, normals);
  m.updateVerticesData(VertexBuffer.NormalKind, normals);
  roundNormals(m, new Vector3(0, 0.1, 0), 0.5);
  paintGradient(m, '#8E8A90', '#D0C7BC');
  return m;
}

/** A tuft of grass: a few thin blades. Normals point up, so it takes the ground's light. */
function grassTuft(scene: Scene, rnd: Random): Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const base = rgb('#6F8447');
  const tip = rgb('#B6C173');
  const blades = 8;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + rnd.jitter(0.4);
    const r = rnd.range(0, 0.1);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = rnd.range(0.22, 0.42);
    const lean = rnd.range(0.08, 0.18);
    const w = 0.045;
    const sx = -Math.sin(a) * w;
    const sz = Math.cos(a) * w;
    const n = positions.length / 3;
    positions.push(x - sx, 0, z - sz, x + sx, 0, z + sz, x + Math.cos(a) * lean, h, z + Math.sin(a) * lean);
    colors.push(...base, 0, ...base, 0, ...tip, 1);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    indices.push(n, n + 1, n + 2);
  }
  const mesh = new Mesh('valley.grass', scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.colors = colors;
  data.applyToMesh(mesh);
  return mesh;
}

/** A small white flower on a thin stem. */
function flower(scene: Scene): Mesh {
  const stem = MeshBuilder.CreateCylinder('fl.stem', { height: 0.24, diameter: 0.02, tessellation: 3 }, scene);
  stem.position.y = 0.12;
  stem.bakeCurrentTransformIntoVertices();
  paintFlat(stem, '#7F8A55', 0.4);
  const petals = MeshBuilder.CreateDisc('fl.petals', { radius: 0.12, tessellation: 6 }, scene);
  petals.rotation.x = Math.PI / 2;
  petals.position.y = 0.24;
  petals.bakeCurrentTransformIntoVertices();
  paintFlat(petals, '#FBF6EA', 1);
  const heart = MeshBuilder.CreateDisc('fl.heart', { radius: 0.042, tessellation: 6 }, scene);
  heart.rotation.x = Math.PI / 2;
  heart.position.y = 0.245;
  heart.bakeCurrentTransformIntoVertices();
  paintFlat(heart, '#EBC57A', 1);
  const m = Mesh.MergeMeshes([stem, petals, heart], true)!;
  // Normals up: the flower takes the light like the ground around it.
  const count = m.getTotalVertices();
  const normals = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) normals[i * 3 + 1] = 1;
  m.setVerticesData(VertexBuffer.NormalKind, normals);
  m.name = 'valley.flower';
  return m;
}

/**
 * Bends the normals toward "away from the centre". A blob then shades
 * like one soft round shape: the painted look of the reference trees.
 */
function roundNormals(mesh: Mesh, centre: Vector3, amount: number): void {
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  const nor = mesh.getVerticesData(VertexBuffer.NormalKind)!;
  const out = new Float32Array(nor.length);
  for (let i = 0; i < pos.length; i += 3) {
    let dx = pos[i]! - centre.x;
    let dy = pos[i + 1]! - centre.y;
    let dz = pos[i + 2]! - centre.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l;
    dy /= l;
    dz /= l;
    let nx = nor[i]! * (1 - amount) + dx * amount;
    let ny = nor[i + 1]! * (1 - amount) + dy * amount;
    let nz = nor[i + 2]! * (1 - amount) + dz * amount;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    out[i] = nx;
    out[i + 1] = ny;
    out[i + 2] = nz;
  }
  mesh.setVerticesData(VertexBuffer.NormalKind, out);
}
