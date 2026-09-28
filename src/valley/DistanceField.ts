/**
 * Distance to a line of points, stored on a grid once and then read back fast.
 * Used for the path and the river: the terrain asks "how far to the river?" many
 * thousand times while it is built.
 */
export class DistanceField {
  private readonly data: Float32Array;
  private readonly nx: number;
  private readonly nz: number;

  constructor(
    points: readonly (readonly [number, number])[],
    private readonly minX: number,
    private readonly minZ: number,
    maxX: number,
    maxZ: number,
    private readonly cell: number,
    /** Farther than this counts as "far" (the value is capped here). */
    private readonly reach: number,
  ) {
    this.nx = Math.ceil((maxX - minX) / cell) + 1;
    this.nz = Math.ceil((maxZ - minZ) / cell) + 1;
    this.data = new Float32Array(this.nx * this.nz).fill(reach);
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i]!;
      const [bx, bz] = points[i + 1]!;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach - minX) / cell));
      const i1 = Math.min(this.nx - 1, Math.ceil((Math.max(ax, bx) + reach - minX) / cell));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) - reach - minZ) / cell));
      const j1 = Math.min(this.nz - 1, Math.ceil((Math.max(az, bz) + reach - minZ) / cell));
      const vx = bx - ax;
      const vz = bz - az;
      const len2 = vx * vx + vz * vz || 1;
      for (let j = j0; j <= j1; j++) {
        const z = minZ + j * cell;
        for (let k = i0; k <= i1; k++) {
          const x = minX + k * cell;
          const t = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / len2));
          const d = Math.hypot(x - ax - vx * t, z - az - vz * t);
          const o = j * this.nx + k;
          if (d < this.data[o]!) this.data[o] = d;
        }
      }
    }
  }

  /** Distance at a point (smoothly blended between grid cells). */
  at(x: number, z: number): number {
    const gx = (x - this.minX) / this.cell;
    const gz = (z - this.minZ) / this.cell;
    if (gx < 0 || gz < 0 || gx >= this.nx - 1 || gz >= this.nz - 1) return this.reach;
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    const fx = gx - i;
    const fz = gz - j;
    const o = j * this.nx + i;
    const a = this.data[o]!;
    const b = this.data[o + 1]!;
    const c = this.data[o + this.nx]!;
    const d = this.data[o + this.nx + 1]!;
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
  }
}

/** A smooth curve through the points (Catmull-Rom), as a denser line of points. */
export function smoothLine(points: readonly (readonly [number, number])[], perSegment = 8): [number, number][] {
  const out: [number, number][] = [];
  const p = (i: number): readonly [number, number] => points[Math.max(0, Math.min(points.length - 1, i))]!;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push([...points[points.length - 1]!] as [number, number]);
  return out;
}
