import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TUNING } from '../config/tuning';
import type { Sound } from '../core/Sound';
import type { DialogueSystem } from '../companion/DialogueSystem';
import type { Fairy } from '../companion/Fairy';
import type { ValleyFog } from './ValleyFog';
import { LAYOUT } from './valleyLayout';

/**
 * The fairy leads the player through the valley. One thing at a time:
 * intro and task, then at each fog: "try to push", then "breathe", then praise,
 * then she shows the way to what comes next.
 * All her lines live in public/data/dialogue/en.json.
 */
export class ValleyStory {
  private chain: Promise<void> = Promise.resolve();
  private running = 0;
  private introDone = false;
  private readonly shown = new Set<string>();
  private pushTalk = 0;
  private taughtBreath = false;
  private praisedBreath = false;
  private readonly playerPos = new Vector3();

  constructor(
    private readonly fairy: Fairy,
    private readonly dialogue: DialogueSystem,
    private readonly sound: Sound,
    private readonly touch: boolean,
  ) {}

  get busy(): boolean {
    return this.running > 0;
  }

  /** Queue a task. Tasks run one after another. */
  private queue(task: () => Promise<void>): Promise<void> {
    this.running++;
    this.chain = this.chain
      .then(task)
      .catch((err: unknown) => console.error('[story]', err))
      .then(() => {
        this.running--;
      });
    return this.chain;
  }

  /** She flies in from afar, greets the player, gives the task and shows the way. */
  intro(firstStep: Vector3): Promise<void> {
    return this.queue(async () => {
      await this.fairy.arrive(this.playerPos.add(new Vector3(10, 14, 30)));
      this.sound.chime();
      this.fairy.pulse();
      await this.dialogue.say('valleyIntro');
      await this.dialogue.say(this.touch ? 'valleyControlsTouch' : 'valleyControls');
      await this.showWay(firstStep);
      this.introDone = true;
    });
  }

  /** She flies ahead a little, glows, and comes back. */
  private async showWay(point: Vector3): Promise<void> {
    await withTimeout(this.fairy.visit(point), 5);
    this.sound.chime();
    await wait(1.4);
    this.fairy.comeBack();
  }

  /** Force on a fog: the first time she explains, later she says one short line. */
  onPush(): void {
    this.fairy.pulse();
    if (this.pushTalk === 0) {
      void this.dialogue.say('valleyPushed', { interrupt: true }).then(() => this.teachBreath());
    } else {
      void this.dialogue.sayOne('valleyPushedAgain', this.pushTalk - 1, { interrupt: true });
    }
    this.pushTalk++;
  }

  private teachBreath(): void {
    if (this.taughtBreath) return;
    this.taughtBreath = true;
    void this.dialogue.say(this.touch ? 'valleyBreathKeysTouch' : 'valleyBreathKeys');
  }

  /** Exhaled light reached a fog for the first time. */
  onBreathHit(): void {
    if (this.praisedBreath) return;
    this.praisedBreath = true;
    if (!this.dialogue.busy) void this.dialogue.say('valleyBreathing');
  }

  /** A fog became light. She celebrates and shows the way on. */
  onRelease(index: number, next: Vector3): void {
    this.fairy.pulse();
    this.sound.release();
    void this.queue(async () => {
      await wait(1.2);
      await this.dialogue.say(index === 0 ? 'valleyReleased1' : 'valleyReleased2', { interrupt: true });
      await this.showWay(next);
    });
  }

  /** The bridge of light is being built. */
  onBridge(): Promise<void> {
    return this.queue(async () => {
      this.fairy.pulse();
      await this.dialogue.say('valleyBridge', { interrupt: true });
    });
  }

  onBridgeReady(): void {
    void this.queue(async () => {
      await this.dialogue.say('valleyBridgeReady');
    });
  }

  update(dt: number, playerPos: Vector3, fogs: ValleyFog[], points: number): void {
    this.playerPos.copyFrom(playerPos);
    this.fairy.update(dt, playerPos);
    if (!this.introDone || this.busy) return;

    // A fog comes into view: she flies to it and says what to try.
    for (let i = 0; i < fogs.length; i++) {
      const f = fogs[i]!;
      if (!f.active || this.shown.has(f.id)) continue;
      if (f.edgeDistance(playerPos.x, playerPos.z) > TUNING.valley.blockade.noticeRange) continue;
      this.shown.add(f.id);
      const point = f.center.add(new Vector3(0, 3.6, -1));
      void this.queue(async () => {
        await withTimeout(this.fairy.visit(point), 4);
        this.sound.chime();
        if (i === 0) {
          await this.dialogue.say('valleyFogFirst');
          await this.dialogue.say(this.touch ? 'valleyPushKeysTouch' : 'valleyPushKeys');
        } else {
          await this.dialogue.say('valleyFogSecond');
          // Someone who skipped pushing and breathing at the first fog still learns how to breathe.
          this.teachBreath();
        }
        this.fairy.comeBack();
      });
      return;
    }

    // At the chasm before there is enough light.
    const c = LAYOUT.chasm;
    if (points < LAYOUT.pointsForBridge && playerPos.z > c.z - c.halfWidth - 7 && !this.shown.has('chasm')) {
      this.shown.add('chasm');
      void this.queue(() => this.dialogue.say('valleyChasmEarly'));
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
