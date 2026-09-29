/** Bounds for the small valley. More chapters do not raise these per-scene budgets. */
export const POLISH = {
  camera: { distance: 11, portraitDistance: 12, pitch: 0.28, lookHeight: 1.8 },
  detail: { cellSize: 32, desktopRange: 76, mobileRange: 56, checkInterval: 0.35 },
  light: { motes: 90, mobileMotes: 42, rays: 5, mobileRays: 3, releaseSeconds: 4.5 },
  saveInterval: 3,
} as const;
