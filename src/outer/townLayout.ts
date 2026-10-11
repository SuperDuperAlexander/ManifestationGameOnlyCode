/**
 * Where everything stands in the outer town. x = east, z = north. Metres.
 * The camera looks north, so the way runs from the Town Edge (south) to the Square (north).
 * Start -> Square centre is about 40 m.
 */
export interface RectArea {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface HouseDef {
  x: number;
  z: number;
  /** Width (east-west) and depth (north-south). */
  w: number;
  d: number;
  /** Height of the walls. */
  h: number;
  wall: 'sandstone' | 'ivory';
  shutter: 'olive' | 'powder';
  /** Which side faces the street: shutters go there. */
  face: 'east' | 'west' | 'south';
}

export type CitizenColors = 'earthy' | 'muted' | 'deep';
export type CitizenHead = 'hair' | 'cap' | 'bald';

export interface CitizenDef {
  colors: CitizenColors;
  head: CitizenHead;
  beard: boolean;
  torch: boolean;
  /** 0..1, how short-tempered this person is by nature. */
  personalBase: number;
  /** Index into TOWN.loops. */
  loop: number;
  /** Start waypoint in the loop. */
  start: number;
  /** Chat partner: index of the other citizen. The lower index leads. */
  partner?: number;
  scale: number;
  seed: number;
}

export const TOWN = {
  start: { x: 0, z: 0 },
  /** Low stone arch between the meadow and Main Street. */
  arch: { x: 0, z: 13, halfOpening: 2.2, height: 3.6 },
  /** Walkable rectangles. They overlap a little at the joints. */
  areas: {
    edge: { minX: -10, maxX: 10, minZ: -5, maxZ: 13.5 } as RectArea,
    street: { minX: -3.2, maxX: 3.2, minZ: 12.5, maxZ: 30.5 } as RectArea,
    square: { minX: -11, maxX: 11, minZ: 28.5, maxZ: 52 } as RectArea,
    alley: { minX: -29, maxX: -9, minZ: 40.2, maxZ: 43.8 } as RectArea,
  },
  /** Slope at the Town Edge: from slopeStartZ (low) up to slopeEndZ (flat). */
  slope: { startZ: -5, endZ: 8 },
  /** Thought Waves come from this side: the alley where the stranger ran. */
  waveSource: { x: -19, z: 42 },
  /** Bump on Main Street: crossing triggerZ starts it. The stranger runs from `spawn` to the player, then along `path`. */
  bump: {
    triggerZ: 21,
    spawn: { x: 2, z: 36.5 },
    path: [[0, 31], [-3, 35.5], [-8, 38.5], [-10.5, 41.8], [-14, 42]] as [number, number][],
  },
  /** Alley story spots. */
  alleyStory: {
    child: { x: -22, z: 41.8, heading: Math.PI / 2 },
    stranger: { x: -20.5, z: 42.5, heading: -Math.PI / 2 },
    basket: { x: -17.5, z: 41.3 },
    apples: [[-15, 41.0], [-16.4, 43.1], [-18.9, 40.8], [-19.6, 43.2], [-13.6, 42.6]] as [number, number][],
  },
  /** Lantern niche in the Old Tree trunk (south side, faces the fountain). */
  niche: { y: 1.2, trunkFaceDz: 0.88, w: 0.5, h: 0.7, d: 0.3 },
  squareCentre: { x: 0, z: 40 },
  oldTree: { x: 0, z: 47, trunkRadius: 0.9, colliderRadius: 1.3 },
  fountain: { x: 0, z: 37, outerRadius: 2.2, innerRadius: 1.6, height: 0.6 },
  stalls: [
    { x: -6.5, z: 41, w: 3, d: 1.6, canopy: 'ivory' as const },
    { x: 6.5, z: 42, w: 3, d: 1.6, canopy: 'olive' as const },
  ],
  /** The wall around the meadow strip (low stone). */
  meadowWall: { thickness: 0.5 },
  /** Waypoint loops for citizens (x, z). Clear of the fountain, stalls and tree. */
  loops: [
    [[-4, 35], [-4, 45], [-9, 47], [-9, 35]],
    [[4, 35], [4, 45], [9, 46], [9, 36]],
    [[4, 37], [0, 41.5], [-4, 37], [0, 32.5]],
    [[-1.5, 17], [1.5, 22], [-1.5, 27], [1.5, 20]],
    [[3, 47], [0, 50.5], [-3, 47], [0, 43.5]],
  ] as [number, number][][],
  /** Eight citizens. Pairs (0,1) (2,3) (4,5) chat. Colour sets mixed everywhere; none means good or bad. */
  citizens: [
    { colors: 'earthy', head: 'hair', beard: false, torch: false, personalBase: 0.1, loop: 0, start: 0, partner: 1, scale: 1.0, seed: 1 },
    { colors: 'muted', head: 'cap', beard: true, torch: true, personalBase: 0.2, loop: 0, start: 0, partner: 0, scale: 1.05, seed: 2 },
    { colors: 'deep', head: 'hair', beard: true, torch: false, personalBase: 0.15, loop: 1, start: 1, partner: 3, scale: 1.08, seed: 3 },
    { colors: 'earthy', head: 'bald', beard: false, torch: true, personalBase: 0.25, loop: 1, start: 1, partner: 2, scale: 0.97, seed: 4 },
    { colors: 'muted', head: 'hair', beard: false, torch: false, personalBase: 0.05, loop: 2, start: 0, partner: 5, scale: 0.95, seed: 5 },
    { colors: 'deep', head: 'cap', beard: false, torch: true, personalBase: 0.2, loop: 2, start: 0, partner: 4, scale: 1.0, seed: 6 },
    { colors: 'earthy', head: 'cap', beard: true, torch: false, personalBase: 0.12, loop: 3, start: 0, scale: 1.03, seed: 7 },
    { colors: 'muted', head: 'hair', beard: true, torch: true, personalBase: 0.3, loop: 4, start: 2, scale: 1.0, seed: 8 },
  ] as CitizenDef[],
  houses: [
    // Main Street, west side
    { x: -7.2, z: 17.5, w: 7, d: 8, h: 4.2, wall: 'sandstone', shutter: 'olive', face: 'east' },
    { x: -7.2, z: 25, w: 7, d: 7, h: 5.2, wall: 'ivory', shutter: 'powder', face: 'east' },
    // Main Street, east side
    { x: 7.2, z: 17.5, w: 7, d: 8, h: 5.0, wall: 'ivory', shutter: 'powder', face: 'west' },
    { x: 7.2, z: 25, w: 7, d: 7, h: 4.0, wall: 'sandstone', shutter: 'olive', face: 'west' },
    // Square, south side flanks
    { x: -7.5, z: 32, w: 7, d: 5, h: 4.6, wall: 'ivory', shutter: 'olive', face: 'south' },
    { x: 7.5, z: 32, w: 7, d: 5, h: 5.4, wall: 'sandstone', shutter: 'powder', face: 'south' },
    // Square, east side
    { x: 14.5, z: 34, w: 7, d: 8, h: 5.0, wall: 'sandstone', shutter: 'powder', face: 'west' },
    { x: 14.5, z: 42, w: 7, d: 8, h: 4.2, wall: 'ivory', shutter: 'olive', face: 'west' },
    { x: 14.5, z: 50, w: 7, d: 8, h: 5.6, wall: 'sandstone', shutter: 'olive', face: 'west' },
    // Square, north side
    { x: -6.5, z: 55, w: 8, d: 6, h: 5.2, wall: 'ivory', shutter: 'powder', face: 'south' },
    { x: 1.5, z: 55, w: 8, d: 6, h: 4.4, wall: 'sandstone', shutter: 'olive', face: 'south' },
    { x: 9, z: 55, w: 7, d: 6, h: 5.6, wall: 'ivory', shutter: 'olive', face: 'south' },
    // Square, west side (north and south of the alley mouth)
    { x: -14.5, z: 33.5, w: 7, d: 6, h: 4.4, wall: 'ivory', shutter: 'olive', face: 'east' },
    { x: -14.5, z: 51, w: 7, d: 6, h: 5.0, wall: 'sandstone', shutter: 'powder', face: 'east' },
    // Alley, south and north sides, and the closed end
    { x: -18, z: 38.2, w: 14, d: 4, h: 4.6, wall: 'sandstone', shutter: 'powder', face: 'south' },
    { x: -18, z: 45.8, w: 14, d: 4, h: 5.0, wall: 'ivory', shutter: 'olive', face: 'south' },
    { x: -31, z: 42, w: 4, d: 9, h: 4.8, wall: 'sandstone', shutter: 'olive', face: 'east' },
  ] as HouseDef[],
} as const;
