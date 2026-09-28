import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/core/events';
import { BodySystem } from '../../src/systems/body';
import { BODY, LAYOUT2 } from '../../src/content/chapter2';

function body(): BodySystem {
  return new BodySystem(new EventBus(), LAYOUT2.bodyStones);
}

/** Takes the breaths one stone asks for, standing at it. */
function doStone(b: BodySystem, index: number): void {
  const stone = LAYOUT2.bodyStones[index];
  if (!stone) return;
  for (let i = 0; i < BODY.breathsPerStone; i++) b.onBreath(true, stone.x, stone.z);
}

describe('the four body stones', () => {
  it('leads to the feet first', () => {
    expect(body().next?.point).toBe('feet');
  });

  it('lights a point after three calm breaths at its stone', () => {
    const b = body();
    const stone = LAYOUT2.bodyStones[0];
    if (!stone) throw new Error('no stone');
    for (let i = 0; i < BODY.breathsPerStone - 1; i++) b.onBreath(true, stone.x, stone.z);
    expect(b.stones[0]?.lit).toBe(false);
    b.onBreath(true, stone.x, stone.z);
    expect(b.stones[0]?.lit).toBe(true);
    expect(b.next?.point).toBe('belly');
  });

  it('ignores breaths taken away from the next stone', () => {
    const b = body();
    for (let i = 0; i < 9; i++) b.onBreath(true, 60, 60);
    expect(b.stones[0]?.lit).toBe(false);
  });

  it('ignores breaths that are not calm', () => {
    const b = body();
    const stone = LAYOUT2.bodyStones[0];
    if (!stone) throw new Error('no stone');
    for (let i = 0; i < 9; i++) b.onBreath(false, stone.x, stone.z);
    expect(b.stones[0]?.breaths).toBe(0);
  });

  /** The order is fixed: standing at the head stone first does nothing. */
  it('keeps the order from the ground up', () => {
    const b = body();
    const head = LAYOUT2.bodyStones[3];
    if (!head) throw new Error('no stone');
    for (let i = 0; i < 9; i++) b.onBreath(true, head.x, head.z);
    expect(b.stones[3]?.lit).toBe(false);
    expect(b.next?.point).toBe('feet');
  });

  it('keeps a lit point lit', () => {
    const b = body();
    doStone(b, 0);
    doStone(b, 1);
    expect(b.litPoints).toEqual(['feet', 'belly']);
  });

  it('shows the silhouette for three seconds after the fourth stone', () => {
    const b = body();
    for (let i = 0; i < 4; i++) doStone(b, i);
    expect(b.allLit).toBe(true);
    expect(b.showingSilhouette).toBe(true);
    for (let t = 0; t < BODY.silhouetteSeconds + 0.2; t += 0.1) b.update(0.1);
    expect(b.showingSilhouette).toBe(false);
  });

  it('times how long the body check took', () => {
    const b = body();
    doStone(b, 0);
    for (let t = 0; t < 5; t += 0.5) b.update(0.5);
    expect(b.elapsed).toBeCloseTo(5, 1);
  });

  it('stops the clock once all four are lit', () => {
    const b = body();
    for (let i = 0; i < 4; i++) doStone(b, i);
    const at = b.elapsed;
    for (let t = 0; t < 4; t += 0.5) b.update(0.5);
    expect(b.elapsed).toBe(at);
  });
});
