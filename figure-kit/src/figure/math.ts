export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Frame-rate independent smoothing factor. */
export function damp(sharpness: number, dt: number): number {
  return 1 - Math.exp(-sharpness * dt);
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
