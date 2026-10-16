import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TUNING } from '../config/tuning';
import { clamp01, smoothstep, lerp } from '../core/Random';
import type { WaveLook } from './waveShader';

export type WaveState = 'drifting' | 'returning' | 'passing' | 'pushed' | 'hit' | 'gone';

/** What a wave tells the field when it reaches the player. */
export interface WaveHooks {
  passed(w: ThoughtWave): void;
  hit(w: ThoughtWave): void;
}

const PUSHED_TIME = 0.8;
const HIT_TIME = 1.5;
const FADE_IN = 1.2;

/** One Thought Wave (GAME_DESIGN 7.3). Logic and look; the mesh is owned by the WaveField. */
export class ThoughtWave {
  private static nextPushCueId = 1;
  pushCueId = ThoughtWave.nextPushCueId++;
  state: WaveState = 'gone';
  x = 0;
  y = 0;
  z = 0;
  dirX = 0;
  dirZ = 1;
  speed: number = TUNING.waves.speed;
  scale = 1;
  readonly look: WaveLook = { alpha: 0, split: 0, flash: 0, textAlpha: 0, fire: 0 };
  private stateTime = 0;
  private age = 0;
  private baseScale = 1;
  fromImp = false;

  constructor(readonly mesh: Mesh) {
    mesh.setEnabled(false);
  }

  get alive(): boolean {
    return this.state !== 'gone';
  }


  /** True while the wave can still be pushed or can still touch the player. */
  get approaching(): boolean {
    return this.state === 'drifting' || this.state === 'returning';
  }

  spawn(x: number, y: number, z: number, targetX: number, targetZ: number, scale: number, speed: number, state: WaveState, fromImp = false): void {
    this.pushCueId = ThoughtWave.nextPushCueId++;
    this.x = x;
    this.y = y;
    this.z = z;
    this.aimAt(targetX, targetZ);
    this.baseScale = scale;
    this.scale = scale;
    this.speed = speed;
    this.age = 0;
    this.fromImp = fromImp;
    this.enter(state);
    this.look.alpha = 0;
    this.look.split = 0;
    this.look.flash = 0;
    this.look.textAlpha = 0;
    this.look.fire = fromImp ? 1 : 0;
    this.mesh.setEnabled(true);
  }

  push(): void {
    if (!this.approaching) return;
    this.enter('pushed');
  }

  /** Fade out without touching anger (anger is gone, or the wave got old). */
  dissolve(): void {
    if (this.approaching) this.enter('passing');
  }

  private enter(s: WaveState): void {
    this.state = s;
    this.stateTime = 0;
  }

  private aimAt(tx: number, tz: number): void {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4) {
      this.dirX = dx / d;
      this.dirZ = dz / d;
    }
  }

  /** Width in metres of the whole ribbon at the current size. */
  get width(): number {
    return TUNING.waves.width * this.scale;
  }

  update(dt: number, px: number, py: number, pz: number, breathing: boolean, hooks: WaveHooks): void {
    if (this.state === 'gone') return;
    this.stateTime += dt;
    this.age += dt;
    const L = this.look;
    const dist = Math.hypot(px - this.x, pz - this.z);

    switch (this.state) {
      case 'drifting':
      case 'returning': {
        const reach = this.width * TUNING.waves.reachFactor;
        // Aim at the player until close, then drift straight on and past.
        if (dist > reach * 2.5) this.aimAt(px, pz);
        this.move(dt, 1);
        const F = TUNING.waves.fromImp;
        const fire = this.fromImp ? 1 - smoothstep(0, F.fireS, this.age) : 0;
        const fade = clamp01(this.age / (this.fromImp ? F.fadeInS : FADE_IN));
        L.alpha = fade;
        L.textAlpha = fade * (1 - fire);
        L.fire = fire;
        L.split = 0;
        L.flash = 0;
        if (dist < reach) {
          if (breathing) {
            this.enter('passing');
            hooks.passed(this);
          } else {
            this.enter('hit');
            hooks.hit(this);
          }
        } else if (this.age > TUNING.waves.maxAge || dist > TUNING.waves.spawnDistance * 2) {
          this.dissolve();
        }
        break;
      }
      case 'passing': {
        const t = clamp01(this.stateTime / TUNING.waves.passTime);
        this.move(dt, 0.7);
        L.split = smoothstep(0, 0.8, t);
        L.textAlpha = Math.min(L.textAlpha, 1 - smoothstep(0, 0.45, t));
        L.alpha = Math.min(L.alpha, 1 - smoothstep(0.3, 1, t));
        L.flash = 0;
        if (t >= 1) this.kill();
        break;
      }
      case 'pushed': {
        const t = clamp01(this.stateTime / PUSHED_TIME);
        // Burst away from the player.
        let ax = this.x - px;
        let az = this.z - pz;
        const d = Math.hypot(ax, az) || 1;
        ax /= d;
        az /= d;
        const burst = 9 * (1 - t) + 1;
        this.x += ax * burst * dt;
        this.z += az * burst * dt;
        this.scale = this.baseScale * (1 + 0.5 * smoothstep(0, 1, t));
        L.flash = 1 - smoothstep(0, 0.65, t);
        L.fire = Math.min(L.fire, 1 - smoothstep(0, 0.3, t));
        L.alpha = 1 - smoothstep(0.35, 1, t);
        L.textAlpha = 1 - smoothstep(0, 0.4, t);
        L.split = 0;
        if (t >= 1) this.kill();
        break;
      }
      case 'hit': {
        const t = clamp01(this.stateTime / HIT_TIME);
        this.move(dt, 0.8);
        L.alpha = 1 - smoothstep(0.35, 1, t);
        L.textAlpha = 1 - smoothstep(0, 0.6, t);
        L.split = 0;
        L.flash = 0;
        if (t >= 1) this.kill();
        break;
      }
    }

    // A wave from the imp starts at mouth height and sinks slowly to the player's height.
    const sink = this.fromImp ? 2 * smoothstep(0.4, TUNING.waves.fromImp.fireS + 1, this.age) : 2;
    this.y += (py + 1.2 - this.y) * Math.min(1, dt * sink);
    this.apply();
  }

  private move(dt: number, k: number): void {
    this.x += this.dirX * this.speed * k * dt;
    this.z += this.dirZ * this.speed * k * dt;
  }

  private kill(): void {
    this.state = 'gone';
    this.mesh.setEnabled(false);
  }

  private apply(): void {
    const F = TUNING.waves.fromImp;
    const grow = this.fromImp ? lerp(F.startScale, 1, smoothstep(0, F.growS, this.age)) : 1;
    const W = TUNING.waves.width * this.scale * grow;
    const H = TUNING.waves.height * this.scale * grow;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.scaling.set(W, H, W);
  }
}
