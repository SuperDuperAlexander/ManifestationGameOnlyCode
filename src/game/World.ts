import type { BreathSystem } from '../player/BreathSystem';
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
  /** Breath state of the player ('idle' | 'inhale' | 'exhale'). Breathing lets Thought Waves pass. */
  breathState(): string;
  /** The player's breath (for the guide ring). */
  breathSystem(): BreathSystem;
  /** Called when the player finishes a whole breath (also for the test hook). */
  onBreathDone(cb: () => void): void;
  /** Counts one full good breath without input (test hook). */
  simulateBreath(): void;
  /** Moves the player by (dx, dz) metres over a short time, never into walls or water. */
  shove(dx: number, dz: number): void;
  /** Walk speed times `factor` for `seconds` (a hit by a Thought Wave). */
  slow(factor: number, seconds: number): void;
  /** Puts the player at (x, z). */
  teleport(x: number, z: number): void;
  /** Values for the debug overlay. */
  debugInfo(): Record<string, string | number>;
}
