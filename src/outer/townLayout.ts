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
  squareCentre: { x: 0, z: 40 },
  oldTree: { x: 0, z: 47, trunkRadius: 0.9, colliderRadius: 1.3 },
  fountain: { x: 0, z: 37, outerRadius: 2.2, innerRadius: 1.6, height: 0.6 },
  stalls: [
    { x: -6.5, z: 41, w: 3, d: 1.6, canopy: 'ivory' as const },
    { x: 6.5, z: 42, w: 3, d: 1.6, canopy: 'olive' as const },
  ],
  /** The wall around the meadow strip (low stone). */
  meadowWall: { thickness: 0.5 },
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
