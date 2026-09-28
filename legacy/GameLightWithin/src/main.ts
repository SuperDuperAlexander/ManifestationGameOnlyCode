import './ui/styles.css';
import { Chapter1 } from './chapter1';
import { Chapter2 } from './chapter2';
import { parseFlags } from './core/debugFlags';
import { chapterUrl, pickChapter } from './core/router';
import type { ChapterRunner } from './core/chapterRunner';
import type { ChapterId } from './content/chapters';
import { Game } from './game';
import { setPlace } from './world/place';
import { meadows } from './world/meadows';
import { valley } from './world/valley';

const root = document.getElementById('app');
if (!root) throw new Error('missing #app');

const flags = parseFlags(window.location.search);
const chapterId = pickChapter(flags);
// The place is set before the world is built. One page load is one place.
setPlace(chapterId === 2 ? meadows : valley);
const game = new Game(root, flags);

/**
 * Handing over between chapters reloads the page at the new address.
 *
 * A chapter owns a whole world, so switching in place would mean tearing down
 * terrain, materials and shaders and hoping nothing is left behind. The build
 * is small and local, so the reload costs less than that risk. The screen
 * fades first, which is what the player sees either way.
 */
function goToChapter(id: ChapterId): void {
  document.body.classList.add('fading');
  window.setTimeout(() => {
    window.location.search = chapterUrl(window.location.search, id);
  }, 700);
}

void game.start().then(() => {
  const chapter: ChapterRunner = chapterId === 2 ? new Chapter2(game) : new Chapter1(game);
  chapter.onLeaveToChapter = goToChapter;
  game.onFrame = (dt): void => chapter.update(dt);
  chapter.begin();
  // The browser tests read the state through this. It is only attached when a
  // debug flag is set, so a normal player never sees it.
  if (flags.debug || flags.autobreathe || flags.startScene !== null) {
    (window as Window & { __lw?: unknown }).__lw = chapter.testApi();
    // The world itself, for the side-by-side tool in `tools/`. It is the only
    // way to ask the running game what it actually put on the screen.
    (window as Window & { __lwGame?: unknown }).__lwGame = game;
  }
  document.body.dataset.ready = '1';
});
