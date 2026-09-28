import type { InputManager } from '../core/InputManager';

/**
 * Virtual joystick for touch screens. Touch anywhere on the left half:
 * the base appears under the finger, dragging moves the knob. Up = north.
 */
export class Joystick {
  private readonly el: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private pointer: number | null = null;
  private baseX = 0;
  private baseY = 0;
  private readonly radius = 56;

  constructor(
    parent: HTMLElement,
    private readonly input: InputManager,
    /** The touch zone (left half of the screen). */
    zone: HTMLElement,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'joystick';
    this.el.innerHTML = '<div class="js-knob"></div>';
    this.knob = this.el.querySelector('.js-knob') as HTMLDivElement;
    parent.appendChild(this.el);

    zone.addEventListener('pointerdown', (e) => {
      if (this.pointer !== null || e.pointerType === 'mouse') return;
      e.preventDefault();
      this.pointer = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      this.baseX = e.clientX;
      this.baseY = e.clientY;
      this.el.style.left = `${this.baseX}px`;
      this.el.style.top = `${this.baseY}px`;
      this.el.classList.add('active');
      this.move(e.clientX, e.clientY);
      this.input.markInteracted();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointer) return;
      e.preventDefault();
      this.move(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== this.pointer) return;
      this.pointer = null;
      this.input.touchMoveX = 0;
      this.input.touchMoveY = 0;
      this.knob.style.transform = 'translate(-50%, -50%)';
      this.el.classList.remove('active');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  private move(x: number, y: number): void {
    let dx = x - this.baseX;
    let dy = y - this.baseY;
    const len = Math.hypot(dx, dy);
    if (len > this.radius) {
      dx = (dx / len) * this.radius;
      dy = (dy / len) * this.radius;
    }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    // Small dead zone, then a smooth ramp to full speed.
    const r = Math.min(1, len / this.radius);
    const k = r < 0.12 ? 0 : (r - 0.12) / 0.88;
    const nx = len > 0 ? dx / Math.min(len, this.radius) : 0;
    const ny = len > 0 ? dy / Math.min(len, this.radius) : 0;
    this.input.touchMoveX = nx * k;
    this.input.touchMoveY = -ny * k;
  }
}
