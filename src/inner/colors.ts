import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';

export type Rgb = [number, number, number];

export function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/**
 * Paints a mesh with a colour gradient from bottom to top (in its own space).
 * Alpha holds the wind sway: 0 at `swayFrom` and below, 1 at the top.
 */
export function paintGradient(mesh: Mesh, bottom: string, top: string, swayFrom = Infinity): Mesh {
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < pos.length; i += 3) {
    minY = Math.min(minY, pos[i]!);
    maxY = Math.max(maxY, pos[i]!);
  }
  const a = rgb(bottom);
  const b = rgb(top);
  const colors = new Float32Array((pos.length / 3) * 4);
  for (let v = 0; v < pos.length / 3; v++) {
    const y = pos[v * 3 + 1]!;
    const t = (y - minY) / Math.max(0.0001, maxY - minY);
    const c = mixRgb(a, b, t);
    const sway = y <= swayFrom ? 0 : Math.min(1, (y - swayFrom) / Math.max(0.0001, maxY - swayFrom));
    colors.set([c[0], c[1], c[2], sway], v * 4);
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  return mesh;
}

/** Paints a mesh in one colour, with a fixed wind sway value. */
export function paintFlat(mesh: Mesh, hex: string, sway = 0): Mesh {
  const c = rgb(hex);
  const count = mesh.getTotalVertices();
  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) colors.set([c[0], c[1], c[2], sway], i * 4);
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  return mesh;
}
