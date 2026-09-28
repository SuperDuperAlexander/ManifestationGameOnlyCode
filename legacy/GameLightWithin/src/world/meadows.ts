import { LAYOUT2, WORLD2 } from '../content/chapter2';
import type { BodyPoint } from '../content/chapter2';
import { PALETTE } from '../content/palette';
import { clamp, clamp01, fbm2d, smoothstep } from '../core/math';
import { worldMaterial } from '../render/materials';
import { computeVertexNormals } from '../render/geometry';
import {
  Color3,
  group,
  linearColor,
  mesh as makeMesh,
  mixColor,
  setVertexColors,
} from '../render/scene3d';
import type { Group } from '../render/scene3d';
import { HeightField } from './heightField';
import type { FixturesResult, Place, PropsResult, TerrainResult } from './place';
import { scatterProps } from './props';
import {
  buildLightWell,
  buildMeadowSpring,
  buildMountains,
  buildSingingStone,
  buildStandingStone,
} from './props2';

/** The path winds up the meadows in long, slow curves. */
function centerX(z: number): number {
  return Math.sin(z * 0.021) * 7 + Math.sin(z * 0.0085 + 2.1) * 5;
}

/** Half width of the walkable floor. The meadows stay wide the whole way. */
function halfWidth(z: number): number {
  let w = 30 + Math.sin(z * 0.03 + 0.7) * 5;
  // Scene 4 runs over a ridge, which narrows to a saddle the storm can fill.
  w -= 16 * Math.exp(-Math.pow((z - LAYOUT2.storm.z) / 13, 2));
  // Scene 5 opens into the widest place in the chapter, for the two seeds.
  w += 14 * Math.exp(-Math.pow((z + 102) / 15, 2));
  return Math.max(9, w);
}

function softCap(value: number, ceiling: number): number {
  return ceiling * (1 - Math.exp(-value / ceiling));
}

/**
 * Every place the ground is eased flat, with each centre's height worked out
 * once at load.
 *
 * The height function is the hottest thing in the chapter: the ground check,
 * the slope check and the collision slide all call it several times per step,
 * and the terrain build calls it about thirty thousand times. Working out the
 * centre height inside the loop meant three more noise evaluations for every
 * point standing in a flattened area — which is every point the player is
 * ever actually standing on, because that is where the scenes are.
 */
const FLAT_SPOTS: { x: number; z: number; radius: number; centre: number }[] = [
  { x: LAYOUT2.playerStart.x, z: LAYOUT2.playerStart.z, radius: 9 },
  { x: LAYOUT2.spring.x, z: LAYOUT2.spring.z, radius: 7 },
  ...LAYOUT2.bodyStones.map((s) => ({ x: s.x, z: s.z, radius: 5 })),
  { x: LAYOUT2.rain.x, z: LAYOUT2.rain.z, radius: 9 },
  { x: LAYOUT2.singingStone.x, z: LAYOUT2.singingStone.z, radius: 6 },
  { x: LAYOUT2.storm.x, z: LAYOUT2.storm.z, radius: 12 },
  { x: LAYOUT2.seedA.x, z: LAYOUT2.seedA.z, radius: 8 },
  { x: LAYOUT2.seedB.x, z: LAYOUT2.seedB.z, radius: 8 },
  { x: LAYOUT2.lightWell.x, z: LAYOUT2.lightWell.z, radius: 6 },
].map((spot) => ({ ...spot, centre: baseHeight(spot.x, spot.z) }));

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

/** The rolling floor, before anything is flattened into it. */
function baseHeight(x: number, z: number): number {
  // The meadows climb as the player walks in, so every scene looks back down
  // over the one before it.
  const climb = clamp01((WORLD2.lengthStart - z) / 120) * 11;
  // The meadows roll. Long swells first, then a shorter fold on top of them,
  // so the ground has a shape from the path and still has one from the ridge.
  let h = fbm2d(x * 0.014 + 90, z * 0.014 + 90, 3, 19) * 7.5 - 3.7;
  h += fbm2d(x * 0.042 + 5, z * 0.042 + 5, 3, 23) * 2.1;
  h += fbm2d(x * 0.13 + 31, z * 0.13 + 31, 2, 37) * 0.4;
  // One slope holds the four body stones, so they stand in a line going up.
  h += 3.2 * Math.exp(-Math.pow((z + 36) / 16, 2));
  return h + climb;
}

