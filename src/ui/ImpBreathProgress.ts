export interface ImpBreathProgressState {
  visible: boolean;
  count: number;
  near: boolean;
  complete: boolean;
}

/** Shows the imp's real completed-breath progress during the helped inner finale. */
export class ImpBreathProgress {
  private readonly el = document.createElement('section');
  private readonly title = document.createElement('div');
  private readonly count = document.createElement('div');
  private readonly marks = document.createElement('div');
  private readonly remaining = document.createElement('div');
  private readonly status = document.createElement('div');
  private lastState = '';

  constructor(parent: HTMLElement, text: (key: string) => string, private readonly total: number) {
    this.el.className = 'imp-breath-progress';
    this.el.hidden = true;
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    this.title.className = 'imp-breath-title';
    this.title.textContent = text('impProgressTitle');
    this.count.className = 'imp-breath-count';
    this.marks.className = 'imp-breath-marks';
    this.marks.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < total; i++) {
      const mark = document.createElement('span');
      mark.className = 'imp-breath-mark';
      this.marks.append(mark);
    }
    this.remaining.className = 'imp-breath-remaining';
    this.status.className = 'imp-breath-status';
    this.el.append(this.title, this.count, this.marks, this.remaining, this.status);
    parent.append(this.el);
    this.text = text;
  }

  private readonly text: (key: string) => string;

  update(state: ImpBreathProgressState): void {
    this.el.hidden = !state.visible;
    if (!state.visible) return;
    const key = `${state.count}|${state.near}|${state.complete}`;
    if (key === this.lastState) return;
    this.lastState = key;
    this.count.textContent = `${state.count}/${this.total}`;
    this.count.setAttribute('aria-label', this.text('impProgressCount').replace('{count}', String(state.count)).replace('{total}', String(this.total)));
    [...this.marks.children].forEach((mark, i) => mark.classList.toggle('filled', i < state.count));
    const left = Math.max(0, this.total - state.count);
    this.remaining.textContent = state.complete
      ? this.text('impProgressDone').replace('{total}', String(this.total))
      : left === 1
        ? this.text('impProgressOneLeft')
        : this.text('impProgressManyLeft').replace('{count}', String(left));
    this.status.textContent = state.complete
      ? this.text('impProgressCalm')
      : state.near
        ? this.text('impProgressNear')
        : this.text('impProgressFar');
  }
}
