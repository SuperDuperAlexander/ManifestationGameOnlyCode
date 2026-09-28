import { TRANSFORM } from '../content/chapter1';
import type { EventBus } from '../core/events';
import { clamp, dist2d } from '../core/math';

/**
 * Fog steps.
 * 0 far away, 1 "see it", 2 "feel it", 3 "become one", 4 dissolved.
 */
export type FogStep = 0 | 1 | 2 | 3 | 4;

/**
 * The transform mechanic. One soft fog on a narrow path.
 *
 * The steps run in order and cannot be skipped. Running away grows the fog a
 * little and resets the current step. Push never works; it only makes the fog
 * denser and adds a calm breath to the last step.
 */
export class TransformSystem {
  step: FogStep = 0;
  /** How far the "see it" text has appeared, 0 to 1. */
  seeProgress = 0;
  /** Calm breaths counted inside the current step. */
  breathsInStep = 0;
  /** Extra size from running away, 0 to TRANSFORM.fleeGrowthMax. */
  growth = 0;
  /** Extra calm breaths the last step needs because of pushing. */
  pushExtra = 0;
  pushCount = 0;
  fleeCount = 0;
  /** Seconds the dissolve animation has run. */
  dissolveTime = 0;
  /** The fog drifts toward the player when they run away. */
  x: number;
  z: number;
  readonly baseRadius: number;

  private everEntered = false;

  constructor(
    private readonly bus: EventBus,
    origin: { x: number; z: number; radius: number },
  ) {
    this.x = origin.x;
    this.z = origin.z;
    this.baseRadius = origin.radius;
  }

  get radius(): number {
    return this.baseRadius * (1 + this.growth);
  }

  /** Calm breaths the final step needs, including any push penalty. */
  get centerBreathsNeeded(): number {
    return TRANSFORM.centerBreaths + this.pushExtra;
  }

  get done(): boolean {
    return this.step === 4;
  }

  /** The push button is offered once the player can see the fog. */
  get pushAvailable(): boolean {
    return this.step >= 1 && this.step < 4;
  }

  distanceTo(px: number, pz: number): number {
    return dist2d(px, pz, this.x, this.z);
  }

  /**
   * Push never works. It makes the fog denser and adds one calm breath to
   * step 3, up to a limit.
   */
  push(): void {
    if (!this.pushAvailable) return;
    this.pushCount++;
    this.pushExtra = clamp(
      this.pushExtra + TRANSFORM.pushExtraBreaths,
      0,
      TRANSFORM.pushExtraBreathsMax,
    );
    this.bus.emit('fogPushed', { count: this.pushCount, extraBreaths: this.pushExtra });
    this.bus.emit('cue', { id: 'push' });
  }

  /** Called once per finished breath while the player is near the fog. */
  onBreath(calm: boolean, px: number, pz: number): void {
    if (!calm || this.done) return;
    const d = this.distanceTo(px, pz);
    if (this.step === 2 && d <= TRANSFORM.feelRadius) {
      this.breathsInStep++;
      if (this.breathsInStep >= TRANSFORM.feelBreaths) this.enterStep(3);
    } else if (this.step === 3 && d <= TRANSFORM.centerRadius + this.radius * 0.2) {
      this.breathsInStep++;
      if (this.breathsInStep >= this.centerBreathsNeeded) this.dissolve();
    }
  }

  update(dt: number, px: number, pz: number): void {
    if (this.step === 4) {
      if (this.dissolveTime < TRANSFORM.dissolveSeconds) this.dissolveTime += dt;
      return;
    }
    const d = this.distanceTo(px, pz);
    const seeRadius = TRANSFORM.seeRadius * (1 + this.growth);

    if (this.step === 0) {
      if (d <= seeRadius) {
        this.everEntered = true;
        this.enterStep(1);
      }
      return;
    }

    // Running away before step 3 ends: the fog grows and drifts closer.
    if (d > seeRadius && this.everEntered) {
      this.flee(px, pz);
      return;
    }

    if (this.step === 1) {
      // The text must be fully shown. It cannot be skipped.
      this.seeProgress = clamp(this.seeProgress + dt / TRANSFORM.seeSeconds, 0, 1);
      if (this.seeProgress >= 1) this.enterStep(2);
      return;
    }
    if (this.step === 2) {
      // Waiting for two calm breaths inside the feel radius.
      return;
    }
    if (this.step === 3 && d > TRANSFORM.centerRadius + this.radius * 0.2) {
      // The player stepped back out of the centre. Breaths there do not count,
      // but the step is kept because they are still inside the see radius.
      return;
    }
  }

  private flee(px: number, pz: number): void {
    this.fleeCount++;
    this.growth = clamp(this.growth + TRANSFORM.fleeGrowth, 0, TRANSFORM.fleeGrowthMax);
    const d = dist2d(px, pz, this.x, this.z) || 1;
    this.x += ((px - this.x) / d) * TRANSFORM.fleeDriftMetres;
    this.z += ((pz - this.z) / d) * TRANSFORM.fleeDriftMetres;
    this.seeProgress = 0;
    this.breathsInStep = 0;
    this.step = 0;
    this.bus.emit('fogFled', { count: this.fleeCount, growth: this.growth });
    this.bus.emit('fogStepChanged', { step: 0 });
  }

  private enterStep(step: FogStep): void {
    if (step === this.step) return;
    // Steps run in order. Nothing may jump ahead.
    if (step > this.step + 1) return;
    this.step = step;
    this.breathsInStep = 0;
    this.bus.emit('fogStepChanged', { step });
    if (step === 3) this.bus.emit('cue', { id: 'fogEnter' });
  }

  private dissolve(): void {
    this.step = 4;
    this.dissolveTime = 0;
    this.bus.emit('fogStepChanged', { step: 4 });
    this.bus.emit('fogDissolved');
    this.bus.emit('cue', { id: 'fogExit' });
    this.bus.emit('lightCollected', { from: 'fog', amount: TRANSFORM.lightReward });
    this.bus.emit('zoneAdded', { x: this.x, z: this.z, radius: TRANSFORM.zoneRadius });
  }
}
