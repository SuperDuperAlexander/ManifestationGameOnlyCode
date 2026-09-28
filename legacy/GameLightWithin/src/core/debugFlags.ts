import type { QualityTier, SceneId } from '../content/chapter1';
import { CHAPTER_IDS } from '../content/chapters';
import type { ChapterId } from '../content/chapters';

export interface DebugFlags {
  /** `?debug=1` shows the debug panel. */
  readonly debug: boolean;
  /** `?scene=N` starts directly at scene N with the right amount of light. */
  readonly startScene: SceneId | null;
  /** `?autobreathe=1` breathes automatically with calm breaths, for browser tests. */
  readonly autobreathe: boolean;
  /** `?nopaint=1` turns the painting filter off. Useful when a driver has no float targets. */
  readonly noPaint: boolean;
  /** `?quality=low|medium|high` pins the tier instead of measuring it. */
  readonly quality: QualityTier | null;
  /** `?chapter=N` opens a chapter directly. */
  readonly chapter: ChapterId | null;
  /** `?autoname=1` answers the naming panel correctly, for the browser tests. */
  readonly autoName: boolean;
  /** `?calm=0.2` forces the calm value, for testing mind seeds. */
  readonly calm: number | null;
  /**
   * `?safe=1` draws the scene straight to the canvas, with no post-processing.
   *
   * A device that is black through the composer and correct in safe mode has
   * a problem with the render targets; one that is black either way has a
   * problem with the world's own shaders. It is also simply a way to play on
   * a device the painted look does not suit.
   */
  readonly safe: boolean;
}

function readChapter(raw: string | null): ChapterId | null {
  const n = Number(raw);
  return CHAPTER_IDS.includes(n as ChapterId) ? (n as ChapterId) : null;
}

function readCalm(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
}

function readQuality(raw: string | null): QualityTier | null {
  return raw === 'low' || raw === 'medium' || raw === 'high' ? raw : null;
}

function readScene(raw: string | null): SceneId | null {
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 6) return null;
  return n as SceneId;
}

export function parseFlags(search: string): DebugFlags {
  const p = new URLSearchParams(search);
  return {
    debug: p.get('debug') === '1',
    startScene: readScene(p.get('scene')),
    autobreathe: p.get('autobreathe') === '1',
    noPaint: p.get('nopaint') === '1',
    quality: readQuality(p.get('quality')),
    chapter: readChapter(p.get('chapter')),
    autoName: p.get('autoname') === '1',
    calm: readCalm(p.get('calm')),
    safe: p.get('safe') === '1',
  };
}
