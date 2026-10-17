import { InputManager } from '../core/InputManager';
import { createControlIcon } from './ControlIcons';

export type ActionCardKind = 'look' | 'press' | 'hold' | 'ok';

export interface ActionCardView {
  id: string;
  kind: ActionCardKind;
  title: string;
  text: string;
  button: string;
  key: string;
  icon: 'look-within' | 'push' | 'collect' | 'breathe';
}

/** Tutorial card (same look as the thought card). One clear action button; never blocks movement. */
export class ActionCard {
  private readonly el = document.createElement('div');
  private readonly title = document.createElement('div');
  private readonly text = document.createElement('div');
  private readonly row = document.createElement('div');
  private readonly close = document.createElement('button');
  private currentId = '';
  private holding = false;
  onDismiss: (id: string) => void = () => {};

  constructor(parent: HTMLElement, closeLabel: string, private readonly act: { look: () => void; press: () => void }) {
    this.el.className = 'thought-plaque action-card';
    this.el.setAttribute('role', 'group');
    this.title.className = 'thought-plaque-title';
    this.text.className = 'thought-plaque-prompt';
    this.row.className = 'action-card-row';
    this.close.type = 'button';
    this.close.className = 'action-card-close';
    this.close.textContent = '×';
    this.close.setAttribute('aria-label', closeLabel);
    this.close.addEventListener('click', () => this.onDismiss(this.currentId));
    this.el.append(this.close, this.title, this.text, this.row);
    parent.appendChild(this.el);
  }

  get id(): string { return this.currentId; }

  show(v: ActionCardView): void {
    if (this.currentId === v.id) return;
    this.releaseHold();
    this.currentId = v.id;
    this.title.textContent = v.title;
    this.text.textContent = v.text;
    this.el.setAttribute('aria-label', v.title);
    this.row.textContent = '';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'action-card-button';
    if (v.kind !== 'ok') b.append(createControlIcon(v.icon));
    const label = document.createElement('span');
    label.textContent = v.button;
    b.append(label);
    if (v.key) {
      const k = document.createElement('kbd');
      k.textContent = v.key;
      b.append(k);
    }
    b.setAttribute('aria-label', v.key ? `${v.button} (${v.key})` : v.button);
    if (v.kind === 'hold') {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        this.holding = true;
        b.classList.add('held');
        InputManager.setUIKey('Space', true);
      });
      const up = (): void => { this.releaseHold(); b.classList.remove('held'); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
    } else {
      b.addEventListener('click', () => {
        if (v.kind === 'look') this.act.look();
        else if (v.kind === 'press') this.act.press();
        else this.onDismiss(v.id);
      });
    }
    this.row.append(b);
    this.el.classList.remove('pop');
    void this.el.offsetWidth;
    this.el.classList.add('open', 'pop');
    document.body.classList.add('action-card-open');
  }

  hide(): void {
    if (!this.currentId) return;
    this.releaseHold();
    this.currentId = '';
    this.el.classList.remove('open', 'pop');
    document.body.classList.remove('action-card-open');
  }

  private releaseHold(): void {
    if (!this.holding) return;
    this.holding = false;
    InputManager.setUIKey('Space', false);
  }
}
