import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TUNING } from '../config/tuning';
import type { InputManager } from '../core/InputManager';
import { angleDelta, damp } from '../core/Random';
import type { Walkability } from '../world/Walkability';

/**
 * Calm walking: smooth acceleration, no jumping. The camera never turns,
 * so "up" on the keyboard is always north on screen.
 */
export class PlayerController {
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  /** Where the player wants to walk (input direction, length 0..1). */
  readonly intent = new Vector3();
  heading = 0;
  /** Scales the walk speed (1 = normal). Breathing slows the walk a little. */
  speedFactor = 1;
  /** When false, the player stands still (intro, transitions). */
  canMove = true;

  constructor(
    private readonly input: InputManager,
    private readonly walk: Walkability,
  ) {}

  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  get speedRatio(): number {
    return Math.min(1, this.speed / TUNING.player.walkSpeed);
  }

  teleport(x: number, z: number): void {
    this.position.set(x, 0, z);
    this.velocity.set(0, 0, 0);
  }

  update(dt: number): void {
    const t = TUNING.player;
    const ix = this.canMove ? this.input.moveX : 0;
    const iz = this.canMove ? this.input.moveY : 0;
    const max = t.walkSpeed * this.speedFactor;
    const tx = ix * max;
    const tz = iz * max;
    const wants = ix !== 0 || iz !== 0;
    this.intent.set(ix, 0, iz);
    const k = damp(wants ? t.acceleration : t.deceleration, dt);
    this.velocity.x += (tx - this.velocity.x) * k;
    this.velocity.z += (tz - this.velocity.z) * k;
    if (!wants && this.speed < 0.02) this.velocity.set(0, 0, 0);

    const nx = this.position.x + this.velocity.x * dt;
    const nz = this.position.z + this.velocity.z * dt;
    const [rx, rz] = this.walk.resolve(this.position.x, this.position.z, nx, nz, t.radius);
    // Blocked movement loses its speed, so the figure does not "run on the spot".
    if (dt > 0) {
      this.velocity.x = (rx - this.position.x) / dt;
      this.velocity.z = (rz - this.position.z) / dt;
    }
    this.position.x = rx;
    this.position.z = rz;

    if (wants) {
      const target = Math.atan2(ix, iz);
      this.heading += angleDelta(this.heading, target) * damp(t.turnSharpness, dt);
    }
  }
}
