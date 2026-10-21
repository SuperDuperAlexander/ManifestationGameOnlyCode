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

/* Removed from src/ui/thought-card.css (tutorial action card CSS, replaced by ControlSpotlight):
/* Tutorial action card: same plaque, one big action button. Never blocks movement (only the button takes taps). */
.thought-plaque.action-card { --tc-w: min(420px, calc(100vw - var(--edge-left) - var(--edge-right))); top: calc(var(--edge-top) + 8px); height: auto; padding: 14px 18px 14px; background: color-mix(in srgb, var(--ui-paper) 78%, transparent); border-color: color-mix(in srgb, var(--gold) 32%, transparent); box-shadow: 0 6px 22px color-mix(in srgb, var(--umber) 12%, transparent); }
.thought-plaque.action-card.open { pointer-events: none; }
.action-card .thought-plaque-prompt { margin: 4px 18px 10px; font-size: 14px; color: var(--ui-deep); }
.action-card-row { display: flex; justify-content: center; }
.action-card-button, .action-card-close { pointer-events: auto; cursor: pointer; font: inherit; }
.action-card-button {
  display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 44px; min-width: 160px; padding: 6px 20px;
  border: 0; border-radius: 999px; color: var(--ui-deep);
  background: color-mix(in srgb, var(--gold) 70%, var(--ui-paper)); font-weight: 700; letter-spacing: .04em; font-size: 13px;
  box-shadow: 0 3px 10px color-mix(in srgb, var(--umber) 12%, transparent);
}
.action-card-button:hover { filter: brightness(1.04); }
.action-card-button.held { transform: scale(1.03); box-shadow: 0 0 0 3px color-mix(in srgb, var(--lantern-white) 80%, transparent), 0 0 30px color-mix(in srgb, var(--gold) 80%, transparent); }
.action-card-button .control-icon { width: 24px; height: 24px; flex: 0 0 auto; }
.action-card-button kbd { font-size: 10px; letter-spacing: 0; padding: 2px 6px; border-radius: 6px; background: color-mix(in srgb, var(--ui-paper) 55%, transparent); }
.action-card-close { position: absolute; top: 4px; right: 8px; width: 32px; height: 32px; border: 0; background: none; color: var(--ui-muted); font-size: 22px; line-height: 1; }
.action-card-button:focus-visible, .action-card-close:focus-visible { outline: 3px solid var(--ui-deep); outline-offset: 2px; }
body.action-card-open .next-step-hint { opacity: 0 !important; pointer-events: none; }
body.action-card-open .imp-breath-progress { top: calc(var(--edge-top) + 150px); }
body.thought-choice-open .action-card { opacity: 0; visibility: hidden; }
@media (max-height: 520px) {
  .action-card .thought-plaque-prompt { display: block; margin: 2px 22px 4px; font-size: 12px; }
  .action-card-button { min-height: 40px; padding: 4px 14px; }
}
*/
