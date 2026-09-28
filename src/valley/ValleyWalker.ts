import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TUNING } from '../config/tuning';
import type { InputManager } from '../core/InputManager';
import { angleDelta, damp } from '../core/Random';
import type { Collider } from './ValleyProps';

/** What the walker needs to know about the ground. */
export interface WalkGround {
  /** Height where the player can stand, or null where they cannot (water, chasm). */
  groundAt(x: number, z: number): number | null;
  /** True on a bridge deck: no slope limit there. */
  onDeck(x: number, z: number): boolean;
}

/**
 * Free walking in every direction. "Forward" is where the camera looks.
 * Steep cliffs, water, the chasm and solid things stop the player softly:
 * the figure slides along them.
 */
export class ValleyWalker {
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  heading = 0;
  /** Scales the walk speed (1 = normal). Breathing slows the walk a little. */
  speedFactor = 1;
  canMove = true;

  constructor(
    private readonly input: InputManager,
    private readonly ground: WalkGround,
    private readonly colliders: Collider[],
  ) {}

  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  get speedRatio(): number {
    return Math.min(1, this.speed / TUNING.valley.walkSpeed);
  }

  place(x: number, z: number, heading: number): void {
    this.position.set(x, this.ground.groundAt(x, z) ?? 0, z);
    this.velocity.set(0, 0, 0);
    this.heading = heading;
  }

  /** `cameraYaw`: the direction the camera looks (0 = north). */
  update(dt: number, cameraYaw: number): void {
    const t = TUNING.player;
    const ix = this.canMove ? this.input.moveX : 0;
    const iz = this.canMove ? this.input.moveY : 0;
    const wants = ix !== 0 || iz !== 0;
    // Input turned into the camera's view: up = away from the camera.
    const fx = Math.sin(cameraYaw);
    const fz = Math.cos(cameraYaw);
    const dirX = fx * iz + fz * ix;
    const dirZ = fz * iz - fx * ix;
    const max = TUNING.valley.walkSpeed * this.speedFactor;
    const k = damp(wants ? t.acceleration : t.deceleration, dt);
    this.velocity.x += (dirX * max - this.velocity.x) * k;
    this.velocity.z += (dirZ * max - this.velocity.z) * k;
    if (!wants && this.speed < 0.02) this.velocity.set(0, 0, 0);

    const ox = this.position.x;
    const oz = this.position.z;
    let nx = ox + this.velocity.x * dt;
    let nz = oz + this.velocity.z * dt;
    // Try the full step, then slide along x or z alone.
    if (!this.canStand(ox, oz, nx, nz)) {
      if (this.canStand(ox, oz, nx, oz)) nz = oz;
      else if (this.canStand(ox, oz, ox, nz)) nx = ox;
      else {
        nx = ox;
        nz = oz;
      }
    }
    const [px, pz] = this.pushOut(nx, nz);
    // Being pushed out of something must never put the player into water or the chasm.
    if (this.ground.groundAt(px, pz) !== null) {
      nx = px;
      nz = pz;
    }
    if (dt > 0) {
      this.velocity.x = (nx - ox) / dt;
      this.velocity.z = (nz - oz) / dt;
    }
    this.position.x = nx;
    this.position.z = nz;
    // Follow the ground smoothly (no jitter on small bumps).
    const gy = this.ground.groundAt(nx, nz) ?? this.position.y;
    this.position.y += (gy - this.position.y) * damp(18, dt);

    if (wants && this.speed > 0.05) {
      const target = Math.atan2(this.velocity.x, this.velocity.z);
      this.heading += angleDelta(this.heading, target) * damp(t.turnSharpness, dt);
    }
  }

  private canStand(ox: number, oz: number, x: number, z: number): boolean {
    const g = this.ground.groundAt(x, z);
    if (g === null) return false;
    if (this.ground.onDeck(x, z) || this.ground.onDeck(ox, oz)) return true;
    const rise = g - (this.ground.groundAt(ox, oz) ?? g);
    const run = Math.hypot(x - ox, z - oz);
    // Walking down is always fine. Walking up only where it is not too steep.
    return rise <= 0 || run === 0 || rise / run <= TUNING.valley.maxSlope;
  }

  private pushOut(x: number, z: number): [number, number] {
    const r = TUNING.player.radius;
    for (const c of this.colliders) {
      if (c.active === false) continue;
      const dx = x - c.x;
      const dz = z - c.z;
      const min = c.radius + r;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        x = c.x + (dx / d) * min;
        z = c.z + (dz / d) * min;
      }
    }
    return [x, z];
  }
}
