import { HINTS } from '../content/chapter1';
import type { EventBus } from '../core/events';
import { dist2d } from '../core/math';

/**
 * Soft hints. They are never text and never explain the meaning. They only
 * point the player's eye somewhere.
 */
export class HintSystem {
  /** Seconds since the player last took a calm breath while standing still. */
  private restlessSeconds = 0;
  private nearSeedSeconds = 0;
  birdShown = false;
  butterflyShown = false;
  /** True when the player found the hidden spring before the bird landed. */
  foundBeforeHint = false;

  constructor(
    private readonly bus: EventBus,
    /** How long the player may walk past before the bird lands. */
    private readonly birdAfterSeconds: number = HINTS.birdAfterSeconds,
  ) {
    bus.on('breathCompleted', ({ calm }) => {
      if (calm) this.restlessSeconds = 0;
    });
  }

  /** Scene 3: the bird lands if the player has not stopped and breathed. */
  updateScene3(dt: number, springFound: boolean): void {
    if (springFound) {
      if (!this.birdShown) this.foundBeforeHint = true;
      return;
    }
    if (this.birdShown) return;
    this.restlessSeconds += dt;
    if (this.restlessSeconds >= this.birdAfterSeconds) {
      this.birdShown = true;
      this.bus.emit('hintShown', { id: 'bird' });
    }
  }

  /** Scene 5: the butterfly appears if the player stays near the seed. */
  updateScene5(dt: number, px: number, pz: number, seedX: number, seedZ: number): void {
    if (this.butterflyShown) return;
    const near = dist2d(px, pz, seedX, seedZ) <= HINTS.butterflyRadius;
    this.nearSeedSeconds = near ? this.nearSeedSeconds + dt : 0;
    if (this.nearSeedSeconds >= HINTS.butterflyAfterSeconds) {
      this.butterflyShown = true;
      this.bus.emit('hintShown', { id: 'butterfly' });
    }
  }

  reset(): void {
    this.restlessSeconds = 0;
    this.nearSeedSeconds = 0;
    this.birdShown = false;
    this.butterflyShown = false;
    this.foundBeforeHint = false;
  }
}
