/**
 * The chapter registry.
 *
 * Every chapter owns a content file, a scene count and its own starting light.
 * Nothing about a chapter is hard-coded anywhere else: the start screen, the
 * save file, the end questions and the transition all read from here, so
 * adding chapter 3 is one entry in this list plus its own modules.
 */

export type ChapterId = 1 | 2 | 3;

export interface ChapterInfo {
  readonly id: ChapterId;
  /** Key into the strings file, so the title can be translated. */
  readonly titleKey: 'chapter1' | 'chapter2' | 'chapter3';
  /** How many scenes the chapter has. */
  readonly scenes: number;
  /**
   * Light the player starts the chapter with. Light is never carried over
   * between chapters: each one is its own walk.
   */
  readonly startLight: number;
  /**
   * How much scaffolding the breath circle shows, 1 full and 0 none. It drops
   * as the player needs less help.
   */
  readonly circleStrength: number;
  /** False until the chapter is written. A listed chapter can still be locked. */
  readonly built: boolean;
}

export const CHAPTERS: Record<ChapterId, ChapterInfo> = {
  1: { id: 1, titleKey: 'chapter1', scenes: 6, startLight: 0, circleStrength: 1, built: true },
  2: { id: 2, titleKey: 'chapter2', scenes: 6, startLight: 3, circleStrength: 0.6, built: true },
  3: { id: 3, titleKey: 'chapter3', scenes: 0, startLight: 0, circleStrength: 0.4, built: false },
};

/**
 * The last chapter this build actually contains.
 *
 * The closing questions are asked once, after the last chapter that exists,
 * not after every chapter. When chapter 3 ships, this becomes 3 and the
 * questions move on their own.
 */
export const LAST_AVAILABLE_CHAPTER: ChapterId = 2;

export const CHAPTER_IDS: ChapterId[] = [1, 2, 3];

export function chapterInfo(id: ChapterId): ChapterInfo {
  return CHAPTERS[id];
}

/** The chapter after this one, or null when there is no next one built. */
export function nextChapter(id: ChapterId): ChapterId | null {
  const next = (id + 1) as ChapterId;
  return CHAPTERS[next]?.built ? next : null;
}

/** True when the closing questions belong at the end of this chapter. */
export function isLastChapter(id: ChapterId): boolean {
  return id === LAST_AVAILABLE_CHAPTER;
}
