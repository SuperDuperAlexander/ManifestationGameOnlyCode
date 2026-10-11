import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Material } from '@babylonjs/core/Materials/material';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE, SHADES } from '../config/palette';
import { mixRgb, paintFlat, paintGradient, rgb, type Rgb } from '../inner/colors';
import { TOWN } from './townLayout';
import { streamZ, townHeight } from './townTerrain';

/**
 * Looks of the town: soft painted geometry in the valley's style (vertex colours + the valley shader).
 * Everything solid is merged into ONE mesh (one draw call); the ground is a second one.
 */

/** Height of the fountain bowl top above its base: the jet starts here. */
export const FOUNTAIN_JET_OFFSET = 1.45;

const hexOf = (c: Rgb): string => {
  const h = (v: number): string => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
};
const mixHex = (a: string, b: string, t: number): string => hexOf(mixRgb(rgb(a), rgb(b), t));

// --- Solid geometry -----------------------------------------------------------------------------

class Parts {
  readonly list: Mesh[] = [];
  /** Added to every y (the ground height under the thing being built). */
  dy = 0;
  constructor(private readonly scene: Scene) {}

  box(w: number, h: number, d: number, x: number, y: number, z: number, lo: string, hi = lo, rotY = 0, rotX = 0): void {
    const b = MeshBuilder.CreateBox('b', { width: w, height: h, depth: d }, this.scene);
    b.position.set(x, y + this.dy, z);
    b.rotation.y = rotY;
    b.rotation.x = rotX;
    paintGradient(b, lo, hi);
    this.list.push(b);
  }

  /** Surface of revolution around y at (x, z). `shape` = [radius, height] pairs. */
  lathe(shape: [number, number][], x: number, z: number, lo: string, hi: string, tess = 28): void {
    const m = MeshBuilder.CreateLathe(
      'lathe',
      { shape: shape.map(([r, y]) => new Vector3(r, y, 0)), tessellation: tess, sideOrientation: Mesh.DOUBLESIDE },
      this.scene,
    );
    m.position.set(x, this.dy, z);
    paintGradient(m, lo, hi);
    this.list.push(m);
  }

  blob(r: number, x: number, y: number, z: number, hex: string, sy = 0.8): void {
    const s = MeshBuilder.CreateSphere('blob', { diameter: r * 2, segments: 5 }, this.scene);
    s.scaling.y = sy;
    s.position.set(x, y + this.dy, z);
    paintFlat(s, hex);
    this.list.push(s);
  }

  custom(mesh: Mesh): void {
    this.list.push(mesh);
  }
}

/** All solid, vertex-coloured things of the town in one mesh. */
export function buildTownSolid(scene: Scene, mat: Material): Mesh | null {
  const p = new Parts(scene);
  gate(p);
  bridge(p);
  square(p);
  const m = Mesh.MergeMeshes(p.list, true, true);
  if (!m) return null;
  m.name = 'town.solid';
  m.material = mat;
  m.isPickable = false;
  m.freezeWorldMatrix();
  m.doNotSyncBoundingInfo = true;
  return m;
}

/** Collider boxes of the gate and its garden walls: [cx, cz, w, d]. */
export function gateBoxes(): [number, number, number, number][] {
  const a = TOWN.arch;
  const pw = 0.9;
  const out: [number, number, number, number][] = [];
  for (const sgn of [-1, 1]) {
    out.push([a.x + sgn * (a.halfOpening + pw / 2), a.z, pw, 1.0]);
    out.push([a.x + sgn * (a.halfOpening + pw + 1.8), a.z, 3.6, 0.5]);
  }
  return out;
}

/** The stone gate between the Town Edge and Main Street, with low garden walls beside it. */
function gate(p: Parts): void {
  const a = TOWN.arch;
  const y0 = townHeight(a.x, a.z);
  p.dy = y0 - 0.9;
  const lo = mixHex(PALETTE.stone, SHADES.umber, 0.14);
  const hi = mixHex(PALETTE.stone, PALETTE.ivory, 0.32);
  const cap = mixHex(PALETTE.stone, PALETTE.ivory, 0.5);
  const pw = 0.9;
  const H = a.height + 0.9;
  for (const sgn of [-1, 1]) {
    const px = a.x + sgn * (a.halfOpening + pw / 2);
    p.box(pw, H, 1.0, px, H / 2, a.z, lo, hi);
    p.box(pw + 0.2, 0.2, 1.2, px, H + 0.02, a.z, hi, cap);
    // Garden wall with a rounded cap.
    const wx = a.x + sgn * (a.halfOpening + pw + 1.8);
    p.box(3.6, 2.4, 0.5, wx, 1.2, a.z, lo, hi);
    p.box(3.7, 0.16, 0.66, wx, 2.46, a.z, hi, cap);
  }
  const lw = a.halfOpening * 2 + pw * 2;
  p.box(lw, 0.7, 1.0, a.x, H - 0.35, a.z, lo, hi);
  p.box(lw - 1.0, 0.28, 1.0, a.x, H - 0.84, a.z, lo, hi);
  p.box(lw - 2.4, 0.24, 1.0, a.x, H - 1.08, a.z, lo, hi);
  p.box(lw + 0.3, 0.2, 1.2, a.x, H + 0.1, a.z, hi, cap);
  p.box(0.7, 0.55, 1.1, a.x, H - 1.0, a.z - 0.05, hi, cap);
  p.dy = 0;
}

