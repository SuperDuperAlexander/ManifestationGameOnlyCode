import { describe, it, expect, beforeEach } from 'vitest';
import { BreathSystem } from '../../src/systems/breath';
import { EventBus } from '../../src/core/events';
import { RHYTHM_PRESETS } from '../../src/content/chapter1';

/**
 * The tests read the target durations from the presets rather than naming
 * them, so retuning the rhythm changes the game and not the test.
 */
const NORMAL = RHYTHM_PRESETS.normal;
/** A duration just inside the tolerance band, as a share of the target. */
const INSIDE = 1;
/** Just inside the low and high edges of the band. */
const lowEdge = (target: number, tol: number): number => target * (1 - tol) + 0.05;
const highEdge = (target: number, tol: number): number => target * (1 + tol) - 0.05;

/** Runs `seconds` of simulation with the two breath keys in a fixed state. */
function run(b: BreathSystem, seconds: number, inHeld: boolean, outHeld: boolean, speed = 0): void {
  const step = 1 / 60;
  for (let t = 0; t < seconds - 1e-9; t += step) {
    b.update(Math.min(step, seconds - t), inHeld, outHeld, speed);
  }
}

/**
 * Takes one whole breath: hold the breathe-in key, then the breathe-out key,
 * then let go. Returns the completion payload.
 */
function takeBreath(
  b: BreathSystem,
  bus: EventBus,
  inhale: number,
  exhale: number,
  speed = 0,
): { calm: boolean; inhale: number; exhale: number } | null {
  let result: { calm: boolean; inhale: number; exhale: number } | null = null;
  const off = bus.on('breathCompleted', (p) => {
    result = { calm: p.calm, inhale: p.inhale, exhale: p.exhale };
  });
  run(b, inhale, true, false, speed);
  run(b, exhale, false, true, speed);
  // Letting the breathe-out key go ends the breath.
  b.update(1 / 60, false, false, speed);
  off();
  return result;
}

describe('BreathSystem', () => {
  let bus: EventBus;
  let breath: BreathSystem;

  beforeEach(() => {
    bus = new EventBus();
    breath = new BreathSystem(bus);
  });

  it('counts a breath inside the tolerance as calm', () => {
    const r = takeBreath(breath, bus, NORMAL.inhale * INSIDE, NORMAL.exhale * INSIDE);
    expect(r).not.toBeNull();
    expect(r?.calm).toBe(true);
  });

  it('measures each half of the breath from its own key', () => {
    const r = takeBreath(breath, bus, NORMAL.inhale, NORMAL.exhale);
    expect(r?.inhale).toBeCloseTo(NORMAL.inhale, 1);
    expect(r?.exhale).toBeCloseTo(NORMAL.exhale, 1);
  });

  it('counts an in-breath outside the tolerance as not calm', () => {
    const tooShort = NORMAL.inhale * (1 - NORMAL.tolerance) - 0.5;
    expect(takeBreath(breath, bus, tooShort, NORMAL.exhale)?.calm).toBe(false);
  });

  it('counts an out-breath that is too long as not calm', () => {
    const tooLong = NORMAL.exhale * (1 + NORMAL.tolerance) + 0.5;
    expect(takeBreath(breath, bus, NORMAL.inhale, tooLong)?.calm).toBe(false);
  });

  it('accepts the edges of the tolerance band', () => {
    const t = NORMAL.tolerance;
    expect(
      takeBreath(breath, bus, lowEdge(NORMAL.inhale, t), lowEdge(NORMAL.exhale, t))?.calm,
    ).toBe(true);
    breath.reset();
    expect(
      takeBreath(breath, bus, highEdge(NORMAL.inhale, t), highEdge(NORMAL.exhale, t))?.calm,
    ).toBe(true);
  });

  it('emits breathStarted when the breathe-in key goes down', () => {
    let started = 0;
    bus.on('breathStarted', () => started++);
    run(breath, 0.5, true, false);
    expect(started).toBe(1);
  });

  it('does not end the breath when the breathe-in key is let go', () => {
    let completed = 0;
    bus.on('breathCompleted', () => completed++);
    run(breath, NORMAL.inhale, true, false);
    run(breath, 1, false, false);
    expect(completed).toBe(0);
    expect(breath.phase).toBe('inhale');
  });

  it('starts the out-breath only when the second key goes down', () => {
    run(breath, NORMAL.inhale, true, false);
    expect(breath.phase).toBe('inhale');
    run(breath, 0.2, false, true);
    expect(breath.phase).toBe('exhale');
  });

  it('gives up on a breath held in far too long', () => {
    run(breath, NORMAL.inhale, true, false);
    run(breath, NORMAL.inhale * 3, false, false);
    expect(breath.phase).toBe('idle');
  });

  it('resets the breath in progress when the player walks', () => {
    let completed = 0;
    bus.on('breathCompleted', () => completed++);
    run(breath, 2, true, false, 0);
    expect(breath.phase).toBe('inhale');
    run(breath, 0.2, true, false, 3);
    expect(breath.phase).toBe('idle');
    run(breath, NORMAL.exhale, false, true, 3);
    expect(completed).toBe(0);
  });

  it('does not start a breath while walking', () => {
    let started = 0;
    bus.on('breathStarted', () => started++);
    run(breath, 2, true, false, 3);
    expect(started).toBe(0);
    expect(breath.phase).toBe('idle');
  });

  it('ignores a tap that is too short to be a breath', () => {
    let completed = 0;
    bus.on('breathCompleted', () => completed++);
    run(breath, 0.1, true, false);
    run(breath, NORMAL.exhale, false, true);
    expect(completed).toBe(0);
  });

  it('uses its own values for each preset', () => {
    for (const preset of Object.values(RHYTHM_PRESETS)) {
      breath.setPreset(preset.id);
      expect(breath.getPreset()).toEqual(preset);
      // Its own target is calm.
      expect(takeBreath(breath, bus, preset.inhale, preset.exhale)?.calm).toBe(true);
      breath.reset();
      // A breath well outside its own band is not.
      const off = preset.exhale * (1 + preset.tolerance) + 1;
      expect(takeBreath(breath, bus, preset.inhale, off)?.calm).toBe(false);
      breath.reset();
    }
    // The easy preset really is the forgiving one.
    expect(RHYTHM_PRESETS.easy.tolerance).toBeGreaterThan(RHYTHM_PRESETS.normal.tolerance);
  });

  it('keeps the target ring moving between 0 and 1', () => {
    for (let i = 0; i < 600; i++) {
      breath.update(1 / 60, false, false, 0);
      expect(breath.targetRing).toBeGreaterThanOrEqual(-1e-6);
      expect(breath.targetRing).toBeLessThanOrEqual(1 + 1e-6);
    }
  });

  it('takes one breath after another', () => {
    let calm = 0;
    bus.on('breathCompleted', (p) => {
      if (p.calm) calm++;
    });
    for (let i = 0; i < 3; i++) takeBreath(breath, bus, NORMAL.inhale, NORMAL.exhale);
    expect(calm).toBe(3);
  });
});
