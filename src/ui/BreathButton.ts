import type { InputManager } from '../core/InputManager';

/**
 * The one large round breath button for touch screens (right side).
 * Hold = breathe in. Let go = breathe out (the breath flows out by itself).
 * The rhythm guide sits right on top of it.
 */
export class BreathButton {
  readonly el: HTMLDivElement;
  private pointer: number | null = null;

  constructor(
    parent: HTMLElement,
    private readonly input: InputManager,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'breath-button';
    this.el.setAttribute('role', 'button');
    this.el.setAttribute('aria-label', 'Breathe: hold to breathe in, let go to breathe out');
    this.el.innerHTML = '<div class="bb-core"></div>';
    parent.appendChild(this.el);

    this.el.addEventListener('pointerdown', (e) => {
      if (this.pointer !== null) return;
      e.preventDefault();
      e.stopPropagation();
      this.pointer = e.pointerId;
      this.el.setPointerCapture(e.pointerId);
      this.el.classList.add('held');
      this.input.touchBreathHeld = true;
      this.input.touchBreathUsed = true;
      this.input.markInteracted();
    });
    const end = (e: PointerEvent): void => {
      if (e.pointerId !== this.pointer) return;
      this.pointer = null;
      this.el.classList.remove('held');
      this.input.touchBreathHeld = false;
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
  }
}
