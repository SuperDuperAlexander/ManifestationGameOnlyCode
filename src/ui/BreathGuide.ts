import type { BreathSystem } from '../player/BreathSystem';

/**
 * The rhythm guide: a calm circle at the bottom of the screen.
 * The thin outer ring breathes at the target rhythm (about 4 s in, 4 s out).
 * The soft inner disc is the player's own breath. Following the ring = good rhythm.
 * It fades in while breathing or near fog, and fades out when not needed.
 */
export class BreathGuide {
  private readonly el: HTMLDivElement;
  private readonly guide: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private opacity = 0;
  private idleTime = 0;
  /** Set by the game when a fog is close, so the guide stays visible there. */
  wanted = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'breath-guide';
    this.el.innerHTML = `
      <div class="bg-track"></div>
      <div class="bg-guide"></div>
      <div class="bg-fill"></div>
      <div class="bg-label"></div>`;
    parent.appendChild(this.el);
    this.guide = this.el.querySelector('.bg-guide') as HTMLDivElement;
    this.fill = this.el.querySelector('.bg-fill') as HTMLDivElement;
    this.label = this.el.querySelector('.bg-label') as HTMLDivElement;
  }

  update(dt: number, breath: BreathSystem): void {
    const active = breath.state !== 'idle' || breath.breathLevel > 0.05;
    this.idleTime = active ? 0 : this.idleTime + dt;
    // Stay for a moment after the last breath, then fade away.
    const visibleTarget = active || this.wanted ? 1 : this.idleTime < 2.5 ? this.opacity : 0;
    this.opacity += (visibleTarget - this.opacity) * Math.min(1, dt * 3);
    this.el.style.opacity = this.opacity.toFixed(3);
    if (this.opacity < 0.01) return;

    const g = 0.35 + 0.65 * breath.guideLevel;
    const f = 0.2 + 0.8 * breath.breathLevel;
    this.guide.style.transform = `scale(${g.toFixed(3)})`;
    this.fill.style.transform = `scale(${f.toFixed(3)})`;
    const close = Math.abs(breath.guideLevel - breath.breathLevel) < 0.18;
    this.el.classList.toggle('in-rhythm', close && breath.state !== 'idle');
    const phase = breath.guidePhase < 0.5 ? 'in' : 'out';
    this.label.textContent = breath.state === 'idle' ? '' : phase === 'in' ? 'breathe in' : 'breathe out';
  }
}
