import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Material } from '@babylonjs/core/Materials/material';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE, SHADES } from '../config/palette';
import { TUNING } from '../config/tuning';
import { Random, clamp01 } from '../core/Random';
import { mixRgb, rgb, type Rgb } from '../inner/colors';
import { createValleyMaterial } from '../inner/valleyShader';

/**
 * Builds the town houses. Everything is vertex-coloured geometry (no textures), painted in the palette,
 * and merged into three frozen meshes for ALL houses: walls (plaster, plinth, gables), roof + wood
 * (tiles, beams, doors, shutters, balconies) and details (glass, frames, steps, chimneys, flowers, lanterns).
 */

export interface HouseSpec {
  x: number;
  z: number;
  /** Rotation around the up axis (radians, like Babylon rotation.y). */
  rot: number;
  /** Width (x) and depth (z) in the house's own frame (m). */
  w: number;
  d: number;
  floors: 1 | 2 | 3;
  style: 'plaster' | 'stone' | 'timber';
  roof: 'gable' | 'hip' | 'flat-terrace';
  /** Index of the palette variant for the wall (0..5, wraps). */
  colour: number;
  seed: number;
  groundY: number;
}

export interface HouseCollider {
  x: number;
  z: number;
  w: number;
  d: number;
  rot: number;
}

type V3 = [number, number, number];
type P2 = [number, number];
type Part = 'wall' | 'wood' | 'det';
interface Buf { pos: number[]; nor: number[]; col: number[]; idx: number[] }
interface Frame { ox: number; oy: number; oz: number; c: number; s: number }
interface Face { yaw: number; ext: number; out: number; nx: number; nz: number }

const T = TUNING.houses;
const C = {
  sandstone: rgb(PALETTE.sandstone), olive: rgb(PALETTE.olive), sage: rgb(PALETTE.sage), powder: rgb(PALETTE.powder),
  ivory: rgb(PALETTE.ivory), gold: rgb(PALETTE.gold), cloak: rgb(PALETTE.cloak), stone: rgb(PALETTE.stone),
  roofTile: rgb(SHADES.roofTile), roofTileLight: rgb(SHADES.roofTileLight), timber: rgb(SHADES.timber),
  timberDark: rgb(SHADES.timberDark), glass: rgb(SHADES.glass), leaf: rgb(SHADES.leaf), lantern: rgb(SHADES.lanternWarm),
};
const WALLS: Rgb[] = [
  mixRgb(C.sandstone, C.ivory, 0.45),
  mixRgb(C.ivory, C.sandstone, 0.12),
  mixRgb(C.powder, C.ivory, 0.45),
  mixRgb(C.gold, C.ivory, 0.5),
  mixRgb(C.sage, C.ivory, 0.5),
  mixRgb(C.sandstone, C.ivory, 0.2),
];

const shade = (c: Rgb, k: number): Rgb => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

class Builder {
  bufs: Record<Part, Buf> = {
    wall: { pos: [], nor: [], col: [], idx: [] },
    wood: { pos: [], nor: [], col: [], idx: [] },
    det: { pos: [], nor: [], col: [], idx: [] },
  };
  cur: Buf = this.bufs.wall;
  frames: Frame[] = [];
  /** World point that is "inside" the house: normals point away from it. */
  hint: V3 = [0, 0, 0];

  use(p: Part): void { this.cur = this.bufs[p]; }
  push(ox: number, oy: number, oz: number, yaw = 0): void {
    this.frames.push({ ox, oy, oz, c: Math.cos(yaw), s: Math.sin(yaw) });
  }
  pop(): void { this.frames.pop(); }

