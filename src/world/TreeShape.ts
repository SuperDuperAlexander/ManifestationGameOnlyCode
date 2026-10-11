/**
 * One tree silhouette, shared by the Old Tree (town) and the giant Inner Tree (GAME_DESIGN 5.2, 8).
 * Units: the tree is 1.0 tall. TreeBuilder scales it. Index k of a branch / root is the same in both worlds.
 * Horizontal direction of an angle `a`: x = cos(a), z = sin(a).
 */
export interface BranchShape {
  /** Direction around the trunk. */
  angle: number;
  /** Angle from vertical (radians). */
  tilt: number;
  length: number;
  /** Where it leaves the trunk, as a fraction of trunk height. */
  start: number;
  radius: number;
}

export interface RootShape {
  angle: number;
  length: number;
  /** Radius at the trunk. */
  radius: number;
  /** How high the root arches above the ground (tree units). */
  hump: number;
  /** Sideways wobble phase. */
  wobble: number;
}

export interface TreeShape {
  trunkHeight: number;
  trunkRadiusBase: number;
  trunkRadiusTop: number;
  /** Sideways lean of the trunk top (x, z), tree units. */
  lean: [number, number];
  /** Crown blobs: x, y, z, radius. */
  crown: [number, number, number, number][];
  branches: BranchShape[];
  roots: RootShape[];
  /** Branch that is dry in the story (the one the lantern heals). */
  dryBranch: number;
  /** Root that burns in the story (faces the imp clearing inside). */
  burnedRoot: number;
}

export const OLD_TREE: TreeShape = {
  trunkHeight: 0.56,
  trunkRadiusBase: 0.068,
  trunkRadiusTop: 0.042,
  lean: [0.035, -0.01],
  crown: [
    [0.03, 0.76, 0, 0.26],
    [0.22, 0.67, 0.06, 0.18],
    [-0.19, 0.67, -0.07, 0.19],
    [0.05, 0.87, -0.13, 0.15],
  ],
  branches: [
    { angle: 0.3, tilt: 1.15, length: 0.34, start: 0.55, radius: 0.016 },
    { angle: 1.45, tilt: 1.1, length: 0.32, start: 0.6, radius: 0.015 },
    { angle: 2.65, tilt: 1.15, length: 0.36, start: 0.5, radius: 0.017 },
    { angle: 3.95, tilt: 1.1, length: 0.33, start: 0.58, radius: 0.015 },
    { angle: 5.2, tilt: 1.2, length: 0.3, start: 0.52, radius: 0.015 },
  ],
  roots: [
    { angle: 0.25, length: 0.3, radius: 0.04, hump: 0.022, wobble: 0.3 },
    { angle: 1.3, length: 0.28, radius: 0.037, hump: 0.02, wobble: 1.1 },
    { angle: 2.35, length: 0.31, radius: 0.042, hump: 0.024, wobble: 2.0 },
    { angle: 3.45, length: 0.29, radius: 0.038, hump: 0.02, wobble: 2.7 },
    { angle: 4.9, length: 0.3, radius: 0.04, hump: 0.022, wobble: 3.6 },
  ],
  dryBranch: 2,
  burnedRoot: 2,
};
