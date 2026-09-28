import { describe, it, expect, beforeEach } from 'vitest';
import { chapterUrl, pickChapter } from '../../src/core/router';
import { parseFlags } from '../../src/core/debugFlags';
import { loadSave, saveSave, setChapterProgress } from '../../src/core/save';

function flags(search: string) {
  return parseFlags(search);
}

describe('chapter router', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens chapter 1 when nothing is stored', () => {
    expect(pickChapter(flags(''))).toBe(1);
  });

  it('opens the chapter named in the address', () => {
    expect(pickChapter(flags('?chapter=2'))).toBe(2);
  });

  it('opens the chapter the player was last in', () => {
    const s = loadSave();
    setChapterProgress(s, 2, { scene: 3 });
    saveSave(s);
    expect(pickChapter(flags(''))).toBe(2);
  });

  it('never opens a chapter that is not built', () => {
    expect(pickChapter(flags('?chapter=3'))).toBe(1);
  });

  it('ignores an address that is not a chapter', () => {
    expect(pickChapter(flags('?chapter=nine'))).toBe(1);
  });

  it('keeps the debug flags when it hands over', () => {
    const url = chapterUrl('?debug=1&autobreathe=1', 2);
    const p = new URLSearchParams(url);
    expect(p.get('chapter')).toBe('2');
    expect(p.get('debug')).toBe('1');
    expect(p.get('autobreathe')).toBe('1');
  });

  /** The scene belongs to the chapter being left, so it does not travel. */
  it('drops the scene when it hands over', () => {
    const p = new URLSearchParams(chapterUrl('?scene=5', 2));
    expect(p.get('scene')).toBeNull();
  });
});
