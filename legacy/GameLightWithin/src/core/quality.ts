import { QUALITY, TIERS, TIER_ORDER } from '../content/chapter1';
import type { QualityTier } from '../content/chapter1';

export type { QualityTier };

export interface QualitySettings {
  tier: QualityTier;
  pixelRatio: number;
  readonly paintScale: number;
  readonly grassCards: number;
  readonly grassFade: number;
  readonly shadowMap: number;
  readonly particles: number;
  readonly skyStrokes: number;
  readonly treeBlobs: number;
  readonly bloom: boolean;
}

export function isTouchDevice(): boolean {
  return (
    typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
  );
}

export function pixelRatioCap(): number {
  const cap = isTouchDevice() ? QUALITY.mobilePixelRatioCap : QUALITY.desktopPixelRatioCap;
  return Math.min(globalThis.devicePixelRatio ?? 1, cap);
}

export function settingsFor(tier: QualityTier): QualitySettings {
  return { tier, pixelRatio: pixelRatioCap(), ...TIERS[tier] };
}

/** The next tier down, or null when already at the cheapest one. */
export function tierBelow(tier: QualityTier): QualityTier | null {
  const i = TIER_ORDER.indexOf(tier);
  return i > 0 ? (TIER_ORDER[i - 1] ?? null) : null;
}

/** The frames per second below which a device is judged too slow. */
export function floorFps(touch = isTouchDevice()): number {
  return touch ? QUALITY.mobileFloorFps : QUALITY.desktopFloorFps;
}

/** Picks a tier from an average frame time in milliseconds. */
export function tierForFrameTime(avgMs: number): QualityTier {
  if (avgMs > QUALITY.lowThresholdMs) return 'low';
  if (avgMs > QUALITY.mediumThresholdMs) return 'medium';
  return 'high';
}

/**
 * Measures frame times for a short moment at start and picks a tier from them.
 * Touch devices never start above medium, so the first seconds stay smooth.
 */
export class QualityProbe {
  private samples: number[] = [];
  private elapsed = 0;
  private done = false;

  get finished(): boolean {
    return this.done;
  }

  /** Returns the chosen tier once the probe is finished, otherwise null. */
  sample(dtSeconds: number): QualityTier | null {
    if (this.done) return null;
    this.elapsed += dtSeconds;
    // Skip the first frames: they include compiling and uploading.
    if (this.elapsed > 0.35) this.samples.push(dtSeconds * 1000);
    if (this.elapsed < QUALITY.probeSeconds) return null;
    this.done = true;
    if (this.samples.length === 0) return 'medium';
    const sorted = [...this.samples].sort((a, b) => a - b);
    // The median ignores a single slow frame.
    const median = sorted[Math.floor(sorted.length / 2)] ?? 16;
    let tier = tierForFrameTime(median);
    if (isTouchDevice() && tier === 'high') tier = 'medium';
    return tier;
  }
}

/**
 * Watches the real frame rate during play and steps the tier down when the
 * device cannot keep up.
 *
 * The start probe only measures the first second, before the player has walked
 * anywhere, so a device can still turn out slower than it looked. The watchdog
 * only ever steps **down**, so it can never oscillate: once it reaches the
 * cheapest tier it stops. The player can still pick any tier by hand.
 */
export class QualityWatchdog {
  private window = 0;
  private frames = 0;
  private cooldown = 0;
  /** How many times the watchdog has stepped the tier down. */
  steps = 0;

  constructor(private readonly floor: number = floorFps()) {}

  /** Call once per rendered frame. Returns the tier to drop to, or null. */
  sample(realSeconds: number, tier: QualityTier): QualityTier | null {
    if (this.cooldown > 0) {
      this.cooldown -= realSeconds;
      if (this.cooldown > 0) return null;
      this.reset();
    }
    this.window += realSeconds;
    this.frames++;
    if (this.window < QUALITY.watchdogWindowSeconds) return null;

    const fps = this.frames / this.window;
    this.reset();
    if (fps >= this.floor) return null;

    const next = tierBelow(tier);
    if (next === null) return null;
    this.steps++;
    this.cooldown = QUALITY.watchdogCooldownSeconds;
    return next;
  }

  /** Starts a fresh measuring window. Used after a manual tier change. */
  restart(): void {
    this.reset();
    this.cooldown = QUALITY.watchdogCooldownSeconds;
  }

  private reset(): void {
    this.window = 0;
    this.frames = 0;
  }
}

/**
 * A rolling frames-per-second counter for the debug panel and the report.
 * It must be fed real elapsed seconds, never a clamped simulation step, or it
 * reports the clamp instead of the frame rate.
 */
export class FpsMeter {
  private frames = 0;
  private acc = 0;
  value = 0;
  /** The slowest frame seen since the last reset, in milliseconds. */
  worstMs = 0;

  update(realSeconds: number): void {
    this.frames++;
    this.acc += realSeconds;
    this.worstMs = Math.max(this.worstMs, realSeconds * 1000);
    if (this.acc >= 0.5) {
      this.value = Math.round(this.frames / this.acc);
      this.frames = 0;
      this.acc = 0;
    }
  }

  reset(): void {
    this.frames = 0;
    this.acc = 0;
    this.worstMs = 0;
  }
}
