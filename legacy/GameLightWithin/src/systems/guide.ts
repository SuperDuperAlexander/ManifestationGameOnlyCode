import { GUIDE } from '../content/chapter1';
import type { EventBus } from '../core/events';

/**
 * What the guide can carry.
 *
 * Today every teaching is text. A recorded teaching, in which Dr. Rulin
 * speaks for herself, is the same thing with a film attached: the guide
 * opens, the words are still there for anyone who cannot or does not want
 * to watch, and the film is fetched from the game's own files at the moment
 * it is needed rather than at the start.
 */
export interface Teaching {
  /** Which line of `strings.guide` to show. Always present. */
  readonly text: string;
  /** A file under `public/teachings`, fetched when this teaching opens. */
  readonly video?: string;
}

export interface GuideMessage {
  /** Said once, unless it is armed again. */
  readonly id: string;
  readonly teaching: Teaching;
  /** Seconds it stays on screen. A teaching with a film waits for the film. */
  readonly seconds: number;
  /** True for a teaching at a blockage: it stops and asks to be read. */
  readonly holds: boolean;
}

/**
 * The guide's judgement about when to speak.
 *
 * She has three jobs and one rule. The jobs: say a word when the player
 * reaches something new, open a teaching at a blockage, and offer a way on
 * when someone has been lost for a while. The rule is that she is quiet
 * while the player is breathing — the breath is the whole of the game and
 * nothing may talk over it.
 *
 * There is no engine and no Babylon in this file, so what she decides can be
 * tested without a screen.
 */
export class GuideSystem {
  /** The message showing now, or null. */
  current: GuideMessage | null = null;
  /** Seconds the current message has been up. */
  showing = 0;
  /** Everything already said, so nothing is said twice. */
  private readonly said = new Set<string>();
  /** Seconds since the player last did anything that counts as progress. */
  private lost = 0;
  /** Seconds until she is willing to speak again. */
  private quiet = 0;
  /** True while the player is mid-breath. She waits. */
  private breathing = false;
  private readonly waiting: GuideMessage[] = [];

  constructor(private readonly bus: EventBus) {}

  /**
   * Offers a message. It is dropped if it has been said, and it waits if the
   * player is breathing or if she has only just spoken.
   */
  say(
    id: string,
    teaching: Teaching,
    options: { seconds?: number; holds?: boolean; again?: boolean } = {},
  ): void {
    if (!options.again && this.said.has(id)) return;
    this.said.add(id);
    this.waiting.push({
      id,
      teaching,
      seconds: options.seconds ?? GUIDE.messageSeconds,
      holds: options.holds ?? false,
    });
  }

  /** Lets a message be said again later. */
  rearm(id: string): void {
    this.said.delete(id);
  }

  /** The player is mid-breath. Nothing is said until they finish. */
  setBreathing(on: boolean): void {
    this.breathing = on;
  }

  /** Something happened that counts as getting somewhere. */
  progressed(): void {
    this.lost = 0;
  }

  /** Closes whatever is showing. The player can always do this. */
  dismiss(): void {
    if (!this.current) return;
    this.current = null;
    this.showing = 0;
    this.quiet = GUIDE.quietAfterSeconds;
  }

  update(dt: number, moving: boolean): void {
    if (this.quiet > 0) this.quiet = Math.max(0, this.quiet - dt);
    this.lost += dt;

    if (this.current) {
      this.showing += dt;
      // A teaching waits to be closed. Everything else goes on its own.
      if (!this.current.holds && this.showing >= this.current.seconds) this.dismiss();
      return;
    }

    // She never speaks over a breath, and never twice in a row without a gap.
    if (this.breathing || this.quiet > 0) return;
    const next = this.waiting.shift();
    if (next) {
      this.current = next;
      this.showing = 0;
      this.bus.emit('guideSpoke', { id: next.id });
      return;
    }

    // Nobody has got anywhere for a long while. She offers the way on, once,
    // and only to somebody who is actually wandering rather than sitting.
    if (moving && this.lost > GUIDE.lostSeconds) {
      this.lost = 0;
      this.rearm('lost');
      this.say('lost', { text: 'lost' }, { again: true });
    }
  }

  reset(): void {
    this.current = null;
    this.waiting.length = 0;
    this.said.clear();
    this.showing = 0;
    this.lost = 0;
    this.quiet = 0;
  }
}