/** Little stone bridge over the stream: deck, parapets, sloping ramps. */
function bridge(p: Parts): void {
  const b = TOWN.bridge;
  const zc = streamZ(b.x);
  const lo = mixHex(PALETTE.stone, SHADES.umber, 0.1);
  const hi = mixHex(PALETTE.stone, PALETTE.ivory, 0.4);
  const cap = mixHex(PALETTE.stone, PALETTE.ivory, 0.55);
  const w = b.halfWidth * 2;
  const deckLen = b.halfDeck * 2;
  p.box(w, 0.5, deckLen + 0.2, b.x, b.deckY - 0.25, zc, lo, hi);
  for (const sgn of [-1, 1]) {
    p.box(0.3, 0.55, deckLen, b.x + sgn * (b.halfWidth - 0.15), b.deckY + 0.25, zc, hi, cap);
    p.box(0.45, 0.2, deckLen + 0.15, b.x + sgn * (b.halfWidth - 0.15), b.deckY + 0.57, zc, hi, cap);
  }
  const rise = b.deckY - b.rampEndY;
  const ang = Math.atan2(rise, b.ramp);
  const len = Math.hypot(rise, b.ramp) + 0.2;
  for (const sgn of [-1, 1]) {
    const z = zc + sgn * (b.halfDeck + b.ramp / 2);
    const y = (b.deckY + b.rampEndY) / 2 - 0.2;
    p.box(w, 0.4, len, b.x, y, z, lo, hi, 0, sgn * ang);
    // Low stone cheeks on the ramps.
    for (const sx of [-1, 1]) p.box(0.3, 0.3, len, b.x + sx * (b.halfWidth - 0.15), y + 0.3, z, hi, cap, 0, sgn * ang);
  }
}

function square(p: Parts): void {
  const f = TOWN.fountain;
  p.dy = townHeight(f.x, f.z);
  const rimLo = mixHex(PALETTE.stone, SHADES.umber, 0.1);
  const rimHi = mixHex(PALETTE.stone, PALETTE.ivory, 0.45);
  // Rounded rim and basin.
  p.lathe(
    [
      [2.25, -0.4],
      [2.25, 0],
      [2.32, 0.2],
      [2.3, 0.45],
      [2.2, 0.6],
      [2.05, 0.66],
      [1.9, 0.6],
      [1.8, 0.5],
      [1.74, 0.38],
      [1.7, 0.3],
      [0.5, 0.3],
    ],
    f.x,
    f.z,
    rimLo,
    rimHi,
    32,
  );
  // Pedestal with a small catch bowl.
  p.lathe(
    [
      [0.75, 0.3],
      [0.55, 0.6],
      [0.36, 1.0],
      [0.46, 1.2],
      [0.78, 1.32],
      [0.74, 1.42],
      [0.6, 1.4],
      [0.3, 1.34],
    ],
    f.x,
    f.z,
    rimLo,
    rimHi,
    20,
  );
  p.dy = 0;

  // Stalls: wooden counter, posts and a striped awning.
  const wood = mixHex(SHADES.umber, PALETTE.sandstone, 0.22);
  for (const s of TOWN.stalls) {
    p.dy = townHeight(s.x, s.z);
    p.box(s.w, 0.9, s.d, s.x, 0.45, s.z, mixHex(wood, SHADES.umber, 0.2), wood);
    p.box(s.w + 0.15, 0.1, s.d + 0.15, s.x, 0.93, s.z, wood, mixHex(wood, PALETTE.ivory, 0.3));
    for (const px of [-1, 1]) {
      for (const pz of [-1, 1]) p.box(0.12, 2.3, 0.12, s.x + px * (s.w / 2 - 0.06), 1.15, s.z + pz * (s.d / 2 - 0.06), SHADES.umber, wood);
    }
    const c1 = s.canopy === 'ivory' ? PALETTE.ivory : PALETTE.olive;
    const c2 = s.canopy === 'ivory' ? mixHex(PALETTE.sandstone, PALETTE.ivory, 0.4) : mixHex(PALETTE.olive, PALETTE.sage, 0.5);
    const slats = 6;
    const sw = (s.w + 0.5) / slats;
    for (let i = 0; i < slats; i++) {
      const cx = s.x - (s.w + 0.5) / 2 + sw * (i + 0.5);
      const col = i % 2 === 0 ? c1 : c2;
      p.box(sw, 0.1, s.d + 0.7, cx, 2.38, s.z, mixHex(col, SHADES.umber, 0.1), col);
    }
    p.box(s.w + 0.5, 0.2, 0.08, s.x, 2.24, s.z - (s.d + 0.7) / 2, mixHex(c2, SHADES.umber, 0.12), c2);
  }

  // Lantern niche in the Old Tree trunk (dark recess).
  const t = TOWN.oldTree;
  const n = TOWN.niche;
  p.dy = townHeight(t.x, t.z);
  p.box(n.w, n.h, n.d, t.x, n.y, t.z - n.trunkFaceDz + n.d / 2 - 0.05, SHADES.legs, SHADES.legs);
  p.dy = 0;
}
