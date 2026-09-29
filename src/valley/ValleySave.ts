import type { Chapter } from './Chapter';

export interface ValleySaveData {
  version: 1;
  chapter: string;
  released: string[];
  checkpoint: [number, number, number];
  complete: boolean;
}

/** One small save per chapter. Storage may be unavailable in private browsers. */
export class ValleySave {
  readonly key: string;
  available = true;
  constructor(private readonly chapter: Chapter) {
    this.key = `light-within.valley.v1.${chapter.id}`;
  }
  read(): ValleySaveData | null {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const s = JSON.parse(raw) as ValleySaveData;
      if (s.version !== 1 || s.chapter !== this.chapter.id || typeof s.complete !== 'boolean' || !Array.isArray(s.released) || !Array.isArray(s.checkpoint) || s.checkpoint.length !== 3) return null;
      if (s.checkpoint.some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 200)) return null;
      if (new Set(s.released).size !== s.released.length || s.released.some(id => !this.chapter.layout.fogs.some(f => f.id === id))) return null;
      return s;
    } catch { this.available = false; return null; }
  }
  write(released: string[], checkpoint: [number, number, number], complete: boolean): void {
    try {
      localStorage.setItem(this.key, JSON.stringify({ version: 1, chapter: this.chapter.id, released, checkpoint, complete } satisfies ValleySaveData));
    } catch { this.available = false; }
  }
  clear(): void {
    try { localStorage.removeItem(this.key); } catch { this.available = false; }
  }
}
