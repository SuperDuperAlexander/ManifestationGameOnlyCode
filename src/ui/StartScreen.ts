/** "begin" = fresh start (checkpoint cleared). "continue" = keep the saved checkpoint. */
export type StartChoice = 'begin' | 'continue';

/**
 * A quiet start screen: the title, and "press any key or tap".
 * If a checkpoint exists, a small "Continue" button sits below the prompt.
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
    this.el.innerHTML = `
      <div class="ss-sun"></div>
      <h1 class="ss-title"></h1>
      <p class="ss-sub"></p>
      <p class="ss-prompt"></p>
      <div class="ss-actions">
        <button type="button" class="ss-btn ss-begin"></button>
        <button type="button" class="ss-btn ss-continue"></button>
      </div>`;
    parent.appendChild(this.el);
    this.actions = this.el.querySelector('.ss-actions') as HTMLDivElement;
    this.beginBtn = this.el.querySelector('.ss-begin') as HTMLButtonElement;
    this.continueBtn = this.el.querySelector('.ss-continue') as HTMLButtonElement;
  }

  /** Fills the texts once the dialogue table is loaded. `cont` = null when there is no checkpoint. */
  setTexts(title: string, sub: string, prompt: string, begin: string, cont: string | null): void {
    (this.el.querySelector('.ss-title') as HTMLElement).textContent = title;
    (this.el.querySelector('.ss-sub') as HTMLElement).textContent = sub;
    (this.el.querySelector('.ss-prompt') as HTMLElement).textContent = prompt;
    this.beginBtn.textContent = begin;
    this.continueBtn.textContent = cont ?? '';
    this.el.classList.toggle('has-save', cont !== null);
    this.el.classList.add('ready');
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
        if (e.code === 'F3' || e.repeat || fromButton(e)) return;
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
    this.el.classList.add('gone');
    setTimeout(() => this.el.remove(), 1600);
  }
}
