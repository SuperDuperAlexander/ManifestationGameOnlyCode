import { PLAYER } from '../content/chapter1';
import { height } from './place';
import type { SurfaceSampler } from './place';

/**
 * Ground and collision checks.
 *
 * Every surface the player can stand on answers one question: how high is
 * the ground here, and is there any. The terrain answers from the heightfield
 * it was built from; the bridge answers from its own arch. They are asked in
 * order, so the ground wins wherever there is ground and the bridge only
 * carries the player over the hole where there is none.
 */
export class Ground {
  private readonly surfaces: SurfaceSampler[] = [];
  /** Obstacles the player cannot walk through, as circles on the floor. */
  private readonly blockers: { x: number; z: number; radius: number }[] = [];

  constructor(surfaces: SurfaceSampler[] = []) {
    this.surfaces.push(...surfaces);
  }

  addSurface(surface: SurfaceSampler): void {
    if (!this.surfaces.includes(surface)) this.surfaces.push(surface);
  }

  removeSurface(surface: SurfaceSampler): void {
    const i = this.surfaces.indexOf(surface);
    if (i >= 0) this.surfaces.splice(i, 1);
  }

  addBlocker(x: number, z: number, radius: number): void {
    this.blockers.push({ x, z, radius });
  }

  clearBlockers(): void {
    this.blockers.length = 0;
  }

  /** Ground height at a point, or null when there is no ground, such as the gap. */
  heightAt(x: number, z: number): number | null {
    for (const surface of this.surfaces) {
      const y = surface(x, z);
      if (y !== null) return y;
    }
    return null;
  }

  /** Surface steepness at a point, as the cosine between the normal and up. */
  slopeCosAt(x: number, z: number): number {
    const h = height(x, z);
    const dx = height(x + 0.6, z) - h;
    const dz = height(x, z + 0.6) - h;
    return 1 / Math.sqrt(1 + (dx / 0.6) ** 2 + (dz / 0.6) ** 2);
  }

  /** True when the player may stand at this point. */
  canStand(x: number, z: number): boolean {
    if (this.heightAt(x, z) === null) return false;
    if (this.slopeCosAt(x, z) < PLAYER.maxSlopeCos) return false;
    for (const b of this.blockers) {
      if (Math.hypot(x - b.x, z - b.z) < b.radius + PLAYER.radius) return false;
    }
    return true;
  }

  /**
   * Moves from a point by a step, sliding along whatever blocks the way instead
   * of stopping dead. Returns the point the player ends up at.
   */
  resolveMove(fromX: number, fromZ: number, dx: number, dz: number): { x: number; z: number } {
    if (this.canStand(fromX + dx, fromZ + dz)) return { x: fromX + dx, z: fromZ + dz };
    if (this.canStand(fromX + dx, fromZ)) return { x: fromX + dx, z: fromZ };
    if (this.canStand(fromX, fromZ + dz)) return { x: fromX, z: fromZ + dz };
    return { x: fromX, z: fromZ };
  }
}
