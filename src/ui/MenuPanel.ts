export type MenuText = (key: string) => string;

/** A native pause menu that keeps the current world and story alive. */
export class MenuPanel {
  private readonly button: HTMLButtonElement;
  private readonly dialog: HTMLDialogElement;
  private available = false;

  constructor(
    parent: HTMLElement,
    text: MenuText,
    private readonly onOpenChange: (open: boolean) => boolean | void,
    touch = document.body.classList.contains('touch'),
  ) {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'menu-open';
    this.button.textContent = text('menuOpen');
    this.button.setAttribute('aria-haspopup', 'dialog');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.hidden = true;
    parent.append(this.button);

    this.dialog = document.createElement('dialog');
    this.dialog.className = 'menu-dialog';
    this.dialog.setAttribute('aria-labelledby', 'menu-title');
    this.dialog.innerHTML = `
      <div class="menu-visual">
        <div class="menu-light" aria-hidden="true"><i></i><i></i><i></i><span>✧</span></div>
        <span class="menu-kicker"></span>
      </div>
      <div class="menu-copy">
        <h2 id="menu-title"></h2>
        <p></p>
        <section class="menu-controls" aria-label=""></section>
        <button type="button" class="menu-return"></button>
      </div>
      <button type="button" class="menu-close"></button>`;
    parent.append(this.dialog);

    this.dialog.querySelector('.menu-kicker')!.textContent = text('menuTitle').toUpperCase();
    this.dialog.querySelector('h2')!.textContent = text('menuTitle');
    this.dialog.querySelector('.menu-copy > p')!.textContent = text('taskLantern');
    const controls = this.dialog.querySelector('.menu-controls')!;
    controls.setAttribute('aria-label', text('menuControls'));
    const heading = document.createElement('h3');
    heading.textContent = text('menuControls');
    controls.append(heading);
    const rows: { key: string; labels: string[] }[] = touch
      ? [
          { key: '', labels: ['hintMoveTouch'] },
          { key: '', labels: ['hintBreatheTouch'] },
          { key: '', labels: ['controlsPush', 'controlsInteract'] },
          { key: '', labels: ['hintLookWithinTouch'] },
        ]
      : [
          { key: 'W A S D', labels: ['controlsWalk', 'controlsArrowKeys'] },
          { key: 'Space', labels: ['controlsBreatheIn'] },
          { key: 'Shift', labels: ['controlsBreatheOut'] },
          { key: 'E', labels: ['controlsPush', 'controlsInteract'] },
          { key: 'Q', labels: ['controlsLookWithin'] },
        ];
    for (const { key, labels } of rows) {
      const row = document.createElement('div');
      row.className = 'menu-help-row';
      if (key) {
        const cap = document.createElement('span');
        cap.className = 'menu-key';
        cap.textContent = key;
        row.append(cap);
      }
      const copy = document.createElement('span');
      copy.textContent = labels.map((label) => text(label)).join(' · ');
      row.append(copy);
      controls.append(row);
    }
    const returnButton = this.dialog.querySelector<HTMLButtonElement>('.menu-return')!;
    returnButton.textContent = text('menuReturn');
    returnButton.setAttribute('aria-label', text('menuReturn'));
    const closeButton = this.dialog.querySelector<HTMLButtonElement>('.menu-close')!;
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', text('menuClose'));
    closeButton.autofocus = true;

    this.button.addEventListener('click', () => this.open());
    returnButton.addEventListener('click', () => this.dialog.close());
    closeButton.addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('close', () => {
      this.button.setAttribute('aria-expanded', 'false');
      this.onOpenChange(false);
      requestAnimationFrame(() => {
        if (this.available && this.button.isConnected && this.button.ownerDocument === document) {
          this.button.focus({ preventScroll: true });
        }
      });
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.dialog.open && this.available) {
        event.preventDefault();
        this.open();
      }
    });
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  setAvailable(available: boolean): void {
    this.available = available;
    this.button.hidden = !available;
  }

  open(): void {
    if (!this.available || this.dialog.open) return;
    if (this.onOpenChange(true) === false) return;
    this.dialog.showModal();
    this.dialog.scrollTop = 0;
    this.dialog.querySelector<HTMLButtonElement>('.menu-close')!.focus({ preventScroll: true });
    this.button.setAttribute('aria-expanded', 'true');
  }
}
