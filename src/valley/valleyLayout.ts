import type chapter from '../../public/data/valley/ch1.json';

/** The valley template accepts new paths, fogs and landmarks from a chapter file. */
export type ValleyLayout = Omit<typeof chapter.layout, 'path' | 'river'> & {
  path: [number, number][];
  river: Omit<typeof chapter.layout.river, 'points'> & { points: [number, number][] };
};
export type FogSpec = ValleyLayout['fogs'][number];
/** Set once before scene construction. A chapter change reloads and releases the old scene. */
export let LAYOUT: ValleyLayout;
export function setLayout(layout: ValleyLayout): void { LAYOUT = layout; }
