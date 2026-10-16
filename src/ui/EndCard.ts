/** A quiet, explicit chapter ending that leaves the completed world available. */
export class EndCard {
  private readonly el: HTMLDivElement;
  private shown = false;
  private statusText = '';
  private continueText = '';
  private previousFocus: HTMLElement | null = null;
  onDismiss: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'end-card';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', 'ec-status ec-title');
    this.el.setAttribute('aria-describedby', 'ec-line');
    this.el.innerHTML = `
      <section class="ec-panel">
        <div class="ec-arch" aria-hidden="true">
          <span class="ec-arch-stone ec-arch-left"></span>
          <span class="ec-arch-stone ec-arch-right"></span>
          <span class="ec-arch-glow"></span>
          <span class="ec-lantern"><i></i></span>
        </div>
        <div class="ec-copy">
          <p class="ec-status" id="ec-status"></p>
          <h1 class="ec-title" id="ec-title"></h1>
          <p class="ec-line" id="ec-line"></p>
          <button class="ec-continue" type="button"></button>
        </div>
      </section>`;
    parent.appendChild(this.el);
    this.el.querySelector<HTMLButtonElement>('.ec-continue')!.addEventListener('click', () => this.dismiss());
    this.el.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.dismiss();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        this.el.querySelector<HTMLButtonElement>('.ec-continue')!.focus({ preventScroll: true });
      }
    });
  }

  /** Remains true after dismissal so existing story/debug hooks keep their meaning. */
  get visible(): boolean {
    return this.shown;
  }

  get open(): boolean {
    return this.el.classList.contains('show');
  }

  setLabels(status: string, continueLabel: string): void {
    this.statusText = status;
    this.continueText = continueLabel;
  }

  show(title: string, line: string): void {
    if (this.shown) return;
    this.shown = true;
    this.el.querySelector<HTMLElement>('.ec-status')!.textContent = this.statusText;
    this.el.querySelector<HTMLElement>('.ec-title')!.textContent = title;
    this.el.querySelector<HTMLElement>('.ec-line')!.textContent = line;
    const button = this.el.querySelector<HTMLButtonElement>('.ec-continue')!;
    button.textContent = this.continueText;
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => {
      this.el.classList.add('show');
      button.focus({ preventScroll: true });
    });
  }

  private dismiss(): void {
    if (!this.open) return;
    this.el.classList.remove('show');
    this.onDismiss?.();
    const target = this.previousFocus?.isConnected ? this.previousFocus : document.querySelector<HTMLElement>('#game');
    if (target) {
      if (target instanceof HTMLCanvasElement && !target.hasAttribute('tabindex')) target.tabIndex = 0;
      target.focus({ preventScroll: true });
    }
    this.previousFocus = null;
  }
}
