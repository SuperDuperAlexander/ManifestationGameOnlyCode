import { TUNING } from '../config/tuning';
import type { Events } from '../core/Events';

/** The English lines, loaded from public/data/dialogue/en.json. A key maps to one line or a list. */
export type DialogueTable = Record<string, string | string[]>;

interface Queued {
  id: string;
  text: string;
  seconds?: number;
  resolve: () => void;
}

/**
 * The fairy's voice: one calm sentence at a time on a line at the bottom of the screen,
 * then silence. Lines never overlap; new ones wait in a short queue.
 */
export class DialogueSystem {
  private table: DialogueTable = {};
  private readonly el: HTMLDivElement;
  private readonly textEl: HTMLSpanElement;
  private readonly queue: Queued[] = [];
  private current: Queued | null = null;
  private timer = 0;
  private gap = 0;
  private readonly said = new Set<string>();

  constructor(
    parent: HTMLElement,
    private readonly events: Events,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'dialogue-line';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.el.innerHTML = '<span class="dl-mark">✦</span><span class="dl-text"></span>';
    this.textEl = this.el.querySelector('.dl-text') as HTMLSpanElement;
    parent.appendChild(this.el);
  }

  async load(url: string): Promise<void> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      this.table = (await res.json()) as DialogueTable;
    } catch (err) {
      console.warn(`[dialogue] could not load ${url}: ${String(err)}`);
    }
  }

  /** All lines of a key (one or many). Unknown keys return an empty list. */
  lines(key: string): string[] {
    const v = this.table[key];
    if (v === undefined) {
      console.warn(`[dialogue] missing line "${key}"`);
      return [];
    }
    return Array.isArray(v) ? v : [v];
  }

  /** Raw data of a key (for structured entries such as `thoughts`). Undefined if missing. */
  data(key: string): unknown {
    return (this.table as Record<string, unknown>)[key];
  }

  /** One line of a key, picked by index (wraps around). */
  line(key: string, index = 0): string {
    const all = this.lines(key);
    return all.length ? all[index % all.length]! : '';
  }

  get busy(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  /** Remove an obsolete prompt from the queue, or dismiss it if it is visible. */
  cancel(key: string): void {
    const keep: Queued[] = [];
    for (const item of this.queue) {
      if (item.id === key) item.resolve();
      else keep.push(item);
    }
    this.queue.splice(0, this.queue.length, ...keep);
    if (this.current?.id === key) {
      this.el.classList.remove('show');
      this.current.resolve();
      this.current = null;
      this.timer = 0;
      this.gap = 0;
    }
  }

  /** True if this key was already said with `once`. */
  hasSaid(key: string): boolean {
    return this.said.has(key);
  }

  /**
   * Says all lines of a key, one after another. Resolves when the last one is gone.
   * `once`: a key is said only the first time.
   */
  say(key: string, opts: { once?: boolean; interrupt?: boolean; seconds?: number } = {}): Promise<void> {
    if (opts.once && this.said.has(key)) return Promise.resolve();
    this.said.add(key);
    return this.sayLines(key, this.lines(key), opts.interrupt ?? false, opts.seconds);
  }

  /** Says one specific line of a key. */
  sayOne(key: string, index: number, opts: { interrupt?: boolean } = {}): Promise<void> {
    const text = this.line(key, index);
    return this.sayLines(key, text ? [text] : [], opts.interrupt ?? false);
  }

  private sayLines(id: string, texts: string[], interrupt: boolean, seconds?: number): Promise<void> {
    if (interrupt) {
      for (const q of this.queue.splice(0)) q.resolve();
      if (this.current) {
        this.el.classList.remove('show');
        this.current.resolve();
        this.current = null;
      }
      this.timer = 0;
      this.gap = 0;
    }
    if (!texts.length) return Promise.resolve();
    const promises = texts.map(
      (text) =>
        new Promise<void>((resolve) => {
          this.queue.push({ id, text, seconds, resolve });
        }),
    );
    return promises[promises.length - 1]!;
  }

  update(dt: number): void {
    const f = TUNING.fairy;
    if (this.current) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.el.classList.remove('show');
        this.current.resolve();
        this.current = null;
        this.gap = f.lineGap;
      }
      return;
    }
    if (this.gap > 0) {
      this.gap -= dt;
      return;
    }
    const next = this.queue.shift();
    if (!next) return;
    this.current = next;
    this.timer = next.seconds ?? f.lineBase + next.text.length * f.linePerChar;
    this.textEl.textContent = next.text;
    this.el.classList.add('show');
    this.events.emit('lineShown', { id: next.id, text: next.text });
  }
}
