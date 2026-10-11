import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { angleDelta, clamp, lerp } from '../core/Random';
import type { TownColliders } from '../outer/Colliders';
import type { CitizenDef } from '../outer/townLayout';
import { CitizenVisual } from './CitizenVisual';
import { Torch } from './Torch';
import type { SteamPool } from './Steam';

export interface CitizenContext {
  townAnger: number;
  playerX: number;
  playerZ: number;
  colliders: TownColliders;
  steam: SteamPool;
  others: readonly Citizen[];
  groundY: (x: number, z: number) => number;
}

/**
 * One townsperson (GAME_DESIGN 6.1). agitation = personalBase + townAnger * weight.
 * low: slow loops, stops, looks around, chats in pairs.
 * medium: stomps, fists, steam now and then, torch raised.
 * high: steam often, two citizens bump and shove apart, torch flares.
 * Never attacks the player: citizens step around the player.
 */
export class Citizen {
  readonly visual: CitizenVisual;
  x: number;
  z: number;
  agitation = 0;
  partner: Citizen | null = null;
  private readonly torch: Torch | null;
  private readonly loop: [number, number][];
  private target: number;
  private heading = 0;
  private speed = 0;
  private wait = 0;
  private steamTimer: number;
  private bumpCooldown = 0;
  private impulseX = 0;
  private impulseZ = 0;
  private time = 0;
  private readonly lead: boolean;
  private readonly tmp = new Vector3();

  constructor(
    scene: Scene,
    private readonly def: CitizenDef,
    index: number,
    loops: [number, number][][],
  ) {
    this.visual = new CitizenVisual(scene, def);
    this.loop = loops[def.loop]!;
    this.target = (def.start + 1) % this.loop.length;
    const p = this.loop[def.start]!;
    // Chat partners start side by side.
    const side = def.partner !== undefined && index > def.partner ? 0.8 : 0;
    this.x = p[0] + side;
    this.z = p[1];
    this.lead = def.partner === undefined || index < def.partner;
    this.steamTimer = 1 + def.seed * 0.37;
    this.wait = 1 + (def.seed % 3);
    this.torch = def.torch ? new Torch(scene, this.visual.torchMount) : null;
  }

  update(dt: number, ctx: CitizenContext): void {
    const T = TUNING.citizens;
    this.time += dt;
    const want = clamp(this.def.personalBase + ctx.townAnger * T.agitationWeight, 0, 1);
    this.agitation += (want - this.agitation) * Math.min(1, dt * T.smooth);
    const a = this.agitation;
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);

