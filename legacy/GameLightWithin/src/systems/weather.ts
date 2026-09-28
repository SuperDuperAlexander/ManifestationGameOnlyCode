import { NAMING, WEATHER } from '../content/chapter2';
import type { FeelingType } from '../content/chapter2';

import { clamp, dist2d } from '../core/math';

export interface WeatherOptions {
  type: FeelingType;
  x: number;
  z: number;
  intensity?: number;
  size?: number;
  followsPlayer?: boolean;
}

/**
 * A feeling shown as weather.
 *
 * It is never an enemy and never punished. It has a place, a strength, and a
 * habit of following the player when they walk away, because that is what a
 * feeling does. Nothing here knows how it is drawn.
 */
export class FeelingWeather {
  readonly type: FeelingType;
  x: number;
  z: number;
  intensity: number;
  size: number;
  followsPlayer: boolean;
  /** True once the player has given it its right name. */
  named = false;
  /** Every name the player has tried, in order. */
  readonly attempts: FeelingType[] = [];
  /** True while it is dissolving. */
  dissolving = false;
  dissolveTime = 0;
  /** How many times the player walked out of its reach. */
  fleeCount = 0;
  /** Seconds left before the naming panel may open again. */
  lockSeconds = 0;
  /** Seconds the player has stood still close by. */
  stillSeconds = 0;

  private wasNear = true;

  constructor(options: WeatherOptions) {
    this.type = options.type;
    this.x = options.x;
    this.z = options.z;
    this.intensity = options.intensity ?? 1;
    this.size = options.size ?? 1;
    this.followsPlayer = options.followsPlayer ?? false;
  }

  /** True once it is spent and has finished dissolving. */
  get gone(): boolean {
    return this.dissolving && this.dissolveTime >= WEATHER.dissolveSeconds;
  }

  distanceTo(px: number, pz: number): number {
    return dist2d(px, pz, this.x, this.z);
  }

  /**
   * One step of the world.
   *
   * @param speed the player's ground speed, so standing still can be seen
   * @param walkSpeed the player's full walking speed, which sets the chase
   */
  update(dt: number, px: number, pz: number, speed: number, walkSpeed: number): void {
    if (this.dissolving) {
      this.dissolveTime += dt;
      return;
    }
    if (this.lockSeconds > 0) this.lockSeconds = Math.max(0, this.lockSeconds - dt);

    const d = this.distanceTo(px, pz);

    // Walking away from a weather that follows is recorded, once per leaving.
    const near = d <= NAMING.radius;
    if (this.wasNear && !near && this.followsPlayer) this.fleeCount++;
    this.wasNear = near;

    // Standing still near it is what opens the naming panel.
    if (near && speed <= NAMING.stillSpeed) this.stillSeconds += dt;
    else if (!near || speed > NAMING.stillSpeed) this.stillSeconds = 0;

    if (this.followsPlayer) this.follow(dt, px, pz, walkSpeed);
  }

  /**
   * The chase. It never quite catches up and never falls behind: at nine
   * tenths of a walk the player can put distance between them, slowly, which
   * is exactly what running from a feeling feels like.
   */
  private follow(dt: number, px: number, pz: number, walkSpeed: number): void {
    const dx = px - this.x;
    const dz = pz - this.z;
    const d = Math.hypot(dx, dz);
    if (d <= WEATHER.followRadius) return;
    const step = Math.min(d - WEATHER.followRadius, walkSpeed * WEATHER.followSpeedFactor * dt);
    this.x += (dx / d) * step;
    this.z += (dz / d) * step;
  }

  /** True when the player may be asked to name this weather. */
  canName(breathsDone: number): boolean {
    return (
      !this.named &&
      !this.dissolving &&
      this.lockSeconds <= 0 &&
      this.stillSeconds >= NAMING.stillSeconds &&
      breathsDone >= NAMING.breathsNeeded
    );
  }

  /**
   * The player's answer.
   *
   * A name that fits softens the weather. A name that does not is never called
   * wrong: the weather simply shows itself more clearly and waits.
   */
  answer(choice: FeelingType): boolean {
    this.attempts.push(choice);
    this.stillSeconds = 0;
    if (choice === this.type) {
      this.named = true;
      this.setIntensity(this.intensity * (1 - WEATHER.namedDrop));
      return true;
    }
    this.lockSeconds = NAMING.lockSeconds;
    this.setIntensity(this.intensity + WEATHER.wrongGrowth);
    this.size += WEATHER.wrongGrowth;
    return false;
  }

  /**
   * A sound breath tone.
   *
   * Anger and worry answer to sound. Sadness does not: it is not a thing to be
   * quietened, only felt through, so a tone leaves it exactly as it was.
   */
  tone(): boolean {
    if (this.type === 'sadness' || this.dissolving) return false;
    this.setIntensity(this.intensity * (1 - WEATHER.toneDrop));
    return true;
  }

  setIntensity(value: number): void {
    this.intensity = clamp(value, WEATHER.minIntensity, WEATHER.maxIntensity);
  }

  /** Starts the weather letting go. */
  dissolve(): void {
    if (this.dissolving) return;
    this.dissolving = true;
    this.dissolveTime = 0;
  }
}

/** The three answers, in a different order every time the panel opens. */
export function shuffledFeelings(rng: () => number): FeelingType[] {
  const out: FeelingType[] = ['sadness', 'anger', 'worry'];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a && b) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

/**
 * Counts what the player tried, for the learning checks. It records every
 * attempt, not only the ones that fit.
 */
export function countAttempts(weather: FeelingWeather): number {
  return weather.attempts.length;
}

/** A weather that is done with the player, ready to dissolve. */
export function isSpent(weather: FeelingWeather): boolean {
  return weather.intensity <= WEATHER.spentIntensity;
}
