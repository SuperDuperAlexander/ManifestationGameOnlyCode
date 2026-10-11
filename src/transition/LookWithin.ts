import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PALETTE } from '../config/palette';
import { TUNING } from '../config/tuning';
import type { World } from '../game/World';

const smooth = (t: number): number => t * t * (3 - 2 * t);
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/**
 * Look Within (GAME_DESIGN 4.2): camera moves in toward the diamond, a gold bloom fills the
 * screen, the world switches, the bloom fades and the camera moves back out in the other world.
 * The hidden world is simply frozen, so position and camera angle stay as they were.
 */
export class LookWithin {
  private readonly bloom: HTMLDivElement;
  private t = -1;
  private switched = false;
  private from!: World;
  private to!: World;
  private readonly pos0 = new Vector3();
  private readonly tgt0 = new Vector3();
  private readonly rot0 = new Vector3();
  private readonly tmp = new Vector3();

  constructor(
    parent: HTMLElement,
    /** Called at the middle of the transition, when the shown world changes. */
    private readonly onSwitch: (to: World) => void,
    /** Called every frame after the camera was moved (shared uniforms follow the camera). */
    private readonly onCamera: (world: World) => void,
  ) {
    this.bloom = document.createElement('div');
    this.bloom.className = 'look-bloom';
    this.bloom.style.background = `radial-gradient(circle at 50% 55%, ${PALETTE.ivory} 0%, ${PALETTE.gold} 55%, ${PALETTE.gold} 100%)`;
    parent.appendChild(this.bloom);
  }

  get active(): boolean {
    return this.t >= 0;
  }

  start(from: World, to: World): void {
    if (this.active) return;
    this.from = from;
    this.to = to;
    this.t = 0;
    this.switched = false;
    from.setActive(false);
    this.capture(from);
  }

  private cam(w: World): FreeCamera {
    return w.camera as FreeCamera;
  }

  private capture(w: World): void {
    const c = this.cam(w);
    this.pos0.copyFrom(c.position);
    this.tgt0.copyFrom(c.getTarget());
    this.rot0.copyFrom(c.rotation);
  }

  private restore(w: World): void {
    const c = this.cam(w);
    c.position.copyFrom(this.pos0);
    c.rotation.copyFrom(this.rot0);
  }

  /** k = 0: normal camera. k = 1: moved in to the diamond. */
  private pose(w: World, k: number): void {
    const c = this.cam(w);
    const d = w.diamondPosition();
    Vector3.LerpToRef(this.pos0, d, k * TUNING.lookWithin.dolly, this.tmp);
    c.position.copyFrom(this.tmp);
    Vector3.LerpToRef(this.tgt0, d, k, this.tmp);
    c.setTarget(this.tmp);
  }

  /** Returns the world to render this frame, or null when no transition runs. */
  update(dt: number): World | null {
    if (!this.active) return null;
    const half = TUNING.lookWithin.transitionTime / 2;
    this.t += dt;
    if (!this.switched && this.t >= half) {
      this.switched = true;
      this.restore(this.from);
      this.capture(this.to);
      this.onSwitch(this.to);
    }
    if (this.t >= 2 * half) {
      this.restore(this.to);
      this.bloom.style.opacity = '0';
      this.t = -1;
      this.onCamera(this.to);
      return this.to;
    }
    const world = this.switched ? this.to : this.from;
    const u = this.switched ? 1 - (this.t - half) / half : this.t / half;
    this.pose(world, smooth(clamp01(u)));
    this.bloom.style.opacity = String(smooth(clamp01(u * 1.15)));
    this.onCamera(world);
    return world;
  }
}
