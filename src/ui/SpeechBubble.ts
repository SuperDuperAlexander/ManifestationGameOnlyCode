import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Engine } from '@babylonjs/core/Engines/engine';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';

/** A short spoken line above a character's head. DOM element, projected from a world point. */
export class SpeechBubble {
  private readonly el: HTMLDivElement;
  private left = 0;
  private anchor: (() => Vector3) | null = null;
  private readonly out = new Vector3();
  private measuredText = '';
  private measuredParentWidth = -1;
  private measuredParentHeight = -1;
  private bubbleWidth = 0;
  private bubbleHeight = 0;

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
    this.measuredText = '';
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
      const parent = this.el.parentElement;
      const parentWidth = parent?.clientWidth ?? w;
      const parentHeight = parent?.clientHeight ?? h;
      if (this.measuredText !== this.el.textContent || this.measuredParentWidth !== parentWidth || this.measuredParentHeight !== parentHeight) {
        const bounds = this.el.getBoundingClientRect();
        this.bubbleWidth = bounds.width;
        this.bubbleHeight = bounds.height;
        this.measuredText = this.el.textContent;
        this.measuredParentWidth = parentWidth;
        this.measuredParentHeight = parentHeight;
      }
      Vector3.ProjectToRef(this.anchor(), Matrix.IdentityReadOnly, scene.getTransformMatrix(), camera.viewport.toGlobal(w, h), this.out);
      if (this.out.z > 0 && this.out.z < 1) {
        const sx = parentWidth / w;
        const sy = parentHeight / h;
        const edge = 16;
        const maxLeft = Math.max(edge, parentWidth - this.bubbleWidth - edge);
        const maxTop = Math.max(edge, parentHeight - this.bubbleHeight - edge);
        const left = Math.min(maxLeft, Math.max(edge, this.out.x * sx - this.bubbleWidth / 2));
        const tail = 10 + (parentWidth < 700 ? TUNING.ui.speechLiftPhone : 0);
        const top = Math.min(maxTop, Math.max(edge, this.out.y * sy - this.bubbleHeight - tail));
        // The tail points at the speaker, kept inside the rounded bubble.
        const tailX = Math.min(this.bubbleWidth - 24, Math.max(24, this.out.x * sx - left));
        this.el.style.setProperty('--tail-x', `${tailX.toFixed(1)}px`);
        this.el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
        visible = true;
      }
    }
    this.el.classList.toggle('show', visible);
  }
}
