import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Group } from '../render/scene3d';

/**
 * Where the ground is at a point, or null where there is none at all.
 *
 * The ground is a heightfield the game generated itself, so the checks read
 * that field directly instead of firing a ray at the mesh built from it. It
 * is the same answer, exactly, for a constant cost and with no acceleration
 * structure to build or keep in step.
 */
export type SurfaceSampler = (x: number, z: number) => number | null;

export interface TerrainResult {
  mesh: Mesh;
  /** Anything else the ground is made of: a chasm, a cliff, a lake bed. */
  extras: Group[];
  /** Where the player's feet rest, for the ground checks. */
  surface: SurfaceSampler;
}

export interface PropsResult {
  group: Group;
  blockers: { x: number; z: number; radius: number }[];
}

/**
 * One chapter's place: its ground, its shape and what stands in it.
 *
 * Grass, props, the ground checks and the border push all read the place
 * rather than one chapter's terrain, so a second chapter is a second place
 * and not a second copy of the world.
 */
export interface Place {
  readonly name: string;
  /** Ground height at a point. */
  height(x: number, z: number): number;
  /** How far outside the soft border a point is, 0 inside, 1 fully outside. */
  border(x: number, z: number): number;
  /** The centre line of the walkable floor at this point. */
  centerX(z: number): number;
  /** Half width of the walkable floor at this point. */
  halfWidth(z: number): number;
  /** How much of a walked track there is here, 0 none to 1 bare earth. */
  pathAmount(x: number, z: number): number;
  /** True where there is no ground at all. */
  isHole(x: number, z: number): boolean;
  /** The two ends of the place along z. */
  readonly zStart: number;
  readonly zEnd: number;
  readonly halfWidthMax: number;
  /**
   * How much grass this place wants, against the tier's own count.
   *
   * A wider floor spreads the same number of cards thinner. The meadows are
   * about half again the area of the valley, so they ask for more; the tier
   * still decides the base number, and the watchdog can still step it down.
   */
  readonly grassDensity: number;
  buildTerrain(): TerrainResult;
  buildProps(treeBlobs: number): PropsResult;
  /**
   * The named things that stand in this place: spring basins, standing
   * stones, a well. A chapter looks them up by name to light them, move them
   * or hide them.
   */
  buildFixtures(): FixturesResult;
  /** The bridge that grows over a gap, where the place has one. */
  readonly bridge: { x: number; z: number; deckZ: number } | null;
}

export interface FixturesResult {
  group: Group;
  anchors: Map<string, Group>;
  blockers: { x: number; z: number; radius: number }[];
}

/**
 * The place the game is standing in.
 *
 * One page load is one place: a chapter change reloads the page, so this is
 * set once, before the world is built, and never changes under anyone.
 */
let active: Place | null = null;

export function setPlace(p: Place): void {
  active = p;
}

export function place(): Place {
  if (!active) throw new Error('no place set');
  return active;
}

/** Ground height at a point, from the active place. */
export function height(x: number, z: number): number {
  return place().height(x, z);
}

/** How far outside the soft border a point is, from the active place. */
export function border(x: number, z: number): number {
  return place().border(x, z);
}
