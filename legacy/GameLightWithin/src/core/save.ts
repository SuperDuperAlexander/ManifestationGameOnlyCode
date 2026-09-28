import { SAVE_KEY, CHECKS_KEY, SETTINGS_KEY } from '../content/chapter1';
import type { RhythmPreset, QualityTier, SceneId } from '../content/chapter1';
import { CHAPTERS, CHAPTER_IDS } from '../content/chapters';
import type { ChapterId } from '../content/chapters';

export interface Answers {
  receive: number | null;
  calm: number | null;
}

/** Where the player is inside one chapter. */
export interface ChapterProgress {
  scene: number;
  light: number;
  completed: boolean;
}

export interface SaveData {
  version: 2;
  /** Progress per chapter, keyed by chapter number. */
  chapters: Partial<Record<ChapterId, ChapterProgress>>;
  /** The chapter the player was last in. */
  current: ChapterId;
  startAnswers: Answers;
  endAnswers: Answers;
}

export interface LearningChecks {
  /** Scene 3: did the player find the hidden spring before the bird hint? */
  stoppedWithoutHint: boolean;
  /** Scene 4: how many times push was used. */
  pushCount: number;
  /** Scene 4: how many times the player ran away from the fog. */
  leftFogCount: number;
  /** Scene 5: did the player leave the 15 m zone without the butterfly hint? */
  walkedAwayFromSeed: boolean;
  /** Seconds spent in each scene. */
  timePerScene: Partial<Record<SceneId, number>>;

  // Chapter 2 "Be aware".
  /** Scene 1: did the player receive at the spring without a hint? */
  receivedWithoutSign: boolean;
  /** Scene 2: how long the four body stones took, in seconds. */
  bodyCheckTime: number;
  /** Scene 3: how many times the player ran from the rain cloud. */
  ranFromCloudCount: number;
  /** How many names the player tried for each weather. */
  namingAttempts: { sadness: number; anger: number; worry: number };
  /** Scene 4: how many sound breath tones the player made. */
  soundBreathCount: number;
  /** Scene 4: how many times the player left the storm. */
  leftStormCount: number;
  /** Scene 5: which kinds of seed were planted, in order. */
  seedTypesPlanted: ('heart' | 'mind')[];
  /** Scene 5: was the first seed a heart seed? */
  heartSeedFirstTry: boolean;
}

export interface SettingsData {
  rhythm: RhythmPreset['id'];
  quality: QualityTier | 'auto';
  volume: number;
  muted: boolean;
  reducedMotion: boolean;
  /** Chapter 2: thunder and the worry whisper at a lower volume. */
  softStorm: boolean;
}

export const DEFAULT_SAVE: SaveData = {
  version: 2,
  chapters: {},
  current: 1,
  startAnswers: { receive: null, calm: null },
  endAnswers: { receive: null, calm: null },
};

export const DEFAULT_PROGRESS: ChapterProgress = { scene: 1, light: 0, completed: false };

export const DEFAULT_CHECKS: LearningChecks = {
  stoppedWithoutHint: false,
  pushCount: 0,
  leftFogCount: 0,
  walkedAwayFromSeed: false,
  timePerScene: {},
  receivedWithoutSign: false,
  bodyCheckTime: 0,
  ranFromCloudCount: 0,
  namingAttempts: { sadness: 0, anger: 0, worry: 0 },
  soundBreathCount: 0,
  leftStormCount: 0,
  seedTypesPlanted: [],
  heartSeedFirstTry: false,
};

export const DEFAULT_SETTINGS: SettingsData = {
  rhythm: 'normal',
  quality: 'auto',
  volume: 0.7,
  muted: false,
  reducedMotion: false,
  softStorm: false,
};

/**
 * Local storage only. Nothing is ever sent anywhere.
 * Every read falls back to the default, so a broken or missing entry cannot block the game.
 */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return structuredClone(fallback);
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...structuredClone(fallback), ...parsed };
  } catch {
    return structuredClone(fallback);
  }
}

function write<T>(key: string, value: T): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota. The game keeps working without saving.
  }
}

/** The shape written by the version 1 save, before chapters existed. */
interface LegacySave {
  version?: number;
  scene?: number;
  light?: number;
  completed?: boolean;
  startAnswers?: Answers;
  endAnswers?: Answers;
}

