import { BREATH, RHYTHM_PRESETS } from '../content/chapter1';
import type { RhythmPreset } from '../content/chapter1';
import type { EventBus } from '../core/events';
import { clamp01 } from '../core/math';

export type BreathPhase = 'idle' | 'inhale' | 'exhale';

/**
 * The breath system. One breath is one in-breath and one out-breath, and each
 * has its own key: hold one to breathe in, hold the other to breathe out.
 *
 * Two keys rather than hold-and-release, because a release is not an action.
 * Letting go of a key is what you do when you stop paying attention, and the
 * out-breath is the half of the breath this chapter is about.
 *
 * A breath counts as calm when both halves are inside the preset tolerance.
 * Breathing only counts while the player stands still; walking resets the
 * breath in progress. Nothing bad happens when it resets.
 */
export class BreathSystem {
  phase: BreathPhase = 'idle';
  /** Seconds the current phase has run. */
  phaseTime = 0;
  /** Seconds the finished in-breath lasted, while the out-breath runs. */
  private inhaleTime = 0;
  /** Seconds waited between the in-breath ending and the out-breath starting. */
  private holdTime = 0;
  private preset: RhythmPreset = RHYTHM_PRESETS.normal;
  /** 0..1 target size of the breath circle, following the preset rhythm. */
  targetRing = 0;
  /** 0..1 size the player is actually holding. */
  playerRing = 0;
  private targetClock = 0;
  private inDown = false;
  private outDown = false;

  constructor(private readonly bus: EventBus) {}

  setPreset(id: RhythmPreset['id']): void {
    this.preset = RHYTHM_PRESETS[id];
    this.reset();
  }

  getPreset(): RhythmPreset {
    return this.preset;
  }

  /** True when a duration is inside the tolerance band around the target. */
  inTolerance(actual: number, target: number): boolean {
    const slack = target * this.preset.tolerance;
    return actual >= target - slack && actual <= target + slack;
  }

  reset(): void {
    this.phase = 'idle';
    this.phaseTime = 0;
    this.inhaleTime = 0;
    this.holdTime = 0;
    this.playerRing = 0;
    this.inDown = false;
    this.outDown = false;
  }

  /**
   * @param dt seconds since the last frame
   * @param inHeld whether the breathe-in key is held
   * @param outHeld whether the breathe-out key is held
   * @param speed the player's current ground speed in metres per second
   */
  update(dt: number, inHeld: boolean, outHeld: boolean, speed: number): void {
    this.advanceTargetRing(dt);

    if (speed > BREATH.walkResetSpeed) {
      // Walking resets the breath in progress. No penalty beyond that.
      if (this.phase !== 'idle') this.reset();
      this.inDown = inHeld;
      this.outDown = outHeld;
      return;
    }

    const inPressed = inHeld && !this.inDown;
    const outPressed = outHeld && !this.outDown;
    const outReleased = !outHeld && this.outDown;
    this.inDown = inHeld;
    this.outDown = outHeld;

    if (this.phase === 'idle') {
      if (inPressed) this.startInhale();
      else this.playerRing = Math.max(0, this.playerRing - dt * 0.8);
      return;
    }

    if (this.phase === 'inhale') {
      // The in-breath runs until the out-breath starts. Letting go of the key
      // only stops the circle growing; it does not end the breath.
      if (inHeld) this.phaseTime += dt;
      else this.holdTime += dt;
      this.playerRing = clamp01(this.phaseTime / this.preset.inhale);

      if (outPressed) {
        if (this.phaseTime < BREATH.minBreathSeconds) {
          // Too short to be a breath. Treat it as a mis-tap.
          this.reset();
          return;
        }
        this.inhaleTime = this.phaseTime;
        this.phase = 'exhale';
        this.phaseTime = 0;
        return;
      }
      // Waiting far too long with the breath held in ends it quietly.
      if (this.holdTime > this.preset.inhale * BREATH.holdGraceFactor) this.reset();
      return;
    }

    // Exhale: it lasts exactly as long as the breathe-out key is held.
    this.phaseTime += dt;
    this.playerRing = clamp01(1 - this.phaseTime / this.preset.exhale);
    if (outReleased) {
      this.complete(this.phaseTime);
      this.reset();
      return;
    }
    // An out-breath twice as long as the target is clearly over.
    if (this.phaseTime >= this.preset.exhale * 2) {
      this.complete(this.phaseTime);
      this.reset();
    }
  }

  private startInhale(): void {
    this.phase = 'inhale';
    this.phaseTime = 0;
    this.holdTime = 0;
    this.bus.emit('breathStarted');
  }

  private complete(exhale: number): void {
    const calm =
      this.inTolerance(this.inhaleTime, this.preset.inhale) &&
      this.inTolerance(exhale, this.preset.exhale);
    this.bus.emit('breathCompleted', { calm, inhale: this.inhaleTime, exhale });
  }

  /** The demonstration rhythm the circle shows, independent of the player. */
  private advanceTargetRing(dt: number): void {
    const cycle = this.preset.inhale + this.preset.exhale;
    this.targetClock = (this.targetClock + dt) % cycle;
    this.targetRing =
      this.targetClock < this.preset.inhale
        ? this.targetClock / this.preset.inhale
        : 1 - (this.targetClock - this.preset.inhale) / this.preset.exhale;
  }

  /** Where the target rhythm currently is. The UI uses it for the label. */
  targetPhase(): 'inhale' | 'exhale' {
    return this.targetClock < this.preset.inhale ? 'inhale' : 'exhale';
  }

  /** What the player should do next. The UI uses it for the label. */
  playerPhase(): 'inhale' | 'exhale' {
    return this.phase === 'exhale' ? 'exhale' : 'inhale';
  }
}
