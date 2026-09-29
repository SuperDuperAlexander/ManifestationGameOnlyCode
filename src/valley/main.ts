import '../ui/styles.css';
import './valley.css';
import { ValleyGame } from './ValleyGame';
import { loadChapter } from './Chapter';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;

async function boot(): Promise<void> {
const loading = document.createElement('div');
loading.className = 'valley-loading';
loading.textContent = 'Opening the valley…';
ui.append(loading);
const chapter = await loadChapter(new URLSearchParams(location.search).get('chapter') ?? 'ch1');
const game = new ValleyGame(canvas, ui, chapter);
loading.remove();

// Read-only hooks for automated browser checks (scripts/check-browser.mjs).
(window as unknown as { __lw: unknown }).__lw = {
  ready: true,
  stats: () => game.stats(),
  state: () => game.state(),
  reach: (a?: number, b?: number) => game.reach(a, b),
  teleport: (x: number, z: number, heading: number) => game.teleport(x, z, heading),
  breathe: (light: number) => game.debugBreathe(light),
};

await game.start();
}
boot().catch((err: unknown) => {
  console.error('[valley] failed to start', err);
  ui.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'valley-loading';
  panel.textContent = 'The valley could not open. ';
  const retry = document.createElement('a');
  retry.href = './';
  retry.textContent = 'Return to Chapter 1';
  panel.append(retry);
  ui.append(panel);
});
