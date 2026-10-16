/** "begin" = fresh start (checkpoint cleared). "continue" = keep the saved checkpoint. */
export type StartChoice = 'begin' | 'continue';

/**
 * A quiet start screen over the live scene. Begin is shown once the texts are ready.
 * If a checkpoint exists, Continue is shown as a second choice.
 * It also makes sure sound may play (browsers need one key press or tap first).
 */
export class StartScreen {
  private readonly el: HTMLDivElement;
  private readonly actions: HTMLDivElement;
  private readonly beginBtn: HTMLButtonElement;
  private readonly continueBtn: HTMLButtonElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'start-screen';
    this.el.setAttribute('aria-busy', 'true');
    this.el.innerHTML = `
      <div class="ss-content">
        <p class="ss-sub"></p>
        <h1 class="ss-title"><span></span><em></em></h1>
        <p class="ss-description"></p>
        <div class="ss-actions">
          <button type="button" class="ss-btn ss-begin"></button>
          <button type="button" class="ss-btn ss-continue"></button>
        </div>
        <p class="ss-prompt"></p>
        <span class="ss-loading" aria-hidden="true"><i></i><i></i><i></i></span>
      </div>`;
    parent.appendChild(this.el);
    this.actions = this.el.querySelector('.ss-actions') as HTMLDivElement;
    this.beginBtn = this.el.querySelector('.ss-begin') as HTMLButtonElement;
    this.continueBtn = this.el.querySelector('.ss-continue') as HTMLButtonElement;
  }

  /** Fills the texts once the dialogue table is loaded. `cont` = null when there is no checkpoint. */
  setTexts(title: string, sub: string, prompt: string, begin: string, cont: string | null, description = ''): void {
    const words = title.trim().split(/\s+/);
    const first = words[0] ?? '';
    (this.el.querySelector('.ss-title span') as HTMLElement).textContent = first ? `${first[0]?.toLocaleUpperCase()}${first.slice(1).toLocaleLowerCase()}` : '';
    (this.el.querySelector('.ss-title em') as HTMLElement).textContent = words.slice(1).join(' ').toLocaleLowerCase();
    (this.el.querySelector('.ss-sub') as HTMLElement).textContent = sub;
    (this.el.querySelector('.ss-description') as HTMLElement).textContent = description;
    (this.el.querySelector('.ss-prompt') as HTMLElement).textContent = prompt;
    this.beginBtn.textContent = begin;
    this.continueBtn.textContent = cont ?? '';
    this.el.classList.toggle('has-save', cont !== null);
    this.el.classList.add('ready');
    this.el.setAttribute('aria-busy', 'false');
    this.beginBtn.focus({ preventScroll: true });
  }

  /** Resolves with the choice. Any key or tap means "begin". Then fades away. */
  waitForStart(): Promise<StartChoice> {
    return new Promise((resolve) => {
      const finish = (choice: StartChoice): void => {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('pointerdown', onPointer);
        this.hide();
        resolve(choice);
      };
      // Button presses have their own handlers; the window listeners must not also fire.
      const fromButton = (e: Event): boolean => e.target instanceof Node && this.actions.contains(e.target);
      const onKey = (e: KeyboardEvent): void => {
        if (e.code === 'F3' || e.key === 'Tab' || e.repeat || fromButton(e)) return;
        finish('begin');
      };
      const onPointer = (e: PointerEvent): void => {
        if (fromButton(e)) return;
        finish('begin');
      };
      this.beginBtn.addEventListener('click', () => finish('begin'));
      this.continueBtn.addEventListener('click', () => finish('continue'));
      window.addEventListener('keydown', onKey);
      window.addEventListener('pointerdown', onPointer);
    });
  }

  hide(): void {
    this.el.inert = true;
    this.el.setAttribute('aria-hidden', 'true');
    this.el.classList.add('gone');
    setTimeout(() => this.el.remove(), 1600);
  }
}
