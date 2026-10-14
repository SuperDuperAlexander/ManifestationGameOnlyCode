import { createControlIcon } from './ControlIcons';

export type HandMode = 'dim' | 'push' | 'interact';

/** Round hand button (touch). No label. Push near a wave, interact near a glowing object. */
export class HandButton {
  readonly el: HTMLDivElement;
  private mode: HandMode = 'dim';

  constructor(parent: HTMLElement, onPress: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'hand-button dim';
    this.el.setAttribute('role', 'button');
    this.el.setAttribute('aria-label', 'Push or interact');
    this.el.appendChild(createControlIcon('push'));
    parent.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.el.classList.add('pressed');
      onPress();
    });
    const up = (): void => this.el.classList.remove('pressed');
    this.el.addEventListener('pointerup', up);
    this.el.addEventListener('pointercancel', up);
    this.el.addEventListener('pointerleave', up);
  }

  setMode(m: HandMode): void {
    if (m === this.mode) return;
    this.mode = m;
    this.el.classList.toggle('dim', m === 'dim');
    this.el.classList.toggle('push', m === 'push');
    this.el.classList.toggle('interact', m === 'interact');
  }
}
