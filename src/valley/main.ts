import '../ui/styles.css';
import './valley.css';
import { ValleyGame } from './ValleyGame';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;

const game = new ValleyGame(canvas, ui);

// Read-only hooks for automated browser checks (scripts/check-browser.mjs).
(window as unknown as { __lw: unknown }).__lw = {
  ready: true,
  stats: () => game.stats(),
  state: () => game.state(),
  reach: (a?: number, b?: number) => game.reach(a, b),
  teleport: (x: number, z: number, heading: number) => game.teleport(x, z, heading),
  breathe: (light: number) => game.debugBreathe(light),
};

game.start().catch((err: unknown) => {
  console.error('[valley] failed to start', err);
});
