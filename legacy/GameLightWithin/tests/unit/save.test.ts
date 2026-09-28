import { describe, it, expect, beforeEach } from 'vitest';
import {
  chapterProgress,
  clearSave,
  loadChecks,
  loadSave,
  loadSettings,
  saveSave,
  saveSettings,
  setChapterProgress,
  unlockedChapters,
} from '../../src/core/save';
import {
  CHAPTERS,
  LAST_AVAILABLE_CHAPTER,
  isLastChapter,
  nextChapter,
} from '../../src/content/chapters';
import { ChecksSystem } from '../../src/systems/checks';

describe('save', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts at chapter 1 scene 1 with nothing stored', () => {
    const s = loadSave();
    expect(s.current).toBe(1);
    expect(chapterProgress(s, 1)).toEqual({ scene: 1, light: 0, completed: false });
  });

  it('keeps progress per chapter', () => {
    const s = loadSave();
    setChapterProgress(s, 1, { scene: 4, light: 6, completed: true });
    setChapterProgress(s, 2, { scene: 2, light: 3 });
    saveSave(s);

    const back = loadSave();
    expect(chapterProgress(back, 1)).toEqual({ scene: 4, light: 6, completed: true });
    expect(chapterProgress(back, 2)).toEqual({ scene: 2, light: 3, completed: false });
    expect(back.current).toBe(2);
  });

  it('restores the start answers', () => {
    const s = loadSave();
    s.startAnswers = { receive: 3, calm: 5 };
    saveSave(s);
    expect(loadSave().startAnswers).toEqual({ receive: 3, calm: 5 });
  });

  it('falls back to scene 1 when the stored scene is out of range', () => {
    const s = loadSave();
    setChapterProgress(s, 1, { scene: 99 });
    saveSave(s);
    expect(chapterProgress(loadSave(), 1).scene).toBe(1);
  });

  it('clamps stored light to the maximum', () => {
    const s = loadSave();
    setChapterProgress(s, 1, { light: 500 });
    saveSave(s);
    expect(chapterProgress(loadSave(), 1).light).toBe(12);
  });

  it('survives a broken entry', () => {
    localStorage.setItem('lightwithin.save.v1', 'not json');
    expect(loadSave().current).toBe(1);
  });

  /**
   * A player part way through chapter 1 must not lose their walk because the
   * save format grew a chapter around it.
   */
  it('moves a version 1 save into the per-chapter shape', () => {
    localStorage.setItem(
      'lightwithin.save.v1',
      JSON.stringify({
        version: 1,
        scene: 4,
        light: 6,
        completed: false,
        startAnswers: { receive: 2, calm: 4 },
        endAnswers: { receive: null, calm: null },
      }),
    );
    const s = loadSave();
    expect(s.version).toBe(2);
    expect(chapterProgress(s, 1)).toEqual({ scene: 4, light: 6, completed: false });
    expect(s.startAnswers).toEqual({ receive: 2, calm: 4 });
    expect(s.current).toBe(1);
  });

  it('clears the save', () => {
    const s = loadSave();
    setChapterProgress(s, 1, { scene: 5 });
    saveSave(s);
    clearSave();
    expect(chapterProgress(loadSave(), 1).scene).toBe(1);
  });

  it('stores and restores settings', () => {
    saveSettings({
      rhythm: 'slow',
      quality: 'low',
      volume: 0.3,
      muted: true,
      reducedMotion: true,
      softStorm: true,
    });
    const s = loadSettings();
    expect(s.rhythm).toBe('slow');
    expect(s.quality).toBe('low');
    expect(s.volume).toBeCloseTo(0.3);
    expect(s.muted).toBe(true);
    expect(s.reducedMotion).toBe(true);
    expect(s.softStorm).toBe(true);
  });

  it('records the learning checks locally', () => {
    const checks = new ChecksSystem();
    checks.set('pushCount', 3);
    checks.set('leftFogCount', 1);
    checks.enterScene(2);
    checks.update(4.25);
    checks.flushScene();
    const stored = loadChecks();
    expect(stored.pushCount).toBe(3);
    expect(stored.leftFogCount).toBe(1);
    expect(stored.timePerScene[2]).toBeCloseTo(4.3, 1);
  });

  it('exports the checks as JSON without sending anything', () => {
    const checks = new ChecksSystem();
    checks.set('walkedAwayFromSeed', true);
    const parsed = JSON.parse(checks.toJson()) as {
      chapter: number;
      checks: { walkedAwayFromSeed: boolean };
    };
    expect(parsed.chapter).toBe(1);
    expect(parsed.checks.walkedAwayFromSeed).toBe(true);
  });
});

describe('chapter unlocking', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('offers only chapter 1 on a fresh save', () => {
    expect(unlockedChapters(loadSave())).toEqual([1]);
  });

  it('offers chapter 2 once chapter 1 is finished', () => {
    const s = loadSave();
    setChapterProgress(s, 1, { completed: true });
    expect(unlockedChapters(s)).toEqual([1, 2]);
  });

  it('never offers a chapter that is not built', () => {
    const s = loadSave();
    setChapterProgress(s, 1, { completed: true });
    setChapterProgress(s, 2, { completed: true });
    expect(unlockedChapters(s)).not.toContain(3);
  });

  it('asks the closing questions only after the last chapter in the build', () => {
    expect(isLastChapter(LAST_AVAILABLE_CHAPTER)).toBe(true);
    expect(isLastChapter(1)).toBe(false);
    expect(CHAPTERS[LAST_AVAILABLE_CHAPTER].built).toBe(true);
  });

  it('knows which chapter comes next', () => {
    expect(nextChapter(1)).toBe(2);
    // Chapter 3 is listed but not built, so chapter 2 has no next yet.
    expect(nextChapter(2)).toBeNull();
  });

  it('gives each chapter its own starting light and help level', () => {
    expect(CHAPTERS[1].startLight).toBe(0);
    expect(CHAPTERS[2].startLight).toBe(3);
    expect(CHAPTERS[2].circleStrength).toBeLessThan(CHAPTERS[1].circleStrength);
  });
});

describe('learning checks batching', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps a change in memory instead of writing on every set', () => {
    const checks = new ChecksSystem();
    checks.set('pushCount', 2);
    expect(checks.hasUnsaved).toBe(true);
    expect(localStorage.getItem('lightwithin.checks.v1')).toBeNull();
  });

  it('writes once the batching interval has passed', () => {
    const checks = new ChecksSystem();
    checks.set('pushCount', 2);
    for (let t = 0; t < 6; t += 0.5) checks.update(0.5);
    expect(checks.hasUnsaved).toBe(false);
    expect(loadChecks().pushCount).toBe(2);
  });

  it('ignores a set that changes nothing', () => {
    const checks = new ChecksSystem();
    checks.set('pushCount', 0);
    expect(checks.hasUnsaved).toBe(false);
  });

  it('writes straight away when a scene ends', () => {
    const checks = new ChecksSystem();
    checks.set('leftFogCount', 3);
    checks.enterScene(2);
    expect(checks.hasUnsaved).toBe(false);
    expect(loadChecks().leftFogCount).toBe(3);
  });

  it('does not lose a change when persist is called by hand', () => {
    const checks = new ChecksSystem();
    checks.set('walkedAwayFromSeed', true);
    checks.persist();
    expect(loadChecks().walkedAwayFromSeed).toBe(true);
  });
});
