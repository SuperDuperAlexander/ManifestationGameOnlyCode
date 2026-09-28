import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/events';
import { LightWell, SeedSpot } from '../../src/systems/seeds2';
import { seedKindFor } from '../../src/systems/manifest';
import { CALM } from '../../src/content/chapter1';
import { LIGHT_WELL, SEEDS2 } from '../../src/content/chapter2';

const FAR = SEEDS2.awayRadius + 5;

function spot(bus = new EventBus()): SeedSpot {
  return new SeedSpot(bus, 'B', 0, 0);
}

/** Runs the clock with the player standing away from the seed. */
function away(s: SeedSpot, seconds: number): void {
  for (let t = 0; t < seconds; t += 0.25) s.update(0.25, 0, FAR);
}

describe('heart and mind seeds', () => {
  it('reads the kind from the calm value at the moment of planting', () => {
    expect(seedKindFor(CALM.heartThreshold)).toBe('heart');
    expect(seedKindFor(CALM.heartThreshold - 0.01)).toBe('mind');
  });

  it('plants a mind seed when calm is low', () => {
    const s = spot();
    s.plant(true, 0.2);
    expect(s.kind).toBe('mind');
  });

  it('plants a heart seed when calm is high', () => {
    const s = spot();
    s.plant(true, 0.9);
    expect(s.kind).toBe('heart');
  });

  it('will not plant without light', () => {
    const s = spot();
    expect(s.plant(false, 0.9)).toBe(false);
    expect(s.state).toBe('none');
  });

  it('grows a mind tree in half the away time', () => {
    const s = spot();
    s.plant(true, 0.2);
    away(s, SEEDS2.growSeconds / SEEDS2.mindSeedSpeedFactor + 0.5);
    expect(s.state).toBe('grown');
  });

  it('a heart tree takes the full away time', () => {
    const s = spot();
    s.plant(true, 0.9);
    away(s, SEEDS2.growSeconds / SEEDS2.mindSeedSpeedFactor + 0.5);
    expect(s.state).toBe('growing');
    away(s, SEEDS2.growSeconds);
    expect(s.state).toBe('grown');
  });

  it('a mind tree fades and gives its light back', () => {
    const bus = new EventBus();
    let returned = 0;
    bus.on('lightCollected', ({ amount }) => (returned += amount));
    const s = spot(bus);
    s.plant(true, 0.2);
    away(s, SEEDS2.growSeconds);
    expect(s.state).toBe('grown');
    away(s, SEEDS2.mindSeedFadeSeconds + 1);
    expect(s.state).toBe('faded');
    expect(returned).toBe(SEEDS2.mindSeedReturn);
  });

  it('a heart tree stays', () => {
    const s = spot();
    s.plant(true, 0.9);
    away(s, SEEDS2.growSeconds + 1);
    away(s, SEEDS2.mindSeedFadeSeconds + 10);
    expect(s.state).toBe('grown');
    expect(s.heartTreeStanding).toBe(true);
  });

  it('pauses while the player stands over it, and adds a little time', () => {
    const s = spot();
    s.plant(true, 0.9);
    away(s, 5);
    const left = s.remaining;
    s.update(0.25, 0, 0);
    expect(s.paused).toBe(true);
    expect(s.remaining).toBeGreaterThan(left);
  });

  it('marks spot A as the windy one', () => {
    const windy = new SeedSpot(new EventBus(), 'A', 0, 0, SEEDS2.windyCalmDecayFactor);
    expect(windy.calmDecayFactor).toBe(SEEDS2.windyCalmDecayFactor);
  });
});

describe('the light well', () => {
  it('gives one light for a calm breath when the player is short', () => {
    const well = new LightWell(new EventBus(), 0, 0);
    expect(well.onBreath(true, 0, 0, 0)).toBe(LIGHT_WELL.lightPerBreath);
  });

  it('gives nothing once the player already has enough', () => {
    const well = new LightWell(new EventBus(), 0, 0);
    expect(well.onBreath(true, 0, 0, LIGHT_WELL.maxLight)).toBe(0);
    expect(well.onBreath(true, 0, 0, LIGHT_WELL.maxLight + 3)).toBe(0);
  });

  it('gives nothing from far away', () => {
    const well = new LightWell(new EventBus(), 0, 0);
    expect(well.onBreath(true, 0, LIGHT_WELL.radius + 2, 0)).toBe(0);
  });

  it('gives nothing for a breath that is not calm', () => {
    const well = new LightWell(new EventBus(), 0, 0);
    expect(well.onBreath(false, 0, 0, 0)).toBe(0);
  });

  /** It never runs out, so a player can always get back to a seed. */
  it('never runs out while the player is short', () => {
    const well = new LightWell(new EventBus(), 0, 0);
    for (let i = 0; i < 20; i++) expect(well.onBreath(true, 0, 0, 0)).toBe(1);
  });
});
