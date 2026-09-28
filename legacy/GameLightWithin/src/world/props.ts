import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Material } from '@babylonjs/core/Materials/material';
import { LAYOUT } from '../content/chapter1';
import { PALETTE } from '../content/palette';
import { makeRng } from '../core/math';
import { worldMaterial } from '../render/materials';
import {
  boxGeo,
  computeVertexNormals,
  cylinderGeo,
  circleGeo,
  icosahedronGeo,
  rotateXGeo,
  sphereGeo,
  torusGeo,
} from '../render/geometry';
import type { Group } from '../render/scene3d';
import { group, linearColor, mesh as makeMesh, mixColor } from '../render/scene3d';
import { place } from './place';
import type { PropsResult, SurfaceSampler } from './place';

/** A material every world prop shares, so they all follow the grey-to-colour rule. */
function propMaterial(color: string | number | Color3, rim = 0.22): Material {
  return worldMaterial({ color, rim });
}

/** A rounded rock. Rocks are soft, never sharp. */
export function buildRock(radius: number, seed: number): Mesh {
  const geo = icosahedronGeo(radius, 1);
  const rng = makeRng(seed);
  for (let i = 0; i < geo.positions.length; i += 3) {
    const s = 0.72 + rng() * 0.45;
    geo.positions[i] = (geo.positions[i] ?? 0) * s;
    geo.positions[i + 1] = (geo.positions[i + 1] ?? 0) * s * 0.72;
    geo.positions[i + 2] = (geo.positions[i + 2] ?? 0) * s;
  }
  computeVertexNormals(geo);
  const rock = makeMesh('rock', geo);
  rock.material = propMaterial(0x8e8a84);
  return rock;
}

/**
 * A stylised tree: a trunk plus clustered soft blobs.
 *
 * Shape matters more than detail here. Trees are the only tall thing in the
 * valley, so they carry the skyline, and a wood of identical shapes reads as
 * wallpaper. Each tree picks one of three builds and its own leaf tone.
 */
export function buildTree(seed: number, blobCount: number): Group {
  const rng = makeRng(seed);
  const tree = group('tree');

  // 0 broad and round, 1 tall and narrow, 2 low and wide.
  const kind = Math.floor(rng() * 3);
  const height =
    kind === 1 ? 5.4 + rng() * 2.4 : kind === 2 ? 2.4 + rng() * 1.1 : 3.4 + rng() * 1.8;
  const spread = kind === 1 ? 0.55 : kind === 2 ? 1.5 : 1.0;

  const trunk = makeMesh('trunk', cylinderGeo(0.14, 0.32, height, 6, 1));
  trunk.material = propMaterial(0x6b5340);
  trunk.position.y = height / 2;
  trunk.rotation.y = rng() * Math.PI;
  // A slight lean keeps a row of trees from looking stamped out.
  trunk.rotation.z = (rng() - 0.5) * 0.12;
  trunk.parent = tree;

  const leaf = icosahedronGeo(1, 1);
  const deep = linearColor(PALETTE.deepGreen);
  const bright = linearColor(PALETTE.growthGreen);
  // Two tones per tree: the lit crown and the shaded underside.
  const crown = propMaterial(mixColor(deep, bright, 0.45 + rng() * 0.5));
  const under = propMaterial(mixColor(deep, bright, 0.1 + rng() * 0.2));

  const count = Math.max(3, blobCount);
  for (let i = 0; i < count; i++) {
    const high = i < count * 0.6;
    const blob = makeMesh('leaf', leaf);
    blob.material = high ? crown : under;
    const r = (0.8 + rng() * 0.8) * (kind === 1 ? 0.8 : 1);
    const a = (i / count) * Math.PI * 2 + rng() * 0.7;
    const ring = (0.35 + rng() * 0.95) * spread;
    blob.position.set(
      Math.cos(a) * ring,
      height + (high ? 0.45 + rng() * 1.3 : -0.1 + rng() * 0.6),
      Math.sin(a) * ring,
    );
    blob.scaling.set(r, r * (0.7 + rng() * 0.3), r);
    blob.rotation.set(rng(), rng(), rng());
    blob.parent = tree;
  }
  return tree;
}

