// Temporary entry (Step 1): shows only the Inner Valley. Game.ts replaces this later.
import '../ui/styles.css';
import { Engine } from '@babylonjs/core/Engines/engine';
import { InnerValley } from '../inner/InnerValley';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const engine = new Engine(canvas, true, { stencil: false, powerPreference: 'high-performance', audioEngine: false });
const world = new InnerValley(engine, canvas, ui);
world.setActive(true);
engine.runRenderLoop(() => {
  world.update(Math.min(0.05, engine.getDeltaTime() / 1000));
  world.scene.render();
});
window.addEventListener('resize', () => engine.resize());
