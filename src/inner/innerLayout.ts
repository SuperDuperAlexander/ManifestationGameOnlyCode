/**
 * Layout of the Inner World (GAME_DESIGN 5.2). All positions in metres. +z = north (up the valley).
 * Order from south to north: Entrance, Source Pond, (Imp Clearing), Inner Tree.
 * The shape matches what ValleyTerrain / ValleyProps / ValleyWater read.
 */
export interface InnerLayout {
  start: { x: number; z: number; heading: number };
  /** Where the arrival light column stands. */
  entrance: { x: number; z: number };
  /** Centre of the future Inner Tree. Kept clear. */
  tree: { x: number; z: number };
  /** Thought Waves come from here (the future imp clearing). */
  waveSource: { x: number; z: number };
  /** Where the (huge) Anger Imp stands: west of the wave source so the Inner Tree and path stay free. */
  impSpot: { x: number; z: number };
  path: [number, number][];
  pathWidth: number;
  /** The Source: a stream from the waterfall that ends in a pond. */
  river: { points: [number, number][]; halfWidth: number; level: number };
  waterfall: { x: number; z: number; dirX: number; dirZ: number; width: number; top: number };
  /** No chasm and no ridge in the inner valley: placed far away with zero size. */
  chasm: { z: number; halfWidth: number; depth: number };
  ridge: { z: number; height: number; halfThickness: number; passX: number; passHalfWidth: number };
  flats: { x: number; z: number; radius: number }[];
  mounds: { x: number; z: number; radius: number; height: number }[];
  clearings: { x: number; z: number; radius: number }[];
  oak?: { x: number; z: number };
  /** Index of the burned root (same index outside). Faces the imp clearing (waveSource). */
  burnedRoot: number;
  /** Horizontal direction (unit) toward the alley side of the valley. The imp's clue points there. */
  alleyDir: { x: number; z: number };
}

export const LAYOUT: InnerLayout = {
  start: { x: 0, z: -19, heading: 0 },
  entrance: { x: 0, z: -19 },
  tree: { x: 0, z: 10 },
  waveSource: { x: -7, z: 12 },
  impSpot: { x: -15, z: 14 },
  burnedRoot: 2,
  alleyDir: { x: -1, z: 0 },
  path: [
    [0, -22],
    [0, -17],
    [-6, -12],
    [-9, -5],
    [-6, 2],
    [-2, 7],
    [0, 10],
  ],
  pathWidth: 1.8,
  river: {
    points: [
      [34, -9],
      [26, -9],
      [18, -10],
      [10, -8],
      [3, -8],
      [-3, -8],
    ],
    halfWidth: 2.6,
    level: -0.55,
  },
  waterfall: { x: 20, z: -9.5, dirX: 1, dirZ: 0.05, width: 1.4, top: 11 },
  chasm: { z: 9999, halfWidth: 1, depth: 0 },
  ridge: { z: 9999, height: 0, halfThickness: 1, passX: 0, passHalfWidth: 1 },
  flats: [{ x: 0, z: 34, radius: 8 }],
  mounds: [
    { x: 14, z: 8, radius: 7, height: 1.4 },
    { x: -14, z: 14, radius: 6, height: 1.2 },
    { x: 13, z: -20, radius: 5, height: 1.0 },
  ],
  clearings: [
    { x: 0, z: -19, radius: 4.5 },
    { x: 0, z: 10, radius: 8 },
    { x: -7, z: 12, radius: 4 },
    { x: -15, z: 14, radius: 9 },
  ],
};
