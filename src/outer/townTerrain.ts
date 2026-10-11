import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Material } from '@babylonjs/core/Materials/material';
import { fbm, noise2 } from '../inner/noise';
import { mixRgb, rgb, type Rgb } from '../inner/colors';
import { segDist, type Segment } from '../world/Walkability';
import { TOWN, type HouseDef, type Lane } from './townLayout';

/**
 * The town's ground: a small valley basin. The height is a formula (so walking, props and the mesh
 * agree): gentle slope up the Town Edge and Main Street, a raised terrace for the Square, a flat
 * Alley floor, grassy banks outside the lanes, pads under the houses, a stream with a bridge,
 * and terraced sandstone cliffs all around (same recipe as the inner valley).
 */

export const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Flat ledges with steep steps between them (as in the valley). */
function terrace(v: number, step: number): number {
  const k = v / step;
  const i = Math.floor(k);
  const f = k - i;
  return step * (i + 0.12 * f + 0.88 * smooth(0.6, 1, f));
}

// --- Lanes -----------------------------------------------------------------------------------

type LaneKind = 'meadow' | 'street' | 'square' | 'alley';
const KINDS: LaneKind[] = ['meadow', 'street', 'square', 'alley'];

function segsOf(l: Lane): Segment[] {
  const out: Segment[] = [];
  const p = l.points;
  if (p.length === 1) out.push({ ax: p[0]![0], az: p[0]![1], bx: p[0]![0], bz: p[0]![1], halfWidth: l.halfWidth });
  for (let i = 0; i < p.length - 1; i++) out.push({ ax: p[i]![0], az: p[i]![1], bx: p[i + 1]![0], bz: p[i + 1]![1], halfWidth: l.halfWidth });
  return out;
}

const SEGS: Record<LaneKind, Segment[]> = {
  meadow: segsOf(TOWN.walk.meadow),
  street: segsOf(TOWN.walk.street),
  square: segsOf(TOWN.walk.square),
  alley: segsOf(TOWN.walk.alley),
};
/** Corridor segments of all lanes (for the colliders). */
export const LANE_SEGMENTS: Segment[] = KINDS.flatMap((k) => SEGS[k]);

/** Signed distance to a lane's edge: negative inside. */
export function laneDist(kind: LaneKind, x: number, z: number): number {
  let d = Infinity;
  for (const s of SEGS[kind]) d = Math.min(d, segDist(x, z, s) - s.halfWidth);
  return d;
}

/** Signed distance to the walkable area (negative inside). */
export function walkDist(x: number, z: number): number {
  let d = Infinity;
  for (const s of LANE_SEGMENTS) d = Math.min(d, segDist(x, z, s) - s.halfWidth);
  return d;
}

// --- Heights -----------------------------------------------------------------------------------

/** The big smooth shape: uphill to the Square, a terrace for it, lower towards the Alley. */
export function floorLevel(x: number, z: number): number {
  let b = -0.3 + 0.07 * clamp(z + 5, 0, 15) + 0.018 * clamp(z - 10, 0, 20) + 0.6 * smooth(26, 33, z);
  b -= 0.55 * smooth(-6, -13, x) * smooth(28, 34, z);
  return b;
}

/** Floor of the alley (flat). */
export const ALLEY_Y = floorLevel(-20, 42);

const RIM = { cx: -7, cz: 27, rx: 36, rz: 46, height: 15, step: 3.4 };

function rimQ(x: number, z: number): number {
  return Math.hypot((x - RIM.cx) / RIM.rx, (z - RIM.cz) / RIM.rz) + fbm(x * 0.045, z * 0.045, 3) * 0.16;
}

