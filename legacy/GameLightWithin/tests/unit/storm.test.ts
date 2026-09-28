import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/events';
import { StormSystem } from '../../src/systems/storm';
import { LAYOUT2, STORM } from '../../src/content/chapter2';

function storm(): StormSystem {
  return new StormSystem(new EventBus(), LAYOUT2.storm);
}

/** Stands at the storm's centre for a while. */
function see(s: StormSystem): void {
  for (let t = 0; t < STORM.seeSeconds + 0.5; t += 0.1) {
    s.update(0.1, LAYOUT2.storm.x, LAYOUT2.storm.z);
  }
}

describe('the storm on the ridge', () => {
  it('shows its thought only while the player stays close', () => {
    const s = storm();
    s.update(1, LAYOUT2.storm.x, LAYOUT2.storm.z);
    expect(s.step).toBe(1);
    expect(s.seeProgress).toBeGreaterThan(0);
    see(s);
    expect(s.step).toBe(2);
  });

  it('cannot be named before it has been seen', () => {
    const s = storm();
    s.answer('anger');
    expect(s.step).toBe(0);
  });

  it('answers to its name and moves on to being felt', () => {
    const s = storm();
    see(s);
    expect(s.answer('anger')).toBe(true);
    expect(s.step).toBe(3);
  });

  it('never calls a name wrong, and stays where it was', () => {
    const s = storm();
    see(s);
    expect(s.answer('worry')).toBe(false);
    expect(s.step).toBe(2);
  });

  it('cannot be quietened before it has been felt', () => {
    const s = storm();
    see(s);
    s.answer('anger');
    s.tone();
    expect(s.tones).toBe(0);
  });

  it('opens after five tones', () => {
    const s = storm();
    see(s);
    s.answer('anger');
    for (let i = 0; i < STORM.feelBreaths; i++) {
      s.onBreath(true, LAYOUT2.storm.x, LAYOUT2.storm.z);
    }
    expect(s.step).toBe(4);
    for (let i = 0; i < STORM.tonesNeeded - 1; i++) s.tone();
    expect(s.open).toBe(false);
    s.tone();
    expect(s.open).toBe(true);
  });

  it('dissolves once the player has stood in the middle and breathed', () => {
    const s = storm();
    see(s);
    s.answer('anger');
    for (let i = 0; i < STORM.feelBreaths; i++) {
      s.onBreath(true, LAYOUT2.storm.x, LAYOUT2.storm.z);
    }
    for (let i = 0; i < STORM.tonesNeeded; i++) s.tone();
    for (let i = 0; i < STORM.centerBreaths; i++) {
      s.onBreath(true, LAYOUT2.storm.x, LAYOUT2.storm.z);
    }
    expect(s.done).toBe(true);
  });

  it('gives its light when it lets go', () => {
    const bus = new EventBus();
    const s = new StormSystem(bus, LAYOUT2.storm);
    let given = 0;
    bus.on('lightCollected', ({ amount }) => (given += amount));
    see(s);
    s.answer('anger');
    for (let i = 0; i < STORM.feelBreaths; i++) {
      s.onBreath(true, LAYOUT2.storm.x, LAYOUT2.storm.z);
    }
    for (let i = 0; i < STORM.tonesNeeded; i++) s.tone();
    for (let i = 0; i < STORM.centerBreaths; i++) {
      s.onBreath(true, LAYOUT2.storm.x, LAYOUT2.storm.z);
    }
    expect(given).toBe(STORM.lightReward);
  });

  it('grows a little when the player runs, up to a limit', () => {
    const s = storm();
    const base = s.radius;
    for (let i = 0; i < 8; i++) {
      s.update(0.1, LAYOUT2.storm.x, LAYOUT2.storm.z);
      s.update(0.1, LAYOUT2.storm.x, LAYOUT2.storm.z + 90);
    }
    expect(s.radius).toBeGreaterThan(base);
    expect(s.radius).toBeLessThanOrEqual(base * (1 + STORM.fleeGrowthMax) + 0.001);
  });

  it('allows a push, which costs one more breath and nothing else', () => {
    const s = storm();
    see(s);
    s.answer('anger');
    s.push();
    expect(s.pushCount).toBe(1);
    expect(s.pushExtra).toBe(STORM.pushExtraBreaths);
    for (let i = 0; i < STORM.feelBreaths; i++) {
      s.onBreath(true, LAYOUT2.storm.x, LAYOUT2.storm.z);
    }
    // The extra breath means it is not felt through yet.
    expect(s.step).toBe(3);
    s.onBreath(true, LAYOUT2.storm.x, LAYOUT2.storm.z);
    expect(s.step).toBe(4);
  });

  it('caps how many times a push helps', () => {
    const s = storm();
    see(s);
    s.answer('anger');
    for (let i = 0; i < 5; i++) s.push();
    expect(s.pushCount).toBe(STORM.pushExtraBreathsMax);
  });
});
