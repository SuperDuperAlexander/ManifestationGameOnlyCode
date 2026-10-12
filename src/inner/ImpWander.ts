import { TUNING } from '../config/tuning';
import { clamp, damp } from '../core/Random';

/** What the wanderer needs to know about the world. */
export interface WanderWorld {
  /** True if the imp may stand at (x, z) (not water, not off the walkable ground). */
  walkable(x: number, z: number): boolean;
  /** Circles to keep out of (the Inner Tree trunk). */
  obstacles: { x: number; z: number; radius: number }[];
}

function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/**
 * Slow, calm wandering of the Anger Imp inside its clearing: walk to a spot, pause, turn, walk on.
 * When the player is near it faces the player. It never leaves the clearing circle and never
 * walks into the Inner Tree, water or the player. No Babylon objects: the caller applies x, z, heading.
 */
export class ImpWander {
  x: number;
  z: number;
  heading: number;
  /** 0..1 how fast it walks right now (for the waddle). */
  walkAmount = 0;
  private speed = 0;
  private pause: number;
  private target: { x: number; z: number } | null = null;

  constructor(
    private readonly cx: number,
    private readonly cz: number,
    heading: number,
    private readonly world: WanderWorld,
  ) {
    this.x = cx;
    this.z = cz;
    this.heading = heading;
    this.pause = 1.5;
  }

  private inside(x: number, z: number, bodyR: number): boolean {
    const W = TUNING.imp.wander;
    if (Math.hypot(x - this.cx, z - this.cz) > W.radius) return false;
    for (const o of this.world.obstacles) {
      if (Math.hypot(x - o.x, z - o.z) < o.radius + bodyR + W.treeMargin) return false;
    }
    return this.world.walkable(x, z);
  }

  private pickTarget(bodyR: number): void {
    const W = TUNING.imp.wander;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * W.radius * 0.9;
      const x = this.cx + Math.cos(a) * r;
      const z = this.cz + Math.sin(a) * r;
      // Walk a decent stretch, not a tiny shuffle.
      if (Math.hypot(x - this.x, z - this.z) < W.radius * 0.35) continue;
      if (this.inside(x, z, bodyR)) {
        this.target = { x, z };
        return;
      }
    }
    this.target = null;
  }

  /**
   * @param frozen true while it must stand still (breathing with the imp, calming).
   * @param player player position (x, z) and whether it counts as near (impSeeRadius).
   */
  update(dt: number, frozen: boolean, bodyR: number, playerX: number, playerZ: number, playerNear: boolean): void {
    const W = TUNING.imp.wander;
    let wantSpeed = 0;
    let moveDir = this.heading;
    if (!frozen) {
      if (this.pause > 0) {
        this.pause -= dt;
        if (this.pause <= 0) this.pickTarget(bodyR);
        if (this.pause <= 0 && !this.target) this.pause = 1.5;
      }
      if (this.pause <= 0 && this.target) {
        const dx = this.target.x - this.x;
        const dz = this.target.z - this.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.4) {
          this.target = null;
          this.pause = W.pauseS[0]! + Math.random() * (W.pauseS[1]! - W.pauseS[0]!);
        } else {
          moveDir = Math.atan2(dx, dz);
          wantSpeed = W.speed;
        }
      }
    }

    // Heading: face the player when near, else face where it walks.
    let wantHeading = this.heading;
    if (playerNear) wantHeading = Math.atan2(playerX - this.x, playerZ - this.z);
    else if (wantSpeed > 0) wantHeading = moveDir;
    const turn = angleDiff(wantHeading, this.heading);
    this.heading += clamp(turn, -W.turnRate * dt, W.turnRate * dt);

    // When it walks without facing its way, wait until it has turned roughly toward the target.
    if (wantSpeed > 0 && !playerNear && Math.abs(angleDiff(moveDir, this.heading)) > 0.6) wantSpeed = 0;

    this.speed += (wantSpeed - this.speed) * damp(W.accel, dt);
    if (this.speed < 0.01 && wantSpeed === 0) this.speed = 0;
    if (this.speed > 0) {
      const nx = this.x + Math.sin(moveDir) * this.speed * dt;
      const nz = this.z + Math.cos(moveDir) * this.speed * dt;
      const pd = Math.hypot(nx - playerX, nz - playerZ);
      const pd0 = Math.hypot(this.x - playerX, this.z - playerZ);
      const tooClose = pd < bodyR + W.playerMargin + 0.8 && pd < pd0;
      if (this.inside(nx, nz, bodyR) && !tooClose) {
        this.x = nx;
        this.z = nz;
      } else {
        // Blocked: stop and rest, then choose another way.
        this.speed = 0;
        this.target = null;
        this.pause = 1 + Math.random() * 2;
      }
    }
    this.walkAmount = clamp(this.speed / W.speed, 0, 1);
  }
}
