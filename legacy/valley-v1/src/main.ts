import './ui/styles.css';
import { Game } from './core/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;

const game = new Game(canvas, ui);

// Read-only hook for automated browser checks (scripts/check-browser.mjs).
(window as unknown as { __lw: unknown }).__lw = {
  game,
  stats: () => game.debug.stats(),
};

game.start().catch((err: unknown) => {
  console.error('[game] failed to start', err);
});
