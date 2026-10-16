import { TUNING } from '../config/tuning';
import type { InputManager } from '../core/InputManager';

/**
 * Virtual joystick for touch screens. Driven by TouchRouter: the first finger
 * anywhere on the screen walks, the base appears under it, dragging moves the knob. Up = north.
 */
export class Joystick {
  private readonly el: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private baseX = 0;
  private baseY = 0;
  private readonly radius = TUNING.touch.joystickRadius;

  constructor(
    parent: HTMLElement,
    private readonly input: InputManager,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'joystick';
    this.el.innerHTML = '<div class="js-knob"></div>';
    this.knob = this.el.querySelector('.js-knob') as HTMLDivElement;
    parent.appendChild(this.el);
  }

  /** A finger starts walking here: the base appears under it. */
  begin(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    this.el.classList.add('active');
    this.move(x, y);
    this.input.markInteracted();
  }

  moveTo(x: number, y: number): void {
    this.move(x, y);
  }

  end(): void {
    this.input.touchMoveX = 0;
    this.input.touchMoveY = 0;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.el.classList.remove('active');
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
