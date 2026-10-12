/** Key names shown in the caps. These are the real bindings (see InputManager.ts and Game.ts). */
const KEYS = {
  walk: 'W A S D',
  breatheIn: 'Space',
  breatheOut: 'Shift',
  push: 'E',
  lookWithin: 'Q',
} as const;

/**
 * Small controls panel, bottom right on desktop: one row per action, key caps then label.
 * Hidden on touch devices (they have on-screen buttons).
 * Texts come from en.json through the lookup passed in (keys: controlsWalk, controlsBreatheIn, ...).
 */
export class ControlsHint {
  private readonly el: HTMLDivElement;
  private readonly rows: Record<'push' | 'lookWithin', HTMLDivElement>;
  private readonly touch: boolean;

  constructor(
    parent: HTMLElement,
    texts: (key: string) => string,
  ) {
    this.touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.el = document.createElement('div');
    this.el.className = 'controls-hint';
    this.el.setAttribute('aria-hidden', 'true');
    if (this.touch) this.el.style.display = 'none';

    const rowDefs: { key: string; cap: string; label: string; name?: 'push' | 'lookWithin' }[] = [
      { key: 'controlsWalk', cap: KEYS.walk, label: texts('controlsWalk') },
      { key: 'controlsBreatheIn', cap: KEYS.breatheIn, label: texts('controlsBreatheIn') },
      { key: 'controlsBreatheOut', cap: KEYS.breatheOut, label: texts('controlsBreatheOut') },
      { key: 'controlsPush', cap: KEYS.push, label: texts('controlsPush'), name: 'push' },
      { key: 'controlsLookWithin', cap: KEYS.lookWithin, label: texts('controlsLookWithin'), name: 'lookWithin' },
    ];

    const rows: Partial<Record<'push' | 'lookWithin', HTMLDivElement>> = {};
    for (const def of rowDefs) {
      const row = document.createElement('div');
      row.className = 'ch-row';
      const cap = document.createElement('span');
      cap.className = 'ch-key';
      cap.textContent = def.cap;
      const label = document.createElement('span');
      label.className = 'ch-label';
      label.textContent = def.label;
      row.append(cap, label);
      this.el.appendChild(row);
      if (def.name) rows[def.name] = row;
    }
    this.rows = rows as Record<'push' | 'lookWithin', HTMLDivElement>;

    parent.appendChild(this.el);
  }

  /** Fades the panel in. Does nothing on touch devices. */
  show(): void {
    if (this.touch) return;
    this.el.classList.add('visible');
  }

  /** Fades the panel out. */
  hide(): void {
    this.el.classList.remove('visible');
  }

  /** Shows or hides the push row (e.g. once push is part of the story). */
  setPushVisible(b: boolean): void {
    this.rows.push.classList.toggle('off', !b);
  }

  /** Shows or hides the look-within row (e.g. once the player may look within). */
  setLookWithinVisible(b: boolean): void {
    this.rows.lookWithin.classList.toggle('off', !b);
  }
}
