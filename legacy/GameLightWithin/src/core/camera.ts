import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CAMERA } from '../content/chapter1';
import { clamp, damp } from '../core/math';

/**
 * A third-person camera that follows gently. It never moves suddenly.
 * With reduced motion on there is no shake at all.
 *
 * This is the movement only. It holds no engine object: it works out where
 * the eye should be and what it should be looking at, and the game copies
 * those two points onto the real camera once a frame. That keeps the follow
 * behaviour testable without a graphics device, which is the part that has
 * actually gone wrong before.
 */
export class FollowCamera {
  yaw = Math.PI;
  pitch: number = CAMERA.startPitch;
  /** Where the eye is. */
  readonly position = new Vector3(0, 6, 12);
  /** What the eye is pointed at. */
  readonly lookAt = new Vector3();
  aspect: number;
  private shake = 0;
  private readonly desired = new Vector3();
  private readonly want = new Vector3();
  reducedMotion = false;
  /** The shake offset, kept apart so the follow position stays smooth. */
  readonly offset = new Vector3();

  constructor(aspect: number) {
    this.aspect = aspect;
  }

  resize(width: number, height: number): void {
    this.aspect = width / Math.max(1, height);
  }

  rotate(yawPixels: number, pitchPixels: number): void {
    this.yaw += yawPixels * CAMERA.dragSensitivity;
    this.pitch = clamp(
      this.pitch + pitchPixels * CAMERA.dragSensitivity,
      CAMERA.minPitch,
      CAMERA.maxPitch,
    );
  }

  /** A short soft shake. Ignored when reduced motion is on. */
  addShake(amount: number): void {
    if (this.reducedMotion) return;
    this.shake = Math.min(1, this.shake + amount);
  }

  /** The direction the player walks when they press forward. */
  forward(out: Vector3): Vector3 {
    out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    return out.normalize();
  }

  /**
   * The direction the player walks when they press right.
   *
   * This is `forward` crossed with up, which in a right-handed world with y
   * up is (-cos yaw, 0, sin yaw). It used to be the negative of that, so A
   * walked right and D walked left.
   */
  right(out: Vector3): Vector3 {
    out.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    return out.normalize();
  }

  /** Snaps straight to the target. Used when a scene starts. */
  snapTo(target: Vector3): void {
    this.computeDesired(target, this.position);
    this.offset.setAll(0);
    this.lookAt.set(target.x, target.y + 1.2, target.z);
  }

  update(dt: number, target: Vector3): void {
    const desired = this.computeDesired(target, this.desired);
    this.position.x = damp(this.position.x, desired.x, CAMERA.followLambda, dt);
    this.position.y = damp(this.position.y, desired.y, CAMERA.followLambda, dt);
    this.position.z = damp(this.position.z, desired.z, CAMERA.followLambda, dt);

    if (this.shake > 0.001) {
      const s = this.shake * 0.09;
      this.offset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0);
      this.shake = Math.max(0, this.shake - dt * 1.4);
    } else {
      this.offset.setAll(0);
    }

    this.want.set(target.x, target.y + 1.25, target.z);
    this.lookAt.x = damp(this.lookAt.x, this.want.x, CAMERA.followLambda * 1.6, dt);
    this.lookAt.y = damp(this.lookAt.y, this.want.y, CAMERA.followLambda * 1.6, dt);
    this.lookAt.z = damp(this.lookAt.z, this.want.z, CAMERA.followLambda * 1.6, dt);
  }

  /** Where the eye actually is this frame, shake included. */
  eye(out: Vector3): Vector3 {
    out.set(
      this.position.x + this.offset.x,
      this.position.y + this.offset.y,
      this.position.z + this.offset.z,
    );
    return out;
  }

  private computeDesired(target: Vector3, out: Vector3): Vector3 {
    const horizontal = Math.cos(this.pitch) * CAMERA.distance;
    out.set(
      target.x - Math.sin(this.yaw) * horizontal,
      target.y + CAMERA.height + Math.sin(this.pitch) * CAMERA.distance,
      target.z - Math.cos(this.yaw) * horizontal,
    );
    return out;
  }
}
