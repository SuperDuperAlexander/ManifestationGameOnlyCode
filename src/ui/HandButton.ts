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
    this.el.innerHTML =
      '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 26V12a2.5 2.5 0 0 1 5 0v10m0-2V9a2.5 2.5 0 0 1 5 0v11m0-1.5V11a2.5 2.5 0 0 1 5 0v10m0-4a2.5 2.5 0 0 1 5 0v14c0 7-4.500 11-11 11-5 0-8-2.500-10.500-7L9 29.500a2.600 2.600 0 0 1 4-3.300L17 31" fill="none" stroke="currentColor" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
