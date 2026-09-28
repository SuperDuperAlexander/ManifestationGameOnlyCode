import { BODY, BODY_POINTS } from '../content/chapter2';
import type { BodyPoint } from '../content/chapter2';
import type { EventBus } from '../core/events';
import { dist2d } from '../core/math';

export interface BodyStone {
  point: BodyPoint;
  x: number;
  z: number;
  /** Calm breaths taken at this stone so far. */
  breaths: number;
  lit: boolean;
}

/**
 * The four body stones.
 *
 * The order is fixed and only the next stone glows, so the player is walked up
 * their own body from the ground to the head without a word of instruction.
 * A point that is lit stays lit for the rest of the chapter.
 */
export class BodySystem {
  readonly stones: BodyStone[];
  /** Seconds since the first stone was reached, for the learning checks. */
  elapsed = 0;
  /** Seconds the silhouette has been shown, once all four are lit. */
  silhouetteTime = 0;
  private started = false;

  constructor(
    private readonly bus: EventBus,
    spots: { point: string; x: number; z: number }[],
  ) {
    this.stones = spots.map((s) => ({
      point: s.point as BodyPoint,
      x: s.x,
      z: s.z,
      breaths: 0,
      lit: false,
    }));
  }

  /** The stone the player is being led to, or null when all four are lit. */
  get next(): BodyStone | null {
    return this.stones.find((s) => !s.lit) ?? null;
  }

  get allLit(): boolean {
    return this.stones.every((s) => s.lit);
  }

  /** The points that are lit, in body order. */
  get litPoints(): BodyPoint[] {
    return BODY_POINTS.filter((p) => this.stones.find((s) => s.point === p)?.lit);
  }

  /**
   * One finished breath.
   * @returns the stone that lit up, if this breath was the one that did it
   */
  onBreath(calm: boolean, px: number, pz: number): BodyStone | null {
    if (!calm) return null;
    const stone = this.next;
    if (!stone) return null;
    if (dist2d(px, pz, stone.x, stone.z) > BODY.radius) return null;

    this.started = true;
    stone.breaths++;
    if (stone.breaths < BODY.breathsPerStone) {
      this.bus.emit('bodyStoneProgress', {
        point: stone.point,
        breaths: stone.breaths,
      });
      return null;
    }
    stone.lit = true;
    this.bus.emit('bodyPointLit', { point: stone.point });
    return stone;
  }

  update(dt: number): void {
    if (this.started && !this.allLit) this.elapsed += dt;
    if (this.allLit && this.silhouetteTime < BODY.silhouetteSeconds) {
      this.silhouetteTime += dt;
    }
  }

  /** True while the small silhouette with the four lit points is showing. */
  get showingSilhouette(): boolean {
    return this.allLit && this.silhouetteTime < BODY.silhouetteSeconds;
  }
}
