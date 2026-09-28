import { RECEIVE } from '../content/chapter1';
import type { EventBus } from '../core/events';
import { dist2d } from '../core/math';

export interface SpringConfig {
  id: string;
  x: number;
  z: number;
  light: number;
  hidden: boolean;
}

/**
 * A spring gives one light per calm breath while the player stands close
 * enough, up to its own limit. A hidden spring stays invisible until the
 * player has taken two calm breaths near it. Walking just stops the flow;
 * nothing bad happens.
 */
export class Spring {
  remaining: number;
  /** A hidden spring is not shown until this is true. */
  revealed: boolean;
  /** Calm breaths taken inside the reveal radius so far. */
  breathsNear = 0;
  /** How much light the last calm breath drew, so the motes can match it. */
  lastGiven = 0;
  /** True once the spring has given all its light. */
  get empty(): boolean {
    return this.remaining <= 0;
  }

  constructor(readonly config: SpringConfig) {
    this.remaining = config.light;
    this.revealed = !config.hidden;
  }

  distanceTo(px: number, pz: number): number {
    return dist2d(px, pz, this.config.x, this.config.z);
  }
}

export class ReceiveSystem {
  readonly springs: Spring[];

  constructor(
    private readonly bus: EventBus,
    configs: SpringConfig[],
  ) {
    this.springs = configs.map((c) => new Spring(c));
  }

  get(id: string): Spring | undefined {
    return this.springs.find((s) => s.config.id === id);
  }

  /**
   * Handles one finished breath.
   * @returns the spring that gave light, if any
   */
  onBreath(calm: boolean, px: number, pz: number): Spring | null {
    if (!calm) return null;
    let gave: Spring | null = null;
    for (const spring of this.springs) {
      const d = spring.distanceTo(px, pz);

      // A hidden spring reveals itself after enough calm breaths nearby.
      if (!spring.revealed && d <= RECEIVE.revealRadius) {
        spring.breathsNear++;
        if (spring.breathsNear >= RECEIVE.revealBreaths) {
          spring.revealed = true;
          this.bus.emit('springRevealed', { id: spring.config.id });
        }
        continue;
      }

      if (spring.revealed && !spring.empty && d <= RECEIVE.drawRadius && gave === null) {
        // One calm breath draws what the spring still holds, up to its share.
        // Standing still for a whole breath is the moment that matters;
        // repeating it is only waiting.
        const amount = Math.min(spring.remaining, RECEIVE.lightPerBreath);
        spring.remaining -= amount;
        spring.lastGiven = amount;
        gave = spring;
        this.bus.emit('lightCollected', { from: 'spring', amount });
        this.bus.emit('cue', { id: 'mote' });
        if (spring.empty) {
          this.bus.emit('springEmptied', { id: spring.config.id });
          this.bus.emit('zoneAdded', {
            x: spring.config.x,
            z: spring.config.z,
            radius: RECEIVE.zoneRadius,
          });
        }
      }
    }
    return gave;
  }

  /** The nearest spring the player can currently draw from, if any. */
  activeSpring(px: number, pz: number): Spring | null {
    let best: Spring | null = null;
    let bestD = Infinity;
    for (const spring of this.springs) {
      if (!spring.revealed || spring.empty) continue;
      const d = spring.distanceTo(px, pz);
      if (d <= RECEIVE.drawRadius && d < bestD) {
        best = spring;
        bestD = d;
      }
    }
    return best;
  }
}
