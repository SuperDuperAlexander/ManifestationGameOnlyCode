/**
 * Where the small town details stand (hand-placed ones). x = east, z = north. Metres.
 * Heights come from the terrain (townTerrain.ts). None of these stand on a walk path.
 * Plants have no colliders. House flowers, doors and steps come from HouseBuilder.
 */
export interface PropSpot {
  x: number;
  z: number;
  scale: number;
  out?: boolean;
}

export const TOWN_PROPS = {
  /** Tall dark flames: on the banks around the Town Edge, at the gate, and in the square's corners. */
  cypresses: [
    { x: -8.8, z: -1.5, scale: 1.25 },
    { x: 9.6, z: 0.5, scale: 1.35 },
    { x: -9.3, z: 6.5, scale: 1.1 },
    { x: 9.8, z: 9, scale: 1.4 },
    { x: -5.4, z: 11.2, scale: 1.2 },
    { x: 6.3, z: 11.4, scale: 1.3 },
    { x: -5, z: -6.2, scale: 1.0 },
    { x: 6.5, z: -5.5, scale: 1.15 },
    { x: -7.6, z: 53.4, scale: 0.6 },
    { x: 7.2, z: 53.6, scale: 0.55 },
  ] as PropSpot[],
  /** Round-crown trees on the slopes behind the meadow and the houses. */
  trees: [
    { x: -12, z: 2, scale: 1.3 },
    { x: 13, z: -2, scale: 1.3 },
    { x: -13.5, z: 9, scale: 1.2 },
    { x: 13.5, z: 11, scale: 1.35 },
    { x: -3, z: -9.5, scale: 1.4 },
    { x: 5, z: -9, scale: 1.25 },
    { x: -15, z: 21, scale: 1.2 },
    { x: 16.5, z: 21, scale: 1.3 },
  ] as PropSpot[],
  /** Round bushes along the meadow edge, at the bridge and in the alley. */
  bushes: [
    { x: -6, z: -2.5, scale: 0.9 },
    { x: 6.5, z: -2.2, scale: 1.0 },
    { x: -6.2, z: 3, scale: 0.85 },
    { x: 6.8, z: 3.6, scale: 0.9 },
    { x: -5.5, z: 9.5, scale: 0.8 },
    { x: 6.2, z: 9.8, scale: 0.9 },
    { x: -1.5, z: 3.2, scale: 0.7 },
    { x: 3.6, z: 7.9, scale: 0.7 },
    { x: -27.2, z: 40.2, scale: 0.55 },
    { x: -27.2, z: 44, scale: 0.5 },
  ] as PropSpot[],
  /** Stone benches at the edge of the square. `rot` = direction the seat faces (radians, 0 = north). */
  benches: [
    { x: 7.9, z: 40.5, rot: -Math.PI / 2 },
    { x: -6.4, z: 50.2, rot: 2.25 },
    { x: 5.5, z: 50.4, rot: Math.PI },
    { x: 7.6, z: 47.5, rot: -Math.PI / 2 },
  ] as { x: number; z: number; rot: number }[],
  /** Crates and barrels behind the stalls and in the alley. */
  crates: [
    { x: -6.4, z: 36.9, s: 0.55, rot: 0.2 },
    { x: -4.8, z: 36.9, s: 0.45, rot: -0.3 },
    { x: 5.3, z: 44.5, s: 0.5, rot: 0.1 },
    { x: 7.7, z: 44.2, s: 0.5, rot: 0.4 },
  ],
  barrels: [
    { x: -3.8, z: 38.6, s: 1 },
    { x: 7.3, z: 42.3, s: 1 },
    { x: -25.8, z: 40.2, s: 0.9 },
    { x: -9.6, z: 43.6, s: 0.9 },
  ],
  /** Colours of the hanging cloth on each stall (same order as TOWN.stalls): palette keys. */
  stallCloth: [
    ['cloak', 'gold'],
    ['sandstone', 'powder'],
  ] as [string, string][],
  /** Pots in the alley, at the lane edge. */
  alleyPots: [
    { x: -12.6, z: 40.1 },
    { x: -24.6, z: 44.0 },
  ],
};
