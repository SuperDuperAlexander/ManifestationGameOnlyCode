import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/events';
import { SoundBreathSystem } from '../../src/systems/soundBreath';
import { RHYTHM_PRESETS } from '../../src/content/chapter1';
import { SOUND_BREATH } from '../../src/content/chapter2';

const TARGET = RHYTHM_PRESETS.normal.exhale;

function ready(): SoundBreathSystem {
  const s = new SoundBreathSystem(new EventBus());
  s.unlock();
  return s;
}

describe('sound breath', () => {
  it('stays silent until the singing stone has answered', () => {
    const s = new SoundBreathSystem(new EventBus());
    expect(s.onBreath(true, TARGET, TARGET)).toBeNull();
    s.unlock();
    expect(s.onBreath(true, TARGET, TARGET)).not.toBeNull();
  });

  it('sings for a calm breath that is long enough', () => {
    const s = ready();
    expect(s.onBreath(true, TARGET, TARGET)).toBeCloseTo(SOUND_BREATH.baseHz, 3);
  });

  it('stays silent for a breath that is not calm', () => {
    expect(ready().onBreath(false, TARGET * 2, TARGET)).toBeNull();
  });

  it('stays silent for an out-breath that is too short', () => {
    expect(ready().onBreath(true, TARGET * 0.6, TARGET)).toBeNull();
  });

  /** Nobody lets go of a key on the exact frame. A near miss still sings. */
  it('forgives a breath that misses the target by a hair', () => {
    expect(ready().onBreath(true, TARGET * SOUND_BREATH.minExhaleFactor, TARGET)).not.toBeNull();
  });

  /** Each tone is the next note of the scale, so a row of them is a tune. */
  it('climbs the pentatonic scale', () => {
    const s = ready();
    const notes: number[] = [];
    for (let i = 0; i < SOUND_BREATH.scale.length; i++) {
      const hz = s.onBreath(true, TARGET, TARGET);
      if (hz !== null) notes.push(hz);
    }
    expect(notes).toHaveLength(SOUND_BREATH.scale.length);
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i]).toBeGreaterThan(notes[i - 1] as number);
    }
  });

  it('carries on into the next octave', () => {
    const s = ready();
    for (let i = 0; i < SOUND_BREATH.scale.length; i++) s.onBreath(true, TARGET, TARGET);
    const next = s.onBreath(true, TARGET, TARGET);
    expect(next).toBeCloseTo(SOUND_BREATH.baseHz * 2, 3);
  });

  it('counts the tones the player has made', () => {
    const s = ready();
    s.onBreath(true, TARGET, TARGET);
    s.onBreath(true, TARGET * 0.3, TARGET);
    s.onBreath(true, TARGET, TARGET);
    expect(s.count).toBe(2);
  });

  it('reads the target from the rhythm preset, not a written-out number', () => {
    const slow = RHYTHM_PRESETS.slow.exhale;
    const s = ready();
    // The same breath sings on the normal rhythm and not on the slow one.
    expect(s.onBreath(true, TARGET, TARGET)).not.toBeNull();
    expect(s.onBreath(true, TARGET, slow)).toBeNull();
  });
});
