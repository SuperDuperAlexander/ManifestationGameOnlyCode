import { describe, it, expect, beforeEach } from 'vitest';
import { CalmSystem } from '../../src/systems/calm';
import { EventBus } from '../../src/core/events';
import { CALM } from '../../src/content/chapter1';

describe('CalmSystem', () => {
  let bus: EventBus;
  let calm: CalmSystem;

  beforeEach(() => {
    bus = new EventBus();
    calm = new CalmSystem(bus);
  });

  it('starts at zero', () => {
    expect(calm.get()).toBe(0);
  });

  it('rises with each calm breath', () => {
    bus.emit('breathCompleted', { calm: true, inhale: 4, exhale: 6 });
    expect(calm.get()).toBeCloseTo(CALM.gainPerCalmBreath, 6);
    bus.emit('breathCompleted', { calm: true, inhale: 4, exhale: 6 });
    expect(calm.get()).toBeCloseTo(CALM.gainPerCalmBreath * 2, 6);
  });

  it('falls with a breath that is not calm', () => {
    calm.set(0.5);
    bus.emit('breathCompleted', { calm: false, inhale: 1, exhale: 1 });
    expect(calm.get()).toBeCloseTo(0.5 - CALM.lossPerNonCalmBreath, 6);
  });

  it('falls slowly while walking', () => {
    calm.set(0.5);
    calm.update(1, true);
    expect(calm.get()).toBeCloseTo(0.5 - CALM.lossPerSecondWalking, 6);
  });

  it('falls more slowly while standing still', () => {
    calm.set(0.5);
    calm.update(1, false);
    expect(calm.get()).toBeCloseTo(0.5 - CALM.lossPerSecondIdle, 6);
  });

  it('never goes below zero', () => {
    for (let i = 0; i < 100; i++) calm.update(1, true);
    expect(calm.get()).toBe(0);
  });

  it('never goes above one', () => {
    for (let i = 0; i < 100; i++) bus.emit('breathCompleted', { calm: true, inhale: 4, exhale: 6 });
    expect(calm.get()).toBe(1);
  });

  it('emits calmChanged only when the value really changes', () => {
    let events = 0;
    bus.on('calmChanged', () => events++);
    calm.set(0.4);
    calm.set(0.4);
    expect(events).toBe(1);
  });

  it('crosses the heart seed threshold after enough calm breaths', () => {
    const needed = Math.ceil(CALM.heartThreshold / CALM.gainPerCalmBreath);
    for (let i = 0; i < needed; i++)
      bus.emit('breathCompleted', { calm: true, inhale: 4, exhale: 6 });
    expect(calm.get()).toBeGreaterThanOrEqual(CALM.heartThreshold);
  });
});
