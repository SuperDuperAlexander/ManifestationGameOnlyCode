export type SpotlightTarget = 'breathe' | 'look' | 'hand' | 'move';

const DESKTOP: Record<SpotlightTarget, string[]> = {
  breathe: ['.breathe-action'],
  look: ['.look-action'],
  hand: ['.push-action'],
  move: ['.move-note'],
};
const TOUCH: Record<SpotlightTarget, string[]> = {
  breathe: ['.breath-button'],
  look: ['.look-button'],
  hand: ['.hand-button'],
  move: [],
};
const MARGIN = 16;
const GAP = 14;

interface Box { left: number; right: number; top: number; bottom: number }

/**
 * Tutorial cue: a soft glow on the real control button plus a small speech-bubble callout next to it.
 * No extra buttons. The callout never takes taps.
 */
export class ControlSpotlight {
  private readonly el = document.createElement('div');
  private readonly textEl = document.createElement('span');
  private current: HTMLElement | null = null;
  private target: SpotlightTarget | null = null;
  private raf = 0;
  private isShown = false;

  constructor(parent: HTMLElement, private readonly touch: boolean) {
    this.el.className = 'control-callout';
    this.el.setAttribute('role', 'status');
    this.textEl.className = 'control-callout-text';
    const tail = document.createElement('span');
    tail.className = 'control-callout-tail';
    this.el.append(this.textEl, tail);
    parent.appendChild(this.el);
    window.addEventListener('resize', () => this.place());
  }

  /** True while the callout is actually visible. */
  get shown(): boolean { return this.isShown; }

  spotlight(target: SpotlightTarget | null, text: string): void {
    if (target === this.target && text === this.textEl.textContent) return;
    this.target = target;
    if (!target) {
      this.clearGlow();
      document.body.classList.remove('spot-on');
      this.setShown(false);
      return;
    }
    this.textEl.textContent = text;
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private readonly tick = (): void => {
    this.raf = 0;
    if (!this.target) return;
    this.place();
    this.raf = requestAnimationFrame(this.tick);
  };

  private find(target: SpotlightTarget): HTMLElement | null {
    for (const sel of (this.touch ? TOUCH : DESKTOP)[target]) {
      for (const el of document.querySelectorAll<HTMLElement>(sel)) if (this.usable(el)) return el;
    }
    return null;
  }

  private usable(el: HTMLElement): boolean {
    if (el.closest('.off')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
    }
    return true;
  }

  private clearGlow(): void {
    this.current?.classList.remove('spotlit');
    this.current = null;
  }

  private setShown(on: boolean): void {
    this.isShown = on;
    this.el.classList.toggle('show', on);
  }

  private place(): void {
    if (!this.target) return;
    let rect: Box | null = null;
    const btn = this.find(this.target);
    if (btn !== this.current) {
      this.current?.classList.remove('spotlit');
      this.current = btn;
      btn?.classList.add('spotlit');
    }
    document.body.classList.toggle('spot-on', !!btn);
    if (btn) rect = btn.getBoundingClientRect();
    else if (this.target === 'move' && this.touch) {
      // The walking stick appears under the finger: point at the lower-left area of the screen.
      rect = { left: innerWidth * 0.3, right: innerWidth * 0.3, top: innerHeight * 0.62, bottom: innerHeight * 0.62 };
    }
    if (!rect) { this.setShown(false); return; }

    const bw = this.el.offsetWidth;
    const bh = this.el.offsetHeight;
    const vw = innerWidth;
    const vh = innerHeight;
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    let side: 'above' | 'below' | 'left' | 'right';
    if (rect.top - GAP - bh >= MARGIN) side = 'above';
    else if (rect.bottom + GAP + bh <= vh - MARGIN) side = 'below';
    else if (rect.left - GAP - bw >= MARGIN) side = 'left';
    else side = 'right';
    let x: number;
    let y: number;
    if (side === 'above' || side === 'below') {
      x = cx - bw / 2;
      y = side === 'above' ? rect.top - GAP - bh : rect.bottom + GAP;
    } else {
      y = cy - bh / 2;
      x = side === 'left' ? rect.left - GAP - bw : rect.right + GAP;
    }
    x = Math.min(Math.max(x, MARGIN), Math.max(MARGIN, vw - MARGIN - bw));
    y = Math.min(Math.max(y, MARGIN), Math.max(MARGIN, vh - MARGIN - bh));
    const tailX = Math.min(Math.max(cx - x, 18), Math.max(18, bw - 18));
    const tailY = Math.min(Math.max(cy - y, 14), Math.max(14, bh - 14));
    this.el.dataset.side = side;
    this.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    this.el.style.setProperty('--tail-x', `${Math.round(tailX)}px`);
    this.el.style.setProperty('--tail-y', `${Math.round(tailY)}px`);
    this.setShown(true);
  }
}