function height(x: number, z: number): number {
  const d = Math.abs(x - centerX(z));
  const half = halfWidth(z);
  let h = baseHeight(x, z);

  // The sides rise into low hills. Lower than the valley's: the meadows are
  // open, and the far mountains do the work of closing the view.
  const over = Math.max(0, d - half);
  h += softCap(over * over * 0.022 + over * 0.2, 16);

  // The ends of the meadows.
  const beyond = Math.max(0, z - WORLD2.lengthStart, WORLD2.lengthEnd - z);
  h += softCap(beyond * beyond * 0.02 + beyond * 0.34, 14);

  // Flat ground wherever the player has to stand still.
  for (const spot of FLAT_SPOTS) h = flattenAround(h, x, z, spot);
  return h;
}

function border(x: number, z: number): number {
  const half = halfWidth(z);
  const dx = Math.abs(x - centerX(z)) - half;
  const outX = clamp01(dx / WORLD2.borderSoftness);
  const outZ = clamp01(
    Math.max(z - WORLD2.lengthStart, WORLD2.lengthEnd - z) / WORLD2.borderSoftness,
  );
  const hardX = clamp01((Math.abs(x) - WORLD2.halfWidth) / WORLD2.borderSoftness + 1);
  return Math.max(outX, outZ, hardX);
}

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
 * The walked track. It runs the whole length of the meadows and branches once,
 * up the slope past the four body stones. There is no track to the rain cloud
 * or to the seeds: those are met, not visited.
 */
function pathAmount(x: number, z: number): number {
  let best = Infinity;
  if (z < WORLD2.lengthStart + 6 && z > WORLD2.lengthEnd + 4) {
    const step = 5;
    const zi = Math.floor(z / step) * step;
    for (const z0 of [zi - step, zi, zi + step]) {
      const z1 = z0 + step;
      best = Math.min(best, distToSegment(x, z, centerX(z0), z0, centerX(z1), z1));
    }
  }
  // Up the slope of the body stones, stone to stone.
  const stones = LAYOUT2.bodyStones;
  const first = stones[0];
  if (first) {
    best = Math.min(best, distToSegment(x, z, centerX(-20), -20, first.x, first.z));
  }
  for (let i = 0; i + 1 < stones.length; i++) {
    const a = stones[i];
    const b = stones[i + 1];
    if (a && b) best = Math.min(best, distToSegment(x, z, a.x, a.z, b.x, b.z));
  }
  const wobble = fbm2d(x * 0.25 + 9, z * 0.25 + 9, 2, 53) * 0.9;
  return 1 - smoothstep(0.9 + wobble, 2.1 + wobble, best);
}

/** The meadows have no gap. There is nowhere the ground runs out. */
function isHole(): boolean {
  return false;
}

/** Mixes two colours into a third. Kept here so the terrain loop makes no garbage. */
function lerpTo(out: Color3, a: Color3, b: Color3, t: number): void {
  out.r = a.r + (b.r - a.r) * t;
  out.g = a.g + (b.g - a.g) * t;
  out.b = a.b + (b.b - a.b) * t;
}

