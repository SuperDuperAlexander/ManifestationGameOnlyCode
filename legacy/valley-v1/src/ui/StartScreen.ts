/**
 * A quiet start screen: the title, and "press any key or tap".
 * It also makes sure sound may play (browsers need one key press or tap first).
 */
export class StartScreen {
  private readonly el: HTMLDivElement;

  constructor(parent: HTMLElement, prompt: string) {
    this.el = document.createElement('div');
    this.el.className = 'start-screen';
    this.el.innerHTML = `
      <div class="ss-sun"></div>
      <h1 class="ss-title">Light Within</h1>
      <p class="ss-sub">Chapter 1 · The Awakening</p>
      <p class="ss-prompt"></p>`;
    (this.el.querySelector('.ss-prompt') as HTMLElement).textContent = prompt;
    parent.appendChild(this.el);
  }

  /** Resolves on the first key press, click or tap. Then fades away. */
  waitForStart(): Promise<void> {
    this.el.classList.add('ready');
    return new Promise((resolve) => {
      const go = (e: Event): void => {
        if (e instanceof KeyboardEvent && (e.code === 'F3' || e.repeat)) return;
        window.removeEventListener('keydown', go);
        window.removeEventListener('pointerdown', go);
        this.hide();
        resolve();
      };
      window.addEventListener('keydown', go);
      window.addEventListener('pointerdown', go);
    });
  }

  hide(): void {
    this.el.classList.add('gone');
    setTimeout(() => this.el.remove(), 1600);
  }
}
