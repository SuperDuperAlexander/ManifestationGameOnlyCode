import { THANKS } from '../content/chapter1';
import type { EventBus } from '../core/events';
import { dist2d } from '../core/math';

/**
 * The thanks mechanic: standing in one place and giving calm breaths to it.
 *
 * In chapter 1 the place is the finished bridge and the thanks turns it
 * golden. In chapter 2 it is the heart tree the player grew. The mechanic is
 * the same either way, so it lives here once and each chapter says where.
 */
export class ThanksSystem {
  breaths = 0;
  complete = false;
  /** 0 to 1, how golden the bridge has turned. */
  golden = 0;
  private bridgeReady = false;

  constructor(
    private readonly bus: EventBus,
    /** Where the thanks is given. A chapter may move it as its world grows. */
    readonly spot: { x: number; z: number },
  ) {
    bus.on('bridgeComplete', () => (this.bridgeReady = true));
  }

  get ready(): boolean {
    return this.bridgeReady;
  }

  /** Opens the thanks without a bridge, for a chapter that has none. */
  arm(): void {
    this.bridgeReady = true;
  }

  onBridge(px: number, pz: number): boolean {
    return this.bridgeReady && dist2d(px, pz, this.spot.x, this.spot.z) <= THANKS.radius;
  }

  onBreath(calm: boolean, px: number, pz: number): void {
    if (!calm || this.complete || !this.onBridge(px, pz)) return;
    this.breaths++;
    this.bus.emit('thanksProgress', { breaths: this.breaths });
    if (this.breaths >= THANKS.breaths) {
      this.complete = true;
      this.bus.emit('thanksComplete');
      this.bus.emit('cue', { id: 'thanks' });
    }
  }

  update(dt: number): void {
    if (!this.complete) return;
    this.golden = Math.min(1, this.golden + dt / THANKS.colorSeconds);
  }
}
