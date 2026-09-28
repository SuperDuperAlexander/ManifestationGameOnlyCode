import { BREATH } from '../content/chapter1';
import { t } from '../content/strings.en';
import { clamp01 } from '../core/math';
import { el, svgEl } from './dom';

const SIZE = 100;
const R_BASE = 20;
const R_FULL = 44;
/** The player disc starts small, so the guide ring is always readable. */
const R_DISC_MIN = 5;

/**
 * The breath circle in the lower centre of the screen.
 *
 * The thin ring shows the target rhythm: it grows on the in-breath and shrinks
 * on the out-breath. The filled circle follows what the player is doing.
 * The strength of both outlines is set by the chapter, so the scaffolding can
 * fade as the player learns: chapter 1 draws it fully, chapter 2 quietly.
 */
export class BreathCircle {
  readonly root: HTMLElement;
  private readonly targetRing: SVGElement;
  private readonly playerRing: SVGElement;
  private readonly glowRing: SVGElement;
  private readonly label: HTMLElement;
  private tremble = 0;
  reducedMotion = false;

  constructor(strength: number = BREATH.circleStrength) {
    const svg = svgEl('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, 'aria-hidden': 'true' });

    this.glowRing = svgEl('circle', {
      cx: '50',
      cy: '50',
      r: String(R_BASE),
      fill: 'rgba(232, 184, 75, 0.3)',
      stroke: 'none',
    });
    this.targetRing = svgEl('circle', {
      cx: '50',
      cy: '50',
      r: String(R_BASE),
      fill: 'none',
      stroke: 'rgba(35, 38, 43, 0.62)',
      'stroke-width': String(2.6 * strength),
      'stroke-dasharray': '4 6',
      'stroke-linecap': 'round',
    });
    this.playerRing = svgEl('circle', {
      cx: '50',
      cy: '50',
      r: String(R_BASE),
      fill: 'none',
      stroke: 'rgba(196, 146, 40, 0.95)',
      'stroke-width': String(3.2 * strength),
      'stroke-linecap': 'round',
    });
    svg.append(this.glowRing, this.targetRing, this.playerRing);

    this.label = el('div', { class: 'lw-breath-label' }, t().hud.breatheIn);
    this.root = el(
      'div',
      { class: 'lw-breath', role: 'img', 'aria-label': t().hud.breathCircle },
      svg,
      this.label,
    );
  }

  /** A small tremble near the fog. Reduced motion turns it off. */
  setTremble(amount: number): void {
    this.tremble = this.reducedMotion ? 0 : clamp01(amount);
  }

  /**
   * @param target 0 to 1 target ring size
   * @param player 0 to 1 the size the player is holding
   * @param inhaling whether the player should be breathing in
   * @param time seconds, for the tremble
   */
  update(target: number, player: number, inhaling: boolean, time: number): void {
    const shake = this.tremble > 0 ? Math.sin(time * 21) * this.tremble * 1.6 : 0;
    const rt = R_BASE + (R_FULL - R_BASE) * clamp01(target) + shake;
    const rp = R_DISC_MIN + (R_FULL - R_DISC_MIN) * clamp01(player);
    this.targetRing.setAttribute('r', rt.toFixed(2));
    this.playerRing.setAttribute('r', rp.toFixed(2));
    this.glowRing.setAttribute('r', (rp * 0.9).toFixed(2));
    // On a keyboard the label names the key, because there is no button to
    // read. On touch the buttons say it themselves.
    const touch = document.body.classList.contains('lw-touch');
    const s = t().hud;
    const want = inhaling
      ? touch
        ? s.breatheIn
        : s.breatheInKeys
      : touch
        ? s.breatheOut
        : s.breatheOutKeys;
    if (this.label.textContent !== want) this.label.textContent = want;
  }

  /** A short warm pulse when a breath was calm. */
  pulse(): void {
    this.glowRing.setAttribute('fill', 'rgba(232, 184, 75, 0.7)');
    window.setTimeout(() => this.glowRing.setAttribute('fill', 'rgba(232, 184, 75, 0.3)'), 420);
  }

  setVisible(on: boolean): void {
    this.root.style.display = on ? '' : 'none';
  }
}