/** A stone spring basin. It holds the light until the player receives it. */
export function buildSpringBasin(): Group {
  const basin = group('spring');

  const ring = makeMesh('basinRing', rotateXGeo(torusGeo(1.5, 0.42, 6, 18), -Math.PI / 2));
  ring.material = propMaterial(0x9a948c);
  ring.position.y = 0.32;
  ring.scaling.y = 0.75;
  ring.parent = basin;

  const bowl = makeMesh('basinBowl', rotateXGeo(circleGeo(1.5, 20), -Math.PI / 2));
  bowl.material = worldMaterial({ color: 0x7d7a75, rim: 0.12, doubleSided: true });
  bowl.position.y = 0.2;
  bowl.parent = basin;

  for (let i = 0; i < 4; i++) {
    const rock = buildRock(0.5 + (i % 2) * 0.22, 100 + i);
    const a = (i / 4) * Math.PI * 2 + 0.5;
    rock.position.set(Math.cos(a) * 2.2, 0.15, Math.sin(a) * 2.2);
    rock.parent = basin;
  }
  return basin;
}

/**
 * The stone next to the dry spring. It carries a carved symbol that means
 * "stop here". There is no text on it.
 */
export function buildSignStone(): Group {
  const stone = group('signStone');

  const slab = makeMesh('slab', boxGeo(1.5, 2.1, 0.34));
  slab.material = propMaterial(0x9c968e);
  slab.position.y = 1.05;
  slab.rotation.z = 0.05;
  slab.parent = stone;

  // The carved symbol: a ring with a short line beneath it, cut a little proud
  // of the face so the light catches it.
  const carveMat = propMaterial(0x6f6a63, 0.12);
  const ring = makeMesh('carveRing', torusGeo(0.4, 0.075, 5, 16));
  ring.material = carveMat;
  ring.position.set(0, 1.32, 0.18);
  ring.parent = stone;

  const bar = makeMesh('carveBar', boxGeo(0.78, 0.1, 0.08));
  bar.material = carveMat;
  bar.position.set(0, 0.62, 0.18);
  bar.parent = stone;

  const dot = makeMesh('carveDot', sphereGeo(0.1, 8, 6));
  dot.material = carveMat;
  dot.position.set(0, 1.32, 0.2);
  dot.parent = stone;

  const base = buildRock(0.8, 7);
  base.position.y = 0.1;
  base.parent = stone;
  return stone;
}

/** The length of the bridge deck along the valley. */
export const BRIDGE_SPAN = LAYOUT.gap.z1 - LAYOUT.gap.z0 + 7;
/** Half the deck's width, and how high its top sits above the group's origin. */
const DECK_HALF_WIDTH = 1.7;
const DECK_TOP = 0.18;
const DECK_ARCH = 0.34;

/** The bridge that grows from the seed. It starts sunk in the gap and rises. */
export function buildBridge(): Group {
  const bridge = group('bridge');
  const span = BRIDGE_SPAN;

  const deckGeo = boxGeo(3.4, 0.36, span, 1, 1, 14);
  for (let i = 0; i < deckGeo.positions.length; i += 3) {
    // A gentle arch across the gap.
    const t = (deckGeo.positions[i + 2] ?? 0) / (span / 2);
    deckGeo.positions[i + 1] = (deckGeo.positions[i + 1] ?? 0) + (1 - t * t) * DECK_ARCH;
  }
  computeVertexNormals(deckGeo);
  const deck = makeMesh('bridgeDeck', deckGeo);
  deck.material = propMaterial(0xa79274, 0.12);
  deck.parent = bridge;

  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const post = makeMesh('bridgePost', cylinderGeo(0.08, 0.1, 0.9, 5));
      post.material = propMaterial(0x8d7a60);
      const t = (i / 6) * 2 - 1;
      post.position.set(side * 1.55, 0.62 + (1 - t * t) * DECK_ARCH, t * (span / 2 - 0.6));
      post.parent = bridge;
    }
    const railGeo = boxGeo(0.12, 0.12, span - 1, 1, 1, 12);
    for (let i = 0; i < railGeo.positions.length; i += 3) {
      const t = (railGeo.positions[i + 2] ?? 0) / ((span - 1) / 2);
      railGeo.positions[i + 1] = (railGeo.positions[i + 1] ?? 0) + (1 - t * t) * DECK_ARCH;
    }
    computeVertexNormals(railGeo);
    const rail = makeMesh('bridgeRail', railGeo);
    rail.material = propMaterial(0x8d7a60);
    rail.position.set(side * 1.55, 1.02, 0);
    rail.parent = bridge;
  }
  return bridge;
}

/**
 * Where the finished bridge carries the player.
 *
 * The deck is an arch of known shape, so where its surface is can simply be
 * worked out. It is only ever asked over the gap, because the ground answers
 * first everywhere there is ground.
 */