/** Ground without stream and house pads. */
function baseHeight(x: number, z: number): number {
  const dM = laneDist('meadow', x, z);
  const dA = laneDist('alley', x, z);
  const dW = Math.min(dM, laneDist('street', x, z), laneDist('square', x, z), dA);
  const out = Math.max(0, dW);
  let h = floorLevel(x, z);
  // Rolling ground: gentle in the meadow, almost flat on the stones, more outside.
  const meadowIn = 1 - smooth(-3, 0.5, dM);
  const amp = 0.06 + 0.5 * meadowIn + 1.0 * smooth(0, 3, out);
  h += fbm(x * 0.07 + 3, z * 0.07 - 5, 3) * amp;
  // The alley floor is flat.
  h = lerp(h, ALLEY_Y, 1 - smooth(-0.4, 1.4, dA));
  // Grassy banks rise outside the lanes.
  h += 1.5 * smooth(0.3, 4, out) + 0.3 * Math.min(10, Math.max(0, out - 4));
  // Terraced sandstone cliffs all around.
  const q = rimQ(x, z);
  const t = smooth(0.9, 1.4, q);
  if (t > 0) {
    const ang = Math.atan2((z - RIM.cz) / RIM.rz, (x - RIM.cx) / RIM.rx);
    const saddle = 0.6 + 0.75 * noise2(Math.cos(ang) * 2.2 + 5, Math.sin(ang) * 2.2 - 3);
    let rise = Math.pow(t, 1.2) * RIM.height * saddle + Math.max(0, q - 1.4) * 9;
    rise += fbm(x * 0.09, z * 0.09, 2) * 1.4 * t;
    h = h * (1 - t) + terrace(Math.max(0, rise), RIM.step);
  }
  return h;
}

// --- Stream and bridge ---------------------------------------------------------------------------

export function streamZ(x: number): number {
  const s = TOWN.stream;
  return s.zAt + s.wiggle * Math.sin(x * 0.25);
}

export function streamY(x: number): number {
  const s = TOWN.stream;
  return s.level0 + s.slope * x;
}

/** x where the stream begins: at the foot of the east cliff, where the ground climbs above the bank. */
export const STREAM_START_X: number = (() => {
  for (let x = 6; x < 40; x += 0.5) if (baseHeight(x, streamZ(x)) > 3.2) return x - 0.5;
  return 16;
})();

export const STREAM_POINTS: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  for (let x = STREAM_START_X; x > TOWN.stream.endX; x -= 1.5) out.push([x, streamY(x), streamZ(x)]);
  const e = TOWN.stream.endX;
  out.push([e, streamY(e), streamZ(e)]);
  return out;
})();

const STREAM_SEGS: Segment[] = STREAM_POINTS.slice(0, -1).map((p, i) => ({
  ax: p[0],
  az: p[2],
  bx: STREAM_POINTS[i + 1]![0],
  bz: STREAM_POINTS[i + 1]![2],
  halfWidth: 0,
}));

export function streamDist(x: number, z: number): number {
  let d = Infinity;
  for (const s of STREAM_SEGS) d = Math.min(d, segDist(x, z, s));
  return d;
}

// --- Houses ---------------------------------------------------------------------------------------

/** Rotation so the house's front (local -z) faces the nearest lane. */
export function houseRot(h: HouseDef): number {
  let best = Infinity;
  let fx = 0;
  let fz = -1;
  const segs = h.z > 10 ? LANE_SEGMENTS.filter((s) => !SEGS.meadow.includes(s)) : LANE_SEGMENTS;
  for (const s of segs) {
    const vx = s.bx - s.ax;
    const vz = s.bz - s.az;
    const len2 = vx * vx + vz * vz || 1;
    const t = clamp(((h.x - s.ax) * vx + (h.z - s.az) * vz) / len2, 0, 1);
    const px = s.ax + vx * t;
    const pz = s.az + vz * t;
    const d = Math.hypot(h.x - px, h.z - pz) - s.halfWidth;
    if (d < best) {
      best = d;
      fx = px - h.x;
      fz = pz - h.z;
    }
  }
  const l = Math.hypot(fx, fz) || 1;
  return Math.atan2(-fx / l, -fz / l) + Math.sin(h.seed * 7.3) * 0.07;
}

export interface HousePad {
  def: HouseDef;
  rot: number;
  /** Floor level (metres). */
  y: number;
}

/** The house specs for the HouseBuilder (its front is local +z, mine is -z: turned by pi). */
export const HOUSE_PADS: HousePad[] = TOWN.houses.map((def) => {
  const rot = houseRot(def);
  const fx = def.x - Math.sin(rot) * (def.d / 2 + 1.2);
  const fz = def.z - Math.cos(rot) * (def.d / 2 + 1.2);
  return { def, rot, y: floorLevel(fx, fz) + 0.1 };
});

function padWeight(p: HousePad, x: number, z: number): number {
  const c = Math.cos(p.rot);
  const s = Math.sin(p.rot);
  const dx = x - p.def.x;
  const dz = z - p.def.z;
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const sd = Math.max(Math.abs(lx) - (p.def.w / 2 + 0.7), Math.abs(lz) - (p.def.d / 2 + 0.7));
  return 1 - smooth(0, 1.8, sd);
}

