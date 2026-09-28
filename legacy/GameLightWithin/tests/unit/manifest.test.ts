import { describe, it, expect, beforeEach } from 'vitest';
import { ManifestSystem, seedKindFor } from '../../src/systems/manifest';
import { EventBus } from '../../src/core/events';
import { MANIFEST, CALM } from '../../src/content/chapter1';

const SPOT = { x: 0, z: 0 };
const NEAR = { x: 0, z: 5 };
const FAR = { x: 0, z: 40 };

/** Runs the seed for `seconds` with the player at a fixed spot. */
function run(seed: ManifestSystem, seconds: number, at: { x: number; z: number }): void {
  const step = 0.1;
  for (let t = 0; t < seconds - 1e-9; t += step) seed.update(step, at.x, at.z);
}

describe('ManifestSystem', () => {
  let bus: EventBus;
  let seed: ManifestSystem;

  beforeEach(() => {
    bus = new EventBus();
    seed = new ManifestSystem(bus, SPOT);
  });

  it('does nothing when the light was not paid', () => {
    expect(seed.plant(false, 1)).toBe(false);
    expect(seed.state).toBe('none');
  });

  it('plants once and not twice', () => {
    expect(seed.plant(true, 1)).toBe(true);
    expect(seed.state).toBe('growing');
    expect(seed.plant(true, 1)).toBe(false);
  });

  it('does not grow while the player is within 15 m', () => {
    seed.plant(true, 1);
    run(seed, 60, NEAR);
    expect(seed.state).toBe('growing');
    expect(seed.paused).toBe(true);
    expect(seed.remaining).toBeCloseTo(MANIFEST.growSeconds, 3);
  });

  it('completes after 25 s of away time', () => {
    seed.plant(true, 1);
    run(seed, MANIFEST.growSeconds - 1, FAR);
    expect(seed.state).toBe('growing');
    run(seed, 1.2, FAR);
    expect(seed.state).toBe('complete');
    expect(seed.progress).toBe(1);
  });

  it('adds 3 s each time the player comes back early', () => {
    seed.plant(true, 1);
    run(seed, 5, FAR);
    const before = seed.remaining;
    run(seed, 1, NEAR);
    expect(seed.remaining).toBeCloseTo(before + MANIFEST.returnPenaltySeconds, 3);
  });

  it('caps the return penalty at plus 9 s', () => {
    seed.plant(true, 1);
    for (let i = 0; i < 8; i++) {
      run(seed, 1, FAR);
      run(seed, 1, NEAR);
    }
    expect(seed.penaltyAdded).toBeCloseTo(MANIFEST.returnPenaltyMax, 3);
    expect(seed.penaltyAdded).toBeCloseTo(9, 3);
  });

  it('still finishes after the full away time plus the penalty', () => {
    seed.plant(true, 1);
    run(seed, 2, FAR);
    run(seed, 1, NEAR);
    expect(seed.state).toBe('growing');
    run(seed, MANIFEST.growSeconds + MANIFEST.returnPenaltySeconds, FAR);
    expect(seed.state).toBe('complete');
  });

  it('emits bridgeComplete exactly once', () => {
    let done = 0;
    bus.on('bridgeComplete', () => done++);
    seed.plant(true, 1);
    run(seed, MANIFEST.growSeconds + 10, FAR);
    expect(done).toBe(1);
  });

  it('runs the bridge rise over 3 s after completion', () => {
    seed.plant(true, 1);
    run(seed, MANIFEST.growSeconds + 0.5, FAR);
    expect(seed.riseTime).toBeLessThan(MANIFEST.bridgeRiseSeconds);
    run(seed, MANIFEST.bridgeRiseSeconds + 0.5, FAR);
    expect(seed.riseTime).toBeGreaterThanOrEqual(MANIFEST.bridgeRiseSeconds);
  });

  it('uses 0.6 calm as the heart or mind threshold', () => {
    expect(CALM.heartThreshold).toBe(0.6);
    expect(seedKindFor(0.6)).toBe('heart');
    expect(seedKindFor(0.75)).toBe('heart');
    expect(seedKindFor(0.59)).toBe('mind');
    expect(seedKindFor(0)).toBe('mind');
  });

  it('always creates a heart seed in chapter 1', () => {
    seed.plant(true, 0.1);
    expect(seed.kind).toBe('heart');
  });

  it('records that the player went away', () => {
    seed.plant(true, 1);
    run(seed, 2, NEAR);
    expect(seed.hasBeenAway).toBe(false);
    run(seed, 2, FAR);
    expect(seed.hasBeenAway).toBe(true);
  });
});
