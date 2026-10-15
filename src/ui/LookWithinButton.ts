import { createControlIcon } from './ControlIcons';

/** Touch diamond action. */
export class LookWithinButton {
  readonly el: HTMLDivElement;
  private readonly label: HTMLSpanElement;

  constructor(parent: HTMLElement, onPress: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'look-button';
    this.el.setAttribute('role', 'button');
    this.el.setAttribute('tabindex', '0');
    this.label = document.createElement('span');
    this.label.className = 'control-label';
    this.el.append(createControlIcon('look-within'), this.label);
    parent.appendChild(this.el);
    this.el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onPress();
    });
  }

  setLabel(label: string, accessibleLabel = label): void {
    this.label.textContent = label;
    this.el.setAttribute('aria-label', accessibleLabel);
    this.el.title = accessibleLabel;
  }
}
