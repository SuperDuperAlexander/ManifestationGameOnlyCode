import type { Engine } from '@babylonjs/core/Engines/engine';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';

export interface TapTarget {
  x: number;
  y: number;
  z: number;
}

/**
 * Tap on a glowing object. A tap is a short touch with little movement,
 * so it never conflicts with drag-look or the joystick.
 */
export class TapPicker {
  private readonly down = new Map<number, { x: number; y: number; t: number }>();
  private readonly tmp = new Vector3();

  constructor(
    private readonly engine: Engine,
    private readonly canvas: HTMLCanvasElement,
    /** Active world's scene and camera, and the glowing objects in reach. */
    private readonly source: () => { scene: Scene; camera: Camera; targets: TapTarget[] },
    /** Called when a target was tapped. */
    private readonly onTap: () => void,
    private readonly tapRadiusPx = 56,
    private readonly maxMovePx = 10,
    private readonly maxMs = 350,
  ) {
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || this.isButton(e.target)) return;
      this.down.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    }, true);
    window.addEventListener('pointerup', (e) => {
      const d = this.down.get(e.pointerId);
      this.down.delete(e.pointerId);
      if (!d) return;
      if (performance.now() - d.t > this.maxMs) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > this.maxMovePx) return;
      if (this.hit(e.clientX, e.clientY)) this.onTap();
    }, true);
    window.addEventListener('pointercancel', (e) => this.down.delete(e.pointerId), true);
  }

  private isButton(t: EventTarget | null): boolean {
    return t instanceof Element && t.closest('.breath-button, .look-button, .hand-button') !== null;
  }

  private hit(cx: number, cy: number): boolean {
    const { scene, camera, targets } = this.source();
    if (targets.length === 0) return false;
    const rect = this.canvas.getBoundingClientRect();
    const w = this.engine.getRenderWidth();
    const h = this.engine.getRenderHeight();
    const vp = camera.viewport.toGlobal(w, h);
    const sx = rect.width / w;
    const sy = rect.height / h;
    for (const t of targets) {
      this.tmp.set(t.x, t.y, t.z);
      const p = Vector3.Project(this.tmp, Matrix.IdentityReadOnly, scene.getTransformMatrix(), vp);
      if (p.z < 0 || p.z > 1) continue;
      if (Math.hypot(rect.left + p.x * sx - cx, rect.top + p.y * sy - cy) < this.tapRadiusPx) return true;
    }
    return false;
  }
}