    // Where to go.
    let tx = this.x;
    let tz = this.z;
    let moving = false;
    const partner = this.partner;
    const following = partner !== null && !this.lead;
    if (following) {
      const dx = partner.x - this.x;
      const dz = partner.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.1) {
        tx = partner.x - (dx / d) * 0.8;
        tz = partner.z - (dz / d) * 0.8;
        moving = true;
      } else {
        // Chatting: face the partner.
        this.turnTo(Math.atan2(dx, dz), dt, 6);
      }
    } else if (this.wait > 0) {
      this.wait -= dt;
      // Look around while waiting. Chat partners face each other instead.
      if (partner && a < T.mediumAbove) {
        this.turnTo(Math.atan2(partner.x - this.x, partner.z - this.z), dt, 6);
      } else {
        this.heading += Math.sin(this.time * 0.9 + this.def.seed) * dt * (0.5 + a * 2);
      }
      if (this.wait <= 0) this.target = (this.target + 1) % this.loop.length;
    } else {
      const w = this.loop[this.target]!;
      tx = w[0];
      tz = w[1];
      moving = true;
      if (Math.hypot(tx - this.x, tz - this.z) < 0.5) {
        this.wait = lerp(T.waitCalm, T.waitAngry, a) * (0.7 + (this.def.seed % 4) * 0.2);
        moving = false;
      }
    }

    // Speed and heading.
    const topSpeed = lerp(T.walkSpeedLow, T.walkSpeedHigh, a);
    let wantSpeed = 0;
    if (moving) {
      const dx = tx - this.x;
      const dz = tz - this.z;
      const d = Math.hypot(dx, dz);
      wantSpeed = topSpeed * clamp(d / 0.8, 0.3, 1);
      if (following) wantSpeed = Math.min(topSpeed * 1.2, wantSpeed * 1.4);
      this.turnTo(Math.atan2(dx, dz), dt, 5);
    }
    this.speed += (wantSpeed - this.speed) * Math.min(1, dt * 4);

    // Move with the walk plus the shove impulse.
    let vx = Math.sin(this.heading) * this.speed + this.impulseX;
    let vz = Math.cos(this.heading) * this.speed + this.impulseZ;
    const decay = Math.exp(-dt * 3);
    this.impulseX *= decay;
    this.impulseZ *= decay;

    // Soft avoidance of the player and of each other. Never a push on the player.
    const avoidP = T.playerAvoid;
    let dx = this.x - ctx.playerX;
    let dz = this.z - ctx.playerZ;
    let d = Math.hypot(dx, dz);
    if (d < avoidP && d > 0.001) {
      const k = (1 - d / avoidP) * 2.2;
      vx += (dx / d) * k;
      vz += (dz / d) * k;
    }
    for (const o of ctx.others) {
      if (o === this) continue;
      dx = this.x - o.x;
      dz = this.z - o.z;
      d = Math.hypot(dx, dz);
      const min = T.radius * 2.2;
      if (d < min && d > 0.001) {
        vx += (dx / d) * (1 - d / min) * 1.5;
        vz += (dz / d) * (1 - d / min) * 1.5;
      }
      // Bump: both agitated, close, off cooldown. They shove apart, no harm.
      if (d < T.bumpDistance && this.agitation > T.bumpAbove && o.agitation > T.bumpAbove && this.bumpCooldown <= 0 && o.bumpCooldown <= 0) {
        this.bumpCooldown = o.bumpCooldown = T.bumpCooldown;
        const nx = dx / (d || 1);
        const nz = dz / (d || 1);
        this.impulseX += nx * T.bumpShove;
        this.impulseZ += nz * T.bumpShove;
        o.impulseX -= nx * T.bumpShove;
        o.impulseZ -= nz * T.bumpShove;
        ctx.steam.puff(this.tmp.set(this.x, ctx.groundY(this.x, this.z) + 1.4, this.z), 1);
        this.steamTimer = 0.2;
      }
    }

    const nx = this.x + vx * dt;
    const nz = this.z + vz * dt;
    const [rx, rz] = ctx.colliders.resolve(this.x, this.z, nx, nz, T.radius);
    const real = Math.hypot(rx - this.x, rz - this.z) / Math.max(dt, 1e-4);
    this.x = rx;
    this.z = rz;
    // Blocked by something: skip to the next waypoint soon.
    if (moving && !following && real < wantSpeed * 0.2 && wantSpeed > 0.3) this.wait = 0.01;

    // Distance to the player decides detail.
    const far = Math.hypot(this.x - ctx.playerX, this.z - ctx.playerZ) > T.lodDistance;
    const y = ctx.groundY(this.x, this.z);
    this.visual.root.position.set(this.x, y, this.z);
    const shownSpeed = Math.min(this.speed, Math.hypot(vx, vz));
    this.visual.update(dt, { speed: shownSpeed, heading: this.heading, agitation: a, far, torchRaised: this.torch !== null && a > T.mediumAbove * 0.6 });

    // Steam: now and then at medium, often at high.
    if (a > T.mediumAbove) {
      this.steamTimer -= dt;
      if (this.steamTimer <= 0) {
        const high = a > T.highAbove;
        this.steamTimer = (high ? T.steamIntervalHigh : T.steamIntervalMedium) * (0.7 + ((this.def.seed * 7 + Math.floor(this.time)) % 5) * 0.12);
        ctx.steam.puff(this.tmp.set(this.x, y + 1.45, this.z), clamp((a - T.mediumAbove) / (1 - T.mediumAbove) + 0.2, 0.2, 1));
      }
    } else {
      this.steamTimer = Math.max(this.steamTimer, 1);
    }

    if (this.torch) {
      this.torch.setIntensity(a);
      if (!far) this.torch.update(dt);
    }
  }

  private turnTo(angle: number, dt: number, rate: number): void {
    this.heading += angleDelta(this.heading, angle) * Math.min(1, dt * rate);
  }

  dispose(): void {
    this.torch?.dispose();
    this.visual.dispose();
  }
}
