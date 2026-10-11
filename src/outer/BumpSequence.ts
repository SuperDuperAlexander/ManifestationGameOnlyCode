import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { CitizenVisual } from '../npc/CitizenVisual';
import { TOWN, type CitizenDef } from './townLayout';
import { walkHeight } from './townTerrain';

export const STRANGER_DEF: CitizenDef = {
  colors: 'muted', head: 'cap', beard: false, torch: false,
  personalBase: 0, loop: 0, start: 0, scale: 1.02, seed: 20,
};

type Phase = 'idle' | 'toPlayer' | 'stagger' | 'away' | 'done';

/**
 * The bump (GAME_DESIGN 9 beat 3): the stranger runs in from the square, hits the player
 * (small shove, no harm) and runs into the alley. The player keeps control all the time.
 */
export class BumpSequence {
  readonly stranger: CitizenVisual;
  /** Unit direction from the stranger to the player at the hit (valid after onImpact). */
  readonly impactDir = { x: 0, z: -1 };
  private phase: Phase = 'idle';
  private x = 0;
  private z = 0;
  private heading = 0;
  private wp = 0;
  private wait = 0;
  private onImpact: () => void = () => {};
  private onDone: () => void = () => {};

  constructor(
    scene: Scene,
    private readonly getPlayer: () => { x: number; z: number },
  ) {
    this.stranger = new CitizenVisual(scene, STRANGER_DEF);
    this.stranger.root.setEnabled(false);
  }

  get triggered(): boolean {
    return this.phase !== 'idle';
  }

  get running(): boolean {
    return this.phase !== 'idle' && this.phase !== 'done';
  }

  /** True once the player has crossed the trigger line on Main Street (and the bump has not started). */
  bumpTriggerReached(playerPos: { x: number; z: number }): boolean {
    return this.phase === 'idle' && playerPos.z >= TOWN.bump.triggerZ && Math.abs(playerPos.x) < TOWN.bump.halfX;
  }

  start(onImpact: () => void, onDone: () => void): void {
    if (this.phase !== 'idle') return;
    this.onImpact = onImpact;
    this.onDone = onDone;
    this.x = TOWN.bump.spawn.x;
    this.z = TOWN.bump.spawn.z;
    this.wp = 0;
    this.phase = 'toPlayer';
    this.stranger.root.setEnabled(true);
    this.place(0, 0);
  }

  update(dt: number): void {
    if (!this.running) return;
    const S = TUNING.story;
    let speed = 0;
    if (this.phase === 'toPlayer') {
      const p = this.getPlayer();
      const dx = p.x - this.x;
      const dz = p.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < S.bumpImpactDist) {
        this.impactDir.x = dx / Math.max(d, 1e-3);
        this.impactDir.z = dz / Math.max(d, 1e-3);
        this.phase = 'stagger';
        this.wait = S.strangerStaggerS;
        this.onImpact();
      } else {
        this.heading = Math.atan2(dx, dz);
        speed = S.strangerRunSpeed;
        this.step(dt, speed);
      }
    } else if (this.phase === 'stagger') {
      this.wait -= dt;
      if (this.wait <= 0) this.phase = 'away';
    } else if (this.phase === 'away') {
      const w = TOWN.bump.path[this.wp]!;
      const dx = w[0] - this.x;
      const dz = w[1] - this.z;
      if (Math.hypot(dx, dz) < 0.5) {
        this.wp++;
        if (this.wp >= TOWN.bump.path.length) {
          this.phase = 'done';
          this.stranger.root.setEnabled(false);
          this.onDone();
          return;
        }
      } else {
        const da = Math.atan2(Math.sin(Math.atan2(dx, dz) - this.heading), Math.cos(Math.atan2(dx, dz) - this.heading));
        this.heading += da * Math.min(1, dt * 12);
        speed = S.strangerRunSpeed;
        this.step(dt, speed);
      }
    }
    this.place(dt, speed);
  }

  private step(dt: number, speed: number): void {
    this.x += Math.sin(this.heading) * speed * dt;
    this.z += Math.cos(this.heading) * speed * dt;
  }

  private place(dt: number, speed: number): void {
    this.stranger.root.position.set(this.x, walkHeight(this.x, this.z), this.z);
    this.stranger.update(dt, { speed, heading: this.heading, agitation: 0.1, far: false, torchRaised: false });
  }
}
