import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TUNING } from '../config/tuning';
import type { Events } from '../core/Events';
import type { Sound } from '../core/Sound';
import type { DialogueSystem } from './DialogueSystem';
import type { Fairy } from './Fairy';

export interface HintData {
  id: string;
  x: number;
  z: number;
  /** Key of the line in en.json. */
  line: string;
  /** Height the fairy hovers at. */
  y?: number;
  /** Range in which the hint calls her. */
  radius?: number;
  /** True for a fog blockade: the first one she uses to teach breathing. */
  blockade?: boolean;
}

/**
 * What the fairy does and says, and when. She speaks one sentence at a time,
 * shows one thing at a time, and always comes back to the player.
 */
export class Companion {
  private readonly hints = new Map<string, HintData>();
  private readonly shownHints = new Set<string>();
  private chain: Promise<void> = Promise.resolve();
  private running = 0;
  private introDone = false;
  private taught = false;
  private releaseCount = 0;
  private readonly playerPos = new Vector3();
  private cooldown = 0;

  constructor(
    private readonly fairy: Fairy,
    private readonly dialogue: DialogueSystem,
    events: Events,
    private readonly sound: Sound,
    private readonly touch: () => boolean,
  ) {
    events.on('fogMet', (e) => this.onFogMet(e.id, e.x, e.z));
    events.on('fogPushed', () => {
      this.fairy.pulse();
      void this.dialogue.say('force', { interrupt: true });
    });
    events.on('blockadeReleased', () => {
      this.fairy.pulse();
      this.sound.release();
      // A short word after a release, only if she is not already talking.
      if (!this.dialogue.busy) void this.dialogue.sayOne('released', this.releaseCount);
      this.releaseCount++;
    });
  }

  get busy(): boolean {
    return this.running > 0;
  }

  get hasIntroduced(): boolean {
    return this.introDone;
  }

  /** Marks intro and teaching as done (continuing a saved game). */
  skipIntro(): void {
    this.introDone = true;
    this.taught = true;
    this.fairy.arrive(this.playerPos.add(new Vector3(1, 1.7, 0.5)));
  }

  addHint(h: HintData): void {
    this.hints.set(h.id, h);
  }

  removeHint(id: string): void {
    this.hints.delete(id);
  }

  /** Queue a task. Tasks run one after another. */
  private queue(task: () => Promise<void>): Promise<void> {
    this.running++;
    this.chain = this.chain.then(task).catch((err: unknown) => console.error('[companion]', err)).then(() => {
      this.running--;
    });
    return this.chain;
  }

  /** The meadow intro: she flies in from afar and introduces herself. */
  playIntro(): Promise<void> {
    return this.queue(async () => {
      const from = this.playerPos.add(new Vector3(9, 16, 34));
      await this.fairy.arrive(from);
      this.sound.chime();
      this.fairy.pulse();
      await this.dialogue.say('intro');
      await this.dialogue.say(this.touch() ? 'controlsMoveTouch' : 'controlsMove');
      this.introDone = true;
    });
  }

  /** She flies to a point, glows, chimes, says one line and comes back. */
  showSomething(point: Vector3, lineKey: string, extraKeys: string[] = [], range: number = TUNING.fairy.hintRange): Promise<void> {
    return this.queue(async () => {
      // The player walked on while she was busy: this hint is no longer about here.
      if (Math.hypot(point.x - this.playerPos.x, point.z - this.playerPos.z) > range * 2) return;
      await withTimeout(this.fairy.visit(point), 4);
      this.sound.chime();
      await this.dialogue.say(lineKey);
      for (const k of extraKeys) await this.dialogue.say(k);
      await wait(TUNING.fairy.hintHold * 0.4);
      this.fairy.comeBack();
    });
  }

  /** Something the fairy says without flying anywhere. */
  say(key: string, opts: { once?: boolean } = {}): Promise<void> {
    return this.queue(async () => {
      this.fairy.pulse();
      await this.dialogue.say(key, opts);
    });
  }

  private onFogMet(id: string, x: number, z: number): void {
    if (!this.taught) this.teach(id, x, z);
  }

  /** First blockade: she flies to it and teaches breathing. */
  private teach(id: string, x: number, z: number): void {
    const point = new Vector3(x, 2.9, z - 0.8);
    {
      this.taught = true;
      this.shownHints.add(id);
      void this.queue(async () => {
        await withTimeout(this.fairy.visit(point), 4);
        this.sound.chime();
        await this.dialogue.say('firstBlockade');
        await this.dialogue.say('breathingTip');
        this.fairy.comeBack();
        await this.dialogue.say(this.touch() ? 'breathingKeysTouch' : 'breathingKeys');
      });
    }
  }

  update(dt: number, playerPos: Vector3): void {
    this.playerPos.copyFrom(playerPos);
    this.fairy.update(dt, playerPos);
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.introDone || this.busy || this.dialogue.busy || this.cooldown > 0) return;

    // Hints: the nearest unseen hint in range calls her.
    let best: HintData | null = null;
    let bestD = Infinity;
    for (const h of this.hints.values()) {
      if (this.shownHints.has(h.id)) continue;
      const d = Math.hypot(h.x - playerPos.x, h.z - playerPos.z);
      if (d < (h.radius ?? TUNING.fairy.hintRange) && d < bestD) {
        best = h;
        bestD = d;
      }
    }
    if (best) {
      this.cooldown = 2;
      if (best.blockade && !this.taught) {
        this.teach(best.id, best.x, best.z);
        return;
      }
      this.shownHints.add(best.id);
      void this.showSomething(new Vector3(best.x, best.y ?? 2.4, best.z), best.line, [], best.radius ?? TUNING.fairy.hintRange);
    }
  }
}

function wait(seconds: number): Promise<void> {
  return new Promise((r) => setTimeout(r, seconds * 1000));
}

/** Resolves when the promise does, or after `seconds` at the latest. */
function withTimeout(p: Promise<void>, seconds: number): Promise<void> {
  return Promise.race([p, wait(seconds)]);
}
