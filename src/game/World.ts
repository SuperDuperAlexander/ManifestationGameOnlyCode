import type { Camera, Scene, Vector3 } from '@babylonjs/core';

/** Which of the two worlds is shown. */
export type WorldId = 'outer' | 'inner';

/**
 * One world = one Babylon Scene on the shared Engine (GAME_DESIGN.md 5).
 * Game renders and updates only the active world.
 */
export interface World {
  readonly id: WorldId;
  readonly scene: Scene;
  /** The world's camera (the Look Within transition moves it). */
  readonly camera: Camera;
  /** Called every frame while this world is active. dt in seconds. */
  update(dt: number): void;
  /** Player feet position in this world. */
  playerPosition(): Vector3;
  /** World position of the gold diamond on the player's back (Look Within camera target). */
  diamondPosition(): Vector3;
  /** Freeze or resume input, player and camera (used during the transition and while hidden). */
  setActive(active: boolean): void;
  /** Values for the debug overlay. */
  debugInfo(): Record<string, string | number>;
}
