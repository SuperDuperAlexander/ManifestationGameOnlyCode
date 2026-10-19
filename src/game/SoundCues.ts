import { audio } from '../core/Audio';
import { TUNING } from '../config/tuning';
import type { Anger } from './Anger';

/**
 * Story and anger cues. All sound is made by src/core/Audio.ts (soft synth, no files).
 * Audio starts after the first tap or key (browser rule), handled in Audio.ts.
 */
export class SoundCues {
  private lastCueAt = -Infinity;

  constructor(anger: Anger) {
    anger.on((e) => {
      if (e === 'pushed') this.pushBurst();
      else if (e === 'passed') this.pass();
    });
  }

  private ready(): boolean {
    const t = performance.now() / 1000;
    if (t - this.lastCueAt < TUNING.sound.minGapS) return false;
    this.lastCueAt = t;
    return true;
  }

  /** Push: a soft, low thump. */
  pushBurst(): void {
    if (this.ready()) audio.push();
  }

  /** Breathe choice: a warm chime. */
  pass(): void {
    if (this.ready()) audio.breatheChoice();
  }

  /** Imp raging: no growl any more, the town stays calm to the ear. */
  impGrowl(): void {}

  /** Imp is calm: warm chord. */
  calmChime(): void {
    audio.impCalm();
  }

  /** Lantern relit: gentle bell chord. */
  lanternRelight(): void {
    audio.lanternBells();
  }
}
