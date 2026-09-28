import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import type { Scene } from '@babylonjs/core/scene';
import { el, svgEl } from './dom';

/**
 * What the guide says, on screen.
 *
 * It is text first and always. A recorded teaching plays above the words,
 * never instead of them, so a muted device, a slow connection or a screen
 * reader loses nothing but the picture. It never covers the middle of the
 * screen and it never stops the world: the player can walk away from it.
 */
export class GuidePanel {
  readonly root: HTMLElement;
  private readonly identity = Matrix.Identity();
  private readonly text: HTMLElement;
  private readonly film: HTMLVideoElement;
  private readonly close: HTMLButtonElement;
  private showing = false;
  /** Called when the player closes the message. */
  onDismiss: (() => void) | null = null;

  constructor(closeLabel: string) {
    this.text = el('p', { class: 'lw-guide-text' });
    this.film = document.createElement('video');
    this.film.className = 'lw-guide-film';
    this.film.playsInline = true;
    this.film.controls = true;
    this.film.preload = 'none';
    this.film.hidden = true;

    this.close = el('button', {
      class: 'lw-guide-close',
      type: 'button',
    }) as HTMLButtonElement;
    this.close.textContent = closeLabel;
    this.close.addEventListener('click', () => this.onDismiss?.());

    const mark = el('span', { class: 'lw-guide-mark', 'aria-hidden': 'true' });
    const labelStar = el('span', { class: 'lw-guide-label-star', 'aria-hidden': 'true' }, '\u2726');
    const label = el('div', { class: 'lw-guide-label' }, mark, labelStar);
    const sparks = el(
      'span',
      { class: 'lw-guide-sparks', 'aria-hidden': 'true' },
      el('i'),
      el('i'),
      el('i'),
      el('i'),
      el('i'),
    );
    const connection = svgEl('svg', {
      class: 'lw-guide-connection',
      viewBox: '0 0 120 92',
      'aria-hidden': 'true',
    });
    connection.append(
      svgEl('path', {
        class: 'lw-guide-connection-fill',
        d: 'M27 0 C24 25 29 48 45 63 C55 72 68 74 72 91 C62 80 48 81 38 70 C21 51 16 25 18 0 Z',
      }),
      svgEl('path', {
        class: 'lw-guide-connection-line',
        d: 'M23 0 C21 30 31 58 72 91',
      }),
      svgEl('circle', {
        class: 'lw-guide-connection-mote lw-guide-connection-mote--one',
        cx: '43',
        cy: '59',
        r: '2.2',
      }),
      svgEl('circle', {
        class: 'lw-guide-connection-mote lw-guide-connection-mote--two',
        cx: '58',
        cy: '75',
        r: '1.7',
      }),
      svgEl('circle', {
        class: 'lw-guide-connection-mote lw-guide-connection-mote--three',
        cx: '73',
        cy: '89',
        r: '2.4',
      }),
    );
    const bubble = el(
      'div',
      { class: 'lw-guide-bubble' },
      label,
      this.film,
      this.text,
      this.close,
      connection,
      sparks,
    );
    this.root = el('div', { class: 'lw-guide', role: 'status', 'aria-live': 'polite' }, bubble);
    this.root.dataset.show = 'false';
  }

  get isShowing(): boolean {
    return this.showing;
  }

  /**
   * Pins the speech bubble to the guide's projected world position.
   * The UI stays in the browser for sharp, accessible text, but its anchor
   * is the real light in the Babylon scene rather than a fixed HUD position.
   */
  follow(anchor: Vector3, scene: Scene): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (width < 1 || height < 1) return;

    const point = Vector3.Project(
      anchor,
      this.identity,
      scene.getTransformMatrix(),
      new Viewport(0, 0, width, height),
    );
    const onScreen = point.z >= 0 && point.z <= 1;
    this.root.dataset.anchorVisible = onScreen ? 'true' : 'false';
    if (!onScreen) return;

    // Keep the words near the light but inside the safe, readable part of a
    // small screen. The tail then bends toward the real, unclamped anchor.
    const bubbleWidth = this.root.getBoundingClientRect().width || Math.min(350, width - 32);
    const sideOffset = Math.min(132, width * 0.18);
    const wantedX = point.x - sideOffset;
    const x = Math.min(width - bubbleWidth / 2 - 16, Math.max(bubbleWidth / 2 + 16, wantedX));
    const bubbleHeight = this.root.offsetHeight || 112;
    const minimumBottom = bubbleHeight + 18;
    const y = Math.min(height - 96, Math.max(minimumBottom, point.y - 84));
    const tail = Math.min(84, Math.max(16, 50 + ((point.x - x) / bubbleWidth) * 100));
    this.root.style.setProperty('--guide-x', `${String(x)}px`);
    this.root.style.setProperty('--guide-y', `${String(y)}px`);
    this.root.style.setProperty('--guide-tail-x', `${String(tail)}%`);
  }

  /**
   * Shows a message. `video` is a path under the game's own files and is
   * only fetched now, the first time this teaching is reached.
   */
  show(text: string, video?: string, holds = false): void {
    this.text.textContent = text;
    this.root.dataset.hold = holds ? 'true' : 'false';
    this.close.hidden = !holds;
    if (video) {
      this.film.src = video;
      this.film.hidden = false;
      // A teaching is offered, not forced. Nothing plays on its own.
      this.film.load();
    } else {
      this.film.hidden = true;
      this.film.removeAttribute('src');
    }
    this.root.dataset.show = 'true';
    this.showing = true;
  }

  hide(): void {
    if (!this.showing) return;
    this.showing = false;
    this.root.dataset.show = 'false';
    this.film.pause();
    this.film.hidden = true;
    this.film.removeAttribute('src');
  }
}
