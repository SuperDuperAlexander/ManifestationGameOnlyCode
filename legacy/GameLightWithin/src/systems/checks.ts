import { loadChecks, saveChecks } from '../core/save';
import type { LearningChecks } from '../core/save';
import type { SceneId } from '../content/chapter1';

/** How often batched changes are written to storage, in seconds. */
const WRITE_EVERY_SECONDS = 5;

/**
 * Hidden learning checks. Stored on this device only and shown in the debug
 * panel. Nothing is ever sent anywhere.
 */
export class ChecksSystem {
  readonly data: LearningChecks;
  private currentScene: SceneId = 1;
  private sceneClock = 0;
  /** True when something changed that has not reached storage yet. */
  private dirty = false;
  private sinceWrite = 0;

  constructor(private readonly chapter: 1 | 2 = 1) {
    this.data = loadChecks();
  }

  reset(): void {
    this.data.stoppedWithoutHint = false;
    this.data.pushCount = 0;
    this.data.leftFogCount = 0;
    this.data.walkedAwayFromSeed = false;
    this.data.timePerScene = {};
    this.data.receivedWithoutSign = false;
    this.data.bodyCheckTime = 0;
    this.data.ranFromCloudCount = 0;
    this.data.namingAttempts = { sadness: 0, anger: 0, worry: 0 };
    this.data.soundBreathCount = 0;
    this.data.leftStormCount = 0;
    this.data.seedTypesPlanted = [];
    this.data.heartSeedFirstTry = false;
    this.sceneClock = 0;
    this.dirty = true;
    this.persist();
  }

  enterScene(scene: SceneId): void {
    this.flushScene();
    this.currentScene = scene;
    this.sceneClock = 0;
  }

  update(dt: number): void {
    this.sceneClock += dt;
    this.sinceWrite += dt;
    // Writing on every change means a storage write per breath. Batching keeps
    // the data safe without touching storage in the middle of the frame.
    if (this.dirty && this.sinceWrite >= WRITE_EVERY_SECONDS) this.persist();
  }

  flushScene(): void {
    if (this.sceneClock > 0) {
      const prev = this.data.timePerScene[this.currentScene] ?? 0;
      this.data.timePerScene[this.currentScene] = Math.round((prev + this.sceneClock) * 10) / 10;
      this.sceneClock = 0;
      this.dirty = true;
    }
    // A scene can end with no time on the clock, for example on a scene jump.
    // Anything still only in memory has to reach storage all the same.
    if (this.dirty) this.persist();
  }

  set<K extends keyof LearningChecks>(key: K, value: LearningChecks[K]): void {
    if (this.data[key] === value) return;
    this.data[key] = value;
    this.dirty = true;
  }

  /** Writes now, whatever the timer says. */
  persist(): void {
    saveChecks(this.data);
    this.dirty = false;
    this.sinceWrite = 0;
  }

  /** True when a change is still only in memory. */
  get hasUnsaved(): boolean {
    return this.dirty;
  }

  /** Builds the JSON the debug "Export results" button downloads. */
  toJson(): string {
    this.flushScene();
    return JSON.stringify(
      { chapter: this.chapter, recordedAt: new Date().toISOString(), checks: this.data },
      null,
      2,
    );
  }
}
