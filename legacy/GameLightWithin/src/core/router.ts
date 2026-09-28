import { CHAPTERS, CHAPTER_IDS } from '../content/chapters';
import type { ChapterId } from '../content/chapters';
import type { DebugFlags } from './debugFlags';
import { loadSave } from './save';

/**
 * Which chapter to open on this load.
 *
 * `?chapter=N` wins, then the chapter the player was last in, then chapter 1.
 * A chapter that is not built yet is never opened.
 */
export function pickChapter(flags: DebugFlags): ChapterId {
  const wanted = flags.chapter;
  if (wanted !== null && CHAPTERS[wanted].built) return wanted;
  const last = loadSave().current;
  if (CHAPTER_IDS.includes(last) && CHAPTERS[last].built) return last;
  return 1;
}

/**
 * The address of another chapter, keeping the debug flags but dropping the
 * scene, which belongs to the chapter being left.
 */
export function chapterUrl(search: string, id: ChapterId): string {
  const p = new URLSearchParams(search);
  p.set('chapter', String(id));
  p.delete('scene');
  return `?${p.toString()}`;
}
