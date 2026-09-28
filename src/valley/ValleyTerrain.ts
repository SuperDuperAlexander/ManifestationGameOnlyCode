import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { Scene } from '@babylonjs/core/scene';
import type { Material } from '@babylonjs/core/Materials/material';
import { TUNING } from '../config/tuning';
import { lerp, smoothstep } from '../core/Random';
import { fbm, noise2 } from './noise';
import { LAYOUT } from './valleyLayout';
import { mixRgb, rgb, type Rgb } from './colors';
import { DistanceField, smoothLine } from './DistanceField';

/**
 * The valley ground: a long closed valley with a rolling floor, a winding path,
 * a river, a rock ridge with one pass, a deep chasm in the north, and terraced
 * sandstone cliffs all around. The height is a formula, so walking, placing props
 * and the mesh all agree.
 */
export class ValleyTerrain {
  readonly mesh: Mesh;
  readonly extentX = 60;
  readonly extentZ = 100;
  /** The path as a smooth line of points. */
  readonly pathLine: [number, number][];
  readonly riverLine: [number, number][];
  private readonly cols: number;
  private readonly rows: number;
  private readonly colors: Float32Array;
  private readonly pathField: DistanceField;
  private readonly riverField: DistanceField;

  constructor(scene: Scene, material: Material) {
    this.pathLine = smoothLine(LAYOUT.path, 10);
    this.riverLine = smoothLine(LAYOUT.river.points, 10);
    const ex = this.extentX;
    const ez = this.extentZ;
    this.pathField = new DistanceField(this.pathLine, -ex, -ez, ex, ez, 0.5, 8);
    this.riverField = new DistanceField(this.riverLine, -ex, -ez, ex, ez, 0.5, 10);

    const cell = TUNING.valley.terrainCell;
    this.cols = Math.round((ex * 2) / cell);
    this.rows = Math.round((ez * 2) / cell);
    const w = this.cols + 1;
    const count = w * (this.rows + 1);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 4);
    const heights = new Float32Array(count);
    for (let j = 0; j <= this.rows; j++) {
      for (let i = 0; i <= this.cols; i++) {
        const x = -ex + (i / this.cols) * ex * 2;
        const z = -ez + (j / this.rows) * ez * 2;
        const o = j * w + i;
        const h = this.height(x, z);
        heights[o] = h;
        positions[o * 3] = x;
        positions[o * 3 + 1] = h;
        positions[o * 3 + 2] = z;
      }
    }
    // Slope from the neighbours (cheaper than asking the formula again).
    for (let j = 0; j <= this.rows; j++) {
      for (let i = 0; i <= this.cols; i++) {
        const o = j * w + i;
        const hx = heights[j * w + Math.min(this.cols, i + 1)]! - heights[j * w + Math.max(0, i - 1)]!;
        const hz = heights[Math.min(this.rows, j + 1) * w + i]! - heights[Math.max(0, j - 1) * w + i]!;
        const slope = Math.hypot(hx, hz) / (2 * cell);
        const [c, grass] = this.groundColor(positions[o * 3]!, positions[o * 3 + 2]!, heights[o]!, slope);
        colors.set([c[0], c[1], c[2], grass], o * 4);
      }
    }
    const indices = new Uint32Array(this.cols * this.rows * 6);
    let n = 0;
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const a = j * w + i;
        const b = a + 1;
        const c = a + w;
        const d = c + 1;
        indices.set([a, b, c, b, d, c], n);
        n += 6;
      }
    }
    const normals = new Float32Array(count * 3);
    VertexData.ComputeNormals(positions, indices, normals);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.colors = colors;
    this.mesh = new Mesh('valley.terrain', scene);
    data.applyToMesh(this.mesh, true);
    this.colors = colors;
    this.mesh.material = material;
    this.mesh.isPickable = false;
    this.mesh.freezeWorldMatrix();
  }

  /** Ground height at a point. */
  height(x: number, z: number): number {
    const v = TUNING.valley;
    const q = this.rimDistance(x, z);

    // Floor: soft rolling ground and a few gentle hills.
    let h = fbm(x * 0.06 + 3, z * 0.06 - 5, 3) * 1.2;
    for (const m of LAYOUT.mounds) {
      const d = Math.hypot(x - m.x, z - m.z) / m.radius;
      if (d < 1) {
        const k = 1 - d * d;
        h += m.height * k * k;
      }
    }
    // The path is a little flatter and lower, like a worn trail.
    h -= 0.12 * (1 - smoothstep(0, LAYOUT.pathWidth * 1.5, this.pathDistance(x, z)));

    // River bed.
    const r = LAYOUT.river;
    h = lerp(h, r.level - 0.95, smoothstep(r.halfWidth + 1.8, r.halfWidth * 0.45, this.riverDistance(x, z)));

    // The rock ridge with its one pass.
    const g = LAYOUT.ridge;
    const rz = Math.abs(z - g.z + fbm(x * 0.1, 3, 2) * 1.6);
    let ridge = g.height * smoothstep(g.halfThickness + 1.3, g.halfThickness - 0.7, rz);
    if (ridge > 0) {
      ridge *= 0.8 + 0.4 * noise2(x * 0.15, 7);
      ridge *= smoothstep(g.passHalfWidth, g.passHalfWidth + 1.5, Math.abs(x - g.passX + fbm(z * 0.3, 1, 2) * 0.5));
      h += terrace(ridge, 2.2);
    }

    // Rim: terraced cliffs rise all around. Some parts are lower, so the far mountains show.
    let t = smoothstep(0.86, 1.4, q);
    for (const f of LAYOUT.flats) t *= smoothstep(f.radius * 0.6, f.radius, Math.hypot(x - f.x, z - f.z));
    if (t > 0) {
      const ang = Math.atan2(z / v.floorRadiusZ, x / v.floorRadiusX);
      const saddle = 0.6 + 0.75 * noise2(Math.cos(ang) * 2.2 + 5, Math.sin(ang) * 2.2 - 3);
      let rise = Math.pow(t, 1.2) * v.rimHeight * saddle + Math.max(0, q - 1.4) * 9;
      rise += fbm(x * 0.09, z * 0.09, 2) * 1.4 * t;
      h = h * (1 - t) + terrace(Math.max(0, rise), v.terraceStep);
    }

    // The chasm: a deep cut with stepped sandstone walls, right across the valley and the cliffs.
    const k = this.chasmFactor(x, z);
    if (k > 0) h -= terrace(k * k * LAYOUT.chasm.depth, 3.4);
    return h;
  }

  /** 0 outside the chasm, rising to 1 in its depth. */
  chasmFactor(x: number, z: number): number {
    const c = LAYOUT.chasm;
    const cz = Math.abs(z - c.z + fbm(x * 0.08, 11, 2) * 1.4);
    // A wide band of stepped ledges down to a narrow floor: the layered canyon look.
    return smoothstep(c.halfWidth + 0.3, c.halfWidth - 4.5, cz);
  }

  /** 0 at the centre, 1 at the foot of the cliffs. A little wobbly, so the rim is not an ellipse. */
  rimDistance(x: number, z: number): number {
    const v = TUNING.valley;
    const q = Math.hypot(x / v.floorRadiusX, z / v.floorRadiusZ);
    return q + fbm(x * 0.045, z * 0.045, 3) * 0.18;
  }

  /** Rise per metre at a point. */
  slope(x: number, z: number): number {
    const e = 0.35;
    const dx = this.height(x + e, z) - this.height(x - e, z);
    const dz = this.height(x, z + e) - this.height(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  }

  /** True in the river. */
  isWater(x: number, z: number): boolean {
    return this.riverDistance(x, z) < LAYOUT.river.halfWidth + 0.15 && this.chasmFactor(x, z) === 0;
  }

  /** True over the chasm. */
  isChasm(x: number, z: number): boolean {
    return this.chasmFactor(x, z) > 0.06;
  }

  pathDistance(x: number, z: number): number {
    return this.pathField.at(x, z);
  }

  riverDistance(x: number, z: number): number {
    return this.riverField.at(x, z);
  }

  /** Painted ground colour and how much of it is grass (0..1). */
  private groundColor(x: number, z: number, h: number, s: number): [Rgb, number] {
    const n1 = noise2(x * 0.07 + 11, z * 0.07 - 4);
    const n2 = noise2(x * 0.31, z * 0.31);
    // Meadow: fresh green with warm sunny patches and deeper hollows, like the painted grass.
    let c = mixRgb(GRASS_DARK, GRASS_MID, smoothstep(0.25, 0.6, n1));
    c = mixRgb(c, GRASS_LIGHT, smoothstep(0.55, 0.85, n1) * 0.8);
    c = mixRgb(c, GRASS_DARK, (0.5 - n2) * 0.35 + 0.05);
    // Higher ledges: warmer, drier grass.
    c = mixRgb(c, GRASS_HIGH, smoothstep(3, 10, h) * 0.6);
    let grass = 1;

    // Sand path with a soft, uneven edge.
    const pd = this.pathDistance(x, z) + (n2 - 0.5) * 0.7;
    const sand = 1 - smoothstep(LAYOUT.pathWidth * 0.55, LAYOUT.pathWidth, pd);
    c = mixRgb(c, mixRgb(SAND_EDGE, SAND, smoothstep(LAYOUT.pathWidth * 0.8, 0.2, pd)), sand);
    grass -= sand;

    // River banks: pale pebbles.
    const rd = this.riverDistance(x, z) + (n2 - 0.5) * 0.8;
    const bank = 1 - smoothstep(LAYOUT.river.halfWidth + 0.4, LAYOUT.river.halfWidth + 1.4, rd);
    c = mixRgb(c, BANK, bank);
    grass -= bank;

    // Cliffs: sandstone walls with soft stripes, lilac low down.
    const cliff = smoothstep(0.7, 1.3, s);
    if (cliff > 0) {
      // Soft strata and vertical weathering streaks, like the painted sandstone.
      const band = 0.9 + 0.1 * Math.sin(h * 2.1 + n1 * 3) * (0.6 + 0.4 * noise2(x * 0.6, z * 0.6));
      const streak = 0.95 + 0.08 * noise2(x * 1.3 + z * 1.3, h * 0.25);
      let rock = mixRgb(ROCK_LOW, ROCK_MID, smoothstep(-3, 4, h));
      rock = mixRgb(rock, ROCK_TOP, smoothstep(6, 16, h));
      rock = mixRgb(rock, ROCK_WARM, n2 * 0.3);
      rock = [rock[0] * band * streak, rock[1] * band * streak, rock[2] * band * streak];
      c = mixRgb(c, rock, cliff);
      grass -= cliff;
    }
    // Deep in the chasm the rock fades into cool blue mist.
    if (h < -0.6) {
      // Inside the chasm: sandstone walls, the narrow ledges catch a lighter tone.
      const ledge = 1 - cliff;
      const band = 0.9 + 0.1 * Math.sin(h * 2.1 + n1 * 3);
      const wall = mixRgb(ROCK_MID, ROCK_TOP, ledge * 0.8);
      c = mixRgb(c, [wall[0] * band, wall[1] * band, wall[2] * band], smoothstep(-0.6, -2.5, h));
      c = mixRgb(c, CHASM_MID, smoothstep(-2, -9, h) * 0.6);
      c = mixRgb(c, CHASM_DEEP, smoothstep(-5, -16, h));
      grass = 0;
    }
    return [c, Math.max(0, grass)];
  }

  /**
   * Soft dark patches on the ground under trees and rocks. Painted once into the
   * vertex colours: shadows for free, nothing is computed at run time.
   */
  paintShadows(spots: { x: number; z: number; radius: number; strength: number }[]): void {
    const cell = (this.extentX * 2) / this.cols;
    const w = this.cols + 1;
    for (const s of spots) {
      // Shadows fall a little to the left (the light comes from the right).
      const cx = s.x - s.radius * 0.25;
      const cz = s.z + s.radius * 0.1;
      const r = s.radius;
      const i0 = Math.max(0, Math.floor((cx - r + this.extentX) / cell));
      const i1 = Math.min(this.cols, Math.ceil((cx + r + this.extentX) / cell));
      const j0 = Math.max(0, Math.floor((cz - r + this.extentZ) / cell));
      const j1 = Math.min(this.rows, Math.ceil((cz + r + this.extentZ) / cell));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = -this.extentX + i * cell;
          const z = -this.extentZ + j * cell;
          const d = Math.hypot(x - cx, z - cz) / r;
          if (d >= 1) continue;
          const k = 1 - s.strength * (1 - smoothstep(0.2, 1, d));
          const o = (j * w + i) * 4;
          // Toward a cool olive shade, never black.
          this.colors[o] = this.colors[o]! * k + 0.2 * (1 - k);
          this.colors[o + 1] = this.colors[o + 1]! * k + 0.25 * (1 - k);
          this.colors[o + 2] = this.colors[o + 2]! * k + 0.24 * (1 - k);
        }
      }
    }
    this.mesh.updateVerticesData(VertexBuffer.ColorKind, this.colors);
  }
}

/** Flat ledges with steep steps between them. */
function terrace(v: number, step: number): number {
  const k = v / step;
  const i = Math.floor(k);
  const f = k - i;
  return step * (i + 0.12 * f + 0.88 * smoothstep(0.6, 1, f));
}

const GRASS_DARK = rgb('#7C904E');
const GRASS_MID = rgb('#93A65A');
const GRASS_LIGHT = rgb('#B2BE6E');
const GRASS_HIGH = rgb('#B8B87A');
const SAND = rgb('#EAD8AE');
const SAND_EDGE = rgb('#D6C18F');
const BANK = rgb('#D9CDA8');
const ROCK_LOW = rgb('#C39585');
const ROCK_MID = rgb('#DDA27A');
const ROCK_TOP = rgb('#E8B48C');
const ROCK_WARM = rgb('#E0B596');
const CHASM_MID = rgb('#B7939A');
const CHASM_DEEP = rgb('#A7B6CF');
