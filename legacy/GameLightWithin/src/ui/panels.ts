import { GAME_TITLE, t } from '../content/strings.en';
import type { Answers, SettingsData } from '../core/save';
import { CHAPTERS, CHAPTER_IDS } from '../content/chapters';
import type { ChapterId } from '../content/chapters';
import type { FeelingType } from '../content/chapter2';
import { button, el, focusFirst } from './dom';

/**
 * Every overlay panel: the start screen, the questions, settings, pause,
 * the seed choice, the learning cycle and the chapter end screen.
 */
export class Panels {
  readonly root: HTMLElement;
  private current: HTMLElement | null = null;
  /** Called whenever a panel opens or closes, so the game can pause. */
  onOpenChanged: ((open: boolean) => void) | null = null;
  onSelect: (() => void) | null = null;

  constructor() {
    this.root = el('div', { id: 'lw-panels' });
  }

  get isOpen(): boolean {
    return this.current !== null;
  }

  close(): void {
    this.current?.remove();
    this.current = null;
    this.onOpenChanged?.(false);
  }

  private show(panel: HTMLElement): void {
    this.current?.remove();
    const overlay = el('div', { class: 'lw-overlay' }, panel);
    this.root.append(overlay);
    this.current = overlay;
    this.onOpenChanged?.(true);
    focusFirst(panel);
  }

  private tap(fn: () => void): () => void {
    return () => {
      this.onSelect?.();
      fn();
    };
  }

  /**
   * Start screen: the title, the chapters, and settings.
   *
   * Every chapter the player has unlocked is listed, so they can walk one
   * again. A chapter that is not built yet is shown but not offered, so the
   * shape of the whole thing is visible from the first screen.
   */
  startScreen(options: {
    unlocked: ChapterId[];
    resumeChapter: ChapterId | null;
    onChapter: (id: ChapterId) => void;
    onResume: () => void;
    onSettings: () => void;
  }): void {
    const s = t();
    const panel = el(
      'div',
      { class: 'lw-panel', role: 'dialog', 'aria-label': GAME_TITLE },
      el('h1', { class: 'lw-title' }, GAME_TITLE),
      el('p', { class: 'lw-sub' }, s.start.subtitle),
      el('p', { class: 'lw-build' }, `${s.start.version} ${__BUILD_STAMP__}`),
    );

    if (options.resumeChapter !== null) {
      panel.append(
        el(
          'div',
          { class: 'lw-row' },
          button(s.pause.resume, 'lw-btn', this.tap(options.onResume)),
        ),
      );
    }

    panel.append(el('h2', { class: 'lw-heading' }, s.chapters.select));
    const list = el('div', { class: 'lw-row' });
    for (const id of CHAPTER_IDS) {
      const info = CHAPTERS[id];
      const unlocked = options.unlocked.includes(id);
      const b = el('button', {
        class: `lw-btn lw-btn--stack${unlocked ? '' : ' lw-btn--quiet'}`,
        type: 'button',
        'data-ui': '1',
        'data-chapter': String(id),
      });
      b.append(
        `${String(id)}. ${s.chapters[info.titleKey]}`,
        el('small', {}, unlocked ? '' : info.built ? s.chapters.locked : s.end.comingSoon),
      );
      b.disabled = !unlocked;
      if (unlocked)
        b.addEventListener(
          'click',
          this.tap(() => options.onChapter(id)),
        );
      list.append(b);
    }
    panel.append(
      list,
      el(
        'div',
        { class: 'lw-row' },
        button(s.start.settings, 'lw-btn lw-btn--quiet', this.tap(options.onSettings)),
      ),
    );
    this.show(panel);
  }