  tp(p: V3): V3 {
    let x = p[0];
    let y = p[1];
    let z = p[2];
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const f = this.frames[i]!;
      const nx = x * f.c + z * f.s + f.ox;
      const nz = -x * f.s + z * f.c + f.oz;
      x = nx;
      z = nz;
      y += f.oy;
    }
    return [x, y, z];
  }

  /** One triangle. The normal is flat and always points away from the hint point. */
  tri(a: V3, b: V3, c: V3, ca: Rgb, cb: Rgb, cc: Rgb, hl?: V3): void {
    const A = this.tp(a);
    const B = this.tp(b);
    const Cc = this.tp(c);
    const u = sub(B, A);
    const v = sub(Cc, A);
    let nx = u[1] * v[2] - u[2] * v[1];
    let ny = u[2] * v[0] - u[0] * v[2];
    let nz = u[0] * v[1] - u[1] * v[0];
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) return;
    nx /= len; ny /= len; nz /= len;
    const h = hl ? this.tp(hl) : this.hint;
    const dx = (A[0] + B[0] + Cc[0]) / 3 - h[0];
    const dy = (A[1] + B[1] + Cc[1]) / 3 - h[1];
    const dz = (A[2] + B[2] + Cc[2]) / 3 - h[2];
    if (nx * dx + ny * dy + nz * dz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const buf = this.cur;
    const n = buf.pos.length / 3;
    buf.pos.push(...A, ...B, ...Cc);
    buf.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    buf.col.push(ca[0], ca[1], ca[2], 0, cb[0], cb[1], cb[2], 0, cc[0], cc[1], cc[2], 0);
    buf.idx.push(n, n + 1, n + 2);
  }

  quad(a: V3, b: V3, c: V3, d: V3, ca: Rgb, cb: Rgb, cc: Rgb, cd: Rgb, hl?: V3): void {
    this.tri(a, b, c, ca, cb, cc, hl);
    this.tri(a, c, d, ca, cc, cd, hl);
  }

  /** A soft box (no bottom unless asked). Can be turned around up (yaw) and around its depth axis (roll). */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: Rgb, yaw = 0, roll = 0): void {
    this.push(cx, cy, cz, yaw);
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const k: V3[] = [];
    for (let i = 0; i < 8; i++) {
      const x = ((i & 1) ? 0.5 : -0.5) * sx;
      const y = ((i & 2) ? 0.5 : -0.5) * sy;
      const z = ((i & 4) ? 0.5 : -0.5) * sz;
      k.push([x * cr - y * sr, x * sr + y * cr, z]);
    }
    const lo = shade(col, 0.86);
    const hi = shade(col, 1.04);
    const top = shade(col, 1.08);
    const cl = (i: number): Rgb => ((i & 2) ? hi : lo);
    const face = (a: number, b: number, c: number, d: number, flat?: Rgb): void =>
      this.quad(k[a]!, k[b]!, k[c]!, k[d]!, flat ?? cl(a), flat ?? cl(b), flat ?? cl(c), flat ?? cl(d), [0, 0, 0]);
    face(1, 3, 7, 5);
    face(0, 4, 6, 2);
    face(2, 6, 7, 3, top);
    face(4, 5, 7, 6);
    face(0, 2, 3, 1);
    this.pop();
  }

  /** A little rounded lump (octahedron): flowers, leaves, bushes. */
  blob(cx: number, cy: number, cz: number, r: number, col: Rgb, squash = 0.8): void {
    const ry = r * squash;
    const p: V3[] = [[cx + r, cy, cz], [cx - r, cy, cz], [cx, cy + ry, cz], [cx, cy - ry, cz], [cx, cy, cz + r], [cx, cy, cz - r]];
    const hi = shade(col, 1.08);
    const lo = shade(col, 0.9);
    const hl: V3 = [cx, cy, cz];
    const f = (a: number, b: number, c: number): void => {
      const A = p[a]!; const B = p[b]!; const Cc = p[c]!;
      this.tri(A, B, Cc, a === 2 ? hi : lo, b === 2 ? hi : lo, c === 2 ? hi : lo, hl);
    };
    f(0, 2, 4); f(4, 2, 1); f(1, 2, 5); f(5, 2, 0);
    f(0, 4, 3); f(4, 1, 3); f(1, 5, 3); f(5, 0, 3);
  }

  /** A flat fan polygon (face frame: x = along the wall, y = up, z = out of the wall). */
  fan(pts: P2[], oAt: (y: number) => number, colAt: (u: number, y: number) => Rgb): void {
    let cu = 0;
    let cy = 0;
    for (const p of pts) { cu += p[0]; cy += p[1]; }
    cu /= pts.length; cy /= pts.length;
    const c0: V3 = [cu, cy, oAt(cy)];
    const cc = colAt(cu, cy);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      this.tri(c0, [a[0], a[1], oAt(a[1])], [b[0], b[1], oAt(b[1])], cc, colAt(a[0], a[1]), colAt(b[0], b[1]));
    }
  }
}

/** Rectangle or arch outline around (u, y). `grow` makes it bigger on all sides. */
function outline(u: number, y: number, w: number, h: number, arch: boolean, grow: number): P2[] {
  const r = w / 2 + grow;
  const yb = y - h / 2 - grow;
  if (!arch) {
    const yt = y + h / 2 + grow;
    return [[u - r, yb], [u + r, yb], [u + r, yt], [u - r, yt]];
  }
  const spring = y + h / 2 - w / 2;
  const pts: P2[] = [[u - r, yb], [u + r, yb]];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    pts.push([u + Math.cos(a) * r, spring + Math.sin(a) * r]);
  }
  return pts;
}

export function buildHouses(
  scene: Scene,
  specs: HouseSpec[],
  material?: Material,
): { meshes: Mesh[]; colliders: HouseCollider[] } {
  const b = new Builder();
  const colliders: HouseCollider[] = [];
  for (const s of specs) {
    buildHouse(b, s);
    colliders.push({ x: s.x, z: s.z, w: s.w, d: s.d, rot: s.rot });
  }
  const mat = material ?? createValleyMaterial('houses', scene, { backFaceCulling: false });
  const meshes: Mesh[] = [];
  (['wall', 'wood', 'det'] as Part[]).forEach((part) => {
    const buf = b.bufs[part];
    if (buf.idx.length === 0) return;
    const mesh = new Mesh(`houses.${part}`, scene);
    const data = new VertexData();
    data.positions = buf.pos;
    data.normals = buf.nor;
    data.colors = buf.col;
    data.indices = buf.idx;
    data.applyToMesh(mesh);
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    mesh.doNotSyncBoundingInfo = true;
    meshes.push(mesh);
  });
  return { meshes, colliders };
}

