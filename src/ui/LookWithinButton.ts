import { createControlIcon } from './ControlIcons';

/** Gold diamond touch button (above the breath button). Press = Look Within. */
export class LookWithinButton {
  readonly el: HTMLDivElement;

  constructor(parent: HTMLElement, onPress: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'look-button';
    this.el.setAttribute('role', 'button');
    this.el.appendChild(createControlIcon('look-within'));
    parent.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onPress();
    });
  }

  setLabel(label: string, accessibleLabel = label): void {
    this.el.setAttribute('aria-label', accessibleLabel);
    this.el.title = accessibleLabel;
  }
}