  /** The two questions, each on a 1 to 5 scale. */
  questions(initial: Answers, onDone: (a: Answers) => void, closing = false): void {
    const s = t();
    const answers: Answers = { receive: initial.receive, calm: initial.calm };
    // The same two questions are asked twice: once before the first chapter
    // and once after the last one in the build. Only the heading changes.
    const heading = closing ? s.questions.headingEnd : s.questions.heading;
    const panel = el(
      'div',
      { class: 'lw-panel', role: 'dialog', 'aria-label': heading },
      el('h2', { class: 'lw-heading' }, heading),
    );

    const done = button(
      s.questions.continue,
      'lw-btn',
      this.tap(() => onDone(answers)),
    );
    done.disabled = true;
    const refresh = (): void => {
      done.disabled = answers.receive === null || answers.calm === null;
    };

    for (const key of ['receive', 'calm'] as const) {
      panel.append(
        el(
          'p',
          { class: 'lw-question' },
          key === 'receive' ? s.questions.receive : s.questions.calm,
        ),
      );
      const scale = el('div', { class: 'lw-scale', role: 'radiogroup', 'aria-label': key });
      const buttons: HTMLButtonElement[] = [];
      for (let i = 1; i <= 5; i++) {
        const b = el(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': 'false',
            'data-ui': '1',
            'data-value': String(i),
          },
          String(i),
        );
        b.addEventListener('click', () => {
          answers[key] = i;
          for (const other of buttons) other.setAttribute('aria-checked', String(other === b));
          this.onSelect?.();
          refresh();
        });
        buttons.push(b);
        scale.append(b);
      }
      panel.append(
        scale,
        el(
          'div',
          { class: 'lw-scale-ends' },
          el('span', {}, key === 'receive' ? s.questions.receiveLow : s.questions.calmLow),
          el('span', {}, key === 'receive' ? s.questions.receiveHigh : s.questions.calmHigh),
        ),
      );
      const stored = answers[key];
      if (stored !== null) buttons[stored - 1]?.setAttribute('aria-checked', 'true');
    }

