import { CALM } from '../content/chapter1';
import type { EventBus } from '../core/events';
import { clamp } from '../core/math';

/**
 * The calm value: a hidden number from 0 to 1. It is never shown to the player.
 * Calm breaths raise it. Non-calm breaths and walking lower it slowly.
 */
export class CalmSystem {
  private value = 0;

  constructor(private readonly bus: EventBus) {
    bus.on('breathCompleted', ({ calm }) => {
      this.add(calm ? CALM.gainPerCalmBreath : -CALM.lossPerNonCalmBreath);
    });
  }

  get(): number {
    return this.value;
  }

  /** Only the debug panel and a scene jump may set this directly. */
  set(v: number): void {
    const next = clamp(v, CALM.min, CALM.max);
    if (next === this.value) return;
    this.value = next;
    this.bus.emit('calmChanged', { value: next });
  }

  add(delta: number): void {
    this.set(this.value + delta);
  }

  update(dt: number, walking: boolean): void {
    this.add(-(walking ? CALM.lossPerSecondWalking : CALM.lossPerSecondIdle) * dt);
  }
}
