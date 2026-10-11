import { TUNING } from '../config/tuning';
import { Sound } from '../core/Sound';
import type { Anger } from './Anger';

/**
 * Soft synth cues for the key moments (no audio files, nothing scary).
 * Audio starts only after the first key press or tap (browser rule).
 * Values: TUNING.sound. Every method fails silently.
 */
export class SoundCues {
  private readonly sound = new Sound();
  private lastCueAt = -Infinity;
  private lastGrowlAt = -Infinity;

  constructor(anger: Anger) {
    const unlock = (): void => {
      this.sound.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    anger.on((e) => {
      if (e === 'pushed') this.pushBurst();
      else if (e === 'passed') this.pass();
    });
  }

  /** Wall-clock seconds, used for rate limits only. */
  private now(): number {
    return performance.now() / 1000;
  }

  /** A wave gets a gentle whoosh. */
  waveWhoosh(): void {
    this.sound.sweep(900, 260, 0, 1.4, TUNING.sound.whooshGain);
  }

  /** Push: a soft, low thud. Rate-limited. */
  pushBurst(): void {
    const t = this.now();
    if (t - this.lastCueAt < TUNING.sound.minGapS) return;
    this.lastCueAt = t;
    this.sound.tone(110, 0, 0.8, TUNING.sound.pushGain, 'triangle');
    this.sound.tone(82.4, 0.04, 1.0, TUNING.sound.pushGain * 0.6, 'sine');
  }

  /** A wave passes: a soft falling tone. Rate-limited. */
  pass(): void {
    const t = this.now();
    if (t - this.lastCueAt < TUNING.sound.minGapS) return;
    this.lastCueAt = t;
    this.sound.tone(523.25, 0, 1.2, TUNING.sound.passGain);
    this.sound.tone(392, 0.12, 1.4, TUNING.sound.passGain * 0.8);
  }

  /** Imp starts raging: low, short, soft growl. At most once per growlGapS. */
  impGrowl(): void {
    const t = this.now();
    if (t - this.lastGrowlAt < TUNING.sound.growlGapS) return;
    this.lastGrowlAt = t;
    this.sound.tone(65.4, 0, 0.9, TUNING.sound.growlGain, 'sine');
    this.sound.sweep(160, 90, 0, 0.9, TUNING.sound.growlGain * 0.5);
  }

  /** Imp is calm: a soft two-note chime. */
  calmChime(): void {
    this.sound.tone(1318.5, 0, 1.6, TUNING.sound.chimeGain);
    this.sound.tone(1975.5, 0.12, 1.4, TUNING.sound.chimeGain * 0.7);
  }

  /** Lantern relit: a warm, rising chord. */
  lanternRelight(): void {
    [523.25, 659.25, 783.99].forEach((f, i) =>
      this.sound.tone(f, i * 0.14, 2.2 - i * 0.2, TUNING.sound.relightGain),
    );
  }
}
