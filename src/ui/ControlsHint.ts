import { createControlIcon } from './ControlIcons';
import { InputManager } from '../core/InputManager';
import { TUNING } from '../config/tuning';

/** Floating desktop actions. Text is supplied by the dialogue data. */
export class ControlsHint {
  private readonly el: HTMLDivElement;
  private readonly pushButton: HTMLButtonElement;
  private readonly lookButton: HTMLButtonElement;
  private readonly pushAction: HTMLDivElement;
  private readonly lookAction: HTMLDivElement;
  private readonly moveNote: HTMLDivElement;
  private readonly inhaleButton: HTMLButtonElement;
  private readonly exhaleButton: HTMLButtonElement;
  private readonly plaque: HTMLDivElement;
  private readonly thoughtEl: HTMLDivElement;
  private readonly touch: boolean;
  private readonly inLabel: HTMLSpanElement;
  private readonly heldKeys = new Set<string>();
  private pushContext: 'push' | 'collectApple' | 'interact' = 'push';

  constructor(
    parent: HTMLElement,
    private readonly texts: (key: string) => string,
    actions?: { push: () => void; lookWithin: () => void },
    touch = false,
  ) {
    // Same decision as Game (isTouchDevice or ?touch): only one control set is on screen.
    this.touch = touch;
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
    // The walking hint fades away for good after the first step.
    const moveKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    const onMove = (event: KeyboardEvent): void => {
      if (!moveKeys.has(event.code)) return;
      window.removeEventListener('keydown', onMove);
      window.setTimeout(() => this.moveNote.classList.add('done'), TUNING.ui.moveHintFadeDelay * 1000);
    };
    window.addEventListener('keydown', onMove);

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
    this.inhaleButton = breathe;
    breathe.type = 'button';
    breathe.className = 'breathe-action';
    breathe.setAttribute('aria-label', `${texts('controlsBreatheIn')}. ${texts('guideHoldInDesktop')}.`);
    breathe.appendChild(createControlIcon('breathe', 'breath-icon'));
    const breathCopy = document.createElement('span');
    breathCopy.className = 'breath-copy';
    const inLabel = document.createElement('span');
    this.inLabel = inLabel;
    inLabel.className = 'breath-verb';
    inLabel.textContent = texts('controlsBreatheIn');
    const holdHint = document.createElement('small');
    holdHint.className = 'breath-hint';
    holdHint.textContent = texts('guideHoldInDesktop');
    const key = document.createElement('kbd');
    key.textContent = 'Space';
    // In the thought card the two breath buttons read as one option: Breathe [Space] [Shift].
    const extraKey = document.createElement('kbd');
    extraKey.className = 'kbd-extra';
    extraKey.textContent = 'Shift';
    breathCopy.append(inLabel, holdHint);
    breathe.append(breathCopy, key, extraKey);

    const secondary = document.createElement('button');
    this.exhaleButton = secondary;
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
    const pushChoice = document.createElement('div');
    pushChoice.className = 'thought-push-choice';
    pushChoice.setAttribute('role', 'group');
    pushChoice.setAttribute('aria-label', texts('controlsPush'));
    pushChoice.append(this.pushAction);
    const breathChoice = document.createElement('div');
    breathChoice.className = 'thought-breathe-choice';
    breathChoice.setAttribute('role', 'group');
    breathChoice.setAttribute('aria-label', texts('controlsBreathe'));
    const breathTitle = document.createElement('span');
    breathTitle.className = 'thought-choice-title';
    breathTitle.textContent = texts('controlsBreathe');
    const breathActions = document.createElement('div');
    breathActions.className = 'thought-breathe-actions';
    breathActions.append(breathe, secondary);
    breathChoice.append(breathTitle, breathActions);
    group.append(pushChoice, breathChoice, this.lookAction);
    this.el.append(this.moveNote, group);
    parent.appendChild(this.el);

    // Plaque (card) behind the choice buttons. It is shown for desktop and touch alike.
    this.plaque = document.createElement('div');
    this.plaque.className = 'thought-plaque';
    this.plaque.setAttribute('role', 'group');
    const title = document.createElement('div');
    title.className = 'thought-plaque-title';
    title.setAttribute('role', 'status');
    title.setAttribute('aria-live', 'polite');
    title.textContent = texts('thoughtCardTitle');
    const prompt = document.createElement('div');
    prompt.className = 'thought-plaque-prompt';
    prompt.textContent = texts('thoughtCardPrompt');
    this.plaque.setAttribute('aria-label', texts('thoughtCardTitle'));
    this.thoughtEl = document.createElement('div');
    this.thoughtEl.className = 'thought-plaque-text';
    this.plaque.append(title, this.thoughtEl, prompt);
    parent.appendChild(this.plaque);
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
  setThoughtChoiceActive(active: boolean): void {
    this.el.classList.toggle('thought-choice-active', active);
    this.plaque.classList.toggle('open', active);
    document.body.classList.toggle('thought-choice-open', active);
    this.inLabel.textContent = this.texts(active ? 'controlsBreathe' : 'controlsBreatheIn');
    if (!active) for (const button of [this.pushButton, this.inhaleButton, this.exhaleButton]) button.classList.remove('thought-choice-pop');
  }
  /** Shows the actual thought on the card (presentation only). */
  setThoughtText(text: string): void {
    if (this.thoughtEl.textContent !== text) this.thoughtEl.textContent = text;
    this.plaque.classList.toggle('has-text', text !== '');
  }
  /** Breath level 0..1 drives the fill of the breath buttons. */
  setBreathLevel(level: number): void {
    document.body.style.setProperty('--breath-level', level.toFixed(3));
  }
  cueThoughtChoice(): void {
    this.plaque.classList.remove('pop');
    void this.plaque.offsetWidth;
    this.plaque.classList.add('pop');
    for (const button of [this.pushButton, this.inhaleButton, this.exhaleButton]) {
      button.classList.remove('thought-choice-pop');
      void button.offsetWidth;
      button.classList.add('thought-choice-pop');
      button.onanimationend = () => button.classList.remove('thought-choice-pop');
    }
  }
  cuePushOpportunity(token: string): void {
    if (!token) {
      this.pushButton.classList.remove('push-ready-pop');
      return;
    }
    if (this.pushContext !== 'push' || this.pushAction.classList.contains('off')) return;
    this.pushButton.classList.remove('push-ready-pop');
    void this.pushButton.offsetWidth;
    this.pushButton.classList.add('push-ready-pop');
    this.pushButton.onanimationend = () => this.pushButton.classList.remove('push-ready-pop');
  }
  setActionContext(context: 'push' | 'collectApple' | 'interact'): void {
    if (context === this.pushContext) return;
    this.pushContext = context;
    const label = this.texts(context === 'collectApple' ? 'controlsCollectApple' : context === 'interact' ? 'controlsInteract' : 'controlsPush');
    const icon = context === 'collectApple' ? 'collect' : 'push';
    const iconEl = this.pushButton.querySelector('svg');
    iconEl?.replaceWith(createControlIcon(icon));
    this.pushButton.querySelector('.action-label')!.textContent = label;
    this.pushButton.setAttribute('aria-label', `${label} (E)`);
    this.pushButton.classList.toggle('collect-apple', context === 'collectApple');
    this.pushButton.classList.toggle('tree-interact', context === 'interact');
    if (context !== 'push') this.pushButton.classList.remove('push-ready-pop');
  }
  setLookWithinVisible(visible: boolean): void { this.lookAction.classList.toggle('off', !visible); }
  setLookWithinLabel(text: string): void {
    this.lookButton.querySelector('.action-label')!.textContent = text;
    this.lookButton.setAttribute('aria-label', `${text} (Q)`);
  }
}
