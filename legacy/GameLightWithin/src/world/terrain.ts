import { LAYOUT, WORLD } from '../content/chapter1';
import { PALETTE } from '../content/palette';
import { clamp, clamp01, fbm2d, smoothstep } from '../core/math';
import { worldMaterial } from '../render/materials';
import { planeGeo, rotateXGeo, computeVertexNormals } from '../render/geometry';
import {
  Color3,
  group,
  linearColor,
  mesh as makeMesh,
  mixColor,
  setVertexColors,
} from '../render/scene3d';
import { HeightField } from './heightField';
import type { Group } from '../render/scene3d';
import type { TerrainResult } from './place';

/** The path wanders gently through the valley instead of running straight. */
export function pathCenterX(z: number): number {
  return Math.sin(z * 0.034) * 5.5 + Math.sin(z * 0.011 + 1.3) * 4;
}

/** Half width of the walkable floor at this point along the valley. */
export function valleyHalfWidth(z: number): number {
  let w = 21 + Math.sin(z * 0.045) * 4;
  // Scene 3 opens into a wide field.
  w += 16 * Math.exp(-Math.pow((z + 45) / 16, 2));
  // Scene 4 narrows to a path just wide enough for the fog.
  w -= 14 * Math.exp(-Math.pow((z - LAYOUT.fog.z) / 11, 2));
  // Scene 5 has a side path out to the third spring.
  w += 13 * Math.exp(-Math.pow((z + 79) / 9, 2));
  return Math.max(6, w);
}

