import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { angleDelta, clamp, damp } from '../core/Random';
/** Anything that knows the ground height (valley terrain, town ground). */
export interface GroundHeight {
  height(x: number, z: number): number;
}

/**
 * Third-person camera behind the player, like in Zelda or Messenger.
 * - Drag (mouse anywhere, or a second finger on a touch screen) turns it.
 * - The mouse wheel moves it closer or further.
 * - When nobody drags, it slowly swings back behind the walking player.
 * - When a hill or rock wall is between it and the player, it moves closer
 *   (instead of flying up), so the view stays low and calm. It never goes into the ground.
 */
export class FollowCamera {
  readonly camera: FreeCamera;
  /** Where the camera looks: 0 = north (+z). */
  yaw = 0;
  private pitch: number = TUNING.inner.camera.pitch;
  private distance: number = TUNING.inner.camera.distance;
  private zoom = 1;
  /** Distance actually used: shorter while something is in the way. */
  private useDist = TUNING.inner.camera.distance as number;
  private idle = 99;
  private readonly focus = new Vector3();
  private focusW = 0;
  private focusWant = 0;
  private focusExtra = 0;
  private focusBlend = 0;
  private readonly target = new Vector3();
  private readonly look = new Vector3();
  private readonly desired = new Vector3();
  private dragId: number | null = null;
  private lastX = 0;
  private lastY = 0;

