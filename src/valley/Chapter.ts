import type { ValleyLayout } from './valleyLayout';
import { setLayout } from './valleyLayout';

export interface Chapter {
  version: 1;
  id: string;
  title: string;
  subtitle: string;
  seed: string;
  next: string | null;
  lesson: { title: string; video: string | null; captions: string | null };
  layout: ValleyLayout;
}

/** Validate external content before it can allocate meshes or affect movement. */
export function validateChapter(value: unknown): Chapter {
  if (!value || typeof value !== 'object') throw new Error('Chapter must be an object.');
  const c = value as Chapter;
  if (c.version !== 1 || !/^[a-z0-9-]{1,40}$/.test(c.id) || !c.title || !c.seed) throw new Error('Invalid chapter header.');
  if (c.next !== null && !/^[a-z0-9-]{1,40}$/.test(c.next)) throw new Error('Invalid next chapter.');
  const l = c.layout;
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 10000;
  const point = (p: { x: number; z: number } | undefined): boolean => !!p && finite(p.x) && finite(p.z);
  if (!l || !point(l.start) || !finite(l.start.heading) || !Array.isArray(l.path) || l.path.length < 4 || l.path.length > 200) throw new Error('Invalid chapter path.');
  for (const line of [l.path, l.river?.points]) {
    if (!Array.isArray(line) || line.length < 2 || line.length > 200 || line.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(finite))) throw new Error('Invalid path or river points.');
  }
  for (const name of ['river', 'stoneBridge', 'ridge', 'chasm', 'lightBridge'] as const) {
    const item = l[name];
    if (!item || Object.entries(item).some(([k, v]) => k !== 'points' && !finite(v))) throw new Error(`Invalid ${name}.`);
  }
  if (!finite(l.pathWidth) || l.pathWidth <= 0 || l.river.halfWidth <= 0 || l.lightBridge.planks < 1 || l.lightBridge.planks > 40 || !Number.isInteger(l.lightBridge.planks) || l.lightBridge.toZ <= l.lightBridge.fromZ) throw new Error('Invalid path or bridge size.');
  if (!Array.isArray(l.fogs) || l.fogs.length < 1 || l.fogs.length > 12 || new Set(l.fogs.map(f => f.id)).size !== l.fogs.length) throw new Error('Invalid fog list.');
  for (const f of l.fogs) if (!point(f) || !f.id || !f.text || !f.release || !finite(f.radius) || f.radius <= 0 || !finite(f.points) || f.points <= 0) throw new Error('Invalid fog.');
  if (!finite(l.pointsForBridge) || l.pointsForBridge <= 0 || l.pointsForBridge > l.fogs.reduce((n, f) => n + f.points, 0)) throw new Error('The bridge cannot be earned.');
  for (const name of ['flats', 'mounds', 'pillars', 'clearings'] as const) {
    if (!Array.isArray(l[name]) || l[name].length > 100 || l[name].some(p => !point(p) || Object.values(p).some(v => !finite(v)))) throw new Error(`Invalid ${name}.`);
  }
  for (const name of ['oak', 'well', 'monolith', 'arch'] as const) if (!point(l[name])) throw new Error(`Invalid ${name}.`);
  if (!c.lesson || typeof c.lesson.title !== 'string') throw new Error('Invalid lesson.');
  for (const url of [c.lesson.video, c.lesson.captions]) if (url !== null && (typeof url !== 'string' || !/^(https:\/\/|\/[^/])/.test(url))) throw new Error('Lesson URLs must use HTTPS or a local path.');
  return c;
}

export async function loadChapter(id: string): Promise<Chapter> {
  if (!/^[a-z0-9-]{1,40}$/.test(id)) throw new Error('Unknown chapter.');
  const response = await fetch(`${import.meta.env.BASE_URL}data/valley/${id}.json`);
  if (!response.ok) throw new Error('This chapter is not available yet.');
  const chapter = validateChapter(await response.json());
  if (chapter.id !== id) throw new Error('Chapter ID does not match its file.');
  setLayout(chapter.layout);
  return chapter;
}
