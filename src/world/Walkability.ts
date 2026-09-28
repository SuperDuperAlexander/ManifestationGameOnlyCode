/**
 * Where the player may stand.
 * Walkable = inside an area rectangle or on a path corridor,
 * and not inside a blocker (unless inside a passage), and not inside a round collider.
 * All of this is plain data from the chapter file, so it works for unloaded zones too.
 */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Segment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  halfWidth: number;
}

export interface Circle {
  x: number;
  z: number;
  r: number;
  /** Colliders can be switched off (a dissolved fog, for example). */
  active?: boolean;
}

export class Walkability {
  readonly areas: Rect[] = [];
  readonly corridors: Segment[] = [];
  readonly blockers: Segment[] = [];
  readonly blockerCircles: Circle[] = [];
  readonly passages: Circle[] = [];
  readonly colliders: Circle[] = [];

  /** True if a point (with a body radius) may stand here, ignoring round colliders. */
  isWalkable(x: number, z: number, radius: number): boolean {
    let inside = false;
    for (const a of this.areas) {
      if (x >= a.minX + radius && x <= a.maxX - radius && z >= a.minZ + radius && z <= a.maxZ - radius) {
        inside = true;
        break;
      }
    }
    if (!inside) {
      for (const c of this.corridors) {
        if (segDist(x, z, c) <= c.halfWidth - radius * 0.5) {
          inside = true;
          break;
        }
      }
    }
    if (!inside) return false;
    for (const p of this.passages) {
      if (Math.hypot(x - p.x, z - p.z) <= p.r) return true;
    }
    for (const b of this.blockers) {
      if (segDist(x, z, b) < b.halfWidth + radius) return false;
    }
    for (const c of this.blockerCircles) {
      if (Math.hypot(x - c.x, z - c.z) < c.r + radius) return false;
    }
    return true;
  }

  /**
   * Moves from (fx, fz) toward (tx, tz). Slides along walls and round colliders.
   * Returns the position the body ends at.
   */
  resolve(fx: number, fz: number, tx: number, tz: number, radius: number): [number, number] {
    let x = tx;
    let z = tz;
    // Push out of round colliders (two passes are enough for our sparse props).
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.colliders) {
        if (c.active === false) continue;
        const dx = x - c.x;
        const dz = z - c.z;
        const min = c.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 0.0001;
          x = c.x + (dx / d) * min;
          z = c.z + (dz / d) * min;
        }
      }
    }
    if (this.isWalkable(x, z, radius)) return [x, z];
    if (this.isWalkable(x, fz, radius)) return [x, fz];
    if (this.isWalkable(fx, z, radius)) return [fx, z];
    return [fx, fz];
  }
}

export function segDist(x: number, z: number, s: Segment): number {
  const vx = s.bx - s.ax;
  const vz = s.bz - s.az;
  const len2 = vx * vx + vz * vz;
  let t = len2 > 0 ? ((x - s.ax) * vx + (z - s.az) * vz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (s.ax + vx * t), z - (s.az + vz * t));
}
