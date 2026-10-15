import { createControlIcon } from './ControlIcons';
import { InputManager } from '../core/InputManager';

/** Floating desktop actions. Text is supplied by the dialogue data. */
export class ControlsHint {
  private readonly el: HTMLDivElement;
  private readonly pushButton: HTMLButtonElement;
  private readonly lookButton: HTMLButtonElement;
  private readonly pushAction: HTMLDivElement;
  private readonly lookAction: HTMLDivElement;
  private readonly moveNote: HTMLDivElement;
  private readonly touch: boolean;
  private readonly heldKeys = new Set<string>();

  constructor(
    parent: HTMLElement,
    texts: (key: string) => string,
    actions?: { push: () => void; lookWithin: () => void },
  ) {
    this.touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.el = document.createElement('div');
    this.el.className = 'controls-hint';
    if (this.touch) this.el.style.display = 'none';

    this.moveNote = document.createElement('div');
    this.moveNote.className = 'move-note';
    const walk = document.createElement('span');
    walk.className = 'walk-label';
    walk.textContent = texts('controlsWalk');
    const keycap = document.createElement('span');
    keycap.className = 'keycap';
    keycap.textContent = 'W A S D';
    const arrow = document.createElement('span');
    arrow.className = 'controls-arrow-keys';
    arrow.textContent = texts('controlsArrowKeys');
    this.moveNote.append(keycap, walk, document.createTextNode(' · '), arrow);

    const group = document.createElement('div');
    group.className = 'action-group';
    this.pushAction = document.createElement('div');
    this.pushAction.className = 'action-shell push-shell';
    this.pushButton = this.makePill('push-action', 'push', texts('controlsPush'), 'E');
    this.pushAction.appendChild(this.pushButton);
    this.lookAction = document.createElement('div');
    this.lookAction.className = 'action-shell look-shell';
    this.lookButton = this.makePill('look-action', 'look-within', texts('controlsLookWithin'), 'Q');
    this.lookAction.appendChild(this.lookButton);

    const breathe = document.createElement('button');
    breathe.type = 'button';
    breathe.className = 'breathe-action';
    breathe.setAttribute('aria-label', `${texts('controlsBreatheIn')}. ${texts('guideHoldInDesktop')}.`);
    breathe.appendChild(createControlIcon('breathe', 'breath-icon'));
    const breathCopy = document.createElement('span');
    breathCopy.className = 'breath-copy';
    const inLabel = document.createElement('span');
    inLabel.className = 'breath-verb';
    inLabel.textContent = texts('controlsBreatheIn');
    const holdHint = document.createElement('small');
    holdHint.className = 'breath-hint';
    holdHint.textContent = texts('guideHoldInDesktop');
    const key = document.createElement('kbd');
    key.textContent = 'Space';
    breathCopy.append(inLabel, holdHint);
    breathe.append(breathCopy, key);

    const secondary = document.createElement('button');
    secondary.type = 'button';
    secondary.className = 'breath-secondary';
    secondary.setAttribute('aria-label', texts('controlsBreatheOut'));
    const outLabel = document.createElement('span');
    outLabel.className = 'breath-verb';
    outLabel.textContent = texts('controlsBreatheOut');
    const outKey = document.createElement('kbd');
    outKey.textContent = 'Shift';
    secondary.append(createControlIcon('breathe'), outLabel, outKey);

    this.pushButton.addEventListener('click', () => actions?.push());
    this.lookButton.addEventListener('click', () => actions?.lookWithin());
    this.bindHold(breathe, 'Space');
    this.bindHold(secondary, 'ShiftLeft');
    group.append(this.pushAction, this.lookAction, breathe, secondary);
    this.el.append(this.moveNote, group);
    parent.appendChild(this.el);
  }

  private makePill(className: string, icon: 'push' | 'look-within', labelText: string, keyText: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    const label = document.createElement('span');
    label.className = 'action-label';
    label.textContent = labelText;
    const key = document.createElement('kbd');
    key.textContent = keyText;
    button.append(createControlIcon(icon), label, key);
    button.setAttribute('aria-label', `${labelText} (${keyText})`);
    return button;
  }

  private bindHold(button: HTMLButtonElement, code: string): void {
    const hold = (id: string): void => {
      if (this.heldKeys.has(id)) return;
      this.heldKeys.add(id);
      InputManager.setUIKey(code, true);
      button.classList.add('held');
    };
    const release = (id: string): void => {
      if (!this.heldKeys.delete(id)) return;
      if (![...this.heldKeys].some((held) => held.startsWith(`${code}:`))) InputManager.setUIKey(code, false);
      button.classList.remove('held');
    };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (this.heldKeys.size > 0 && !this.heldKeys.has(`${code}:${event.pointerId}`)) return;
      button.setPointerCapture(event.pointerId);
      hold(`${code}:${event.pointerId}`);
    });
    const pointerRelease = (event: PointerEvent): void => release(`${code}:${event.pointerId}`);
    button.addEventListener('pointerup', pointerRelease);
    button.addEventListener('pointercancel', pointerRelease);
    button.addEventListener('lostpointercapture', pointerRelease);
    button.addEventListener('keydown', (event) => {
      if ((event.code !== 'Space' && event.code !== 'Enter') || event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      hold(`${code}:key:${event.code}`);
    });
    button.addEventListener('keyup', (event) => {
      if (event.code === 'Space' || event.code === 'Enter') event.stopPropagation();
      release(`${code}:key:${event.code}`);
    });
    button.addEventListener('blur', () => {
      for (const id of [...this.heldKeys]) if (id.startsWith(`${code}:key:`)) release(id);
    });
    window.addEventListener('blur', () => releaseAll());
    const releaseAll = (): void => {
      for (const id of [...this.heldKeys]) if (id.startsWith(`${code}:`)) release(id);
    };
  }

  /** Fades the controls in. Does nothing on touch devices. */
  show(): void {
    if (!this.touch) this.el.classList.add('visible');
  }

  hide(): void { this.el.classList.remove('visible'); }
  setPushVisible(visible: boolean): void { this.pushAction.classList.toggle('off', !visible); }
  setLookWithinVisible(visible: boolean): void { this.lookAction.classList.toggle('off', !visible); }
  setLookWithinLabel(text: string): void {
    this.lookButton.querySelector('.action-label')!.textContent = text;
    this.lookButton.setAttribute('aria-label', `${text} (Q)`);
  }
}
