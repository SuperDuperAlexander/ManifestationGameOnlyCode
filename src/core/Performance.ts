import type { Engine } from '@babylonjs/core/Engines/engine';
import { TUNING } from '../config/tuning';

/**
 * Keeps the frame rate steady on phones by rendering fewer pixels when needed.
 * "Render scale" = device pixels per rendered pixel: 1 = full sharpness, 2 = half.
 * Desktop: full sharpness, device pixel ratio capped at 2.
 * Phones: start at 1.5 and adapt between 1.25 and 2 from the measured frame rate.
 */
export class Performance {
  private scale: number;
  private timer = 0;
  private frames = 0;
  private elapsed = 0;

  constructor(
    private readonly engine: Engine,
    private readonly mobile: boolean,
  ) {
    this.scale = mobile ? 1.5 : 1;
    this.apply();
    window.addEventListener('resize', () => this.apply());
  }

  get renderScale(): number {
    return this.scale;
  }

  private apply(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 3 : 2);
    this.engine.setHardwareScalingLevel(this.scale / dpr);
  }

  update(dt: number): void {
    if (!this.mobile) return;
    const p = TUNING.performance;
    this.frames++;
    this.elapsed += dt;
    this.timer += dt;
    if (this.timer < p.adaptInterval) return;
    const fps = this.frames / Math.max(0.001, this.elapsed);
    this.timer = 0;
    this.frames = 0;
    this.elapsed = 0;
    let next = this.scale;
    if (fps < p.lowFps) next = Math.min(p.mobileScalingMax, this.scale + 0.25);
    else if (fps > p.highFps) next = Math.max(p.mobileScalingMin, this.scale - 0.25);
    if (next !== this.scale) {
      this.scale = next;
      this.apply();
    }
  }
}

/** True on phones and tablets (a coarse pointer and a touch screen). */
export function isTouchDevice(): boolean {
  return (
    (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
    ('ontouchstart' in window && navigator.maxTouchPoints > 0)
  );
}
