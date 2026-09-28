import { NIGHT } from '../content/chapter2';
import { PALETTE } from '../content/palette';
import { el, svgEl } from './dom';

/**
 * The short dream at the end of chapter 2.
 *
 * A small village under a night sky, and one bird that crosses the same roof
 * twice. There is no text and nothing to do: it is a look at somewhere the
 * player has not been yet.
 *
 * It is drawn flat, as a silhouette overlay rather than in the world, because
 * a dream should not look like the place the player is standing in — and
 * because building a second village in three dimensions to show it for
 * thirteen seconds would cost more than the whole chapter.
 */
export class DreamView {
  readonly root: HTMLElement;
  /** The in-game setting, which is not the same as the browser's own. */
  reducedMotion = false;

  constructor() {
    const svg = svgEl('svg', {
      viewBox: '0 0 400 220',
      preserveAspectRatio: 'xMidYMid slice',
      'aria-hidden': 'true',
      class: 'lw-dream-sky',
    });

    // Stars, as a fixed handful. A dream does not need a sky simulation.
    for (const [x, y, r] of [
      [40, 30, 1.4],
      [88, 52, 1],
      [130, 24, 1.7],
      [196, 44, 1.1],
      [248, 28, 1.3],
      [300, 56, 1],
      [344, 34, 1.5],
      [372, 66, 1.1],
    ] as const) {
      svg.append(
        svgEl('circle', { cx: String(x), cy: String(y), r: String(r), fill: PALETTE.stars }),
      );
    }
    svg.append(
      svgEl('circle', { cx: '330', cy: '46', r: '13', fill: PALETTE.stars, opacity: '0.9' }),
    );

    // The hill the village sits on, then the houses, darkest at the front.
    svg.append(
      svgEl('path', {
        d: 'M0 168 Q 100 138 200 158 T 400 150 L400 220 L0 220 Z',
        fill: '#18213a',
      }),
    );

    const houses: [number, number, number, number][] = [
      [58, 150, 40, 30],
      [112, 142, 52, 38],
      [186, 148, 44, 32],
      [246, 138, 58, 42],
      [322, 152, 38, 28],
    ];
    for (const [x, y, w, h] of houses) {
      svg.append(
        svgEl('rect', {
          x: String(x),
          y: String(y),
          width: String(w),
          height: String(h),
          // The walls are lighter than the hill behind them and the roof is
          // darker than the walls, so the roof line reads against the sky
          // instead of disappearing into it.
          fill: '#26324f',
        }),
      );
      // A simple pitched roof over each one.
      svg.append(
        svgEl('path', {
          d: `M${String(x - 5)} ${String(y)} L${String(x + w / 2)} ${String(y - 15)} L${String(x + w + 5)} ${String(y)} Z`,
          fill: '#141c31',
        }),
      );
      // One lit window, the only warm thing in the picture.
      svg.append(
        svgEl('rect', {
          x: String(x + w / 2 - 4),
          y: String(y + 10),
          width: '8',
          height: '9',
          fill: PALETTE.receiveGold,
          opacity: '0.72',
        }),
      );
    }

    // The bird. It crosses the roof of the tallest house, twice.
    const bird = svgEl('path', {
      d: 'M-6 0 Q -3 -3.4 0 0 Q 3 -3.4 6 0',
      fill: 'none',
      stroke: PALETTE.stars,
      'stroke-width': '1.6',
      'stroke-linecap': 'round',
      class: 'lw-dream-bird',
    });
    svg.append(bird);

    this.root = el('div', { class: 'lw-dream', 'aria-hidden': 'true' }, svg);
    this.root.hidden = true;
  }

  /** Starts the dream. It runs itself and shows nothing else. */
  play(): void {
    this.root.hidden = false;
    // Restarting the animation needs the class off for one frame.
    this.root.classList.remove('lw-dream--on');
    void this.root.offsetWidth;
    this.root.style.setProperty('--lw-dream-seconds', `${String(NIGHT.dreamSeconds)}s`);
    this.root.classList.toggle('lw-dream--calm', this.reducedMotion);
    this.root.classList.add('lw-dream--on');
  }

  stop(): void {
    this.root.classList.remove('lw-dream--on');
    this.root.hidden = true;
  }
}
