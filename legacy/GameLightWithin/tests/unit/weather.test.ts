import { describe, it, expect } from 'vitest';
import { FeelingWeather, isSpent, shuffledFeelings } from '../../src/systems/weather';
import { NAMING, WEATHER } from '../../src/content/chapter2';
import { PLAYER } from '../../src/content/chapter1';

function still(w: FeelingWeather, seconds: number, px = 0, pz = 0): void {
  for (let t = 0; t < seconds; t += 0.1) w.update(0.1, px, pz, 0, PLAYER.walkSpeed);
}

describe('feeling weather', () => {
  it('follows the player at nine tenths of a walk', () => {
    const w = new FeelingWeather({ type: 'sadness', x: 0, z: 0, followsPlayer: true });
    // The player is far away and standing still, so the weather closes in.
    w.update(1, 0, 40, 0, PLAYER.walkSpeed);
    expect(w.z).toBeCloseTo(PLAYER.walkSpeed * WEATHER.followSpeedFactor, 3);
  });

  it('stays where it is when it does not follow', () => {
    const w = new FeelingWeather({ type: 'anger', x: 0, z: 0, followsPlayer: false });
    w.update(1, 0, 40, 0, PLAYER.walkSpeed);
    expect(w.z).toBe(0);
  });

  it('keeps its distance instead of sitting on the player', () => {
    const w = new FeelingWeather({ type: 'worry', x: 0, z: 0, followsPlayer: true });
    for (let i = 0; i < 40; i++) w.update(0.1, 0, 0.4, 0, PLAYER.walkSpeed);
    expect(w.distanceTo(0, 0.4)).toBeLessThanOrEqual(WEATHER.followRadius + 0.001);
  });

  it('records each time the player runs out of reach', () => {
    const w = new FeelingWeather({ type: 'sadness', x: 0, z: 0, followsPlayer: true });
    w.update(0.1, 0, 1, 0, PLAYER.walkSpeed);
    w.update(0.1, 0, NAMING.radius + 5, 4, PLAYER.walkSpeed);
    expect(w.fleeCount).toBe(1);
  });

  it('opens the naming panel after standing still long enough', () => {
    const w = new FeelingWeather({ type: 'sadness', x: 0, z: 0 });
    expect(w.canName(1)).toBe(false);
    still(w, NAMING.stillSeconds + 0.2);
    expect(w.canName(1)).toBe(true);
  });

  it('does not open the panel before one calm breath', () => {
    const w = new FeelingWeather({ type: 'sadness', x: 0, z: 0 });
    still(w, NAMING.stillSeconds + 0.2);
    expect(w.canName(0)).toBe(false);
  });

  it('does not open the panel while the player walks', () => {
    const w = new FeelingWeather({ type: 'sadness', x: 0, z: 0 });
    for (let t = 0; t < 6; t += 0.1) w.update(0.1, 0, 0, 3, PLAYER.walkSpeed);
    expect(w.canName(1)).toBe(false);
  });

  it('softens by 40 percent when the name fits', () => {
    const w = new FeelingWeather({ type: 'sadness', x: 0, z: 0, intensity: 1 });
    expect(w.answer('sadness')).toBe(true);
    expect(w.intensity).toBeCloseTo(1 - WEATHER.namedDrop, 5);
    expect(w.named).toBe(true);
  });

  it('locks the panel for four seconds when the name does not fit', () => {
    const w = new FeelingWeather({ type: 'sadness', x: 0, z: 0, intensity: 0.8 });
    expect(w.answer('anger')).toBe(false);
    expect(w.named).toBe(false);
    expect(w.lockSeconds).toBeCloseTo(NAMING.lockSeconds, 5);
    still(w, NAMING.stillSeconds + 0.2);
    // Still locked: the panel cannot open again yet.
    expect(w.canName(1)).toBe(false);
    still(w, NAMING.lockSeconds);
    expect(w.canName(1)).toBe(true);
  });

  it('shows itself more clearly after a name that does not fit, and nothing else', () => {
    const w = new FeelingWeather({ type: 'worry', x: 3, z: 4, intensity: 0.5, size: 1 });
    w.answer('sadness');
    expect(w.intensity).toBeCloseTo(0.5 + WEATHER.wrongGrowth, 5);
    expect(w.size).toBeCloseTo(1 + WEATHER.wrongGrowth, 5);
    // It does not move, dissolve, or take anything from the player.
    expect(w.x).toBe(3);
    expect(w.z).toBe(4);
    expect(w.dissolving).toBe(false);
  });

  it('records every attempt, fitting or not', () => {
    const w = new FeelingWeather({ type: 'anger', x: 0, z: 0 });
    w.answer('worry');
    w.answer('sadness');
    w.answer('anger');
    expect(w.attempts).toEqual(['worry', 'sadness', 'anger']);
  });

  it('never leaves the 0 to 1 range', () => {
    const w = new FeelingWeather({ type: 'anger', x: 0, z: 0, intensity: 1 });
    for (let i = 0; i < 12; i++) w.answer('worry');
    expect(w.intensity).toBeLessThanOrEqual(WEATHER.maxIntensity);
    w.setIntensity(-5);
    expect(w.intensity).toBe(WEATHER.minIntensity);
  });

  it('shuffles the three answers', () => {
    const order = shuffledFeelings(() => 0.99);
    expect([...order].sort()).toEqual(['anger', 'sadness', 'worry']);
  });

  it('is spent once almost nothing is left of it', () => {
    const w = new FeelingWeather({ type: 'worry', x: 0, z: 0, intensity: 1 });
    expect(isSpent(w)).toBe(false);
    w.setIntensity(0.01);
    expect(isSpent(w)).toBe(true);
  });
});

describe('sound breath against weather', () => {
  it('takes 20 percent off anger', () => {
    const w = new FeelingWeather({ type: 'anger', x: 0, z: 0, intensity: 1 });
    expect(w.tone()).toBe(true);
    expect(w.intensity).toBeCloseTo(1 - WEATHER.toneDrop, 5);
  });

  it('takes 20 percent off worry', () => {
    const w = new FeelingWeather({ type: 'worry', x: 0, z: 0, intensity: 0.5 });
    w.tone();
    expect(w.intensity).toBeCloseTo(0.5 * (1 - WEATHER.toneDrop), 5);
  });

  /** Sadness is not a thing to be quietened. A tone leaves it as it was. */
  it('leaves sadness exactly as it was', () => {
    const w = new FeelingWeather({ type: 'sadness', x: 0, z: 0, intensity: 0.8 });
    expect(w.tone()).toBe(false);
    expect(w.intensity).toBe(0.8);
  });
});
