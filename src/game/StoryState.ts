/** Story flags and the beat number (GAME_DESIGN.md section 9). Saved as a checkpoint in localStorage. */
export interface StoryFlags {
  bumped: boolean;
  sawImp: boolean;
  helped: boolean;
  impCalm: boolean;
  lanternRelit: boolean;
  delivered: boolean;
}

const KEY = 'lw.lantern.save.v1';

const fresh = (): StoryFlags => ({ bumped: false, sawImp: false, helped: false, impCalm: false, lanternRelit: false, delivered: false });

export class StoryState {
  /** Highest beat reached (0..9). */
  beat = 0;
  readonly flags: StoryFlags = fresh();
  /** True when the state came from a save. */
  restored = false;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as { beat?: number; flags?: Partial<StoryFlags> };
        if (typeof d.beat === 'number') this.beat = Math.min(9, Math.max(0, d.beat));
        Object.assign(this.flags, d.flags ?? {});
        this.restored = this.beat > 0;
      }
    } catch {
      /* storage may be blocked: the game runs without it */
    }
  }

  reach(n: number): void {
    if (n > this.beat) {
      this.beat = n;
      this.save();
    }
  }

  set(flag: keyof StoryFlags): void {
    this.flags[flag] = true;
    this.save();
  }

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ beat: this.beat, flags: this.flags }));
    } catch {
      /* ignore */
    }
  }

  /** Beat stored in the checkpoint (0 when there is none). Does not touch the live state. */
  static savedBeat(): number {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return 0;
      const d = JSON.parse(raw) as { beat?: number };
      return typeof d.beat === 'number' ? Math.min(9, Math.max(0, d.beat)) : 0;
    } catch {
      return 0;
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}
