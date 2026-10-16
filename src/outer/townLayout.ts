/**
 * Where everything stands in the outer town. x = east, z = north. Metres.
 * The camera looks north, so the way runs from the Town Edge (south) to the Square (north).
 * Start -> Square centre is about 40 m.
 * The ground is a small valley basin (townTerrain.ts): lanes are walkable, banks and cliffs close the town.
 */
export interface RectArea {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * A house. Its front (door side) is local south (-z); the rotation toward the street is computed
 * in townTerrain.houseRot. floors/style/roof/colour feed the HouseBuilder.
 */
export interface HouseDef {
  x: number;
  z: number;
  /** Width and depth (before rotation). */
  w: number;
  d: number;
  /** Height of the walls (metres). */
  h: number;
  floors: 1 | 2 | 3;
  style: 'plaster' | 'stone' | 'timber';
  roof: 'gable' | 'hip' | 'flat-terrace';
  wall: 'sandstone' | 'ivory';
  shutter: 'olive' | 'powder';
  /** Wall colour (palette hex). */
  colour: string;
  seed: number;
}

/** A walkable lane: a polyline with a half width (round ends). */
export interface Lane {
  points: [number, number][];
  halfWidth: number;
}

export type CitizenColors = 'earthy' | 'muted' | 'deep';
export type CitizenHead = 'hair' | 'cap' | 'bald';
export type CitizenGender = 'male' | 'female';

export interface CitizenDef {
  /** Omitted for older story figures, which keep the male shape. */
  gender?: CitizenGender;
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

const SAND = '#E8A77C';
const IVORY = '#F4EEDF';

export const TOWN = {
  start: { x: 0, z: 0 },
  /** Walkable lanes. Together with the stream they define where the player may stand. */
  walk: {
    /** The grassy slope of the Town Edge. */
    meadow: { points: [[0.4, -3.4], [0.7, 7.5]], halfWidth: 7 } as Lane,
    /** Main Street: curves gently uphill to the Square. */
    street: { points: [[0, 9], [0.8, 14], [0.6, 18], [0, 22], [-1.2, 26], [-1.4, 29.5], [0, 33]], halfWidth: 3 } as Lane,
    /** The Square: a round terrace. */
    square: { points: [[0, 37], [0, 45]], halfWidth: 8.5 } as Lane,
    /** The Alley: a narrow lane that bends west. Flat floor. */
    alley: {
      points: [[-8, 42], [-11, 42.4], [-14, 41.5], [-17, 41.6], [-20, 42.4], [-23, 42.6], [-26, 41.9], [-27.5, 42]],
      halfWidth: 2.2,
    } as Lane,
  },
  /** Bounding rectangles of the four places (camera, rough tests). */
  areas: {
    edge: { minX: -7, maxX: 8, minZ: -5, maxZ: 14.5 } as RectArea,
    street: { minX: -4.5, maxX: 4.5, minZ: 9, maxZ: 33 } as RectArea,
    square: { minX: -8.5, maxX: 8.5, minZ: 28.5, maxZ: 53.5 } as RectArea,
    alley: { minX: -29.7, maxX: -8, minZ: 39.2, maxZ: 44.8 } as RectArea,
  },
  /** Stone gate between the meadow and Main Street. */
  arch: { x: 0.5, z: 12, halfOpening: 2.2, height: 3.6 },
  /** A small stream from a cliff waterfall in the east crosses the Town Edge. */
  stream: { halfWidth: 1.15, zAt: 5.4, wiggle: 0.8, endX: -17.5, level0: 0.3, slope: 0.004 },
  /** Little stone bridge over the stream (the way in). The deck runs south-north. */
  bridge: { x: 1.0, halfWidth: 1.3, halfDeck: 2.0, ramp: 2.2, deckY: 0.95, rampEndY: 0.4 },
  /** Thought Waves come from this side: the alley where the stranger ran. */
  waveSource: { x: -19, z: 42 },
  /** Bump on Main Street: crossing triggerZ starts it. The stranger runs from `spawn` to the player, then along `path`. */
  bump: {
    triggerZ: 35,
    halfX: 8,
    /** The stranger enters the square from the east lane (between the two east houses). */
    spawn: { x: 17, z: 49.7 },
    path: [[-5, 42.6], [-9, 42.2], [-14, 41.6]] as [number, number][],
  },
  /** Alley story spots (all on the alley floor). */
  alleyStory: {
    child: { x: -22, z: 42.5, heading: Math.PI / 2 },
    stranger: { x: -20.5, z: 42.3, heading: -Math.PI / 2 },
    basket: { x: -17.5, z: 41.6 },
    apples: [[-15, 41.0], [-16.4, 42.9], [-18.9, 41.3], [-19.6, 43.4], [-13.6, 42.2]] as [number, number][],
  },
  /** Lantern niche in the Old Tree trunk (south side, faces the fountain). */
  niche: { y: 1.2, trunkFaceDz: 0.88, w: 0.5, h: 0.7, d: 0.3 },
  squareCentre: { x: 0, z: 41 },
  oldTree: { x: 0, z: 47, trunkRadius: 0.9, colliderRadius: 1.3, lanternBranchFraction: 0.72 },
  fountain: { x: 0, z: 37, outerRadius: 2.2, innerRadius: 1.6, height: 0.6 },
  stalls: [
    { x: -5.6, z: 38.4, w: 3, d: 1.6, canopy: 'ivory' as const },
    { x: 6, z: 43, w: 3, d: 1.6, canopy: 'olive' as const },
  ],
  /** Waypoint loops for citizens (x, z). On the lanes, clear of the fountain, stalls and tree. */
  loops: [
    [[-3, 34.5], [-3, 45.5], [-6.5, 47.5], [-8.2, 41.5], [-8.2, 36.5]],
    [[4, 35], [4, 45], [7, 46], [7, 36]],
    [[4, 37], [0, 41.5], [-4, 37], [0, 32.5]],
    [[0.8, 15], [0.5, 19], [-0.8, 24], [-0.2, 20]],
    [[3, 47], [0, 50.5], [-3, 47], [0, 43.5]],
  ] as [number, number][][],
  /** Eight citizens. Pairs (0,1) (2,3) (4,5) chat. Colour sets mixed everywhere; none means good or bad. */
  citizens: [
    { gender: 'female', colors: 'earthy', head: 'hair', beard: false, torch: false, personalBase: 0.1, loop: 0, start: 0, partner: 1, scale: 1.0, seed: 1 },
    { gender: 'male', colors: 'muted', head: 'cap', beard: true, torch: true, personalBase: 0.2, loop: 0, start: 0, partner: 0, scale: 1.05, seed: 2 },
    { gender: 'male', colors: 'deep', head: 'hair', beard: true, torch: false, personalBase: 0.15, loop: 1, start: 1, partner: 3, scale: 1.08, seed: 3 },
    { gender: 'male', colors: 'earthy', head: 'bald', beard: false, torch: true, personalBase: 0.25, loop: 1, start: 1, partner: 2, scale: 0.97, seed: 4 },
    { gender: 'female', colors: 'muted', head: 'hair', beard: false, torch: false, personalBase: 0.05, loop: 2, start: 0, partner: 5, scale: 0.95, seed: 5 },
    { gender: 'female', colors: 'deep', head: 'cap', beard: false, torch: true, personalBase: 0.2, loop: 2, start: 0, partner: 4, scale: 1.0, seed: 6 },
    { gender: 'male', colors: 'earthy', head: 'cap', beard: true, torch: false, personalBase: 0.12, loop: 3, start: 0, scale: 1.03, seed: 7 },
    { gender: 'female', colors: 'muted', head: 'hair', beard: false, torch: true, personalBase: 0.3, loop: 4, start: 2, scale: 1.0, seed: 8 },
  ] as CitizenDef[],
  houses: [
    // Main Street, west and east
    { x: -7.4, z: 16.5, w: 6, d: 7, h: 4.2, floors: 2, style: 'plaster', roof: 'gable', wall: 'sandstone', shutter: 'olive', colour: SAND, seed: 1 },
    { x: -8.6, z: 23.2, w: 5.5, d: 6, h: 5.2, floors: 2, style: 'timber', roof: 'gable', wall: 'ivory', shutter: 'powder', colour: IVORY, seed: 2 },
    { x: 9.4, z: 15.5, w: 6, d: 7, h: 5.0, floors: 2, style: 'plaster', roof: 'hip', wall: 'ivory', shutter: 'powder', colour: IVORY, seed: 3 },
    { x: 7.6, z: 23, w: 6, d: 7, h: 4.0, floors: 1, style: 'stone', roof: 'gable', wall: 'sandstone', shutter: 'olive', colour: SAND, seed: 4 },
    { x: -11.5, z: 30, w: 5.5, d: 5.5, h: 4.6, floors: 2, style: 'plaster', roof: 'gable', wall: 'ivory', shutter: 'olive', colour: IVORY, seed: 5 },
    { x: 11.5, z: 30, w: 5.5, d: 5.5, h: 5.4, floors: 2, style: 'timber', roof: 'hip', wall: 'sandstone', shutter: 'powder', colour: SAND, seed: 6 },
    // Square, east
    { x: 16.5, z: 36.5, w: 7, d: 8, h: 5.0, floors: 2, style: 'plaster', roof: 'gable', wall: 'sandstone', shutter: 'powder', colour: SAND, seed: 7 },
    { x: 15.5, z: 44.5, w: 7, d: 8, h: 4.2, floors: 1, style: 'stone', roof: 'hip', wall: 'ivory', shutter: 'olive', colour: IVORY, seed: 8 },
    { x: 15, z: 54.5, w: 7, d: 7, h: 5.6, floors: 3, style: 'plaster', roof: 'gable', wall: 'sandstone', shutter: 'olive', colour: SAND, seed: 9 },
    // Square, north
    { x: -6.5, z: 58.5, w: 6.5, d: 6, h: 5.2, floors: 2, style: 'plaster', roof: 'hip', wall: 'ivory', shutter: 'powder', colour: IVORY, seed: 10 },
    { x: 2, z: 58.5, w: 6.5, d: 6, h: 4.4, floors: 2, style: 'timber', roof: 'gable', wall: 'sandstone', shutter: 'olive', colour: SAND, seed: 11 },
    { x: 10, z: 61, w: 5.5, d: 5.5, h: 5.6, floors: 3, style: 'stone', roof: 'gable', wall: 'ivory', shutter: 'olive', colour: IVORY, seed: 12 },
    // Square, west (north and south of the alley mouth)
    { x: -12, z: 53, w: 6, d: 6, h: 5.0, floors: 2, style: 'plaster', roof: 'gable', wall: 'sandstone', shutter: 'powder', colour: SAND, seed: 13 },
    { x: -15.5, z: 35.8, w: 6, d: 5, h: 4.4, floors: 2, style: 'timber', roof: 'hip', wall: 'ivory', shutter: 'olive', colour: IVORY, seed: 14 },
    // Alley: south side, north side and the closed end
    { x: -23.5, z: 36.2, w: 8, d: 4.8, h: 4.6, floors: 2, style: 'plaster', roof: 'gable', wall: 'sandstone', shutter: 'powder', colour: SAND, seed: 15 },
    { x: -19.5, z: 48.5, w: 8, d: 5, h: 5.0, floors: 2, style: 'stone', roof: 'gable', wall: 'ivory', shutter: 'olive', colour: IVORY, seed: 16 },
    { x: -27, z: 48, w: 5, d: 5, h: 4.0, floors: 1, style: 'plaster', roof: 'hip', wall: 'sandstone', shutter: 'olive', colour: SAND, seed: 17 },
    { x: -34.5, z: 42, w: 5, d: 8, h: 4.8, floors: 2, style: 'timber', roof: 'gable', wall: 'sandstone', shutter: 'olive', colour: SAND, seed: 18 },
  ] as HouseDef[],
  /** Soft gold guide light at the mouth of the Square. */
  beacon: { x: 0, z: 34.5 },
} as const;
