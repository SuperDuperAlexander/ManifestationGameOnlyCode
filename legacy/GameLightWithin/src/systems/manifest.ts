import { CALM, MANIFEST } from '../content/chapter1';
import type { EventBus } from '../core/events';
import { clamp, clamp01, dist2d } from '../core/math';

export type SeedKind = 'heart' | 'mind';

/** Decides the seed kind from the calm value at the moment of planting. */
export function seedKindFor(calmValue: number): SeedKind {
  return calmValue >= CALM.heartThreshold ? 'heart' : 'mind';
}

export type SeedState = 'none' | 'growing' | 'complete';

/**
 * The manifest mechanic. A seed grows only while the player is far away.
 * Coming back too early pauses growth and adds a little time.
 */
export class ManifestSystem {
  state: SeedState = 'none';
  kind: SeedKind = 'heart';
  /** Away time still needed, in seconds. */
  remaining: number = MANIFEST.growSeconds;
  /** Extra time added by coming back early. */
  penaltyAdded = 0;
  /** True while the player is inside the away radius. */
  paused = false;
  /** Seconds the bridge rise animation has run. */
  riseTime = 0;
  /** True once the player has been outside the away radius at least once. */
  hasBeenAway = false;

  private wasNear = true;

  constructor(
    private readonly bus: EventBus,
    readonly spot: { x: number; z: number },
  ) {}

  get progress(): number {
    if (this.state === 'complete') return 1;
    return clamp01(1 - this.remaining / (MANIFEST.growSeconds + this.penaltyAdded));
  }

  /**
   * Plants a seed. Costs light, so the caller must spend it first and pass the
   * result in. Returns false when the seed could not be planted.
   */
  plant(paid: boolean, calmValue: number): boolean {
    if (this.state !== 'none' || !paid) return false;
    this.state = 'growing';
    // Chapter 1 always creates a heart seed. The mind branch stays for chapter 2.
    this.kind = 'heart';
    void seedKindFor(calmValue);
    this.remaining = MANIFEST.growSeconds;
    this.penaltyAdded = 0;
    this.wasNear = true;
    this.bus.emit('seedPlanted', { kind: this.kind });
    this.bus.emit('cue', { id: 'seedGrow' });
    return true;
  }

  update(dt: number, px: number, pz: number): void {
    if (this.state === 'complete') {
      if (this.riseTime < MANIFEST.bridgeRiseSeconds) {
        this.riseTime += dt;
        if (this.riseTime >= MANIFEST.bridgeRiseSeconds) this.bus.emit('cue', { id: 'bridgeDone' });
      }
      return;
    }
    if (this.state !== 'growing') return;

    const near = dist2d(px, pz, this.spot.x, this.spot.z) <= MANIFEST.awayRadius;
    if (!near) this.hasBeenAway = true;

    // Coming back before growth is complete adds time, up to a limit.
    if (near && !this.wasNear) {
      const add = Math.min(
        MANIFEST.returnPenaltySeconds,
        MANIFEST.returnPenaltyMax - this.penaltyAdded,
      );
      if (add > 0) {
        this.penaltyAdded += add;
        this.remaining += add;
      }
    }
    this.wasNear = near;
    this.paused = near;

    if (!near) {
      const speed = this.kind === 'mind' ? MANIFEST.mindSeedSpeedFactor : 1;
      this.remaining = clamp(this.remaining - dt * speed, 0, Number.MAX_SAFE_INTEGER);
      if (this.remaining <= 0) this.complete();
    }
    this.bus.emit('seedGrowthChanged', { progress: this.progress, paused: this.paused });
  }

  private complete(): void {
    this.state = 'complete';
    this.paused = false;
    this.riseTime = 0;
    this.bus.emit('bridgeComplete');
  }
}
