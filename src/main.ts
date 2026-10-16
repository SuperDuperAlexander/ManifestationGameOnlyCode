import './ui/styles.css';
import './ui/thought-card.css';
import { Game } from './game/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
new Game(canvas, ui);