  constructor(
    private readonly scene: Scene,
    private readonly terrain: GroundHeight,
    canvas: HTMLCanvasElement,
    /** True when a TouchRouter drives touch drags (canvas then only takes the mouse). */
    touchRouted: boolean,
  ) {
    const c = TUNING.inner.camera;
    this.camera = new FreeCamera('valley.camera', new Vector3(0, 5, -10), scene);
    this.camera.inputs.clear();
    this.camera.minZ = 0.3;
    this.camera.maxZ = c.maxZ;
    this.camera.fovMode = Camera.FOVMODE_VERTICAL_FIXED;
    this.onResize();

    // Mouse (and touch when no touch router is used) drags on the canvas.
    canvas.addEventListener('pointerdown', (e) => {
      if (this.dragId !== null) return;
      if (touchRouted && e.pointerType !== 'mouse') return;
      this.dragId = e.pointerId;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.dragId) return;
      this.dragMove(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId === this.dragId) this.dragId = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom = clamp(this.zoom * (e.deltaY > 0 ? 1.08 : 0.93), c.minDistance / c.distance, c.maxDistance / c.distance);
      },
      { passive: false },
    );
  }

  /** Camera finger (from TouchRouter). */
  dragStart(x: number, y: number): void {
    this.lastX = x;
    this.lastY = y;
  }

  dragMove(x: number, y: number): void {
    this.turn(x - this.lastX, y - this.lastY);
    this.lastX = x;
    this.lastY = y;
  }

  dragEnd(): void {}

  /** Lifts the look target toward `point` and pulls back, by `weight` 0..1 (e.g. near the big Anger Imp). */
  setFocus(point: Vector3 | null, weight: number, extraDist: number, blend: number): void {
    if (point) this.focus.copyFrom(point);
    this.focusWant = point ? weight : 0;
    this.focusExtra = extraDist;
    this.focusBlend = blend;
  }

  /** Briefly frames a point when this world opens. Player input releases the focus. */
  focusOnEntry(point: Vector3, extraDist: number, blend: number): void {
    this.focus.copyFrom(point);
    this.focusWant = 1;
    this.focusExtra = extraDist;
    this.focusBlend = blend;
    this.focusW = 0;
    this.idle = 0;
  }

  private releaseFocus(): void {
    if (this.focusWant === 0) return;
    this.focusWant = 0;
    this.focusExtra = 0;
    this.idle = 0;
  }

  private turn(dx: number, dy: number): void {
    const c = TUNING.inner.camera;
    this.yaw += dx * c.dragSpeed;
    this.pitch = clamp(this.pitch + dy * c.dragSpeed * 0.6, c.minPitch, c.maxPitch);
    this.idle = 0;
    this.releaseFocus();
  }

  /** Gently turns the view toward a yaw (e.g. the alley story) unless the player is dragging the camera. */
  easeYaw(target: number, rate: number, dt: number): void {
    if (this.idle < TUNING.inner.camera.recenterDelay) return;
    this.yaw += angleDelta(this.yaw, target) * Math.min(1, rate * dt);
  }

  onResize(): void {
    const c = TUNING.inner.camera;
    const engine = this.scene.getEngine();
    const portrait = engine.getRenderWidth() < engine.getRenderHeight();
    this.camera.fov = portrait ? c.fovPortrait : c.fov;
    this.distance = portrait ? c.distancePortrait : c.distance;
  }

  snapTo(pos: Vector3, heading: number): void {
    this.yaw = heading;
    this.target.set(pos.x, pos.y + TUNING.inner.camera.lookHeight, pos.z);
    this.place(1);
  }

  /** `heading`: where the player faces. `moving`: 0..1 share of walk speed. */
  update(dt: number, pos: Vector3, heading: number, moving: number): void {
    const c = TUNING.inner.camera;
    this.idle += dt;
    if (moving > 0.1) this.releaseFocus();
    // Swing slowly behind the player while walking sideways, unless the player just turned
    // the camera. Walking toward the camera does not spin it around (sin = 0 there).
    if (this.idle > c.recenterDelay && moving > 0.1) {
      this.yaw += Math.sin(angleDelta(this.yaw, heading)) * c.recenterSpeed * 0.5 * moving * dt;
    }
    const f = damp(c.followSharpness, dt);
    this.target.x += (pos.x - this.target.x) * f;
    this.target.y += (pos.y + c.lookHeight - this.target.y) * damp(c.followSharpness * 0.5, dt);
    this.target.z += (pos.z - this.target.z) * f;
    this.place(damp(c.followSharpness, dt));
  }

  private place(k: number): void {
    const c = TUNING.inner.camera;
    this.focusW += (this.focusWant - this.focusW) * Math.min(1, k * 0.35);
    const fw = this.focusW;
    const want = this.distance * this.zoom + this.focusExtra * fw;
    const look = this.look;
    look.copyFrom(this.target);
    if (fw > 0.001) {
      const b = fw * this.focusBlend;
      look.x += (this.focus.x - look.x) * b;
      look.y += (this.focus.y - look.y) * b;
      look.z += (this.focus.z - look.z) * b;
    }
    // Is the ground in the way between the player and the camera? Then come closer.
    let free = want;
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    for (let s = 0.15; s <= 1.001; s += 0.085) {
      const d = want * s;
      const x = look.x - Math.sin(this.yaw) * cosP * d;
      const z = look.z - Math.cos(this.yaw) * cosP * d;
      const y = look.y + sinP * d;
      if (this.terrain.height(x, z) + c.groundClearance > y) {
        free = Math.max(c.minDistance * 0.6, d - want * 0.1);
        break;
      }
    }
    // Move in fast, move back out slowly.
    this.useDist += (free - this.useDist) * (free < this.useDist ? Math.max(k, 0.35) : k * 0.25);
    const dist = this.useDist;
    const flat = cosP * dist;
    this.desired.set(
      look.x - Math.sin(this.yaw) * flat,
      look.y + sinP * dist,
      look.z - Math.cos(this.yaw) * flat,
    );
    const ground = this.terrain.height(this.desired.x, this.desired.z) + c.groundClearance;
    if (this.desired.y < ground) this.desired.y = ground;
    const p = this.camera.position;
    p.x += (this.desired.x - p.x) * k;
    p.y += (this.desired.y - p.y) * k;
    p.z += (this.desired.z - p.z) * k;
    this.camera.setTarget(look);
  }
}
