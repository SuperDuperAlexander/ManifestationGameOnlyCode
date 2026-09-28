import { SOUND_BREATH } from '../content/chapter2';
import type { EventBus } from '../core/events';

/**
 * The sound breath.
 *
 * A breath out that is calm and long enough makes a tone. The tones climb a
 * pentatonic scale, so however many the player makes, the row is pleasant.
 * Nothing about this is a skill check: a breath that is short simply does not
 * sing, and the player hears the difference without being told.
 */
export class SoundBreathSystem {
  /** True once the singing stone has answered the player for the first time. */
  unlocked = false;
  /** How many tones the player has made in this chapter. */
  count = 0;
  /** Which note of the scale comes next. */
  private step = 0;

  constructor(private readonly bus: EventBus) {}

  /** The singing stone answers, and the sound breath is the player's from now on. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.bus.emit('cue', { id: 'soundBreath' });
  }

  /**
   * Offers a finished breath to the sound breath.
   *
   * @param calm whether the breath was in rhythm
   * @param exhale how long the out-breath lasted, in seconds
   * @param target the out-breath the rhythm asks for
   * @returns the note in hertz, or null when the breath did not sing
   */
  onBreath(calm: boolean, exhale: number, target: number): number | null {
    if (!this.unlocked || !calm) return null;
    if (exhale < target * SOUND_BREATH.minExhaleFactor) return null;
    const scale = SOUND_BREATH.scale;
    const semitones = scale[this.step % scale.length] ?? 0;
    const octave = Math.floor(this.step / scale.length);
    const hz = SOUND_BREATH.baseHz * Math.pow(2, semitones / 12 + octave);
    this.step++;
    this.count++;
    this.bus.emit('soundBreathTone', { hz, index: this.count });
    return hz;
  }

  reset(): void {
    this.count = 0;
    this.step = 0;
  }
}