/** Shortest distance from a point to a line between two points, on the floor. */
function distToSegment(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = clamp01(((x - ax) * dx + (z - az) * dz) / len2);
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/**
 * How much of a walked track there is at this point, 0 none to 1 bare earth.
 *
 * The brief says a path leads to the dry spring. Without one the valley is an
 * even meadow and the player has nothing to follow. The track is drawn into
 * the terrain's vertex colours and it keeps the grass off itself, so it costs
 * no extra geometry. There is deliberately **no** track to the second spring:
 * that one is meant to be found by stopping, not by following.
 */
export function pathAmount(x: number, z: number): number {
  let best = Infinity;

  // The main track runs the length of the valley and stops at the gap.
  if (z < WORLD.lengthStart + 6 && z > LAYOUT.gap.z1 - 1) {
    // Follow the wandering centre line in short straight pieces.
    const step = 4;
    const zi = Math.floor(z / step) * step;
    for (const z0 of [zi - step, zi, zi + step]) {
      const z1 = z0 + step;
      best = Math.min(best, distToSegment(x, z, pathCenterX(z0), z0, pathCenterX(z1), z1));
    }
  }

  // A short branch off to the dry spring and its sign stone.
  best = Math.min(
    best,
    distToSegment(x, z, pathCenterX(-24), -24, LAYOUT.spring1.x, LAYOUT.spring1.z + 1.5),
  );

  // The side path out to the third spring, which the seed needs.
  best = Math.min(
    best,
    distToSegment(x, z, pathCenterX(-79), -79, LAYOUT.spring3.x - 2, LAYOUT.spring3.z),
  );

  // Soft, uneven edges, so it reads as trodden rather than drawn.
  const wobble = fbm2d(x * 0.25, z * 0.25, 2, 31) * 0.9;
  return 1 - smoothstep(1.0 + wobble, 2.3 + wobble, best);
}

/** True inside the gap that stops the path in scene 5. */
export function inGap(x: number, z: number): boolean {
  const g = LAYOUT.gap;
  return x > g.x0 && x < g.x1 && z > g.z0 && z < g.z1;
}

/**
 * Ground height at a point. Terrain, grass and props all read this, so the
 * world stays consistent without any outside height map.
 */
export function terrainHeight(x: number, z: number): number {
  const cx = pathCenterX(z);
  const d = Math.abs(x - cx);
  const half = valleyHalfWidth(z);

  // Soft rolling floor.
  let h = fbm2d(x * 0.028 + 40, z * 0.028 + 40, 4, 7) * 2.6 - 1.3;
  h += fbm2d(x * 0.11, z * 0.11, 3, 13) * 0.45;

  // The sides rise into hills. Never a wall, always a slope, and the tops
  // round off instead of cutting to a flat plateau.
  const over = Math.max(0, d - half);
  h += softCap(over * over * 0.03 + over * 0.26, 22);

  // Far hills close the valley at each end. They stay low, so the sky is
  // still visible from the far end of the walk.
  const beyond = Math.max(0, z - WORLD.lengthStart, WORLD.lengthEnd - z);
  h += softCap(beyond * beyond * 0.018 + beyond * 0.3, 12);

  // The floor is flattened where the player has to stand still.
  for (const spot of FLAT_SPOTS) h = flattenAround(h, x, z, spot);
  return h;
}

/** Approaches a ceiling smoothly instead of cutting off at it. */
function softCap(value: number, ceiling: number): number {
  return ceiling * (1 - Math.exp(-value / ceiling));
}

/**
 * Every place the ground is eased flat, with each centre's height worked out
 * once at load rather than on every call.
 *
 * The height function is the hottest thing in the game: the ground check, the
 * slope check and the collision slide all call it several times per step.
 */
const FLAT_SPOTS: { x: number; z: number; radius: number; centre: number }[] = [
  { x: LAYOUT.spring1.x, z: LAYOUT.spring1.z, radius: 7 },
  { x: LAYOUT.spring2.x, z: LAYOUT.spring2.z, radius: 8 },
  { x: LAYOUT.spring3.x, z: LAYOUT.spring3.z, radius: 7 },
  { x: LAYOUT.fog.x, z: LAYOUT.fog.z, radius: 9 },
  { x: LAYOUT.seedSpot.x, z: LAYOUT.seedSpot.z, radius: 8 },
  { x: LAYOUT.playerStart.x, z: LAYOUT.playerStart.z, radius: 8 },
].map((spot) => ({
  ...spot,
  centre: fbm2d(spot.x * 0.028 + 40, spot.z * 0.028 + 40, 4, 7) * 2.6 - 1.3,
}));

/** Eases the ground toward a spot's own height inside its radius. */
function flattenAround(
  h: number,
  x: number,
  z: number,
  spot: { x: number; z: number; radius: number; centre: number },
): number {
  const d = Math.hypot(x - spot.x, z - spot.z);
  const t = 1 - smoothstep(spot.radius * 0.4, spot.radius, d);
  if (t <= 0) return h;
  return h * (1 - t) + spot.centre * t;
}

/** How far outside the soft border a point is, 0 inside, 1 fully outside. */
export function borderAmount(x: number, z: number): number {
  const half = valleyHalfWidth(z);
  const dx = Math.abs(x - pathCenterX(z)) - half;
  const outX = clamp01(dx / WORLD.borderSoftness);
  const outZ = clamp01(Math.max(z - WORLD.lengthStart, WORLD.lengthEnd - z) / WORLD.borderSoftness);
  const hardX = clamp01((Math.abs(x) - WORLD.halfWidth) / WORLD.borderSoftness + 1);
  return Math.max(outX, outZ, hardX);
}

/**
 * Builds the valley as one heightfield. Quads inside the gap are left out,
 * so the ground check finds nothing there and the player cannot walk across
 * until the bridge is built.
 */
export function buildTerrain(): TerrainResult {
  const minZ = WORLD.lengthEnd - 18;
  const maxZ = WORLD.lengthStart + 18;
  const width = WORLD.halfWidth * 2;
  const depth = maxZ - minZ;
  const segX = WORLD.terrainSegments;
  const segZ = Math.round(segX * (depth / width));

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const cols = segX + 1;
  const heights = new Float32Array(cols * (segZ + 1));
  const solid = new Uint8Array(segX * segZ);

  const green = linearColor(PALETTE.growthGreen);
  const deep = linearColor(PALETTE.deepGreen);
  const violet = linearColor(PALETTE.farHillsViolet);
  const earth = linearColor(0xa08a68);
  const meadow = mixColor(linearColor(PALETTE.growthGreen), linearColor(0xd6e07a), 0.4);
  const straw = linearColor(0xc9b478);
  const tmp = new Color3();

  for (let iz = 0; iz <= segZ; iz++) {
    for (let ix = 0; ix <= segX; ix++) {
      const x = -WORLD.halfWidth + (ix / segX) * width;
      const z = minZ + (iz / segZ) * depth;
      const y = terrainHeight(x, z);
      positions.push(x, y, z);
      heights[iz * cols + ix] = y;

      // Light is baked into the vertex colours instead of a shadow map.
      const slope = terrainHeight(x + 1, z) - y;
      const shade = clamp(0.56 + slope * 0.5 + fbm2d(x * 0.07, z * 0.07, 3, 21) * 0.3, 0.46, 1);
      const height01 = clamp01((y + 2) / 16);
      lerpTo(tmp, deep, green, clamp01(1.15 - height01 * 1.4));
      lerpTo(tmp, tmp, violet, clamp01((height01 - 0.45) * 1.6));

      // Patches. A single flat green reads as a plane no matter how it is lit,
      // so the ground carries broad drifts of lighter and drier growth on top
      // of finer mottling. This is the cheapest way to make ground look like
      // ground: it costs nothing at run time, only vertex colours.
      const drift = fbm2d(x * 0.035 + 11, z * 0.035 + 7, 3, 43);
      lerpTo(tmp, tmp, meadow, clamp01((drift - 0.42) * 1.9));
      const dry = fbm2d(x * 0.021 + 61, z * 0.021 + 29, 2, 77);
      lerpTo(tmp, tmp, straw, clamp01((dry - 0.58) * 1.7) * 0.75);
      const mottle = 0.9 + fbm2d(x * 0.55, z * 0.55, 2, 91) * 0.22;

      const lit = shade * mottle;
      tmp.r *= lit;
      tmp.g *= lit;
      tmp.b *= lit;
      // The walked track shows the earth under the grass.
      const track = pathAmount(x, z);
      if (track > 0) lerpTo(tmp, tmp, earth, track * 0.85);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const x = -WORLD.halfWidth + (ix / segX) * width;
      const z = minZ + (iz / segZ) * depth;
      // Leave the gap open. No ground means the player cannot cross it.
      if (inGap(x, z) || inGap(x + width / segX, z + depth / segZ)) continue;
      solid[iz * segX + ix] = 1;
      const a = iz * cols + ix;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = computeVertexNormals({
    positions,
    normals: [],
    uvs: new Array<number>(cols * (segZ + 1) * 2).fill(0),
    indices,
  });
  const mesh = makeMesh('terrain', geo);
  setVertexColors(mesh, colors);
  // A low rim on the ground: enough to catch the hill edges against the sky,
  // not so much that the whole meadow glows.
  mesh.material = worldMaterial({ rim: 0.07 });
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  mesh.freezeWorldMatrix();

  const field = new HeightField(
    -WORLD.halfWidth,
    minZ,
    width / segX,
    depth / segZ,
    segX,
    segZ,
    heights,
    solid,
  );

  return { mesh, extras: [buildChasm()], surface: field.sampler() };
}

/** Mixes two colours into a third. Kept here so the terrain loop makes no garbage. */
function lerpTo(out: Color3, a: Color3, b: Color3, t: number): void {
  out.r = a.r + (b.r - a.r) * t;
  out.g = a.g + (b.g - a.g) * t;
  out.b = a.b + (b.b - a.b) * t;
}

/**
 * The gap in the ground. It is built as an open box that sits exactly inside
 * the hole in the terrain: four dark walls dropping from the rim and a floor
 * far below. Each wall stops at the ground height above it, so no wall ever
 * sticks up out of the valley floor.
 */
function buildChasm(): Group {
  const g = LAYOUT.gap;
  const chasm = group('chasm');
  const cx = (g.x0 + g.x1) / 2;
  const cz = (g.z0 + g.z1) / 2;
  const width = g.x1 - g.x0;
  const depth = g.z1 - g.z0;
  const floorY = -12;

  // Everything down here sits in shadow, so the colours stay very dark.
  const rock = linearColor(PALETTE.blockage).scale(0.12);
  const wallMat = worldMaterial({ color: rock, rim: 0.02, doubleSided: true });

  const floorGeo = rotateXGeo(planeGeo(width + 2, depth + 2, 6, 6), -Math.PI / 2);
  for (let i = 0; i < floorGeo.positions.length; i += 3) {
    floorGeo.positions[i + 1] =
      floorY +
      fbm2d((floorGeo.positions[i] ?? 0) * 0.2, (floorGeo.positions[i + 2] ?? 0) * 0.2, 2, 5) * 2;
  }
  computeVertexNormals(floorGeo);
  const floor = makeMesh('chasmFloor', floorGeo);
  floor.material = wallMat;
  floor.position.set(cx, 0, cz);
  floor.parent = chasm;

  // Four walls, each reaching up to the ground height at its own edge.
  const walls: [number, number, number, number][] = [
    [width, cx, g.z0, 0],
    [width, cx, g.z1, Math.PI],
    [depth, g.x0, cz, Math.PI / 2],
    [depth, g.x1, cz, -Math.PI / 2],
  ];
  for (const [span, x, z, rotY] of walls) {
    const top = terrainHeight(x, z) + 0.2;
    const wallHeight = top - floorY;
    const wall = makeMesh('chasmWall', planeGeo(span, wallHeight));
    wall.material = wallMat;
    wall.position.set(x, floorY + wallHeight / 2, z);
    wall.rotation.y = rotY;
    wall.parent = chasm;
  }
  for (const m of chasm.getChildMeshes(false)) {
    m.isPickable = false;
    m.receiveShadows = true;
  }
  return chasm;
}
