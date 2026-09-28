import { STORM, WEATHER } from '../content/chapter2';
import type { EventBus } from '../core/events';
import { clamp01, dist2d } from '../core/math';
import { FeelingWeather } from './weather';

/**
 * Step 0 not yet met, 1 seen, 2 named, 3 felt, 4 quietened, 5 become one.
 * The steps cannot be skipped: each one only opens once the one before it is
 * finished, so the player cannot walk into the middle of a storm they have
 * not yet looked at.
 */
export type StormStep = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * The storm on the ridge.
 *
 * It does not follow the player: anger sits where it is and waits. Everything
 * else about it works like the chapter 1 fog, including what running away and
 * pushing cost, so a player who learned that chapter already knows this one.
 */
export class StormSystem {
  readonly weather: FeelingWeather;
  step: StormStep = 0;
  /** How much of the thought has been shown, 0 to 1. */
  seeProgress = 0;
  /** Calm breaths taken inside the feel radius. */
  feelBreaths = 0;
  /** Sound breath tones that have reached it. */
  tones = 0;
  /** Calm breaths taken in the quiet middle. */
  centerBreaths = 0;
  /** How many times the player has pushed. */
  pushCount = 0;
  /** Extra breaths a push has added. */
  pushExtra = 0;
  /** Seconds the storm has been dissolving. */
  dissolveTime = 0;
  done = false;

  constructor(
    private readonly bus: EventBus,
    spot: { x: number; z: number; radius: number },
  ) {
    this.weather = new FeelingWeather({
      type: 'anger',
      x: spot.x,
      z: spot.z,
      intensity: STORM.startIntensity,
      size: spot.radius,
      followsPlayer: false,
    });
  }

  get x(): number {
    return this.weather.x;
  }

  get z(): number {
    return this.weather.z;
  }

  /** The storm grows a little each time the player runs from it. */
  get radius(): number {
    return this.weather.size * (1 + Math.min(STORM.fleeGrowthMax, this.growth));
  }

  private growth = 0;

  distanceTo(px: number, pz: number): number {
    return dist2d(px, pz, this.weather.x, this.weather.z);
  }

  get pushAvailable(): boolean {
    return !this.done && this.step >= 2 && this.pushCount < STORM.pushExtraBreathsMax;
  }

  /**
   * Pushing against the storm.
   *
   * It is allowed, it does nothing bad, and it costs one more breath. Being
   * able to try the thing that does not work is part of learning the thing
   * that does.
   */
  push(): void {
    if (!this.pushAvailable) return;
    this.pushCount++;
    this.pushExtra = Math.min(
      STORM.pushExtraBreathsMax * STORM.pushExtraBreaths,
      this.pushExtra + STORM.pushExtraBreaths,
    );
    this.bus.emit('fogPushed', { count: this.pushCount, extraBreaths: this.pushExtra });
  }

  private wasInside = false;

  update(dt: number, px: number, pz: number): void {
    if (this.done) {
      if (this.dissolveTime < STORM.dissolveSeconds) this.dissolveTime += dt;
      return;
    }
    const d = this.distanceTo(px, pz);

    // Step 1: the thought shows itself while the player stays close.
    if (this.step === 0 && d <= STORM.seeRadius) this.setStep(1);
    if (this.step === 1) {
      if (d <= STORM.seeRadius) {
        this.seeProgress = clamp01(this.seeProgress + dt / STORM.seeSeconds);
        if (this.seeProgress >= 1) this.setStep(2);
      } else {
        // Leaving does not undo what was shown; it only stops it growing.
        this.seeProgress = Math.max(0, this.seeProgress - dt * 0.2);
      }
    }

    // Running out of reach makes it a little bigger, up to a limit.
    const inside = d <= this.radius;
    if (this.wasInside && !inside && this.step >= 1) {
      this.growth = Math.min(STORM.fleeGrowthMax, this.growth + STORM.fleeGrowth);
      this.bus.emit('fogFled', { count: this.fleeCount + 1, growth: this.growth });
      this.fleeCount++;
    }
    this.wasInside = inside;
  }

  fleeCount = 0;

  /** One finished breath, wherever the player is standing. */
  onBreath(calm: boolean, px: number, pz: number): void {
    if (!calm || this.done) return;
    const d = this.distanceTo(px, pz);

    if (this.step === 3 && d <= STORM.feelRadius) {
      this.feelBreaths++;
      if (this.feelBreaths >= STORM.feelBreaths + this.pushExtra) this.setStep(4);
      return;
    }
    if (this.step === 5 && d <= STORM.centerRadius) {
      this.centerBreaths++;
      if (this.centerBreaths >= STORM.centerBreaths) this.finish();
    }
  }

  /** The player's answer to the naming panel. */
  answer(choice: 'sadness' | 'anger' | 'worry'): boolean {
    const right = this.weather.answer(choice);
    this.bus.emit('weatherNamed', { type: 'anger', correct: right });
    if (right && this.step === 2) this.setStep(3);
    return right;
  }

  /** A sound breath tone reaching the storm. */
  tone(): void {
    if (this.done || this.step < 4) return;
    this.weather.tone();
    this.tones++;
    this.bus.emit('weatherIntensity', { type: 'anger', value: this.weather.intensity });
    if (this.tones >= STORM.tonesNeeded) this.setStep(5);
  }

  /** True once the storm has opened and the middle can be walked into. */
  get open(): boolean {
    return this.step >= 5;
  }

  private setStep(step: StormStep): void {
    if (step <= this.step) return;
    this.step = step;
    this.bus.emit('stormStepChanged', { step });
  }

  private finish(): void {
    this.done = true;
    this.dissolveTime = 0;
    this.weather.setIntensity(WEATHER.minIntensity);
    this.weather.dissolve();
    this.bus.emit('weatherDissolved', { type: 'anger' });
    this.bus.emit('lightCollected', { from: 'fog', amount: STORM.lightReward });
    this.bus.emit('zoneAdded', {
      x: this.weather.x,
      z: this.weather.z,
      radius: STORM.zoneRadius,
    });
  }
}
