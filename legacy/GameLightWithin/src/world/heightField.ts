import type { SurfaceSampler } from './place';

/**
 * The ground the terrain mesh was built from, read back exactly.
 *
 * The mesh is a grid of quads, each split into two triangles the same way
 * every time. Asking this where the ground is gives the height of the very
 * triangle that is drawn, at a fixed cost and with nothing to keep in step.
 * A quad that was left out of the mesh — the gap in the valley floor — has
 * no ground here either, so the player cannot walk over the hole.
 */
export class HeightField {
  constructor(
    private readonly minX: number,
    private readonly minZ: number,
    private readonly stepX: number,
    private readonly stepZ: number,
    private readonly segX: number,
    private readonly segZ: number,
    private readonly heights: Float32Array,
    /** One flag per quad: false where the mesh has a hole. */
    private readonly solid: Uint8Array,
  ) {}

  /** Height at a point, or null where the ground runs out. */
  at(x: number, z: number): number | null {
    const gx = (x - this.minX) / this.stepX;
    const gz = (z - this.minZ) / this.stepZ;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    if (ix < 0 || iz < 0 || ix >= this.segX || iz >= this.segZ) return null;
    if (this.solid[iz * this.segX + ix] === 0) return null;

    const u = gx - ix;
    const v = gz - iz;
    const cols = this.segX + 1;
    const a = this.heights[iz * cols + ix] ?? 0;
    const b = this.heights[iz * cols + ix + 1] ?? 0;
    const c = this.heights[(iz + 1) * cols + ix] ?? 0;
    const d = this.heights[(iz + 1) * cols + ix + 1] ?? 0;
    // The same two triangles the mesh is made of: (a, c, b) and (b, c, d).
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }

  /** The sampler the ground checks use. */
  sampler(): SurfaceSampler {
    return (x, z) => this.at(x, z);
  }
}