/**
 * Reads the save, moving a version 1 file into the per-chapter shape.
 *
 * A player part way through chapter 1 must not lose their walk because the
 * save format grew a chapter around it.
 */
export function loadSave(): SaveData {
  const raw = read<SaveData & LegacySave>(SAVE_KEY, DEFAULT_SAVE as SaveData & LegacySave);
  const data: SaveData = {
    version: 2,
    chapters: raw.chapters ?? {},
    current: clampChapter(raw.current ?? 1),
    startAnswers: raw.startAnswers ?? { receive: null, calm: null },
    endAnswers: raw.endAnswers ?? { receive: null, calm: null },
  };

  // A version 1 file is recognised by its top-level scene, not by a missing
  // chapters field: reading merges the default over the stored data, so
  // chapters always exists by the time it gets here, empty.
  const legacy = typeof raw.scene === 'number' && Object.keys(data.chapters).length === 0;
  if (legacy) {
    data.chapters[1] = {
      scene: clampScene(raw.scene ?? 1, 1),
      light: clampLight(raw.light ?? 0),
      completed: raw.completed === true,
    };
    data.current = 1;
  }

  for (const id of CHAPTER_IDS) {
    const progress = data.chapters[id];
    if (!progress) continue;
    progress.scene = clampScene(progress.scene, id);
    progress.light = clampLight(progress.light);
    progress.completed = progress.completed === true;
  }
  return data;
}

function clampChapter(id: number): ChapterId {
  return CHAPTER_IDS.includes(id as ChapterId) ? (id as ChapterId) : 1;
}

function clampScene(scene: number, chapter: ChapterId): number {
  const max = Math.max(1, CHAPTERS[chapter].scenes);
  if (!Number.isInteger(scene) || scene < 1 || scene > max) return 1;
  return scene;
}

function clampLight(light: number): number {
  return Math.max(0, Math.min(12, Math.round(light || 0)));
}

/** Progress inside one chapter, or a fresh start when there is none stored. */
export function chapterProgress(save: SaveData, id: ChapterId): ChapterProgress {
  return { ...DEFAULT_PROGRESS, ...save.chapters[id] };
}

/** Writes progress for one chapter without touching the others. */
export function setChapterProgress(
  save: SaveData,
  id: ChapterId,
  progress: Partial<ChapterProgress>,
): SaveData {
  save.chapters[id] = { ...chapterProgress(save, id), ...progress };
  save.current = id;
  return save;
}

/** True when the player has finished this chapter at least once. */
export function isChapterComplete(save: SaveData, id: ChapterId): boolean {
  return save.chapters[id]?.completed === true;
}

/**
 * Which chapters the player may open from the start screen: every built one
 * they have finished, plus the next one after those, plus chapter 1.
 *
 * `open` is the chapter the game is running right now. A chapter the player is
 * already standing in is always offered, so a deep link into one does not show
 * its own start screen with its own button greyed out.
 */
export function unlockedChapters(save: SaveData, open: ChapterId | null = null): ChapterId[] {
  const out: ChapterId[] = [];
  for (const id of CHAPTER_IDS) {
    if (!CHAPTERS[id].built) continue;
    if (
      id === 1 ||
      id === open ||
      isChapterComplete(save, (id - 1) as ChapterId) ||
      save.chapters[id]
    ) {
      out.push(id);
    }
  }
  return out;
}

export function saveSave(data: SaveData): void {
  write(SAVE_KEY, data);
}

export function clearSave(): void {
  try {
    globalThis.localStorage?.removeItem(SAVE_KEY);
  } catch {
    /* nothing to do */
  }
}

export function loadChecks(): LearningChecks {
  return read(CHECKS_KEY, DEFAULT_CHECKS);
}

export function saveChecks(data: LearningChecks): void {
  write(CHECKS_KEY, data);
}

export function loadSettings(): SettingsData {
  const s = read(SETTINGS_KEY, DEFAULT_SETTINGS);
  s.volume = Math.max(0, Math.min(1, s.volume));
  return s;
}

export function saveSettings(data: SettingsData): void {
  write(SETTINGS_KEY, data);
}
