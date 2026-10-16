import type { InputManager } from '../core/InputManager';
import { createControlIcon } from './ControlIcons';

/** Touch hold button. Holding breathes in; release breathes out. */
export class BreathButton {
  private static readonly instances = new Set<BreathButton>();
  private static labelText = '';
  private static hintText = '';
  private static thoughtChoiceActive = false;
  readonly el: HTMLDivElement;
  private pointer: number | null = null;
  private readonly label: HTMLSpanElement;
  private readonly hint: HTMLSpanElement;

  constructor(parent: HTMLElement, private readonly input: InputManager) {
    this.el = document.createElement('div');
    this.el.className = 'breath-button';
    this.el.setAttribute('role', 'button');
    this.el.setAttribute('tabindex', '0');
    this.label = document.createElement('span');
    this.label.className = 'control-label';
    this.hint = document.createElement('span');
    this.hint.className = 'control-hint';
    this.el.appendChild(createControlIcon('breathe'));
    this.el.append(this.label, this.hint);
    parent.appendChild(this.el);
    BreathButton.instances.add(this);
    this.el.classList.toggle('thought-choice-active', BreathButton.thoughtChoiceActive);
    this.applyTexts();

    this.el.addEventListener('pointerdown', (event) => {
      if (this.pointer !== null) return;
      event.preventDefault();
      event.stopPropagation();
      this.pointer = event.pointerId;
      this.el.setPointerCapture(event.pointerId);
      this.el.classList.add('held');
      this.input.touchBreathHeld = true;
      this.input.touchBreathUsed = true;
      this.input.markInteracted();
    });
    const end = (event: PointerEvent): void => {
      if (event.pointerId !== this.pointer) return;
      this.pointer = null;
      this.el.classList.remove('held');
      this.input.touchBreathHeld = false;
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
    this.el.addEventListener('lostpointercapture', end);
    window.addEventListener('blur', () => this.resetHeld());
  }

  static setTexts(text: string, hint: string): void {
    BreathButton.labelText = text;
    BreathButton.hintText = hint;
    for (const instance of BreathButton.instances) instance.applyTexts();
  }

  static setThoughtChoiceActive(active: boolean): void {
    BreathButton.thoughtChoiceActive = active;
    for (const instance of BreathButton.instances) {
      instance.el.classList.toggle('thought-choice-active', active);
      if (!active) instance.el.classList.remove('thought-choice-pop');
    }
  }

  static cueThoughtChoice(): void {
    for (const instance of BreathButton.instances) {
      instance.el.classList.remove('thought-choice-pop');
      void instance.el.offsetWidth;
      instance.el.classList.add('thought-choice-pop');
      instance.el.onanimationend = () => instance.el.classList.remove('thought-choice-pop');
    }
  }

  private applyTexts(): void {
    this.label.textContent = BreathButton.labelText;
    this.hint.textContent = BreathButton.hintText;
    this.el.setAttribute('aria-label', [BreathButton.labelText, BreathButton.hintText].filter(Boolean).join('. '));
  }

  private resetHeld(): void {
    this.pointer = null;
    this.el.classList.remove('held');
    this.input.touchBreathHeld = false;
  }
}
