import { describe, it, expect, beforeEach } from 'vitest';
import { TransformSystem } from '../../src/systems/transform';
import { EventBus } from '../../src/core/events';
import { TRANSFORM } from '../../src/content/chapter1';

const ORIGIN = { x: 0, z: 0, radius: 5.5 };

/** Walks the fog through the first two steps and returns the system. */
function toStep3(fog: TransformSystem, bus: EventBus): void {
  // Step 1: stand inside the see radius until the text is fully shown.
  fog.update(0.1, 0, 4);
  expect(fog.step).toBe(1);
  for (let t = 0; t < TRANSFORM.seeSeconds + 0.2; t += 0.1) fog.update(0.1, 0, 4);
  expect(fog.step).toBe(2);
  // Step 2: two calm breaths inside the feel radius.
  for (let i = 0; i < TRANSFORM.feelBreaths; i++) fog.onBreath(true, 0, 3);
  expect(fog.step).toBe(3);
  void bus;
}

describe('TransformSystem', () => {
  let bus: EventBus;
  let fog: TransformSystem;

  beforeEach(() => {
    bus = new EventBus();
    fog = new TransformSystem(bus, ORIGIN);
  });

  it('starts at step 0 while the player is far away', () => {
    fog.update(0.1, 0, 40);
    expect(fog.step).toBe(0);
  });

  it('cannot skip the see step: breaths do nothing before the text is shown', () => {
    fog.update(0.1, 0, 4);
    expect(fog.step).toBe(1);
    for (let i = 0; i < 10; i++) fog.onBreath(true, 0, 1);
    expect(fog.step).toBe(1);
  });

  it('the see text cannot be skipped and takes the full time', () => {
    fog.update(0.1, 0, 4);
    for (let t = 0; t < TRANSFORM.seeSeconds - 0.5; t += 0.1) fog.update(0.1, 0, 4);
    expect(fog.step).toBe(1);
    expect(fog.seeProgress).toBeLessThan(1);
    for (let t = 0; t < 1; t += 0.1) fog.update(0.1, 0, 4);
    expect(fog.step).toBe(2);
  });

  it('runs the steps in order to the dissolve', () => {
    const steps: number[] = [];
    bus.on('fogStepChanged', (p) => steps.push(p.step));
    toStep3(fog, bus);
    for (let i = 0; i < TRANSFORM.centerBreaths; i++) fog.onBreath(true, 0, 0);
    expect(fog.step).toBe(4);
    expect(steps).toEqual([1, 2, 3, 4]);
  });

  it('gives 2 light and a colour zone when it dissolves', () => {
    let light = 0;
    let zones = 0;
    bus.on('lightCollected', (p) => (light += p.amount));
    bus.on('zoneAdded', () => zones++);
    toStep3(fog, bus);
    for (let i = 0; i < TRANSFORM.centerBreaths; i++) fog.onBreath(true, 0, 0);
    expect(light).toBe(TRANSFORM.lightReward);
    expect(light).toBe(2);
    expect(zones).toBe(1);
  });

  it('grows by 10 percent and drifts closer when the player runs away', () => {
    fog.update(0.1, 0, 4);
    expect(fog.step).toBe(1);
    fog.update(0.1, 0, 40);
    expect(fog.growth).toBeCloseTo(TRANSFORM.fleeGrowth, 6);
    expect(fog.step).toBe(0);
    // It drifted one metre toward the player, who stood at z = 40.
    expect(fog.z).toBeCloseTo(TRANSFORM.fleeDriftMetres, 6);
  });

  it('caps the growth from running away at plus 30 percent', () => {
    for (let i = 0; i < 12; i++) {
      fog.update(0.1, fog.x, fog.z + 4);
      fog.update(0.1, fog.x, fog.z + 60);
    }
    expect(fog.growth).toBeCloseTo(TRANSFORM.fleeGrowthMax, 6);
    expect(fog.growth).toBeCloseTo(0.3, 6);
    expect(fog.radius).toBeCloseTo(ORIGIN.radius * 1.3, 6);
  });

  it('resets the progress in the current step when the player runs away', () => {
    fog.update(0.1, 0, 4);
    for (let t = 0; t < 2; t += 0.1) fog.update(0.1, 0, 4);
    expect(fog.seeProgress).toBeGreaterThan(0);
    fog.update(0.1, 0, 40);
    expect(fog.seeProgress).toBe(0);
    expect(fog.breathsInStep).toBe(0);
  });

  it('push adds one calm breath and never works', () => {
    fog.update(0.1, 0, 4);
    expect(fog.pushAvailable).toBe(true);
    fog.push();
    expect(fog.pushCount).toBe(1);
    expect(fog.centerBreathsNeeded).toBe(TRANSFORM.centerBreaths + 1);
    // The fog is still there. Pushing changed nothing else.
    expect(fog.step).toBe(1);
    expect(fog.done).toBe(false);
  });

  it('caps the extra breaths from pushing', () => {
    fog.update(0.1, 0, 4);
    for (let i = 0; i < 6; i++) fog.push();
    expect(fog.pushCount).toBe(6);
    expect(fog.pushExtra).toBe(TRANSFORM.pushExtraBreathsMax);
    expect(fog.centerBreathsNeeded).toBe(TRANSFORM.centerBreaths + TRANSFORM.pushExtraBreathsMax);
  });

  it('needs the extra pushed breaths before it dissolves', () => {
    fog.update(0.1, 0, 4);
    fog.push();
    toStep3(fog, bus);
    for (let i = 0; i < TRANSFORM.centerBreaths; i++) fog.onBreath(true, 0, 0);
    expect(fog.step).toBe(3);
    fog.onBreath(true, 0, 0);
    expect(fog.step).toBe(4);
  });

  it('ignores breaths that are not calm', () => {
    toStep3(fog, bus);
    for (let i = 0; i < 10; i++) fog.onBreath(false, 0, 0);
    expect(fog.step).toBe(3);
  });

  it('ignores calm breaths taken outside the centre in the last step', () => {
    toStep3(fog, bus);
    for (let i = 0; i < 5; i++) fog.onBreath(true, 0, 6);
    expect(fog.step).toBe(3);
  });
});
