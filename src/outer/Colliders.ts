import { Walkability, type Circle, type Rect } from '../world/Walkability';

/**
 * Town colliders: walkable rectangles (the town is closed by them) plus
 * circle and box obstacles. The player slides along both.
 * Extends Walkability so PlayerController can use it unchanged.
 */
export class TownColliders extends Walkability {
  readonly boxes: Rect[] = [];

  addArea(r: Rect): void {
    this.areas.push(r);
  }

  addCircle(x: number, z: number, r: number): void {
    const c: Circle = { x, z, r };
    this.colliders.push(c);
  }

  addBox(cx: number, cz: number, w: number, d: number): void {
    this.boxes.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }

  override isWalkable(x: number, z: number, radius: number): boolean {
    let inside = false;
    for (const a of this.areas) {
      if (x >= a.minX + radius && x <= a.maxX - radius && z >= a.minZ + radius && z <= a.maxZ - radius) {
        inside = true;
        break;
      }
    }
    return inside;
  }

  /** Push a point out of circles and boxes. */
  private pushOut(x: number, z: number, radius: number): [number, number] {
    for (let pass = 0; pass < 3; pass++) {
      for (const c of this.colliders) {
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
      for (const b of this.boxes) {
        const nx = Math.max(b.minX, Math.min(x, b.maxX));
        const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
        const dx = x - nx;
        const dz = z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * radius;
          z = nz + (dz / d) * radius;
        } else {
          // Centre is inside the box: leave by the nearest side.
          const l = x - b.minX;
          const r = b.maxX - x;
          const s = z - b.minZ;
          const n = b.maxZ - z;
          const m = Math.min(l, r, s, n);
          if (m === l) x = b.minX - radius;
          else if (m === r) x = b.maxX + radius;
          else if (m === s) z = b.minZ - radius;
          else z = b.maxZ + radius;
        }
      }
    }
    return [x, z];
  }

  override resolve(fx: number, fz: number, tx: number, tz: number, radius: number): [number, number] {
    const [px, pz] = this.pushOut(tx, tz, radius);
    if (this.isWalkable(px, pz, radius)) return [px, pz];
    // Slide along the town boundary: try each axis alone.
    const [ax, az] = this.pushOut(px, fz, radius);
    if (this.isWalkable(ax, az, radius)) return [ax, az];
    const [bx, bz] = this.pushOut(fx, pz, radius);
    if (this.isWalkable(bx, bz, radius)) return [bx, bz];
    return [fx, fz];
  }
}
