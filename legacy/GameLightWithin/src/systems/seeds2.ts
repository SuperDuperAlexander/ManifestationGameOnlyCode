import { CALM } from '../content/chapter1';
import { LIGHT_WELL, SEEDS2 } from '../content/chapter2';
import type { EventBus } from '../core/events';
import { clamp, clamp01, dist2d } from '../core/math';
import type { SeedKind } from './manifest';
import { seedKindFor } from './manifest';

export type Seed2State = 'none' | 'growing' | 'grown' | 'faded';

/**
 * One seed spot in the chapter 2 meadows.
 *
 * The rules are chapter 1's, with the heart and mind branch switched on. A
 * mind seed grows in half the time and gives a bright tree that does not stay.
 * Nothing says which is better. The player sees the difference and draws
 * their own conclusion, which is the whole point of the scene.
 */
export class SeedSpot {
  state: Seed2State = 'none';
  kind: SeedKind = 'heart';
  /** Away time still needed, in seconds. */
  remaining: number = SEEDS2.growSeconds;
  penaltyAdded = 0;
  paused = false;
  /** Seconds since a mind tree finished growing. */
  fadeTime = 0;
  hasBeenAway = false;

  private wasNear = true;

  constructor(
    private readonly bus: EventBus,
    readonly id: 'A' | 'B',
    readonly x: number,
    readonly z: number,
    /** Spot A sits in the storm's leftover wind, which costs calm faster. */
    readonly calmDecayFactor = 1,
  ) {}

  get progress(): number {
    if (this.state !== 'growing') return this.state === 'none' ? 0 : 1;
    return clamp01(1 - this.remaining / (SEEDS2.growSeconds + this.penaltyAdded));
  }

  /** Plants a seed. The caller spends the light first and passes the result. */
  plant(paid: boolean, calmValue: number): boolean {
    if (this.state !== 'none' || !paid) return false;
    this.state = 'growing';
    this.kind = seedKindFor(calmValue);
    this.remaining = SEEDS2.growSeconds;
    this.penaltyAdded = 0;
    this.wasNear = true;
    this.fadeTime = 0;
    this.bus.emit('seedPlanted', { kind: this.kind });
    this.bus.emit('cue', { id: 'seedGrow' });
    return true;
  }

  update(dt: number, px: number, pz: number): void {
    if (this.state === 'grown' && this.kind === 'mind') {
      this.fadeTime += dt;
      if (this.fadeTime >= SEEDS2.mindSeedFadeSeconds) this.fade();
      return;
    }
    if (this.state !== 'growing') return;

    const near = dist2d(px, pz, this.x, this.z) <= SEEDS2.awayRadius;
    if (!near) this.hasBeenAway = true;

    if (near && !this.wasNear) {
      const add = Math.min(3, 9 - this.penaltyAdded);
      if (add > 0) {
        this.penaltyAdded += add;
        this.remaining += add;
      }
    }
    this.wasNear = near;
    this.paused = near;

    if (!near) {
      const speed = this.kind === 'mind' ? SEEDS2.mindSeedSpeedFactor : 1;
      this.remaining = clamp(this.remaining - dt * speed, 0, Number.MAX_SAFE_INTEGER);
      if (this.remaining <= 0) {
        this.state = 'grown';
        this.fadeTime = 0;
        this.paused = false;
      }
    }
    this.bus.emit('seedGrowthChanged', { progress: this.progress, paused: this.paused });
  }

  /** A mind tree goes. The light it held comes back to the player. */
  private fade(): void {
    this.state = 'faded';
    this.bus.emit('lightCollected', { from: 'spring', amount: SEEDS2.mindSeedReturn });
  }

  /** True when a heart tree stands here. Only these carry the chapter on. */
  get heartTreeStanding(): boolean {
    return this.state === 'grown' && this.kind === 'heart';
  }
}

/**
 * The light well.
 *
 * It gives one light for every calm breath taken beside it, and it never runs
 * out — but only while the player is short. A player who spends everything on
 * a seed that fades must be able to try again; a player who is already
 * carrying enough gets nothing, so the well can never become the whole game.
 */
export class LightWell {
  /** How much light it has given, for the debug panel. */
  given = 0;

  constructor(
    private readonly bus: EventBus,
    readonly x: number,
    readonly z: number,
  ) {}

  distanceTo(px: number, pz: number): number {
    return dist2d(px, pz, this.x, this.z);
  }

  /** True when standing here and breathing would give light. */
  wouldGive(px: number, pz: number, light: number): boolean {
    return this.distanceTo(px, pz) <= LIGHT_WELL.radius && light < LIGHT_WELL.maxLight;
  }

  /**
   * One finished breath.
   * @returns how much light it gave, which is zero most of the time
   */
  onBreath(calm: boolean, px: number, pz: number, light: number): number {
    if (!calm || !this.wouldGive(px, pz, light)) return 0;
    this.given += LIGHT_WELL.lightPerBreath;
    this.bus.emit('lightWellGave', { amount: LIGHT_WELL.lightPerBreath });
    this.bus.emit('cue', { id: 'spring' });
    return LIGHT_WELL.lightPerBreath;
  }
}

/** The calm threshold that decides a heart seed from a mind seed. */
export const HEART_THRESHOLD = CALM.heartThreshold;
