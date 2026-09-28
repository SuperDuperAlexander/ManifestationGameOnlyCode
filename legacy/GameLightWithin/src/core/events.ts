import type { SceneId } from '../content/chapter1';
import type { BodyPoint, FeelingType } from '../content/chapter2';

/** Every event the systems use to talk to each other. */
export interface GameEvents {
  breathStarted: void;
  breathCompleted: { calm: boolean; inhale: number; exhale: number };
  calmChanged: { value: number };
  lightChanged: { value: number; delta: number };
  lightCollected: { from: 'spring' | 'fog'; amount: number };
  springRevealed: { id: string };
  springEmptied: { id: string };
  zoneAdded: { x: number; z: number; radius: number };
  fogStepChanged: { step: 0 | 1 | 2 | 3 | 4 };
  fogFled: { count: number; growth: number };
  fogPushed: { count: number; extraBreaths: number };
  fogDissolved: void;
  seedPlanted: { kind: 'heart' | 'mind' };
  seedGrowthChanged: { progress: number; paused: boolean };
  bridgeComplete: void;
  thanksProgress: { breaths: number };
  thanksComplete: void;
  globalColorChanged: { value: number };
  sceneChanged: { scene: SceneId };
  hintShown: { id: 'bird' | 'butterfly' };
  chapterComplete: void;
  /** Chapter 2: the feeling weather, the body stones and the sound breath. */
  weatherNamed: { type: FeelingType; correct: boolean };
  weatherIntensity: { type: FeelingType; value: number };
  weatherDissolved: { type: FeelingType };
  bodyStoneProgress: { point: BodyPoint; breaths: number };
  bodyPointLit: { point: BodyPoint };
  soundBreathTone: { hz: number; index: number };
  stormStepChanged: { step: 0 | 1 | 2 | 3 | 4 | 5 };
  lightWellGave: { amount: number };
  nightFell: void;
  /** The guide has started saying something. */
  guideSpoke: { id: string };
  /** Sound-only cue requests. */
  cue: { id: CueId };
}

export type CueId =
  | 'calmBreath'
  | 'soundBreath'
  | 'stoneHum'
  | 'stoneLit'
  | 'rain'
  | 'thunder'
  | 'whisper'
  | 'rainbow'
  | 'night'
  | 'spring'
  | 'mote'
  | 'push'
  | 'fogEnter'
  | 'fogExit'
  | 'seedGrow'
  | 'bridgeDone'
  | 'thanks'
  | 'uiSelect';

export type EventName = keyof GameEvents;
type Handler<K extends EventName> = (payload: GameEvents[K]) => void;

/**
 * A small typed event bus. It has no Three.js dependency so systems stay testable.
 */
export class EventBus {
  private readonly handlers = new Map<EventName, Set<(p: never) => void>>();

  on<K extends EventName>(name: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler as (p: never) => void);
    return () => this.off(name, handler);
  }

  once<K extends EventName>(name: K, handler: Handler<K>): () => void {
    const off = this.on(name, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends EventName>(name: K, handler: Handler<K>): void {
    this.handlers.get(name)?.delete(handler as (p: never) => void);
  }

  emit<K extends EventName>(...args: GameEvents[K] extends void ? [K] : [K, GameEvents[K]]): void {
    const [name, payload] = args as [K, GameEvents[K]];
    const set = this.handlers.get(name);
    if (!set) return;
    for (const handler of [...set]) {
      (handler as Handler<K>)(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
