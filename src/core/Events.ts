/** All game events and their data. */
export interface GameEvents {
  /** The player pushed or struck a fog. */
  fogPushed: { id: string; first: boolean };
  /** The player came close to a fog for the first time. */
  fogMet: { id: string; x: number; z: number };
  /** Exhaled light reached a fog. */
  fogBreathed: { id: string; density: number };
  /** A fog dissolved. */
  blockadeReleased: { id: string; points: number; release: string; x: number; z: number };
  lightPointsChanged: { total: number; added: number };
  /** A zone finished loading or was removed. */
  zoneLoaded: { id: string };
  zoneUnloaded: { id: string };
  /** The player walked into a zone. */
  zoneEntered: { id: string };
  /** A plank of the light bridge appeared. */
  plankAdded: { index: number; count: number };
  bridgeWalkable: Record<string, never>;
  gateOpened: Record<string, never>;
  chapterComplete: { id: string };
  /** The fairy started or finished a line. */
  lineShown: { id: string; text: string };
}

type Handler<T> = (data: T) => void;

/** Tiny typed event bus. */
export class Events {
  private readonly handlers = new Map<keyof GameEvents, Handler<never>[]>();

  on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(fn as Handler<never>);
    this.handlers.set(type, list);
    return () => {
      const l = this.handlers.get(type);
      if (l) l.splice(l.indexOf(fn as Handler<never>), 1);
    };
  }

  emit<K extends keyof GameEvents>(type: K, data: GameEvents[K]): void {
    const list = this.handlers.get(type);
    if (!list) return;
    for (const fn of [...list]) (fn as Handler<GameEvents[K]>)(data);
  }
}
