import { describe, it, expect, beforeEach } from 'vitest';
import { LightSystem } from '../../src/systems/light';
import { EventBus } from '../../src/core/events';
import { LIGHT, LAYOUT, TRANSFORM } from '../../src/content/chapter1';

describe('LightSystem', () => {
  let bus: EventBus;
  let light: LightSystem;

  beforeEach(() => {
    bus = new EventBus();
    light = new LightSystem(bus);
  });

  it('starts empty', () => {
    expect(light.get()).toBe(0);
  });

  it('never goes above the maximum of 12', () => {
    light.add(100);
    expect(light.get()).toBe(LIGHT.max);
    expect(LIGHT.max).toBe(12);
  });

  it('reports how much light actually fitted', () => {
    light.set(11);
    expect(light.add(3)).toBe(1);
    expect(light.get()).toBe(12);
  });

  it('never goes below zero', () => {
    light.add(-5);
    expect(light.get()).toBe(0);
  });

  it('cannot plant a seed with less than 5 light', () => {
    light.set(4);
    expect(light.canAfford(LIGHT.seedCost)).toBe(false);
    expect(light.spend(LIGHT.seedCost)).toBe(false);
    expect(light.get()).toBe(4);
  });

  it('plants a seed with exactly 5 light', () => {
    light.set(5);
    expect(light.spend(LIGHT.seedCost)).toBe(true);
    expect(light.get()).toBe(0);
  });

  it('emits lightChanged with the delta', () => {
    const seen: number[] = [];
    bus.on('lightChanged', (p) => seen.push(p.delta));
    light.add(3);
    light.spend(1);
    expect(seen).toEqual([3, -1]);
  });

  it('gives enough light in chapter 1 to plant the bridge', () => {
    const total =
      LAYOUT.spring1.light + LAYOUT.spring2.light + TRANSFORM.lightReward + LAYOUT.spring3.light;
    expect(total).toBe(11);
    expect(total).toBeGreaterThanOrEqual(LIGHT.seedCost);
    expect(total).toBeLessThanOrEqual(LIGHT.max);
  });
});
