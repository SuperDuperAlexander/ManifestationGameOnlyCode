import type { Events } from '../core/Events';

/** Minimal HUD: light points, soft, in the top corner. */
export class Hud {
  private readonly el: HTMLDivElement;
  private readonly value: HTMLSpanElement;
  private readonly plus: HTMLSpanElement;
  private shown = 0;
  private target = 0;

  constructor(parent: HTMLElement, events: Events) {
    this.el = document.createElement('div');
    this.el.className = 'hud-light';
    this.el.innerHTML = '<span class="hl-star">✦</span><span class="hl-value">0</span><span class="hl-plus"></span>';
    this.value = this.el.querySelector('.hl-value') as HTMLSpanElement;
    this.plus = this.el.querySelector('.hl-plus') as HTMLSpanElement;
    parent.appendChild(this.el);
    events.on('lightPointsChanged', (e) => {
      this.target = e.total;
      if (e.added > 0) {
        this.plus.textContent = `+${e.added}`;
        this.el.classList.remove('pulse');
        void this.el.offsetWidth;
        this.el.classList.add('pulse');
      } else {
        this.shown = e.total;
      }
      this.el.classList.add('visible');
    });
  }

  update(dt: number): void {
    if (this.shown === this.target) return;
    // Count up calmly.
    this.shown = Math.min(this.target, this.shown + Math.max(1, dt * 12));
    this.value.textContent = String(Math.round(this.shown));
  }
}