/** True if (x, z) is inside the (slightly grown) footprint of a house; returns that house's roof top y. */
export function houseRoofAt(x: number, z: number, margin: number): number | null {
  for (const p of HOUSE_PADS) {
    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
    const dx = x - p.def.x;
    const dz = z - p.def.z;
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) < p.def.w / 2 + margin && Math.abs(lz) < p.def.d / 2 + margin) return p.y + 0.34 + p.def.floors * 2.9 + 3.0;
  }
  return null;
}

// --- Final height ---------------------------------------------------------------------------------

/** Ground height (no bridge). */
export function townHeight(x: number, z: number): number {
  let h = baseHeight(x, z);
  const st = TOWN.stream;
  // A small mound hides the end of the stream.
  const me = Math.hypot(x - (st.endX - 1.5), z - streamZ(st.endX));
  if (me < 4.5) h += 1.5 * (1 - smooth(0, 4.5, me));
  // Stream bed.
  if (x < STREAM_START_X + 1 && x > st.endX - 2) {
    const wx = smooth(st.endX - 1, st.endX + 3, x) * smooth(STREAM_START_X + 0.5, STREAM_START_X - 3, x);
    const w = (1 - smooth(st.halfWidth * 0.5, st.halfWidth + 1.4, streamDist(x, z))) * wx;
    if (w > 0) h = lerp(h, streamY(x) - 0.45, w);
  }
  // House pads.
  for (const p of HOUSE_PADS) {
    const w = padWeight(p, x, z);
    if (w > 0) h = lerp(h, p.y, w);
  }
  return h;
}

/** Height the player and citizens stand on: ground, or the bridge deck. */
export function walkHeight(x: number, z: number): number {
  let h = townHeight(x, z);
  const b = TOWN.bridge;
  if (Math.abs(x - b.x) < b.halfWidth + 0.4) {
    const dz = Math.abs(z - streamZ(b.x));
    if (dz < b.halfDeck + b.ramp) {
      const y = dz <= b.halfDeck ? b.deckY : lerp(b.deckY, b.rampEndY, (dz - b.halfDeck) / b.ramp);
      h = Math.max(h, y);
    }
  }
  return h;
}

// --- Mesh ----------------------------------------------------------------------------------------

const GRASS_DARK = rgb('#7C904E');
const GRASS_MID = rgb('#93A65A');
const GRASS_LIGHT = rgb('#B2BE6E');
const GRASS_HIGH = rgb('#B8B87A');
const SAND = rgb('#EAD8AE');
const SAND_EDGE = rgb('#D6C18F');
const PEBBLES = rgb('#D9CDA8');
const PAVE_A = rgb('#EBD3A8');
const PAVE_B = rgb('#DDB98D');
const PLAZA = rgb('#F2E4C6');
const EARTH = rgb('#B58C68');
const ROCK_LOW = rgb('#C39585');
const ROCK_MID = rgb('#DDA27A');
const ROCK_TOP = rgb('#E8B48C');
const ROCK_WARM = rgb('#E0B596');

/** The sandy way from the start to the bridge and the gate. */
const WAY: Segment[] = [
  [0.3, -3.6, 0.2, 1],
  [0.2, 1, 0.8, 3.8],
  [0.8, 3.8, 1, 8],
  [1, 8, 0.6, 10.5],
].map(([ax, az, bx, bz]) => ({ ax: ax!, az: az!, bx: bx!, bz: bz!, halfWidth: 0 }));

