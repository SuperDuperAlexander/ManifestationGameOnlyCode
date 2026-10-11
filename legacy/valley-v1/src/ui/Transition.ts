/**
 * The light-and-fog blend between chapters, and the calm card at the end of the chapter.
 */
export class Transition {
  private readonly el: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'transition';
    this.el.innerHTML = `
      <div class="tr-fog"></div>
      <div class="tr-light"></div>
      <div class="tr-card">
        <div class="tr-sun"></div>
        <h2 class="tr-title"></h2>
        <p class="tr-sub"></p>
        <p class="tr-line"></p>
        <p class="tr-next"></p>
      </div>`;
    parent.appendChild(this.el);
  }

  /** Light and fog rise and fill the screen over `seconds`. */
  blendIn(seconds: number): Promise<void> {
    this.el.style.setProperty('--tr-time', `${seconds}s`);
    this.el.classList.add('active');
    return new Promise((r) => setTimeout(r, seconds * 1000));
  }

  showCard(title: string, subtitle: string, line: string, next: string): void {
    const q = (s: string): HTMLElement => this.el.querySelector(s) as HTMLElement;
    q('.tr-title').textContent = title;
    q('.tr-sub').textContent = subtitle;
    q('.tr-line').textContent = line;
    q('.tr-next').textContent = next;
    this.el.classList.add('card');
  }
}