    panel.append(
      el('p', { class: 'lw-note' }, s.questions.privacy),
      el('div', { class: 'lw-row' }, done),
    );
    refresh();
    this.show(panel);
  }

  settings(data: SettingsData, onChange: (d: SettingsData) => void, onBack: () => void): void {
    const s = t();
    const next = { ...data };
    const panel = el(
      'div',
      { class: 'lw-panel', role: 'dialog', 'aria-label': s.settings.heading },
      el('h2', { class: 'lw-heading' }, s.settings.heading),
    );

    const segment = <T extends string>(
      label: string,
      options: { id: T; label: string }[],
      value: T,
      set: (v: T) => void,
    ): HTMLElement => {
      const group = el('div', { class: 'lw-seg', role: 'group', 'aria-label': label });
      const buttons: HTMLButtonElement[] = [];
      for (const option of options) {
        const b = el(
          'button',
          { type: 'button', 'data-ui': '1', 'aria-pressed': String(option.id === value) },
          option.label,
        );
        b.addEventListener('click', () => {
          set(option.id);
          for (const other of buttons) other.setAttribute('aria-pressed', String(other === b));
          this.onSelect?.();
          onChange(next);
        });
        buttons.push(b);
        group.append(b);
      }
      return el('div', { class: 'lw-field' }, el('span', {}, label), group);
    };

    panel.append(
      segment(
        s.settings.rhythm,
        [
          { id: 'normal' as const, label: s.settings.rhythmNormal },
          { id: 'slow' as const, label: s.settings.rhythmSlow },
          { id: 'easy' as const, label: s.settings.rhythmEasy },
        ],
        next.rhythm,
        (v) => (next.rhythm = v),
      ),
      segment(
        s.settings.quality,
        [
          { id: 'auto' as const, label: s.settings.qualityAuto },
          { id: 'low' as const, label: s.settings.qualityLow },
          { id: 'medium' as const, label: s.settings.qualityMedium },
          { id: 'high' as const, label: s.settings.qualityHigh },
        ],
        next.quality,
        (v) => (next.quality = v),
      ),
    );

    const slider = el('input', {
      type: 'range',
      min: '0',
      max: '100',
      value: String(Math.round(next.volume * 100)),
      'data-ui': '1',
      'aria-label': s.settings.volume,
    }) as HTMLInputElement;
    slider.addEventListener('input', () => {
      next.volume = Number(slider.value) / 100;
      onChange(next);
    });
    panel.append(el('div', { class: 'lw-field' }, el('span', {}, s.settings.volume), slider));

    panel.append(
      segment(
        s.settings.mute,
        [
          { id: 'off' as const, label: s.settings.off },
          { id: 'on' as const, label: s.settings.on },
        ],
        next.muted ? 'on' : 'off',
        (v) => (next.muted = v === 'on'),
      ),
      segment(
        s.settings.reducedMotion,
        [
          { id: 'off' as const, label: s.settings.off },
          { id: 'on' as const, label: s.settings.on },
        ],
        next.reducedMotion ? 'on' : 'off',
        (v) => (next.reducedMotion = v === 'on'),
      ),
      segment(
        s.settings2.softStorm,
        [
          { id: 'off' as const, label: s.settings.off },
          { id: 'on' as const, label: s.settings.on },
        ],
        next.softStorm ? 'on' : 'off',
        (v) => (next.softStorm = v === 'on'),
      ),
      el('div', { class: 'lw-row' }, button(s.start.back, 'lw-btn', this.tap(onBack))),
    );
    this.show(panel);
  }

  pause(
    onResume: () => void,
    onSettings: () => void,
    onStart: () => void,
    heading: string = t().pause.heading,
  ): void {
    const s = t();
    const panel = el(
      'div',
      { class: 'lw-panel', role: 'dialog', 'aria-label': heading },
      el('h2', { class: 'lw-title' }, heading),
      el(
        'div',
        { class: 'lw-row' },
        button(s.pause.resume, 'lw-btn', this.tap(onResume)),
        button(s.pause.settings, 'lw-btn lw-btn--quiet', this.tap(onSettings)),
        button(s.pause.toStart, 'lw-btn lw-btn--quiet', this.tap(onStart)),
      ),
    );
    this.show(panel);
  }

  /**
   * The seed choice. Each chapter offers the one seed its place can hold:
   * a bridge over the chapter 1 gap, a tree in the chapter 2 meadows.
   */
  seedChoice(
    canAfford: boolean,
    onPlant: () => void,
    onCancel: () => void,
    offered: 'bridge' | 'tree' = 'bridge',
  ): void {
    const s = t();
    const panel = el(
      'div',
      { class: 'lw-panel', role: 'dialog', 'aria-label': s.seed.heading },
      el('h2', { class: 'lw-heading' }, s.seed.heading),
    );
    const row = el('div', { class: 'lw-row' });
    const labels = {
      bridge: s.seed.bridge,
      tree: s.seed.tree,
      house: s.seed.house,
      well: s.seed.well,
    };

    for (const key of ['bridge', 'tree', 'house', 'well'] as const) {
      if (key === offered) {
        const b = el('button', {
          class: 'lw-btn lw-btn--stack',
          type: 'button',
          'data-ui': '1',
          'data-seed': key,
        });
        b.append(labels[key], el('small', {}, canAfford ? s.seed.cost : s.seed.notEnough));
        b.disabled = !canAfford;
        b.addEventListener('click', this.tap(onPlant));
        row.append(b);
        continue;
      }
      const b = el('button', {
        class: 'lw-btn lw-btn--quiet lw-btn--stack',
        type: 'button',
        disabled: 'true',
      });
      b.append(labels[key], el('small', {}, s.seed.comingSoon));
      row.append(b);
    }

    panel.append(
      row,
      el(
        'div',
        { class: 'lw-row' },
        button(s.seed.cancel, 'lw-btn lw-btn--quiet', this.tap(onCancel)),
      ),
    );
    this.show(panel);
  }

  /** Learning cycle step 1. Every answer gets the same reply. */
  reflect(onNext: () => void): void {
    const s = t();
    const panel = el(
      'div',
      { class: 'lw-panel', role: 'dialog', 'aria-label': s.reflect.question },
      el('h2', { class: 'lw-heading' }, s.reflect.question),
    );
    const row = el('div', { class: 'lw-row' });
    const reply = el('p', { class: 'lw-text' }, '');
    reply.style.visibility = 'hidden';
    const next = button(s.end.next, 'lw-btn', this.tap(onNext));
    next.style.display = 'none';

    for (const answer of [
      s.reflect.answerCalm,
      s.reflect.answerImpatient,
      s.reflect.answerNothing,
    ]) {
      row.append(
        button(
          answer,
          'lw-btn lw-btn--quiet',
          this.tap(() => {
            reply.textContent = s.reflect.reply;
            reply.style.visibility = 'visible';
            row.style.display = 'none';
            next.style.display = '';
            next.focus();
          }),
        ),
      );
    }
    panel.append(row, reply, el('div', { class: 'lw-row' }, next));
    this.show(panel);
  }

  /**
   * Learning cycle step 1 for chapter 2. Every answer gets the same reply,
   * including "None": noticing nothing is also noticing.
   */
  reflect2(onNext: () => void): void {
    const s = t();
    const panel = el(
      'div',
      { class: 'lw-panel', role: 'dialog', 'aria-label': s.reflect2.question },
      el('h2', { class: 'lw-heading' }, s.reflect2.question),
    );
    const row = el('div', { class: 'lw-row' });
    const reply = el('p', { class: 'lw-text' }, '');
    reply.style.visibility = 'hidden';
    const next = button(s.end.next, 'lw-btn', this.tap(onNext));
    next.style.display = 'none';

    for (const answer of [
      s.reflect2.sadness,
      s.reflect2.anger,
      s.reflect2.worry,
      s.reflect2.none,
    ]) {
      row.append(
        button(
          answer,
          'lw-btn lw-btn--quiet',
          this.tap(() => {
            reply.textContent = s.reflect.reply;
            reply.style.visibility = 'visible';
            row.style.display = 'none';
            next.style.display = '';
            next.focus();
          }),
        ),
      );
    }
    panel.append(row, reply, el('div', { class: 'lw-row' }, next));
    this.show(panel);
  }

  /**
   * Asks the player to name the weather in front of them.
   *
   * The three answers are shuffled every time, so the panel cannot be learned
   * as a position. A name that does not fit is never called wrong.
   */
  naming(order: FeelingType[], onAnswer: (choice: FeelingType) => void): void {
    const s = t();
    const panel = el(
      'div',
      { class: 'lw-panel', role: 'dialog', 'aria-label': s.naming.question },
      el('h2', { class: 'lw-heading' }, s.naming.question),
    );
    const row = el('div', { class: 'lw-row' });
    for (const feeling of order) {
      const b = button(
        s.naming[feeling],
        'lw-btn',
        this.tap(() => onAnswer(feeling)),
      );
      b.dataset.feeling = feeling;
      row.append(b);
    }
    panel.append(row);
    this.show(panel);
  }

  /** The reply to a name that does not fit. It never says "wrong". */
  lookAgain(): void {
    this.show(
      el(
        'div',
        { class: 'lw-panel', role: 'dialog' },
        el('p', { class: 'lw-text' }, t().naming.lookAgain),
      ),
    );
  }

  /** One text card with a Next button. Used by Understand and Apply. */
  card(text: string, onNext: () => void): void {
    const panel = el(
      'div',
      { class: 'lw-panel', role: 'dialog' },
      el('p', { class: 'lw-text' }, text),
      el('div', { class: 'lw-row' }, button(t().end.next, 'lw-btn', this.tap(onNext))),
    );
    this.show(panel);
  }

  /**
   * The chapter end screen. When another chapter is built, the coming-soon
   * button becomes the way into it.
   */
  chapterEnd(options: {
    heading: string;
    /** The chapter just finished, so the screen can name the one after it. */
    current: ChapterId;
    /** The next chapter, when it is built. Null means it is not, yet. */
    next: ChapterId | null;
    onAgain: () => void;
    onStart: () => void;
    onNext: () => void;
  }): void {
    const s = t();
    const row = el(
      'div',
      { class: 'lw-row' },
      button(s.end.playAgain, 'lw-btn lw-btn--quiet', this.tap(options.onAgain)),
      button(s.end.toStart, 'lw-btn lw-btn--quiet', this.tap(options.onStart)),
    );
    if (options.next === null) {
      // Name the chapter that is coming, not a fixed one. Chapter 2's end
      // screen used to offer "Chapter 2, coming soon", which is the chapter
      // the player had just finished.
      const after = CHAPTER_IDS.find((id) => id > options.current);
      const soon = el('button', {
        class: 'lw-btn lw-btn--quiet lw-btn--stack',
        type: 'button',
        disabled: 'true',
      });
      soon.append(
        after ? `${String(after)}. ${s.chapters[CHAPTERS[after].titleKey]}` : s.end.nextChapter,
        el('small', {}, s.end.comingSoon),
      );
      row.append(soon);
    } else {
      const go = el('button', {
        class: 'lw-btn lw-btn--stack',
        type: 'button',
        'data-ui': '1',
        'data-next-chapter': String(options.next),
      });
      go.append(
        s.end.continueTo,
        el('small', {}, `${String(options.next)}. ${s.chapters[CHAPTERS[options.next].titleKey]}`),
      );
      go.addEventListener('click', this.tap(options.onNext));
      row.append(go);
    }
    this.show(
      el(
        'div',
        { class: 'lw-panel', role: 'dialog', 'aria-label': options.heading },
        el('h2', { class: 'lw-title' }, options.heading),
        row,
      ),
    );
  }
}
