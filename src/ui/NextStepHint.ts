import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';

/** A plain task hint and a small gold target marker, also at the screen edge. */
export class NextStepHint {
  private readonly el = document.createElement('div');
  private readonly marker = document.createElement('div');
  private readonly text = document.createElement('span');
  private lastLine = '';
  private quietTimer = 0;

  constructor(parent: HTMLElement) {
    this.el.className = 'next-step-hint';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.marker.className = 'next-step-marker';
    const diamond = document.createElement('span');
    diamond.className = 'next-step-diamond';
    diamond.setAttribute('aria-hidden', 'true');
    this.marker.append(diamond, this.text);
    this.marker.hidden = true;
    parent.append(this.el, this.marker);
  }

  update(key: string, line: string, label: string, turn: string, target: Vector3 | null, scene: Scene, camera: Camera, badge = ''): void {
    if (this.el.dataset.step !== key) {
      this.el.dataset.step = key;
      // A new objective shows as a centered banner, then settles into the quiet corner line.
      // Progress-only changes (same sentence, new badge) stay quiet.
      if (line && line !== this.lastLine) {
        this.el.classList.remove('quiet');
        this.el.classList.add('banner');
        window.clearTimeout(this.quietTimer);
        this.quietTimer = window.setTimeout(() => {
          this.el.classList.remove('banner');
          this.el.classList.add('quiet');
        }, TUNING.ui.questBannerSeconds * 1000);
      }
      this.lastLine = line;
      this.el.textContent = '';
      const main = document.createElement('span');
      main.className = 'next-step-line';
      main.textContent = line;
      this.el.append(main);
      if (badge) {
        const pill = document.createElement('span');
        pill.className = 'next-step-badge';
        pill.textContent = badge;
        this.el.append(pill);
      }
    }
    this.el.hidden = !line;
    this.marker.hidden = !target;
    this.marker.dataset.target = target ? label : '';
    if (!target) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const point = Vector3.Project(target, Matrix.IdentityReadOnly, scene.getTransformMatrix(), camera.viewport.toGlobal(width, height));
    // Reverse the projected direction when the target is behind the camera.
    const behind = Vector3.TransformCoordinates(target, camera.getViewMatrix()).z < 0;
    let x = point.x;
    let y = point.y;
    if (behind) {
      x = width - x;
      y = height - y;
    }
    const g = TUNING.story;
    const left = width * g.guidanceEdgeX;
    const right = width * (1 - g.guidanceEdgeX);
    const top = height * g.guidanceEdgeTop;
    const bottom = height * g.guidanceEdgeBottom;
    const edge = behind || x < left || x > right || y < top || y > bottom;
    this.text.textContent = edge ? `${turn} ${label}` : label;
    if (behind) y = bottom;
    this.marker.classList.toggle('at-edge', edge);
    // Keep fractional layout pixels clear of either edge after a label change.
    const halfWidth = this.marker.getBoundingClientRect().width / 2 + g.guidanceMarkerPadding;
    this.marker.style.left = `${Math.min(Math.min(right, width - halfWidth), Math.max(Math.max(left, halfWidth), x))}px`;
    this.marker.style.top = `${Math.min(bottom, Math.max(top, y))}px`;
  }
}
