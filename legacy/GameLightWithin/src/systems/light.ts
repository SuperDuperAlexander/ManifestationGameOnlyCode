import { LIGHT } from '../content/chapter1';
import type { EventBus } from '../core/events';
import { clamp } from '../core/math';

/**
 * The light the player carries. Shown as glowing motes, never as a number.
 */
export class LightSystem {
  private value = 0;

  constructor(private readonly bus: EventBus) {}

  get(): number {
    return this.value;
  }

  get max(): number {
    return LIGHT.max;
  }

  set(v: number): void {
    const next = clamp(Math.round(v), 0, LIGHT.max);
    if (next === this.value) return;
    const delta = next - this.value;
    this.value = next;
    this.bus.emit('lightChanged', { value: next, delta });
  }

  /** Adds light and returns how much actually fitted. Never goes above the maximum. */
  add(amount: number): number {
    const before = this.value;
    this.set(before + amount);
    return this.value - before;
  }

  canAfford(cost: number): boolean {
    return this.value >= cost;
  }

  /** Spends light. Returns false and changes nothing when there is not enough. */
  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.set(this.value - cost);
    return true;
  }
}
