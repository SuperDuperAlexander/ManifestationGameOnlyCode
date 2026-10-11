/** The calm end card: title and one line, fades in. It never blocks input. */
export class EndCard {
  private readonly el: HTMLDivElement;
  private shown = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'end-card';
    this.el.innerHTML = '<div class="ec-title"></div><div class="ec-line"></div>';
    parent.appendChild(this.el);
  }

  get visible(): boolean {
    return this.shown;
  }

  show(title: string, line: string): void {
    if (this.shown) return;
    this.shown = true;
    (this.el.querySelector('.ec-title') as HTMLElement).textContent = title;
    (this.el.querySelector('.ec-line') as HTMLElement).textContent = line;
    // Next frame, so the CSS fade runs.
    requestAnimationFrame(() => this.el.classList.add('show'));
    // The card softly leaves again; the player keeps walking.
    window.setTimeout(() => this.el.classList.remove('show'), 12000);
  }
}