function buildTerrain(): TerrainResult {
  const minZ = WORLD2.lengthEnd - 18;
  const maxZ = WORLD2.lengthStart + 18;
  const width = WORLD2.halfWidth * 2;
  const depth = maxZ - minZ;
  const segX = WORLD2.terrainSegments;
  const segZ = Math.round(segX * (depth / width));

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const cols = segX + 1;
  const heights = new Float32Array(cols * (segZ + 1));
  const solid = new Uint8Array(segX * segZ).fill(1);

  const green = linearColor(PALETTE.growthGreen);
  const deep = linearColor(PALETTE.deepGreen);
  const violet = linearColor(PALETTE.farHillsViolet);
  const earth = linearColor(0xa08a68);
  // Alpine meadow: lighter and yellower than the valley floor below it.
  const meadow = mixColor(linearColor(PALETTE.growthGreen), linearColor(0xdfe884), 0.55);
  const straw = linearColor(0xd2bc7e);
  const tmp = new Color3();

  for (let iz = 0; iz <= segZ; iz++) {
    for (let ix = 0; ix <= segX; ix++) {
      const x = -WORLD2.halfWidth + (ix / segX) * width;
      const z = minZ + (iz / segZ) * depth;
      const y = height(x, z);
      positions.push(x, y, z);
      heights[iz * cols + ix] = y;

      const slope = height(x + 1, z) - y;
      const shade = clamp(0.58 + slope * 0.5 + fbm2d(x * 0.07, z * 0.07, 3, 29) * 0.28, 0.48, 1);
      const height01 = clamp01((y + 2) / 22);
      lerpTo(tmp, deep, green, clamp01(1.2 - height01 * 1.3));
      // High ground turns violet, so the meadows read as high up.
      lerpTo(tmp, tmp, violet, clamp01((height01 - 0.42) * 1.5));

      const drift = fbm2d(x * 0.03 + 21, z * 0.03 + 17, 3, 61);
      lerpTo(tmp, tmp, meadow, clamp01((drift - 0.38) * 2.1));
      const dry = fbm2d(x * 0.019 + 71, z * 0.019 + 39, 2, 83);
      lerpTo(tmp, tmp, straw, clamp01((dry - 0.56) * 1.6) * 0.7);
      const mottle = 0.9 + fbm2d(x * 0.5, z * 0.5, 2, 97) * 0.22;

      const lit = shade * mottle;
      tmp.r *= lit;
      tmp.g *= lit;
      tmp.b *= lit;
      const track = pathAmount(x, z);
      if (track > 0) lerpTo(tmp, tmp, earth, track * 0.8);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iz * cols + ix;
      indices.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
    }
  }

  const mesh = makeMesh(
    'terrain',
    computeVertexNormals({
      positions,
      normals: [],
      uvs: new Array<number>(cols * (segZ + 1) * 2).fill(0),
      indices,
    }),
  );
  setVertexColors(mesh, colors);
  mesh.material = worldMaterial({ rim: 0.07 });
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  mesh.freezeWorldMatrix();

  const far = group('mountains');
  buildMountains().parent = far;

  const field = new HeightField(
    -WORLD2.halfWidth,
    minZ,
    width / segX,
    depth / segZ,
    segX,
    segZ,
    heights,
    solid,
  );

  return { mesh, extras: [far], surface: field.sampler() };
}

function buildFixtures(): FixturesResult {
  const fixtures = group('fixtures');
  const anchors = new Map<string, Group>();
  const blockers: { x: number; z: number; radius: number }[] = [];

  const put = (id: string, object: Group, x: number, z: number, blockR = 0): void => {
    object.position.set(x, height(x, z), z);
    object.parent = fixtures;
    anchors.set(id, object);
    if (blockR > 0) blockers.push({ x, z, radius: blockR });
  };

  put('spring', buildMeadowSpring(), LAYOUT2.spring.x, LAYOUT2.spring.z);

  let i = 0;
  for (const stone of LAYOUT2.bodyStones) {
    const built = buildStandingStone(stone.point as BodyPoint, 700 + i);
    built.rotation.y = -0.4 + i * 0.25;
    put(`stone-${stone.point}`, built, stone.x, stone.z, 0.5);
    i++;
  }

  put('singingStone', buildSingingStone(), LAYOUT2.singingStone.x, LAYOUT2.singingStone.z, 0.8);
  put('lightWell', buildLightWell(), LAYOUT2.lightWell.x, LAYOUT2.lightWell.z);

  return { group: fixtures, anchors, blockers };
}

export const meadows: Place = {
  name: 'meadows',
  height,
  border,
  centerX,
  halfWidth,
  pathAmount,
  isHole,
  zStart: WORLD2.lengthStart,
  zEnd: WORLD2.lengthEnd,
  halfWidthMax: WORLD2.halfWidth,
  grassDensity: WORLD2.grassDensity,
  buildTerrain,
  buildProps(treeBlobs: number): PropsResult {
    // The meadows are above the tree line in places, so there are fewer trees
    // and more rock than in the valley.
    return scatterProps(treeBlobs, {
      seed: 20260916,
      count: 260,
      treeShare: 0.42,
      keepClear: [
        { x: LAYOUT2.playerStart.x, z: LAYOUT2.playerStart.z, r: 9 },
        { x: LAYOUT2.spring.x, z: LAYOUT2.spring.z, r: 8 },
        ...LAYOUT2.bodyStones.map((s) => ({ x: s.x, z: s.z, r: 6 })),
        { x: LAYOUT2.rain.x, z: LAYOUT2.rain.z, r: 12 },
        { x: LAYOUT2.singingStone.x, z: LAYOUT2.singingStone.z, r: 7 },
        { x: LAYOUT2.storm.x, z: LAYOUT2.storm.z, r: 14 },
        { x: LAYOUT2.seedA.x, z: LAYOUT2.seedA.z, r: 10 },
        { x: LAYOUT2.seedB.x, z: LAYOUT2.seedB.z, r: 10 },
        { x: LAYOUT2.lightWell.x, z: LAYOUT2.lightWell.z, r: 7 },
      ],
    });
  },
  buildFixtures,
  bridge: null,
};
