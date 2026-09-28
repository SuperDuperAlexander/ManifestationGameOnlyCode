/**
 * The MVP level: one closed valley. Metres, x = east, z = north.
 *
 *   south: start meadow ── winding path ── fog 1 on the stone bridge over the river
 *   middle: meadow with the monolith, the old oak and the well
 *   a rock ridge crosses the valley; fog 2 sits in its only pass
 *   a small plateau, then
 *   the deep chasm. With 20 light points a bridge of light appears. The arch waits beyond.
 */
export const LAYOUT = {
  start: { x: 4, z: -46, heading: 0 },

  /** The winding sand path (smoothed into a curve). */
  path: [
    [4, -50],
    [3, -44],
    [-5, -38],
    [-9, -31],
    [-4, -24],
    [6, -19],
    [8, -13],
    [1, -9],
    [0, -3],
    [0, 1],
    [-5, 6],
    [-8, 12],
    [-3, 17],
    [4, 20],
    [5, 24],
    [4, 29],
    [1, 34],
    [0, 38.5],
  ] as [number, number][],
  pathWidth: 1.8,

  /** The river runs from a waterfall in the east cliff to the west cliff, across the whole valley. */
  river: {
    points: [
      [62, 1],
      [36, -1],
      [25, 0],
      [15, -5],
      [7, -2],
      [0, -3],
      [-8, -6],
      [-16, -2],
      [-25, -5],
      [-36, -3],
      [-62, -2],
    ] as [number, number][],
    halfWidth: 2.3,
    level: -0.55,
  },

  /** The stone bridge over the river (north-south). */
  stoneBridge: { x: 0, z: -3, length: 8, width: 2.6 },

  /** A rock ridge across the valley, with one narrow pass. */
  ridge: { z: 24, height: 6, halfThickness: 2.6, passX: 5, passHalfWidth: 2.4 },

  /** The chasm across the north of the valley. */
  chasm: { z: 45.5, halfWidth: 6.5, depth: 30 },

  /** The bridge of light over the chasm. */
  lightBridge: { x: 0, fromZ: 38.4, toZ: 52.6, width: 2.8, planks: 15 },

  /** The two blockades. Text and release sentence are drafts for Alexander. */
  fogs: [
    { id: 'worthy', x: 0, z: -7.4, radius: 3.0, text: 'I am not worthy', release: 'I am worthy', points: 10 },
    { id: 'angry', x: 5, z: 24, radius: 3.0, text: 'I am angry', release: 'I choose peace', points: 10 },
  ],
  pointsForBridge: 20,

  /** Places the cliffs must not cover. */
  flats: [
    { x: 0, z: 58, radius: 8 },
    { x: 4, z: -48, radius: 7 },
  ],

  mounds: [
    { x: -15, z: 12, radius: 8, height: 2.4 },
    { x: 14, z: -26, radius: 7, height: 1.6 },
    { x: -14, z: -40, radius: 6, height: 1.2 },
    { x: 15, z: 14, radius: 6, height: 1.3 },
    { x: -12, z: 33, radius: 6, height: 1.4 },
  ],
  oak: { x: -15, z: 12 },
  monolith: { x: 9, z: 9 },
  well: { x: -10, z: 17 },
  arch: { x: 0, z: 58 },
  pillars: [
    { x: -4.2, z: 55.5, height: 2.4 },
    { x: 4.6, z: 56, height: 1.4 },
    { x: 3.8, z: 60.5, height: 3.0 },
  ],
  /** Keep trees and rocks away from these points. */
  clearings: [
    { x: 4, z: -46, radius: 5 },
    { x: 9, z: 9, radius: 4 },
    { x: -10, z: 17, radius: 3.5 },
    { x: 0, z: 58, radius: 6 },
    { x: 0, z: -7.4, radius: 5 },
    { x: 5, z: 24, radius: 5 },
  ],
} as const;

export type FogSpec = (typeof LAYOUT.fogs)[number];
