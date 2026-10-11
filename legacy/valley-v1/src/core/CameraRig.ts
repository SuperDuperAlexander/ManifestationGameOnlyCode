import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { damp } from './Random';
import { WORLD_UNIFORMS } from '../shaders/paperShader';

/**
 * Fixed-angle follow camera. The player cannot turn it: paper cards only
 * look right from the front. It looks north (+z) from above at TUNING.camera.pitchDeg.
 */
export class CameraRig {
  readonly camera: FreeCamera;
  readonly target = new Vector3();
  private readonly offset = new Vector3();
  /** Screen height share (0 = top, 1 = bottom) where the bent ground meets the sky. */
  horizonFromTop = 0.3;
  /** Distance ahead of the look-at point where the bent ground forms the horizon. */
  horizonDz = 15;
  private portrait = false;

  constructor(private readonly scene: Scene) {
    this.camera = new FreeCamera('camera', new Vector3(0, 10, -20), scene);
    this.camera.inputs.clear();
    this.camera.minZ = 0.5;
    this.camera.maxZ = TUNING.camera.maxZ;
    this.camera.fovMode = Camera.FOVMODE_VERTICAL_FIXED;
    const pitch = (TUNING.camera.pitchDeg * Math.PI) / 180;
    this.offset.set(0, Math.sin(pitch) * TUNING.camera.distance, -Math.cos(pitch) * TUNING.camera.distance);
    this.camera.rotation.set(pitch, 0, 0);
    // Tilt the projection plane part of the way, so paper cards stand more upright on screen.
    if (TUNING.camera.verticalCorrection > 0) this.camera.projectionPlaneTilt = pitch * TUNING.camera.verticalCorrection;
    this.onResize();
  }

  /** Call when the canvas size changes. Picks the field of view and finds the horizon. */
  onResize(): void {
    const engine = this.scene.getEngine();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    this.portrait = aspect < 1;
    // Portrait phones: a wider vertical view so enough of the world fits left and right.
    this.camera.fov = this.portrait ? TUNING.camera.fovPortrait : TUNING.camera.fov;
    this.horizonFromTop = this.computeHorizon();
  }

  get isPortrait(): boolean {
    return this.portrait;
  }

  /** Jump straight to a point (no smoothing). */
  snapTo(p: Vector3): void {
    this.target.set(p.x, TUNING.camera.lookHeight, p.z + TUNING.camera.lookAhead);
    this.apply();
  }

  update(dt: number, follow: Vector3): void {
    const k = damp(TUNING.camera.followSharpness, dt);
    this.target.x += (follow.x - this.target.x) * k;
    this.target.y = TUNING.camera.lookHeight;
    this.target.z += (follow.z + TUNING.camera.lookAhead - this.target.z) * k;
    this.apply();
  }

  private apply(): void {
    this.camera.position.copyFrom(this.target).addInPlace(this.offset);
    WORLD_UNIFORMS.pivotZ = this.target.z;
  }

  /**
   * The ground bends down past the flat zone. Seen from the camera, the bent ground
   * rises on screen up to a highest point: the horizon. Everything above it is sky.
   * This projects bent ground points (same formula as the shader) and finds the top one.
   */
  private computeHorizon(): number {
    const saved = this.target.clone();
    this.target.set(0, TUNING.camera.lookHeight, 0);
    this.apply();
    const view = this.camera.getViewMatrix(true);
    const proj = this.camera.getProjectionMatrix(true);
    const vp = view.multiply(proj);
    const p = new Vector3();
    let top = 1;
    for (let dz = -5; dz < 220; dz += 0.25) {
      const d = Math.max(dz - TUNING.curve.flatDistance, 0);
      p.set(0, -TUNING.curve.strength * d * d, dz);
      const s = Vector3.TransformCoordinates(p, vp);
      const fromTop = 0.5 - s.y * 0.5;
      if (s.z > 0 && s.z < 1 && fromTop < top) {
        top = fromTop;
        this.horizonDz = dz;
      }
    }
    this.target.copyFrom(saved);
    this.apply();
    return Math.min(1, Math.max(0, top));
  }
}
