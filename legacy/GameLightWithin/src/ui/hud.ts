import { t } from '../content/strings.en';
import type { InputState } from '../core/input';
import { isTouchDevice } from '../core/quality';
import { BreathCircle } from './breathCircle';
import { el } from './dom';

/**
 * The head-up display: the breath circle, the touch controls, the pause
 * button, the soft hint line and the thought that appears inside the fog.
 */
export class Hud {
  readonly root: HTMLElement;
  readonly breathCircle: BreathCircle;
  private readonly hint: HTMLElement;
  private readonly fogText: HTMLElement;
  private readonly pushBtn: HTMLButtonElement;
  private readonly interactBtn: HTMLButtonElement;
  private readonly breathInBtn: HTMLButtonElement;
  private readonly breathOutBtn: HTMLButtonElement;
  private readonly joyKnob: HTMLElement;

  constructor(
    private readonly input: InputState,
    onPause: () => void,
    onPush: () => void,
    onInteract: () => void,
    circleStrength?: number,
  ) {
    this.breathCircle = new BreathCircle(circleStrength);
    // A laptop with a touchscreen reports touch points but is played with a
    // keyboard, so showing the joystick straight away just clutters the view.
    // The touch controls appear the first time a finger is actually used.
    if (isTouchDevice() && !matchMedia('(any-hover: hover)').matches) {
      document.body.classList.add('lw-touch');
    }
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'touch') document.body.classList.add('lw-touch');
      },
      { capture: true },
    );

    this.hint = el('div', { class: 'lw-hint', role: 'status', 'aria-live': 'polite' });
    this.fogText = el('div', { class: 'lw-fog-text', 'aria-hidden': 'true' });

    const pauseBtn = el(
      'button',
      { class: 'lw-icon-btn', type: 'button', 'data-ui': '1', 'aria-label': t().hud.pause },
      '❙❙',
    );
    pauseBtn.addEventListener('click', onPause);

    this.pushBtn = el(
      'button',
      { class: 'lw-push-btn', type: 'button', 'data-ui': '1' },
      t().hud.push,
      el('span', { class: 'lw-key', 'aria-hidden': 'true' }, 'E'),
    );
    this.pushBtn.addEventListener('click', onPush);
    this.pushBtn.style.display = 'none';

    this.interactBtn = el(
      'button',
      { class: 'lw-push-btn', type: 'button', 'data-ui': '1' },
      t().hud.plant,
      el('span', { class: 'lw-key', 'aria-hidden': 'true' }, 'Enter'),
    );
    this.interactBtn.addEventListener('click', onInteract);
    this.interactBtn.style.display = 'none';

    // Two buttons, one per half of the breath, to match the two keys.
    const makeBreathButton = (
      label: string,
      set: (on: boolean) => void,
      cls: string,
    ): HTMLButtonElement => {
      const btn = el(
        'button',
        { class: `lw-breath-btn ${cls}`, type: 'button', 'data-ui': '1', 'aria-label': label },
        label,
      );
      const hold = (on: boolean) => (): void => {
        set(on);
        btn.dataset.held = String(on);
      };
      btn.addEventListener('pointerdown', hold(true));
      btn.addEventListener('pointerup', hold(false));
      btn.addEventListener('pointercancel', hold(false));
      btn.addEventListener('pointerleave', hold(false));
      // The buttons must work from the keyboard too.
      btn.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') hold(true)();
      });
      btn.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') hold(false)();
      });
      return btn;
    };

    this.breathInBtn = makeBreathButton(
      t().hud.breatheInShort,
      (on) => (this.input.touchBreathIn = on),
      'lw-breath-btn--in',
    );
    this.breathOutBtn = makeBreathButton(
      t().hud.breatheOutShort,
      (on) => (this.input.touchBreathOut = on),
      'lw-breath-btn--out',
    );

    this.joyKnob = el('div', { class: 'lw-joystick-knob' });
    const joystick = el(
      'div',
      { class: 'lw-joystick', 'data-ui': '1', 'aria-label': t().hud.joystick, role: 'application' },
      this.joyKnob,
    );
    this.input.onJoystick = (x, y): void => {
      this.joyKnob.style.transform = `translate(${x}px, ${y}px)`;
    };

    this.root = el(
      'div',
      { id: 'lw-hud' },
      this.fogText,
      this.breathCircle.root,
      this.hint,
      el('div', { class: 'lw-corner' }, pauseBtn),
      joystick,
      // One button per thumb. The in-breath sits on the left with the
      // joystick, the out-breath on the right: both halves are something you
      // press, and neither is something you sit on and watch.
      el('div', { class: 'lw-touch-left' }, this.breathInBtn),
      el('div', { class: 'lw-touch-right' }, this.breathOutBtn),
      // Push and plant sit where the right thumb rests. The breath pair sits
      // above them, level with each other, so the two halves of one breath
      // are the same gesture on either side.
      el('div', { class: 'lw-touch-actions' }, this.pushBtn, this.interactBtn),
    );
    this.joystickZone = joystick;
  }

  readonly joystickZone: HTMLElement;

  setPushVisible(on: boolean): void {
    this.pushBtn.style.display = on ? '' : 'none';
  }

  setInteractVisible(on: boolean): void {
    this.interactBtn.style.display = on ? '' : 'none';
  }

  /** A short soft line. Used for controls, never to explain the meaning. */
  showHint(text: string | null): void {
    if (text === null) {
      this.hint.dataset.show = 'false';
      return;
    }
    this.hint.textContent = text;
    this.hint.dataset.show = 'true';
  }

  /** The thought inside the fog appears letter by letter. */
  setFogText(text: string, progress: number): void {
    if (progress <= 0) {
      this.fogText.style.opacity = '0';
      this.fogText.textContent = '';
      return;
    }
    const shown = Math.ceil(text.length * Math.min(1, progress));
    this.fogText.textContent = text.slice(0, shown);
    this.fogText.style.opacity = String(Math.min(1, progress * 2.2));
  }

  setVisible(on: boolean): void {
    this.root.style.display = on ? '' : 'none';
  }
}