function buildHouse(b: Builder, s: HouseSpec): void {
  const rnd = new Random(s.seed * 7919 + 13);
  const w = s.w;
  const d = s.d;
  // Terraces are rare, small annexes: only 1 floor, and only for every third seed. Timber stays at 2 floors.
  const roofKind: HouseSpec['roof'] = s.roof === 'flat-terrace' && s.seed % 3 !== 0 ? 'gable' : s.roof;
  const floors = roofKind === 'flat-terrace' ? 1 : s.style === 'timber' ? Math.min(2, s.floors) : s.floors;
  const { plinthH, floorH, lean, taper } = T;
  const bevel = T.bevel * 1.5;
  const H = plinthH + floors * floorH;
  const hw = w / 2;
  const hd = d / 2;
  const lx = rnd.jitter(lean);
  const lz = rnd.jitter(lean);
  const base = WALLS[((s.colour % WALLS.length) + WALLS.length) % WALLS.length]!;
  const wallBase = s.style === 'stone' ? mixRgb(base, C.stone, 0.4) : base;
  const stoneCol = mixRgb(C.stone, base, 0.18);
  const trim = mixRgb(C.ivory, base, 0.25);
  const wood = mixRgb(C.timber, C.timberDark, rnd.range(0, 0.35));
  const shutterCol = rnd.next() < 0.5 ? mixRgb(C.olive, C.sage, 0.15) : mixRgb(C.powder, C.olive, 0.25);
  const doorCol = [wood, mixRgb(C.olive, C.timberDark, 0.35), mixRgb(C.cloak, C.timberDark, 0.35)][Math.floor(rnd.next() * 3)]!;
  const roofCol = [C.roofTile, mixRgb(C.roofTile, C.roofTileLight, 0.5), mixRgb(C.roofTile, C.cloak, 0.3)][Math.floor(rnd.next() * 3)]!;

  b.push(s.x, s.groundY, s.z, s.rot);
  b.hint = b.tp([0, 0, 0]);

  // Each of the 4 faces: a frame turned so that its z axis points out of the wall.
  const faces: Face[] = [
    { yaw: 0, ext: w, out: hd, nx: 0, nz: 1 },
    { yaw: Math.PI, ext: w, out: hd, nx: 0, nz: -1 },
    { yaw: Math.PI / 2, ext: d, out: hw, nx: 1, nz: 0 },
    { yaw: -Math.PI / 2, ext: d, out: hw, nx: -1, nz: 0 },
  ];
  /** Distance of the wall plane from the middle at height y. */
  const wo = (f: Face, y: number): number => {
    const t = clamp01((y - plinthH) / (H - plinthH));
    return f.out * (1 - taper * t) + Math.sin(t * Math.PI) * 0.05 + (lx * f.nx + lz * f.nz) * t;
  };

  // ---------------- walls ----------------
  const wob: P2[][] = [];
  for (let k = 0; k < 40; k++) {
    const row: P2[] = [];
    for (let i = 0; i < 8; i++) row.push([rnd.jitter(T.wobble), rnd.jitter(T.wobble)]);
    wob.push(row);
  }
  const ring = (y: number, e: number, k: number): V3[] => {
    const t = clamp01((y - plinthH) / (H - plinthH));
    const belly = Math.sin(t * Math.PI) * 0.05;
    const rw = hw * (1 - taper * t) + e + belly;
    const rd = hd * (1 - taper * t) + e + belly;
    const c = Math.min(bevel, rw * 0.5, rd * 0.5);
    const pts: P2[] = [
      [rw - c, rd], [-rw + c, rd], [-rw, rd - c], [-rw, -rd + c], [-rw + c, -rd], [rw - c, -rd], [rw, -rd + c], [rw, rd - c],
    ];
    return pts.map((p, i): V3 => [p[0] + lx * t + wob[k]![i]![0], y, p[1] + lz * t + wob[k]![i]![1]]);
  };
  const faceTone: number[] = [];
  for (let i = 0; i < 8; i++) faceTone.push(1 + rnd.jitter(0.025));

  const rowsPerFloor = s.style === 'stone' ? 6 : 3;
  const wallColAt = (y: number, i: number, row: number): Rgb => {
    const t = clamp01((y - plinthH) / (H - plinthH));
    const lowC = shade(mixRgb(wallBase, C.sandstone, 0.14), 0.94);
    const highC = mixRgb(wallBase, C.ivory, 0.16);
    let c = shade(mixRgb(lowC, highC, t), faceTone[i % 8]!);
    if (s.style === 'stone' && row % 2 === 1) c = shade(c, 0.95);
    return c;
  };
  b.use('wall');
  // Plinth of stones: two bands, slightly wider than the wall.
  const plinthRings = [ring(-0.2, 0.08, 0), ring(plinthH * 0.5, 0.085, 1), ring(plinthH, 0.08, 2)];
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 8; i++) {
      const a0 = plinthRings[r]![i]!; const a1 = plinthRings[r]![(i + 1) % 8]!;
      const b0 = plinthRings[r + 1]![i]!; const b1 = plinthRings[r + 1]![(i + 1) % 8]!;
      const cc = shade(stoneCol, (r === 0 ? 0.9 : 1.0) * faceTone[i]!);
      b.quad(a0, a1, b1, b0, shade(cc, 0.94), shade(cc, 0.94), cc, cc);
    }
  }
  // Ledge between plinth and wall.
  const ledgeTop = ring(plinthH, 0, 3);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    const lc = shade(stoneCol, 1.1);
    b.quad(plinthRings[2]![i]!, plinthRings[2]![j]!, ledgeTop[j]!, ledgeTop[i]!, lc, lc, lc, lc, [0, -5, 0]);
  }
  // The wall rings.
  const rowCount = floors * rowsPerFloor;
  let prev = ring(plinthH, 0, 3);
  for (let r = 1; r <= rowCount; r++) {
    const y = plinthH + (r / rowCount) * (H - plinthH);
    const cur = ring(y, 0, 3 + r);
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      b.quad(prev[i]!, prev[j]!, cur[j]!, cur[i]!, wallColAt(prev[i]![1], i, r - 1), wallColAt(prev[i]![1], i, r - 1),
        wallColAt(y, i, r - 1), wallColAt(y, i, r - 1));
    }
    prev = cur;
  }

  // ---------------- roof frame ----------------
  const ridgeAlongX = w >= d;
  const L = ridgeAlongX ? w : d;
  const S = ridgeAlongX ? d : w;
  const roofYaw = ridgeAlongX ? 0 : Math.PI / 2;
  const topCol = wallColAt(H, 0, 0);

  // ---------------- doors, windows and friends (face coordinates) ----------------
  const front = faces[0]!;
  const doorU = [-0.22, 0, 0.22][Math.floor(rnd.next() * 3)]! * w;
  const doorH = 2.0;
  const doorW = 1.0;
  const doorArch = rnd.next() < 0.55;
  const hasBalcony = floors >= 2 && rnd.next() < T.balcony;
  const hasStair = floors >= 2 && !hasBalcony && rnd.next() < T.stair;
  const stairFace = faces[2]!;
  const stairLen = 7;
  const stairRun = 0.36;
  const landingW = 1.1;
  const stairStartU = -stairFace.ext / 2 + 0.55;
  const landingU = stairStartU + stairLen * stairRun + landingW / 2;
  const useShutters = rnd.next() < T.shutters;
  const useFlowers = true;
  const archWin = rnd.next() < T.archWindow;
  const hasAwning = rnd.next() < T.awning;
  const lanternHouse = true;
  const signHouse = false;
  const frameCol = s.style === 'timber' ? mixRgb(C.timber, C.timberDark, 0.5) : trim;

  const withFace = (f: Face, fn: () => void): void => {
    b.push(0, 0, 0, f.yaw);
    fn();
    b.pop();
  };

  const door = (f: Face, u: number, yBottom: number, arch: boolean): void => {
    withFace(f, () => {
      const yc = yBottom + doorH / 2;
      const o0 = (y: number): number => wo(f, y);
      b.use('det');
      b.fan(outline(u, yc, doorW, doorH, arch, 0.13), (y) => o0(y) + 0.03, (_u, y) => shade(trim, 0.92 + 0.1 * clamp01((y - yBottom) / doorH)));
      b.use('wood');
      b.fan(outline(u, yc, doorW, doorH, arch, 0), (y) => o0(y) + 0.06, (_u, y) => shade(doorCol, 0.9 + 0.14 * clamp01((y - yBottom) / doorH)));
      b.box(u, yBottom + (arch ? doorH * 0.4 : doorH * 0.5), o0(yc) + 0.08, 0.05, arch ? doorH * 0.78 : doorH * 0.94, 0.03, shade(doorCol, 0.72));
      b.box(u - doorW * 0.24, yBottom + doorH * 0.4, o0(yc) + 0.085, 0.04, doorH * 0.7, 0.03, shade(doorCol, 0.82));
      b.box(u + doorW * 0.24, yBottom + doorH * 0.4, o0(yc) + 0.085, 0.04, doorH * 0.7, 0.03, shade(doorCol, 0.82));
      b.use('det');
      b.box(u + doorW * 0.32, yBottom + doorH * 0.45, o0(yc) + 0.1, 0.07, 0.07, 0.05, C.gold);
    });
  };

  const window = (f: Face, u: number, yc: number, ww: number, wh: number, arch: boolean, flowers: boolean): void => {
    withFace(f, () => {
      const o0 = wo(f, yc);
      b.use('det');
      b.fan(outline(u, yc, ww, wh, arch, 0.09), (y) => wo(f, y) + 0.025, () => frameCol);
      b.fan(outline(u, yc, ww, wh, arch, 0), (y) => wo(f, y) + 0.04,
        (_u, y) => mixRgb(C.glass, C.powder, clamp01((y - (yc - wh / 2)) / wh) * 0.7));
      b.box(u, yc, o0 + 0.06, 0.035, wh, 0.03, frameCol);
      b.box(u, yc - wh * 0.08, o0 + 0.06, ww, 0.035, 0.03, frameCol);
      b.box(u, yc - wh / 2 - 0.06, o0 + 0.1, ww + 0.32, 0.09, 0.24, shade(trim, 0.98));
      if (useShutters) {
        b.use('wood');
        const sh = wh * (arch ? 0.8 : 1);
        for (const sgn of [-1, 1]) {
          const su = u + sgn * (ww / 2 + 0.2);
          b.box(su, yc - (wh - sh) / 2, o0 + 0.045, 0.34, sh, 0.05, shutterCol);
          b.box(su, yc - (wh - sh) / 2, o0 + 0.075, 0.05, sh * 0.9, 0.02, shade(shutterCol, 0.82));
        }
      }
      if (flowers) {
        b.use('wood');
        const fy = yc - wh / 2 - 0.2;
        b.box(u, fy, o0 + 0.17, ww + 0.12, 0.17, 0.2, shade(C.timber, 1.0));
        b.use('det');
        const bloom = [C.sandstone, C.gold, C.ivory, mixRgb(C.sandstone, C.cloak, 0.4)][Math.floor(rnd.next() * 4)]!;
        for (let i = 0; i < 4; i++) {
          const fu = u + (i / 3 - 0.5) * (ww * 0.95);
          b.blob(fu, fy + 0.15, o0 + 0.17, 0.11, shade(C.leaf, 0.95 + rnd.range(0, 0.15)));
          b.blob(fu + rnd.jitter(0.04), fy + 0.25, o0 + 0.19, 0.06, bloom);
        }
      }
    });
  };

  const slots = (ext: number, spacing: number): number[] => {
    const n = Math.max(1, Math.floor(ext / spacing));
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(-ext / 2 + ((i + 0.5) * ext) / n);
    return out;
  };

  // Door + steps on the front.
  door(front, doorU, plinthH - 0.02, doorArch);
  withFace(front, () => {
    b.use('det');
    const o = wo(front, 0.2);
    b.box(doorU, 0.08, o + 0.42, 1.55, 0.2, 0.7, shade(stoneCol, 1.08));
    b.box(doorU, 0.2, o + 0.28, 1.25, 0.2, 0.42, shade(stoneCol, 1.14));
  });

  // Stair + landing door on the right face.
  if (hasStair) {
    const landingY = plinthH + floorH;
    withFace(stairFace, () => {
      b.use('det');
      const o = wo(stairFace, 1);
      for (let i = 0; i < stairLen; i++) {
        const top = ((i + 1) / (stairLen + 1)) * landingY;
        b.box(stairStartU + (i + 0.5) * stairRun, top / 2 - 0.1, o + 0.45, stairRun + 0.01, top + 0.2, 0.9, shade(stoneCol, 1.02 + i * 0.012));
      }
      b.box(landingU, landingY / 2 - 0.05, o + 0.5, landingW, landingY + 0.1, 1.0, shade(stoneCol, 1.1));
      b.use('wood');
      // Rail along the outer edge of the landing and a post at the stair foot.
      b.box(landingU, landingY + 0.78, o + 0.97, landingW, 0.08, 0.07, wood);
      b.box(landingU, landingY + 0.4, o + 0.97, 0.06, 0.8, 0.06, wood);
      b.box(landingU + landingW / 2 - 0.04, landingY + 0.42, o + 0.97, 0.08, 0.84, 0.08, shade(wood, 0.85));
      b.box(landingU - landingW / 2 + 0.04, landingY + 0.42, o + 0.97, 0.08, 0.84, 0.08, shade(wood, 0.85));
      b.box(landingU - landingW / 2 - stairLen * stairRun * 0.5, landingY * 0.5 + 0.8, o + 0.97,
        Math.hypot(stairLen * stairRun, landingY * 0.88), 0.07, 0.07, wood, 0, Math.atan2(landingY * 0.88, stairLen * stairRun));
    });
    door(stairFace, landingU, landingY + 0.02, true);
  }

  // Windows per floor on each face.
  const frontSlots = slots(w, 2.0);
  let awningDone = false;
  faces.forEach((f, fi) => {
    const sl = slots(f.ext, fi < 2 ? 2.0 : 2.5);
    for (let fl = 0; fl < floors; fl++) {
      const yb = plinthH + fl * floorH;
      for (let si = 0; si < sl.length; si++) {
        const u = sl[si]!;
        if (fi === 0 && fl === 0 && Math.abs(u - doorU) < 1.2) continue;
        if (fi === 2 && hasStair && fl === 0 && u < landingU + 1) continue;
        if (fi === 2 && hasStair && fl === 1 && Math.abs(u - landingU) < 1.2) continue;
        if (fi === 1 && fl === 0 && rnd.next() < 0.35) continue;
        if (fi >= 2 && rnd.next() < 0.18) continue;
        const arch = archWin && (fl === 0 || fl === floors - 1) && rnd.next() < 0.7;
        const wh = fl === 0 ? 1.15 : 1.05;
        const ww = arch ? 0.75 : 0.72;
        const yc = yb + (fl === 0 ? 1.55 : 1.45);
        // Balcony door replaces the middle window of floor 1 on the front.
        if (fi === 0 && fl === 1 && hasBalcony && si === Math.floor(frontSlots.length / 2)) continue;
        window(f, u, yc, ww, wh, arch, useFlowers && fi === 0);
        if (fi === 0 && fl === 0 && hasAwning && !awningDone) {
          awningDone = true;
          withFace(front, () => {
            b.use('wood');
            const o = wo(front, yc);
            const yTop = yc + wh / 2 + 0.55;
            const aw = ww + 0.9;
            const stripeCol = [C.cloak, C.powder, C.olive][Math.floor(rnd.next() * 3)]!;
            const n = 6;
            for (let k = 0; k < n; k++) {
              const u0 = u - aw / 2 + (k / n) * aw;
              const u1 = u - aw / 2 + ((k + 1) / n) * aw;
              const c = k % 2 === 0 ? stripeCol : C.ivory;
              b.quad([u0, yTop, o + 0.03], [u1, yTop, o + 0.03], [u1, yTop - 0.42, o + 0.95], [u0, yTop - 0.42, o + 0.95],
                shade(c, 1.04), shade(c, 1.04), shade(c, 0.94), shade(c, 0.94));
              b.tri([u0, yTop - 0.42, o + 0.95], [u1, yTop - 0.42, o + 0.95], [(u0 + u1) / 2, yTop - 0.62, o + 0.93], shade(c, 0.94), shade(c, 0.94), shade(c, 0.8),
                [(u0 + u1) / 2, yTop - 3, o - 3]);
            }
            b.box(u - aw / 2, yTop - 0.5, o + 0.5, 0.04, 0.04, 1.0, wood, 0, 0.05);
            b.box(u + aw / 2, yTop - 0.5, o + 0.5, 0.04, 0.04, 1.0, wood, 0, 0.05);
          });
        }
      }
    }
  });

  // Balcony on the front, floor 1.
  if (hasBalcony) {
    const u = frontSlots[Math.floor(frontSlots.length / 2)]!;
    const fy = plinthH + floorH;
    window(front, u, fy + 1.0, 0.85, 1.75, true, false);
    withFace(front, () => {
      const o = wo(front, fy);
      b.use('wood');
      const bw = 2.1;
      b.box(u, fy + 0.04, o + 0.45, bw, 0.12, 0.9, shade(wood, 1.05));
      b.box(u, fy + 0.95, o + 0.88, bw, 0.07, 0.07, wood);
      b.box(u - bw / 2 + 0.04, fy + 0.95, o + 0.45, 0.07, 0.07, 0.9, wood);
      b.box(u + bw / 2 - 0.04, fy + 0.95, o + 0.45, 0.07, 0.07, 0.9, wood);
      for (let i = 0; i < 7; i++) b.box(u - bw / 2 + 0.06 + (i / 6) * (bw - 0.12), fy + 0.5, o + 0.88, 0.045, 0.86, 0.045, shade(wood, 0.9));
      for (const sgn of [-1, 1]) b.box(u + sgn * (bw / 2 - 0.2), fy - 0.28, o + 0.5, 0.09, 0.5, 0.09, shade(wood, 0.8), 0, sgn * 0.0);
      b.use('det');
      b.blob(u - 0.5, fy + 1.1, o + 0.88, 0.12, C.leaf);
      b.blob(u - 0.5, fy + 1.22, o + 0.9, 0.065, C.cloak);
      b.blob(u + 0.6, fy + 1.1, o + 0.88, 0.12, C.leaf);
      b.blob(u + 0.6, fy + 1.22, o + 0.9, 0.065, C.gold);
    });
  }

  // Lantern or sign next to the door.
  if (lanternHouse || signHouse) {
    withFace(front, () => {
      const su = doorU + (doorU > 0 ? -1 : 1) * 0.95;
      const dir = su > doorU ? 1 : -1;
      const o = wo(front, 2.6);
      b.use('wood');
      b.box(su, 2.75, o + 0.3, 0.06, 0.06, 0.6, shade(C.timberDark, 0.9));
      b.box(su, 2.6, o + 0.12, 0.05, 0.3, 0.05, shade(C.timberDark, 0.9), 0, 0.5 * dir);
      if (lanternHouse) {
        b.box(su, 2.45, o + 0.58, 0.04, 0.2, 0.04, shade(C.timberDark, 0.9));
        b.use('det');
        b.box(su, 2.2, o + 0.58, 0.22, 0.3, 0.22, C.lantern);
        b.box(su, 2.4, o + 0.58, 0.3, 0.05, 0.3, C.timberDark);
        b.box(su, 1.99, o + 0.58, 0.26, 0.05, 0.26, C.timberDark);
      } else {
        b.box(su, 2.35, o + 0.58, 0.62, 0.42, 0.05, shade(C.timber, 1.0));
        b.use('det');
        b.box(su, 2.35, o + 0.61, 0.3, 0.28, 0.03, C.ivory);
        b.box(su, 2.35, o + 0.63, 0.14, 0.14, 0.03, C.cloak);
      }
    });
  }

  // ---------------- timber / stone extras ----------------
  if (s.style === 'timber') {
    b.use('wood');
    const beam = shade(C.timberDark, 1.1);
    faces.forEach((f) => {
      withFace(f, () => {
        for (let fl = 1; fl <= floors; fl++) {
          const y = plinthH + fl * floorH - 0.09;
          b.box(0, y, wo(f, y) + 0.035, f.ext - 0.1, 0.17, 0.09, beam);
        }
        const topY = plinthH + floors * floorH;
        const hgt = topY - plinthH;
        const posts = Math.max(2, Math.round(f.ext / 1.9) + 1);
        for (let i = 0; i < posts; i++) {
          const u = -f.ext / 2 + 0.1 + (i / (posts - 1)) * (f.ext - 0.2);
          b.box(u, plinthH + hgt / 2, wo(f, plinthH + hgt / 2) + 0.035, 0.15, hgt, 0.09, beam);
        }
        // Diagonal braces in some upper panels.
        for (let fl = 0; fl < floors; fl++) {
          for (let i = 0; i < posts - 1; i++) {
            if (rnd.next() < 0.78) continue;
            const u = -f.ext / 2 + 0.1 + ((i + 0.5) / (posts - 1)) * (f.ext - 0.2);
            const y = plinthH + fl * floorH + floorH * 0.5;
            const pw = (f.ext - 0.2) / (posts - 1);
            const sgn = rnd.next() < 0.5 ? 1 : -1;
            b.box(u, y, wo(f, y) + 0.04, Math.hypot(pw, floorH) * 0.9, 0.11, 0.08, beam, 0, sgn * Math.atan2(floorH, pw) * 0.97);
          }
        }
      });
    });
  } else if (s.style === 'stone') {
    b.use('det');
    withFace(front, () => {
      for (let fl = 0; fl < floors; fl++) {
        for (const sgn of [-1, 1]) {
          for (let q = 0; q < 4; q++) {
            const y = plinthH + fl * floorH + 0.3 + q * 0.7;
            const big = q % 2 === 0;
            b.box(sgn * (front.ext / 2 - (big ? 0.2 : 0.14)), y, wo(front, y) + 0.015, big ? 0.4 : 0.28, 0.34, 0.1, shade(mixRgb(C.stone, C.ivory, 0.45), 0.96 + 0.06 * rnd.next()));
          }
        }
      }
    });
  }

  // Plinth stones along front and one side.
  b.use('det');
  for (const f of [faces[0]!, faces[rnd.next() < 0.5 ? 2 : 3]!]) {
    withFace(f, () => {
      const n = Math.floor(f.ext / 0.8);
      for (let i = 0; i < n; i++) {
        const u = -f.ext / 2 + 0.45 + ((i + rnd.next() * 0.4) / n) * (f.ext - 0.7);
        if (f === faces[0] && Math.abs(u - doorU) < 0.9) continue;
        const sw = rnd.range(0.35, 0.6);
        b.box(u, rnd.range(0.1, 0.16), wo(f, plinthH) + 0.1, sw, rnd.range(0.2, 0.3), 0.1, shade(stoneCol, rnd.range(0.88, 1.12)));
      }
    });
  }

  // ---------------- roof ----------------
  b.push(lx, H, lz, roofYaw);
  const y0 = 0;
  if (roofKind === 'flat-terrace') {
    buildTerrace(b, L, S, y0, base, roofCol, trim, rnd);
  } else {
    const hip = roofKind === 'hip';
    const o = T.overhang;
    const ze = S / 2 + o;
    const xe = L / 2 + (hip ? o : T.gableOverhang);
    const ye = y0 - 0.05;
    const rise = ze * T.roofPitch;
    const yr = ye + rise;
    const rh = hip ? Math.max(0.12, xe - ze) : xe;

    // Gable triangles in the wall mesh.
    if (!hip) {
      b.use('wall');
      for (const sgn of [-1, 1]) {
        const x = sgn * (L / 2 - 0.015);
        const hl: V3 = [0, -3, 0];
        const yEdge = yr - (S / 2) * T.roofPitch - 0.04;
        const hiC = shade(mixRgb(topCol, C.ivory, 0.2), 1.0);
        const p0: V3 = [x, y0 - 0.02, -S / 2];
        const p1: V3 = [x, y0 - 0.02, S / 2];
        const p2: V3 = [x, yEdge, S / 2];
        const p3: V3 = [x, yr - 0.04, 0];
        const p4: V3 = [x, yEdge, -S / 2];
        b.tri(p0, p1, p2, topCol, topCol, hiC, hl);
        b.tri(p0, p2, p3, topCol, hiC, hiC, hl);
        b.tri(p0, p3, p4, topCol, hiC, hiC, hl);
      }
    }
    b.use('wood');
    const slope = (A0: V3, A1: V3, B0: V3, B1: V3): void => {
      const len = Math.hypot(B0[0] - A0[0], B0[1] - A0[1], B0[2] - A0[2]);
      const rows = Math.max(4, Math.min(10, Math.round(len / T.tileRowLen)));
      const mid = lerp3(lerp3(A0, A1, 0.5), lerp3(B0, B1, 0.5), 0.5);
      const e1 = sub(A1, A0);
      const e2 = sub(B0, A0);
      let nx = e1[1] * e2[2] - e1[2] * e2[1];
      let ny = e1[2] * e2[0] - e1[0] * e2[2];
      let nz = e1[0] * e2[1] - e1[1] * e2[0];
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      if (ny < 0 || (Math.abs(ny) < 0.01 && nx * mid[0] + nz * mid[2] < 0)) { nx = -nx; ny = -ny; nz = -nz; }
      const lift = T.tileLift;
      const flick = (t: number): number => 0.16 * Math.pow(1 - t, 3);
      const P = (t: number, u: number, raise: number): V3 => {
        const p = lerp3(lerp3(A0, A1, u), lerp3(B0, B1, u), t);
        return [p[0] + nx * raise, p[1] + ny * raise + flick(t), p[2] + nz * raise];
      };
      const cols = Math.max(1, Math.round(Math.hypot(A1[0] - A0[0], A1[2] - A0[2]) / 1.2));
      for (let r = 0; r < rows; r++) {
        const t0 = r / rows;
        const t1 = (r + 1) / rows;
        const tone = (r % 2 === 0 ? 1.0 : 0.95) * (0.97 + 0.06 * rnd.next());
        const rowC = shade(mixRgb(roofCol, C.roofTileLight, t1 * 0.18), tone);
        for (let c = 0; c < cols; c++) {
          const u0 = c / cols;
          const u1 = (c + 1) / cols;
          const ct = 1 + rnd.jitter(0.035);
          b.quad(P(t0, u0, lift), P(t0, u1, lift), P(t1, u1, 0), P(t1, u0, 0),
            shade(rowC, 1.1 * ct), shade(rowC, 1.1 * ct), shade(rowC, 0.9 * ct), shade(rowC, 0.9 * ct));
          if (r < rows - 1) {
            const down = sub(P(t0, 0.5, 0), P(t1, 0.5, 0));
            const hl: V3 = [P(t1, 0.5, 0)[0] - down[0] * -3, P(t1, 0.5, 0)[1] - down[1] * -3, P(t1, 0.5, 0)[2] - down[2] * -3];
            b.quad(P(t1, u0, 0), P(t1, u1, 0), P(t1, u1, lift), P(t1, u0, lift), shade(rowC, 0.7), shade(rowC, 0.7), shade(rowC, 0.78), shade(rowC, 0.78), hl);
          }
        }
      }
    };
    if (!hip) {
      slope([-xe, ye, ze], [xe, ye, ze], [-xe, yr, 0], [xe, yr, 0]);
      slope([xe, ye, -ze], [-xe, ye, -ze], [xe, yr, 0], [-xe, yr, 0]);
    } else {
      slope([-xe, ye, ze], [xe, ye, ze], [-rh, yr, 0], [rh, yr, 0]);
      slope([xe, ye, -ze], [-xe, ye, -ze], [rh, yr, 0], [-rh, yr, 0]);
      slope([xe, ye, ze], [xe, ye, -ze], [rh, yr, 0], [rh, yr, 0]);
      slope([-xe, ye, -ze], [-xe, ye, ze], [-rh, yr, 0], [-rh, yr, 0]);
    }
    // Underside of the eaves (shadowed) and fascia boards.
    const under = shade(mixRgb(C.timberDark, base, 0.25), 0.9);
    b.quad([-xe, ye, -ze], [xe, ye, -ze], [xe, ye, ze], [-xe, ye, ze], under, under, under, under, [0, 20, 0]);
    const fas = shade(C.timberDark, 1.05);
    b.quad([-xe, ye + 0.12, ze], [xe, ye + 0.12, ze], [xe, ye - 0.2, ze], [-xe, ye - 0.2, ze], fas, fas, fas, fas, [0, 0, -3]);
    b.quad([-xe, ye + 0.12, -ze], [xe, ye + 0.12, -ze], [xe, ye - 0.2, -ze], [-xe, ye - 0.2, -ze], fas, fas, fas, fas, [0, 0, 3]);
    if (hip) {
      b.quad([xe, ye, -ze], [xe, ye, ze], [xe, ye - 0.2, ze], [xe, ye - 0.2, -ze], fas, fas, fas, fas, [-3, 0, 0]);
      b.quad([-xe, ye, -ze], [-xe, ye, ze], [-xe, ye - 0.2, ze], [-xe, ye - 0.2, -ze], fas, fas, fas, fas, [3, 0, 0]);
    }
    // Ridge cap: a small triangular prism.
    const capC = shade(roofCol, 0.82);
    const capHi = shade(roofCol, 1.0);
    const rx = rh + (hip ? 0.08 : 0.04);
    const a: V3 = [-rx, yr + 0.17, 0];
    const bb: V3 = [rx, yr + 0.17, 0];
    const l0: V3 = [-rx, yr - 0.04, -0.2];
    const l1: V3 = [rx, yr - 0.04, -0.2];
    const r0: V3 = [-rx, yr - 0.04, 0.2];
    const r1: V3 = [rx, yr - 0.04, 0.2];
    b.quad(a, bb, r1, r0, capHi, capHi, capC, capC);
    b.quad(a, bb, l1, l0, capHi, capHi, capC, capC);
    b.tri(a, l0, r0, capC, capC, capC, [0, yr - 5, 0]);
    b.tri(bb, l1, r1, capC, capC, capC, [0, yr - 5, 0]);

    // Small dormer with its own gable on the front slope.
    if (!hip && ridgeAlongX && rnd.next() < 0.45) {
      const dz = ze * 0.5;
      const ys = yr - dz * T.roofPitch;
      const dx = (rnd.next() < 0.5 ? -1 : 1) * L * 0.22;
      b.use('wall');
      b.box(dx, ys + 0.3, dz, 1.1, 1.1, 0.9, topCol);
      b.use('wood');
      const rc = shade(roofCol, 1.0);
      const e0: V3 = [dx - 0.7, ys + 0.85, dz + 0.55];
      const e1: V3 = [dx + 0.7, ys + 0.85, dz + 0.55];
      const r0: V3 = [dx - 0.7, ys + 1.25, dz - 0.5];
      const r1: V3 = [dx + 0.7, ys + 1.25, dz - 0.5];
      const rt0: V3 = [dx, ys + 1.5, dz + 0.55];
      const rt1: V3 = [dx, ys + 1.5, dz - 0.5];
      b.quad(e0, rt0, rt1, [dx - 0.7, ys + 1.0, dz - 0.5], shade(rc, 1.05), shade(rc, 1.1), shade(rc, 1.1), shade(rc, 0.95));
      b.quad(e1, rt0, rt1, [dx + 0.7, ys + 1.0, dz - 0.5], shade(rc, 0.9), shade(rc, 1.0), shade(rc, 1.0), shade(rc, 0.85));
      void r0; void r1;
      b.use('det');
      b.fan(outline(dx, ys + 0.45, 0.5, 0.65, true, 0.07), () => dz + 0.46, () => frameCol);
      b.fan(outline(dx, ys + 0.45, 0.5, 0.65, true, 0), () => dz + 0.48, (_u, y) => mixRgb(C.glass, C.powder, clamp01((y - ys) / 0.8) * 0.6));
    }

    // Chimney.
    if (rnd.next() < T.chimney) {
      b.use('det');
      const cx = (rnd.next() < 0.5 ? -1 : 1) * (hip ? 0.1 : 0.22) * L;
      const cz = -S * 0.12;
      const ground = yr - Math.abs(cz) * T.roofPitch - 0.5;
      const top = yr + 0.6;
      const cc = mixRgb(C.stone, C.ivory, 0.35);
      b.box(cx, (ground + top) / 2, cz, 0.58, top - ground, 0.58, cc);
      b.box(cx, top + 0.05, cz, 0.74, 0.12, 0.74, shade(cc, 0.9));
      b.box(cx, top + 0.13, cz, 0.38, 0.05, 0.38, C.timberDark);
    }
  }
  b.pop();
  b.pop();
}

