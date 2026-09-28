import { TUNING } from '../config/tuning';
import { clamp01 } from '../core/Random';

export type BreathState = 'idle' | 'inhale' | 'exhale';

export interface BreathInput {
  /** Space held (desktop) or breath button held (touch). */
  inhale: boolean;
  /** Shift held (desktop). */
  exhale: boolean;
  /**
   * Touch mode: letting go of the button starts the exhale by itself,
   * and it runs until the breath is empty or the button is pressed again.
   */
  releaseExhales: boolean;
}

/** One finished exhale. Fog listens for these. */
export interface ExhaleEvent {
  /** Light given this frame, before distance falloff. */
  light: number;
}

/**
 * The breath. Hold to breathe in (the light grows), then breathe out (the light flows out).
 * A calm rhythm of about 4 s in and 4 s out gives more light. A poor rhythm is never punished;
 * it only gives a little less.
 */
export class BreathSystem {
  state: BreathState = 'idle';
  /** 0..1, how full the breath is. */
  breathLevel = 0;
  /** 0..1, how close the last breath came to the target rhythm. */
  rhythmScore = 0.5;
  /** Seconds in the current state. */
  stateTime = 0;
  /** Time of the rhythm guide, 0..1 over one full target breath (in + out). */
  guidePhase = 0;
  /** Light given out during this frame (0 when not exhaling). */
  lightThisFrame = 0;
  /** Total number of finished breaths. */
  breaths = 0;
  /** Seconds of the last inhale, for scoring the full breath at the end of the exhale. */
  private lastInhale = 0;
  private autoExhale = false;
  /** True once the current exhale has been counted (so it is not counted twice). */
  private exhaleCounted = false;
  private readonly listeners: ((e: { rhythm: number; level: number }) => void)[] = [];

  /** Called when an exhale ends (a whole breath finished). */
  onBreathDone(cb: (e: { rhythm: number; level: number }) => void): void {
    this.listeners.push(cb);
  }

  get lightRadius(): number {
    const b = TUNING.breath;
    return b.lightRadiusBase + b.lightRadiusGain * this.breathLevel;
  }

  /** Rhythm guide value 0..1: rises for 4 s, falls for 4 s. */
  get guideLevel(): number {
    const b = TUNING.breath;
    const total = b.inhaleTarget + b.exhaleTarget;
    const t = this.guidePhase * total;
    const raw = t < b.inhaleTarget ? t / b.inhaleTarget : 1 - (t - b.inhaleTarget) / b.exhaleTarget;
    // Ease in and out, like a real breath.
    return 0.5 - 0.5 * Math.cos(raw * Math.PI);
  }

  update(dt: number, input: BreathInput): void {
    const b = TUNING.breath;
    this.lightThisFrame = 0;
    this.stateTime += dt;

    let want: BreathState = 'idle';
    if (input.inhale) {
      want = 'inhale';
      this.autoExhale = false;
    } else if (input.exhale) {
      want = 'exhale';
    } else if (input.releaseExhales && (this.state === 'inhale' || this.autoExhale) && this.breathLevel > 0.02) {
      want = 'exhale';
      this.autoExhale = true;
    }
    if (this.autoExhale && this.breathLevel <= 0.001) this.autoExhale = false;

    if (want !== this.state) this.enter(want);

    switch (this.state) {
      case 'inhale': {
        this.breathLevel = clamp01(this.breathLevel + b.inhaleRate * dt);
        break;
      }
      case 'exhale': {
        const before = this.breathLevel;
        this.breathLevel = clamp01(this.breathLevel - b.exhaleRate * dt);
        const spent = before - this.breathLevel;
        // Rhythm while exhaling: how close the inhale was to the target so far.
        const rhythm = this.scorePhase(this.lastInhale, b.inhaleTarget);
        this.lightThisFrame = spent * (b.lightBase + b.rhythmBonus * rhythm);
        if (this.breathLevel <= 0 && before > 0 && !this.exhaleCounted) {
          this.exhaleCounted = true;
          this.finishBreath();
        }
        break;
      }
      case 'idle': {
        // A held breath slowly settles when nothing is pressed.
        this.breathLevel = Math.max(0, this.breathLevel - b.idleDecay * dt * 0.5);
        break;
      }
    }
    // The guide runs on its own clock: 4 s up, 4 s down. It restarts with each inhale.
    this.guidePhase = (this.guidePhase + dt / (b.inhaleTarget + b.exhaleTarget)) % 1;
  }

  private enter(next: BreathState): void {
    if (this.state === 'inhale') this.lastInhale = this.stateTime;
    if (this.state === 'exhale' && !this.exhaleCounted && this.stateTime >= TUNING.breath.minScoredPhase) {
      this.finishBreath();
    }
    if (next === 'inhale' && this.state !== 'inhale') this.guidePhase = this.breathLevel * 0.5;
    if (next === 'exhale') this.exhaleCounted = false;
    this.state = next;
    this.stateTime = 0;
  }

  private finishBreath(): void {
    const b = TUNING.breath;
    const exhale = this.stateTime;
    const rIn = this.scorePhase(this.lastInhale, b.inhaleTarget);
    const rOut = this.scorePhase(exhale, b.exhaleTarget);
    const score = (rIn + rOut) / 2;
    // Smooth, so one uneven breath does not swing the score.
    this.rhythmScore = this.rhythmScore * 0.4 + score * 0.6;
    this.breaths++;
    for (const cb of this.listeners) cb({ rhythm: score, level: this.breathLevel });
    this.lastInhale = 0;
  }

  /** 1 = exactly on target, falls off smoothly; phases that are too short score low. */
  private scorePhase(actual: number, target: number): number {
    if (actual < TUNING.breath.minScoredPhase) return 0.2;
    return clamp01(1 - Math.abs(actual - target) / target);
  }
}