function groundColor(x: number, z: number, h: number, s: number): [Rgb, number] {
  const n1 = noise2(x * 0.07 + 11, z * 0.07 - 4);
  const n2 = noise2(x * 0.31, z * 0.31);
  let c = mixRgb(GRASS_DARK, GRASS_MID, smooth(0.25, 0.6, n1));
  c = mixRgb(c, GRASS_LIGHT, smooth(0.55, 0.85, n1) * 0.8);
  c = mixRgb(c, GRASS_DARK, (0.5 - n2) * 0.35 + 0.05);
  c = mixRgb(c, GRASS_HIGH, smooth(3, 10, h) * 0.6);
  let grass = 1;

  // Paved lanes: warm cobbles with a soft edge.
  const dP = Math.min(laneDist('street', x, z), laneDist('square', x, z), laneDist('alley', x, z));
  const pave = 1 - smooth(-0.3, 0.9, dP + (n2 - 0.5) * 0.9);
  if (pave > 0) {
    const cob = noise2(x * 2.4 + 20, z * 2.4) * 0.4 + noise2(x * 0.7, z * 0.7 + 8) * 0.3 + noise2(x * 0.2, z * 0.2) * 0.3;
    let pc = mixRgb(PAVE_A, PAVE_B, smooth(0.25, 0.8, cob));
    const f = TOWN.fountain;
    pc = mixRgb(pc, PLAZA, 0.6 * (1 - smooth(2.3, 4.4, Math.hypot(x - f.x, z - f.z))));
    const t = TOWN.oldTree;
    pc = mixRgb(pc, EARTH, 0.65 * (1 - smooth(1.6, 3.4, Math.hypot(x - t.x, z - t.z))));
    c = mixRgb(c, pc, pave);
    grass -= pave * 0.75;
  }
  // Sand way through the meadow.
  let wd = Infinity;
  for (const w of WAY) wd = Math.min(wd, segDist(x, z, w));
  wd += (n2 - 0.5) * 0.7;
  const way = 1 - smooth(0.6, 1.3, wd);
  if (way > 0) {
    c = mixRgb(c, mixRgb(SAND_EDGE, SAND, smooth(1.1, 0.2, wd)), way);
    grass -= way;
  }
  // Stream banks: pale pebbles.
  const sd = streamDist(x, z) + (n2 - 0.5) * 0.8;
  const bank = (1 - smooth(TOWN.stream.halfWidth + 0.3, TOWN.stream.halfWidth + 1.3, sd)) * (x < STREAM_START_X ? 1 : 0);
  if (bank > 0) {
    c = mixRgb(c, PEBBLES, bank);
    grass -= bank;
  }
  // Cliffs: sandstone with soft strata.
  const cliff = smooth(0.7, 1.3, s);
  if (cliff > 0) {
    const band = 0.9 + 0.1 * Math.sin(h * 2.1 + n1 * 3) * (0.6 + 0.4 * noise2(x * 0.6, z * 0.6));
    const streak = 0.95 + 0.08 * noise2(x * 1.3 + z * 1.3, h * 0.25);
    let rock = mixRgb(ROCK_LOW, ROCK_MID, smooth(-3, 4, h));
    rock = mixRgb(rock, ROCK_TOP, smooth(6, 16, h));
    rock = mixRgb(rock, ROCK_WARM, n2 * 0.3);
    rock = [rock[0] * band * streak, rock[1] * band * streak, rock[2] * band * streak];
    c = mixRgb(c, rock, cliff);
    grass -= cliff;
  }
  return [c, Math.max(0, grass)];
}

export const TERRAIN_EXTENT = { minX: -60, maxX: 48, minZ: -42, maxZ: 94, cell: 1.25 };

export function buildTownTerrain(scene: Scene, material: Material): Mesh {
  const E = TERRAIN_EXTENT;
  const cols = Math.round((E.maxX - E.minX) / E.cell);
  const rows = Math.round((E.maxZ - E.minZ) / E.cell);
  const w = cols + 1;
  const count = w * (rows + 1);
  const positions = new Float32Array(count * 3);
  const heights = new Float32Array(count);
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const x = E.minX + i * E.cell;
      const z = E.minZ + j * E.cell;
      const o = j * w + i;
      const h = townHeight(x, z);
      heights[o] = h;
      positions.set([x, h, z], o * 3);
    }
  }
  const colors = new Float32Array(count * 4);
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const o = j * w + i;
      const hx = heights[j * w + Math.min(cols, i + 1)]! - heights[j * w + Math.max(0, i - 1)]!;
      const hz = heights[Math.min(rows, j + 1) * w + i]! - heights[Math.max(0, j - 1) * w + i]!;
      const slope = Math.hypot(hx, hz) / (2 * E.cell);
      const [c, grass] = groundColor(positions[o * 3]!, positions[o * 3 + 2]!, heights[o]!, slope);
      colors.set([c[0], c[1], c[2], grass], o * 4);
    }
  }
  const indices = new Uint32Array(cols * rows * 6);
  let n = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
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
  const mesh = new Mesh('town.terrain', scene);
  data.applyToMesh(mesh);
  mesh.material = material;
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  mesh.doNotSyncBoundingInfo = true;
  return mesh;
}

export function streamRibbonPoints(): Vector3[] {
  return STREAM_POINTS.map((p) => new Vector3(p[0], p[1] + 0.03, p[2]));
}
