import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

/**
 * Flat ground pieces. All are simple meshes with world-space UVs, so textures tile
 * seamlessly across pieces. The bend toward the horizon happens in the shader,
 * so large pieces are subdivided enough to bend smoothly.
 */

/** A flat rectangle on the ground, subdivided every `cell` metres. */
export function createGroundRect(
  name: string,
  scene: Scene,
  cx: number,
  cz: number,
  width: number,
  depth: number,
  y = 0,
  cell = 2,
): Mesh {
  const nx = Math.max(1, Math.ceil(width / cell));
  const nz = Math.max(1, Math.ceil(depth / cell));
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      const v = j / nz;
      positions.push(cx - width / 2 + u * width, y, cz - depth / 2 + v * depth);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return build(name, scene, positions, uvs, indices);
}

/**
 * A ribbon along a polyline (paths, rivers). uv.x runs across (0..1), uv.y along, in metres.
 * Returns the mesh and its total length (for soft ends).
 */
export function createRibbon(
  name: string,
  scene: Scene,
  points: [number, number][],
  width: number,
  y = 0.02,
  step = 1.5,
): { mesh: Mesh; length: number } {
  const pts = resample(points, step);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let along = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const prev = pts[Math.max(0, i - 1)]!;
    const next = pts[Math.min(pts.length - 1, i + 1)]!;
    let dx = next[0] - prev[0];
    let dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    // Left normal.
    const nx = -dz;
    const nz = dx;
    if (i > 0) along += Math.hypot(p[0] - pts[i - 1]![0], p[1] - pts[i - 1]![1]);
    positions.push(p[0] + nx * (width / 2), y, p[1] + nz * (width / 2));
    positions.push(p[0] - nx * (width / 2), y, p[1] - nz * (width / 2));
    uvs.push(0, along, 1, along);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  return { mesh: build(name, scene, positions, uvs, indices), length: along };
}

/** A flat disc (plazas, clearings). uv runs 0..1 across its bounding square. */
export function createDisc(
  name: string,
  scene: Scene,
  cx: number,
  cz: number,
  radiusX: number,
  radiusZ: number,
  y = 0.015,
  rings = 6,
  segments = 36,
): Mesh {
  const positions: number[] = [cx, y, cz];
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];
  for (let r = 1; r <= rings; r++) {
    const t = r / rings;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      positions.push(cx + Math.cos(a) * radiusX * t, y, cz + Math.sin(a) * radiusZ * t);
      uvs.push(0.5 + Math.cos(a) * 0.5 * t, 0.5 + Math.sin(a) * 0.5 * t);
    }
  }
  for (let s = 0; s < segments; s++) {
    const s2 = (s + 1) % segments;
    indices.push(0, 1 + s2, 1 + s);
  }
  for (let r = 1; r < rings; r++) {
    const base = 1 + (r - 1) * segments;
    const outer = 1 + r * segments;
    for (let s = 0; s < segments; s++) {
      const s2 = (s + 1) % segments;
      indices.push(base + s, base + s2, outer + s, base + s2, outer + s2, outer + s);
    }
  }
  return build(name, scene, positions, uvs, indices);
}

/** A vertical wall along a line, from `top` down to `bottom` (cliff faces, waterfalls). */
export function createWall(
  name: string,
  scene: Scene,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  top: number,
  bottom: number,
  cell = 2,
): Mesh {
  const len = Math.hypot(bx - ax, bz - az);
  const nx = Math.max(1, Math.ceil(len / cell));
  const ny = Math.max(1, Math.ceil((top - bottom) / cell));
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      const v = j / ny;
      positions.push(ax + (bx - ax) * u, top - (top - bottom) * v, az + (bz - az) * u);
      uvs.push((u * len) / (top - bottom), 1 - v);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  return build(name, scene, positions, uvs, indices);
}

function build(name: string, scene: Scene, positions: number[], uvs: number[], indices: number[]): Mesh {
  const mesh = new Mesh(name, scene);
  const vd = new VertexData();
  vd.positions = positions;
  vd.uvs = uvs;
  vd.indices = indices;
  vd.applyToMesh(mesh);
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  return mesh;
}

/**
 * Lets the camera skip a static mesh when it is off screen, even though the shader bends it down:
 * its bounding box is stretched down far enough to hold the bent shape.
 */
export function curveSafeBounds(mesh: Mesh, drop = 40): void {
  mesh.refreshBoundingInfo();
  const bi = mesh.getBoundingInfo();
  const min = bi.minimum.clone();
  const max = bi.maximum.clone();
  bi.reConstruct(new Vector3(min.x, min.y - drop, min.z), new Vector3(max.x, max.y + 1, max.z), mesh.getWorldMatrix());
  mesh.alwaysSelectAsActiveMesh = false;
  mesh.doNotSyncBoundingInfo = true;
}

/** Points along a polyline, about `step` metres apart, following Catmull-Rom curves. */
export function resample(points: [number, number][], step: number): [number, number][] {
  if (points.length < 2) return points.slice();
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(1, Math.ceil(segLen / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push(catmull(p0, p1, p2, p3, t));
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

function catmull(p0: number[], p1: number[], p2: number[], p3: number[], t: number): [number, number] {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number): number =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0]!, p1[0]!, p2[0]!, p3[0]!), f(p0[1]!, p1[1]!, p2[1]!, p3[1]!)];
}
