import type { Events } from '../core/Events';

/** Light points: the reward for every released blockade. */
export class LightPoints {
  total = 0;

  constructor(private readonly events: Events) {
    events.on('blockadeReleased', (e) => this.add(e.points));
  }

  add(points: number): void {
    if (points <= 0) return;
    this.total += points;
    this.events.emit('lightPointsChanged', { total: this.total, added: points });
  }

  /** Restores a saved total without celebrating it. */
  set(total: number): void {
    this.total = total;
    this.events.emit('lightPointsChanged', { total, added: 0 });
  }
}
