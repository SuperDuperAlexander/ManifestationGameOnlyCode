import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { angleDelta, clamp, damp } from '../core/Random';
import type { ValleyTerrain } from './ValleyTerrain';

/**
 * Third-person camera behind the player, like in Zelda or Messenger.
 * - Drag (mouse anywhere, or a finger on the right half of a touch screen) turns it.
 * - The mouse wheel moves it closer or further.
 * - When nobody drags, it slowly swings back behind the walking player.
 * - When a hill or rock wall is between it and the player, it moves closer
 *   (instead of flying up), so the view stays low and calm. It never goes into the ground.
 */
export class FollowCamera {
  readonly camera: FreeCamera;
  /** Where the camera looks: 0 = north (+z). */
  yaw = 0;
  private pitch: number = TUNING.valley.camera.pitch;
  private distance: number = TUNING.valley.camera.distance;
  private zoom = 1;
  /** Distance actually used: shorter while something is in the way. */
  private useDist = TUNING.valley.camera.distance as number;
  private idle = 99;
  private readonly target = new Vector3();
  private readonly desired = new Vector3();
  private dragId: number | null = null;
  private lastX = 0;
  private lastY = 0;

  constructor(
    private readonly scene: Scene,
    private readonly terrain: ValleyTerrain,
    canvas: HTMLCanvasElement,
    /** Touch screens: only this element (right half) turns the camera. */
    touchZone: HTMLElement | null,
  ) {
    const c = TUNING.valley.camera;
    this.camera = new FreeCamera('valley.camera', new Vector3(0, 5, -10), scene);
    this.camera.inputs.clear();
    this.camera.minZ = 0.3;
    this.camera.maxZ = c.maxZ;
    this.camera.fovMode = Camera.FOVMODE_VERTICAL_FIXED;
    this.onResize();

    const dragTarget = touchZone ?? canvas;
    dragTarget.addEventListener('pointerdown', (e) => {
      if (this.dragId !== null) return;
      if (touchZone && e.pointerType === 'mouse') return;
      this.dragId = e.pointerId;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      dragTarget.setPointerCapture(e.pointerId);
    });
    dragTarget.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.dragId) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.turn(dx, dy);
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId === this.dragId) this.dragId = null;
    };
    dragTarget.addEventListener('pointerup', end);
    dragTarget.addEventListener('pointercancel', end);
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom = clamp(this.zoom * (e.deltaY > 0 ? 1.08 : 0.93), c.minDistance / c.distance, c.maxDistance / c.distance);
      },
      { passive: false },
    );
  }

  private turn(dx: number, dy: number): void {
    const c = TUNING.valley.camera;
    this.yaw += dx * c.dragSpeed;
    this.pitch = clamp(this.pitch + dy * c.dragSpeed * 0.6, c.minPitch, c.maxPitch);
    this.idle = 0;
  }

  onResize(): void {
    const c = TUNING.valley.camera;
    const engine = this.scene.getEngine();
    const portrait = engine.getRenderWidth() < engine.getRenderHeight();
    this.camera.fov = portrait ? c.fovPortrait : c.fov;
    this.distance = portrait ? c.distancePortrait : c.distance;
  }

  snapTo(pos: Vector3, heading: number): void {
    this.yaw = heading;
    this.target.set(pos.x, pos.y + TUNING.valley.camera.lookHeight, pos.z);
    this.place(1);
  }

  /** `heading`: where the player faces. `moving`: 0..1 share of walk speed. */
  update(dt: number, pos: Vector3, heading: number, moving: number): void {
    const c = TUNING.valley.camera;
    this.idle += dt;
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
    const c = TUNING.valley.camera;
    const want = this.distance * this.zoom;
    // Is the ground in the way between the player and the camera? Then come closer.
    let free = want;
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    for (let s = 0.15; s <= 1.001; s += 0.085) {
      const d = want * s;
      const x = this.target.x - Math.sin(this.yaw) * cosP * d;
      const z = this.target.z - Math.cos(this.yaw) * cosP * d;
      const y = this.target.y + sinP * d;
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
      this.target.x - Math.sin(this.yaw) * flat,
      this.target.y + sinP * dist,
      this.target.z - Math.cos(this.yaw) * flat,
    );
    const ground = this.terrain.height(this.desired.x, this.desired.z) + c.groundClearance;
    if (this.desired.y < ground) this.desired.y = ground;
    const p = this.camera.position;
    p.x += (this.desired.x - p.x) * k;
    p.y += (this.desired.y - p.y) * k;
    p.z += (this.desired.z - p.z) * k;
    this.camera.setTarget(this.target);
  }
}
