import type { ChapterId } from '../content/chapters';

/**
 * What every chapter looks like from the outside.
 *
 * The router knows nothing about a chapter beyond this. Adding chapter 3 means
 * one more class with these four members and one entry in the registry.
 */
export interface ChapterRunner {
  /** Opens the chapter: its start screen, or straight into a scene. */
  begin(): void;
  /** One fixed simulation step. */
  update(dt: number): void;
  /** State the browser tests read. Only attached behind a debug flag. */
  testApi(): Record<string, (...args: never[]) => unknown>;
  /**
   * Set by the router. A chapter calls it to hand over to another chapter,
   * from its end screen or from the chapter list.
   */
  onLeaveToChapter: ((id: ChapterId) => void) | null;
}
