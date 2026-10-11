import { TUNING } from '../config/tuning';

export type AngerEvent = 'passed' | 'pushed' | 'hit';

/**
 * The hidden anger value shared by both worlds (GAME_DESIGN.md 7.3, 7.4).
 * Push makes waves stronger, breathing lets them pass.
 */
export class Anger {
  value = 0;
  pushLevel = 0;
  passStreak = 0;
  /** Removed by the outer step (helped). Until then anger never drops below it. */
  floor: number = TUNING.anger.floorBeforeHelp;
  /** Set when the imp is calm: anger stays at 0 for good. */
  done = false;
  private listeners: ((e: AngerEvent) => void)[] = [];

  get active(): boolean {
    return this.value > 0.001;
  }

  on(fn: (e: AngerEvent) => void): void {
    this.listeners.push(fn);
  }

  set(v: number): void {
    this.value = Math.min(1, Math.max(0, v));
  }

  passed(): void {
    this.passStreak++;
    this.pushLevel = Math.max(0, this.pushLevel - 1);
    if (this.passStreak >= TUNING.waves.resetAfterPasses) this.pushLevel = 0;
    this.add(TUNING.anger.pass);
    this.emit('passed');
  }

  pushed(): void {
    this.passStreak = 0;
    this.pushLevel = Math.min(TUNING.waves.maxPushLevel, this.pushLevel + 1);
    this.add(TUNING.anger.push);
    this.emit('pushed');
  }

  hit(): void {
    this.passStreak = 0;
    this.add(TUNING.anger.hit);
    this.emit('hit');
  }

  /** Size multiplier for new waves. */
  waveScale(): number {
    return 1 + this.pushLevel * TUNING.waves.pushGrow;
  }

  private add(d: number): void {
    if (this.done) return;
    this.value = Math.min(1, Math.max(this.floor, this.value + d));
  }

  private emit(e: AngerEvent): void {
    for (const fn of this.listeners) fn(e);
  }
}
