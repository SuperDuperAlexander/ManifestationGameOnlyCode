import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Engine } from '@babylonjs/core/Engines/engine';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';

/** A short spoken line above a character's head. DOM element, projected from a world point. */
export class SpeechBubble {
  private readonly el: HTMLDivElement;
  private left = 0;
  private anchor: (() => Vector3) | null = null;
  private readonly out = new Vector3();

  constructor(
    parent: HTMLElement,
    private readonly engine: Engine,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'speech-bubble';
    parent.appendChild(this.el);
  }

  show(text: string, anchor: () => Vector3, seconds: number): void {
    this.el.textContent = text;
    this.anchor = anchor;
    this.left = seconds;
  }

  /** `scene`/`camera` of the shown world, or null when the bubble's world is not shown. */
  update(dt: number, scene: Scene | null, camera: Camera | null): void {
    if (this.left > 0) this.left -= dt;
    let visible = false;
    if (this.left > 0 && this.anchor && scene && camera) {
      const w = this.engine.getRenderWidth();
      const h = this.engine.getRenderHeight();
      Vector3.ProjectToRef(this.anchor(), Matrix.IdentityReadOnly, scene.getTransformMatrix(), camera.viewport.toGlobal(w, h), this.out);
      if (this.out.z > 0 && this.out.z < 1) {
        const sx = (this.el.parentElement?.clientWidth ?? w) / w;
        const sy = (this.el.parentElement?.clientHeight ?? h) / h;
        this.el.style.transform = `translate(calc(${(this.out.x * sx).toFixed(1)}px - 50%), calc(${(this.out.y * sy).toFixed(1)}px - 100%))`;
        visible = true;
      }
    }
    this.el.classList.toggle('show', visible);
  }
}
