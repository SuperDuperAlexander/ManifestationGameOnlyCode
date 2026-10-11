import { SHADES, rgba } from '../config/palette';
import { TUNING } from '../config/tuning';

/* Red glow at the screen edge when a thought wave hits (GAME_DESIGN.md 7.3, "Nothing"). */
const FADE_S = TUNING.heat.hitFadeS;
const PEAK = TUNING.heat.hitPeak;

export class HitTint {
  private readonly el: HTMLDivElement;
  private left = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hit-tint';
    this.el.style.setProperty('--hit-color', rgba(SHADES.emberRed, 0.55));
    parent.appendChild(this.el);
  }

  flash(): void {
    this.left = FADE_S;
  }

  update(dt: number): void {
    if (this.left <= 0) return;
    this.left = Math.max(0, this.left - dt);
    const t = this.left / FADE_S;
    this.el.style.opacity = String(PEAK * t * t);
  }
}
