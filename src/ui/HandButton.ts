import { createControlIcon } from './ControlIcons';

export type HandMode = 'dim' | 'push' | 'interact' | 'collect';

/** Touch action button. Its label follows the nearby action. */
export class HandButton {
  private static readonly instances = new Set<HandButton>();
  private static pushText = '';
  private static interactText = '';
  private static collectText = '';
  private static tapText = '';
  readonly el: HTMLDivElement;
  private mode: HandMode = 'dim';
  private readonly label: HTMLSpanElement;
  private readonly hint: HTMLSpanElement;
  private icon: SVGSVGElement;

  constructor(parent: HTMLElement, onPress: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'hand-button dim';
    this.el.setAttribute('role', 'button');
    this.el.setAttribute('tabindex', '-1');
    this.label = document.createElement('span');
    this.label.className = 'control-label';
    this.hint = document.createElement('span');
    this.hint.className = 'control-hint';
    this.icon = createControlIcon('push');
    this.el.append(this.icon, this.label, this.hint);
    parent.appendChild(this.el);
    HandButton.instances.add(this);
    this.applyLabel();
    this.el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.mode === 'dim') return;
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
    this.el.addEventListener('keydown', (event) => {
      if (this.mode === 'dim' || (event.code !== 'Space' && event.code !== 'Enter')) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) onPress();
    });
  }

  static setTexts(push: string, interact: string, collect: string, tap: string): void {
    HandButton.pushText = push;
    HandButton.interactText = interact;
    HandButton.collectText = collect;
    HandButton.tapText = tap;
    for (const instance of HandButton.instances) instance.applyLabel();
  }

  private applyLabel(): void {
    const text = this.mode === 'collect' ? HandButton.collectText : this.mode === 'interact' ? HandButton.interactText : HandButton.pushText;
    this.label.textContent = text;
    this.hint.textContent = this.mode === 'dim' ? '' : HandButton.tapText;
    this.el.setAttribute('aria-label', text);
    this.el.setAttribute('aria-disabled', String(this.mode === 'dim'));
    this.el.setAttribute('tabindex', this.mode === 'dim' ? '-1' : '0');
  }

  setMode(mode: HandMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode !== 'push') this.el.classList.remove('push-ready-pop');
    this.el.classList.toggle('dim', mode === 'dim');
    this.el.classList.toggle('push', mode === 'push');
    this.el.classList.toggle('interact', mode === 'interact');
    this.el.classList.toggle('collect', mode === 'collect');
    const icon = mode === 'collect' ? 'collect' : 'push';
    this.icon.replaceWith(createControlIcon(icon));
    this.icon = this.el.querySelector('svg')!;
    this.applyLabel();
  }

  cuePushOpportunity(token: string): void {
    if (!token || this.mode !== 'push') {
      this.el.classList.remove('push-ready-pop');
      return;
    }
    this.el.classList.remove('push-ready-pop');
    void this.el.offsetWidth;
    this.el.classList.add('push-ready-pop');
    this.el.onanimationend = () => this.el.classList.remove('push-ready-pop');
  }
}