/** A flat roof with a low parapet, sometimes a small stair hut, pots and a sun sail. */
function buildTerrace(b: Builder, L: number, S: number, y0: number, base: Rgb, roofCol: Rgb, trim: Rgb, rnd: Random): void {
  b.use('wood');
  const slab = mixRgb(roofCol, C.sandstone, 0.4);
  b.quad([-L / 2 - 0.1, y0, -S / 2 - 0.1], [L / 2 + 0.1, y0, -S / 2 - 0.1], [L / 2 + 0.1, y0, S / 2 + 0.1], [-L / 2 - 0.1, y0, S / 2 + 0.1],
    shade(slab, 1.0), shade(slab, 1.0), shade(slab, 1.0), shade(slab, 1.0), [0, -5, 0]);
  const par = mixRgb(base, C.ivory, 0.3);
  const ph = 0.3;
  const th = 0.3;
  b.box(0, y0 + ph / 2, S / 2 + 0.05, L + 0.3, ph, th, par);
  b.box(0, y0 + ph / 2, -S / 2 - 0.05, L + 0.3, ph, th, par);
  b.box(L / 2 + 0.05, y0 + ph / 2, 0, th, ph, S, par);
  b.box(-L / 2 - 0.05, y0 + ph / 2, 0, th, ph, S, par);
  b.box(0, y0 + ph + 0.03, S / 2 + 0.05, L + 0.4, 0.07, th + 0.1, shade(trim, 1.0));
  b.box(0, y0 + ph + 0.03, -S / 2 - 0.05, L + 0.4, 0.07, th + 0.1, shade(trim, 1.0));
  b.box(L / 2 + 0.05, y0 + ph + 0.03, 0, th + 0.1, 0.07, S + 0.2, shade(trim, 1.0));
  b.box(-L / 2 - 0.05, y0 + ph + 0.03, 0, th + 0.1, 0.07, S + 0.2, shade(trim, 1.0));
  b.use('det');
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) b.blob(cx * (L / 2 + 0.05), y0 + ph + 0.06, cz * (S / 2 + 0.05), 0.22, shade(par, 1.05), 0.9);
  // Little pergola with a green roof.
  b.use('wood');
  const pw = Math.min(2.2, L * 0.4);
  for (const px of [-1, 1]) for (const pz of [-1, 1]) b.box(px * pw / 2, y0 + 1.0, pz * 0.8 - S * 0.1, 0.1, 2.0, 0.1, C.timber);
  for (let i = 0; i < 4; i++) b.box(0, y0 + 2.04, -S * 0.1 - 0.9 + i * 0.6, pw + 0.3, 0.07, 0.1, C.timberDark);
  b.use('det');
  for (let i = 0; i < 5; i++) b.blob(-pw / 2 + i * pw / 4, y0 + 2.15, -S * 0.1 + rnd.jitter(0.6), 0.2, shade(C.leaf, 0.95 + 0.1 * rnd.next()));
  const sgn = rnd.next() < 0.5 ? -1 : 1;
  if (false) {
    // Stair hut with a slightly overhanging flat roof.
    const hx = sgn * (L / 2 - 1.0);
    const hz = -S / 2 + 0.9;
    b.use('wall');
    b.box(hx, y0 + 0.95, hz, 1.5, 1.9, 1.3, base);
    b.use('wood');
    b.box(hx, y0 + 2.0, hz, 1.8, 0.14, 1.6, shade(roofCol, 0.95));
    b.use('det');
    b.box(hx, y0 + 0.7, hz + 0.67, 0.6, 1.3, 0.04, shade(C.timber, 0.9));
  }
  b.use('det');
  for (let i = 0; i < 3; i++) {
    const px = -sgn * (L / 2 - 0.6 - i * 0.55);
    const pz = S / 2 - 0.6;
    b.box(px, y0 + 0.2, pz, 0.34, 0.4, 0.34, C.roofTile);
    b.blob(px, y0 + 0.5, pz, 0.24, C.leaf, 1);
    if (i === 1) b.blob(px, y0 + 0.62, pz, 0.08, C.cloak);
  }
}