export function bridgeSurface(bridge: Group): SurfaceSampler {
  return (x, z) => {
    const localX = x - bridge.position.x;
    const localZ = z - bridge.position.z;
    if (Math.abs(localX) > DECK_HALF_WIDTH) return null;
    const half = BRIDGE_SPAN / 2;
    if (Math.abs(localZ) > half) return null;
    const t = localZ / half;
    return bridge.position.y + DECK_TOP + (1 - t * t) * DECK_ARCH;
  };
}

export interface ScatterOptions {
  /** Circles nothing may stand inside, so the player always has room. */
  keepClear: { x: number; z: number; r: number }[];
  /** How many trees and rocks to try to place. */
  count?: number;
  /** Share of props that are trees rather than rocks. */
  treeShare?: number;
  seed?: number;
}

/**
 * Scatters trees and rocks over the shoulders of the active place, well clear
 * of the floor the player walks. The place decides its own shape; this only
 * decides what stands on it.
 *
 * Fourteen trees are built, and every tree on the hillside is a copy of one
 * of them. The copies are not objects: each part of each template carries a
 * list of the places it stands, and the whole wood is drawn in about as many
 * calls as the fourteen originals took. Three hundred trees of ten parts each
 * would otherwise be three thousand things to move, sort and draw, one at a
 * time, every frame.
 */
export function scatterProps(treeBlobs: number, options: ScatterOptions): PropsResult {
  const scatter = group('scatter');
  const blockers: { x: number; z: number; radius: number }[] = [];
  const rng = makeRng(options.seed ?? 20260915);
  const here = place();
  const keepClear = options.keepClear;
  const want = options.count ?? 320;
  const treeShare = options.treeShare ?? 0.62;

  // Each template part, lifted out of its tree and left standing at the
  // origin. Its place inside the tree is kept as a matrix instead.
  const templates: { part: Mesh; local: Matrix; places: number[] }[][] = [];
  for (let i = 0; i < 14; i++) {
    const tree = buildTree(300 + i, treeBlobs);
    const parts: { part: Mesh; local: Matrix; places: number[] }[] = [];
    for (const child of tree.getChildMeshes(false)) {
      if (!(child instanceof Mesh)) continue;
      const local = Matrix.Compose(
        child.scaling.clone(),
        Quaternion.FromEulerAngles(child.rotation.x, child.rotation.y, child.rotation.z),
        child.position.clone(),
      );
      child.parent = null;
      child.position.setAll(0);
      child.rotation.setAll(0);
      child.scaling.setAll(1);
      child.isPickable = false;
      child.alwaysSelectAsActiveMesh = true;
      child.doNotSyncBoundingInfo = true;
      parts.push({ part: child, local, places: [] });
    }
    tree.dispose();
    templates.push(parts);
  }

  const stand = new Vector3();
  const spin = new Quaternion();
  const size = new Vector3();
  let placed = 0;
  for (let i = 0; i < want * 9 && placed < want; i++) {
    const z = here.zEnd + rng() * (here.zStart - here.zEnd);
    const half = here.halfWidth(z);
    const side = rng() < 0.5 ? -1 : 1;
    // Props live on the shoulders, not on the floor the player walks.
    const x = here.centerX(z) + side * (half * (0.72 + rng() * 0.55));
    if (Math.abs(x) > here.halfWidthMax - 3) continue;
    if (here.isHole(x, z)) continue;
    if (keepClear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) continue;

    const y = here.height(x, z);
    if (rng() < treeShare) {
      const template = templates[Math.floor(rng() * templates.length)];
      if (!template) continue;
      const s = 0.72 + rng() * 0.7;
      stand.set(x, y, z);
      size.setAll(s);
      Quaternion.FromEulerAnglesToRef(0, rng() * Math.PI * 2, 0, spin);
      const world = Matrix.Compose(size, spin, stand);
      for (const entry of template) {
        entry.local.multiply(world).copyToArray(entry.places, entry.places.length);
      }
      blockers.push({ x, z, radius: 0.55 * s });
    } else {
      const r = 0.5 + rng() * 1.4;
      const rock = buildRock(r, 400 + i);
      rock.position.set(x, y + r * 0.3, z);
      rock.rotation.y = rng() * Math.PI * 2;
      rock.parent = scatter;
      rock.isPickable = false;
      rock.freezeWorldMatrix();
      if (r > 0.9) blockers.push({ x, z, radius: r * 0.7 });
    }
    placed++;
  }

  for (const template of templates) {
    for (const entry of template) {
      if (entry.places.length === 0) {
        entry.part.dispose();
        continue;
      }
      entry.part.thinInstanceSetBuffer('matrix', new Float32Array(entry.places), 16, true);
      entry.part.parent = scatter;
    }
  }
  return { group: scatter, blockers };
}
