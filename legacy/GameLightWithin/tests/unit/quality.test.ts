import { describe, it, expect } from 'vitest';
import {
  QualityProbe,
  QualityWatchdog,
  settingsFor,
  tierBelow,
  tierForFrameTime,
} from '../../src/core/quality';
import { QUALITY, TIERS } from '../../src/content/chapter1';

/** Feeds the watchdog a steady frame rate for a number of seconds. */
function run(
  w: QualityWatchdog,
  fps: number,
  seconds: number,
  tier: 'low' | 'medium' | 'high',
): string | null {
  const dt = 1 / fps;
  let last: string | null = null;
  for (let t = 0; t < seconds; t += dt) {
    const drop = w.sample(dt, tier);
    if (drop) {
      last = drop;
      tier = drop;
    }
  }
  return last;
}

describe('quality tiers', () => {
  it('orders the tiers from cheapest to richest', () => {
    expect(tierBelow('high')).toBe('medium');
    expect(tierBelow('medium')).toBe('low');
    expect(tierBelow('low')).toBeNull();
  });

  it('gives a cheaper tier fewer grass cards and a closer fade', () => {
    expect(TIERS.low.grassCards).toBeLessThan(TIERS.medium.grassCards);
    expect(TIERS.medium.grassCards).toBeLessThan(TIERS.high.grassCards);
    expect(TIERS.low.grassFade).toBeLessThan(TIERS.high.grassFade);
    expect(TIERS.low.paintScale).toBeLessThan(TIERS.high.paintScale);
  });

  it('carries the tier values into the settings object', () => {
    const s = settingsFor('low');
    expect(s.tier).toBe('low');
    expect(s.grassCards).toBe(TIERS.low.grassCards);
    expect(s.grassFade).toBe(TIERS.low.grassFade);
  });

  it('picks a tier from a frame time', () => {
    expect(tierForFrameTime(40)).toBe('low');
    expect(tierForFrameTime(22)).toBe('medium');
    expect(tierForFrameTime(10)).toBe('high');
  });
});

describe('QualityProbe', () => {
  it('says nothing until its window is over', () => {
    const probe = new QualityProbe();
    expect(probe.sample(0.1)).toBeNull();
    expect(probe.finished).toBe(false);
  });

  it('picks a cheap tier on a slow machine', () => {
    const probe = new QualityProbe();
    let picked: string | null = null;
    for (let t = 0; t < QUALITY.probeSeconds + 0.2; t += 0.05)
      picked = probe.sample(0.05) ?? picked;
    expect(probe.finished).toBe(true);
    expect(picked).toBe('low');
  });

  it('picks only once', () => {
    const probe = new QualityProbe();
    for (let t = 0; t < QUALITY.probeSeconds + 0.2; t += 0.05) probe.sample(0.05);
    expect(probe.sample(0.05)).toBeNull();
  });
});

describe('QualityWatchdog', () => {
  const FLOOR = 45;

  it('says nothing while the frame rate is fine', () => {
    const w = new QualityWatchdog(FLOOR);
    expect(run(w, 60, 30, 'high')).toBeNull();
    expect(w.steps).toBe(0);
  });

  it('says nothing before its window is full', () => {
    const w = new QualityWatchdog(FLOOR);
    expect(run(w, 10, QUALITY.watchdogWindowSeconds - 1, 'high')).toBeNull();
  });

  it('steps down one tier when the frame rate stays low', () => {
    const w = new QualityWatchdog(FLOOR);
    expect(run(w, 20, QUALITY.watchdogWindowSeconds + 0.5, 'high')).toBe('medium');
    expect(w.steps).toBe(1);
  });

  it('waits out a cooldown before stepping down again', () => {
    const w = new QualityWatchdog(FLOOR);
    run(w, 20, QUALITY.watchdogWindowSeconds + 0.5, 'high');
    // Straight after a change it must not judge again.
    expect(run(w, 20, QUALITY.watchdogCooldownSeconds - 1, 'medium')).toBeNull();
    expect(w.steps).toBe(1);
  });

  it('reaches the cheapest tier and then stops for good', () => {
    const w = new QualityWatchdog(FLOOR);
    const long = (QUALITY.watchdogWindowSeconds + QUALITY.watchdogCooldownSeconds) * 6;
    run(w, 5, long, 'high');
    // Two steps take it from high to low, and low has nothing below it.
    expect(w.steps).toBe(2);
  });

  it('never steps back up, so it cannot oscillate', () => {
    const w = new QualityWatchdog(FLOOR);
    run(w, 20, QUALITY.watchdogWindowSeconds + 0.5, 'high');
    const after = run(w, 120, 60, 'medium');
    expect(after).toBeNull();
    expect(w.steps).toBe(1);
  });

  it('restarts its window after a manual tier change', () => {
    const w = new QualityWatchdog(FLOOR);
    w.restart();
    expect(run(w, 5, QUALITY.watchdogCooldownSeconds - 1, 'high')).toBeNull();
  });
});
