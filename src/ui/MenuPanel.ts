export type MenuText = (key: string) => string;
import { BREATH_DURATION_CHOICES, getBreathPreferences, setBreathPreference } from '../player/BreathPreferences';

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
      </div>
      <div class="menu-copy">
        <h2 id="menu-title"></h2>
        <p></p>
        <section class="menu-controls" aria-label=""></section>
        <section class="menu-breath-settings" aria-label=""></section>
        <button type="button" class="menu-return"></button>
      </div>
      <button type="button" class="menu-close"></button>`;
    parent.append(this.dialog);

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
    const settings = this.dialog.querySelector<HTMLElement>('.menu-breath-settings')!;
    settings.setAttribute('aria-label', text('breathSettings'));
    const settingsHeading = document.createElement('h3');
    settingsHeading.textContent = text('breathSettings');
    settings.append(settingsHeading);
    const preferences = getBreathPreferences();
    for (const [phase, labelKey] of [['inhaleSeconds', 'inhaleDuration'], ['exhaleSeconds', 'exhaleDuration']] as const) {
      const row = document.createElement('div');
      row.className = 'breath-setting-row';
      const label = document.createElement('span');
      label.textContent = text(labelKey);
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'breath-setting-slider';
      slider.min = String(BREATH_DURATION_CHOICES[0]);
      slider.max = String(BREATH_DURATION_CHOICES[BREATH_DURATION_CHOICES.length - 1]);
      slider.step = '1';
      slider.value = String(preferences[phase]);
      slider.setAttribute('aria-label', text(labelKey));
      slider.addEventListener('keydown', (event) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
          event.stopPropagation();
        }
      });
      const value = document.createElement('output');
      value.className = 'breath-setting-value';
      value.setAttribute('aria-live', 'polite');
      value.setAttribute('aria-atomic', 'true');
      const update = () => {
        const seconds = Number(slider.value);
        const valueText = `${seconds} ${text(seconds === 1 ? 'second' : 'seconds')}`;
        value.textContent = valueText;
        slider.setAttribute('aria-valuetext', valueText);
        const progress = ((seconds - Number(slider.min)) / (Number(slider.max) - Number(slider.min))) * 100;
        slider.style.setProperty('--slider-progress', `${progress}%`);
        setBreathPreference(phase, seconds);
      };
      slider.addEventListener('input', update);
      update();
      row.append(label, value, slider);
      settings.append(row);
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
