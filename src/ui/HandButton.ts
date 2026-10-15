import { createControlIcon } from './ControlIcons';

export type HandMode = 'dim' | 'push' | 'interact';

/** Touch action button. Its label follows the nearby action. */
export class HandButton {
  private static readonly instances = new Set<HandButton>();
  private static pushText = '';
  private static interactText = '';
  readonly el: HTMLDivElement;
  private mode: HandMode = 'dim';
  private readonly label: HTMLSpanElement;
  private readonly hint: HTMLSpanElement;

  constructor(parent: HTMLElement, onPress: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'hand-button dim';
    this.el.setAttribute('role', 'button');
    this.el.setAttribute('tabindex', '0');
    this.label = document.createElement('span');
    this.label.className = 'control-label';
    this.hint = document.createElement('span');
    this.hint.className = 'control-hint';
    this.el.append(createControlIcon('push'), this.label, this.hint);
    parent.appendChild(this.el);
    HandButton.instances.add(this);
    this.applyLabel();
    this.el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.el.setPointerCapture(event.pointerId);
      this.el.classList.add('pressed');
      onPress();
    });
    const up = (): void => this.el.classList.remove('pressed');
    this.el.addEventListener('pointerup', up);
    this.el.addEventListener('pointercancel', up);
    this.el.addEventListener('lostpointercapture', up);
    this.el.addEventListener('pointerleave', up);
    window.addEventListener('blur', up);
  }

  static setTexts(push: string, interact: string): void {
    HandButton.pushText = push;
    HandButton.interactText = interact;
    for (const instance of HandButton.instances) instance.applyLabel();
  }

  private applyLabel(): void {
    const text = this.mode === 'interact' ? HandButton.interactText : HandButton.pushText;
    this.label.textContent = text;
    this.el.setAttribute('aria-label', text);
  }

  setMode(mode: HandMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.el.classList.toggle('dim', mode === 'dim');
    this.el.classList.toggle('push', mode === 'push');
    this.el.classList.toggle('interact', mode === 'interact');
    this.applyLabel();
  }
}
