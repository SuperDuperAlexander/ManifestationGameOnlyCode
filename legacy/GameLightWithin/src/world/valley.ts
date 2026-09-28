import { LAYOUT, WORLD } from '../content/chapter1';
import { group } from '../render/scene3d';
import type { Group } from '../render/scene3d';
import type { FixturesResult, Place, PropsResult, TerrainResult } from './place';
import { buildSignStone, buildSpringBasin, scatterProps } from './props';
import {
  borderAmount,
  buildTerrain,
  inGap,
  pathAmount,
  pathCenterX,
  terrainHeight,
  valleyHalfWidth,
} from './terrain';

/**
 * Chapter 1's place: the grey valley with the gap in it.
 *
 * Everything here already existed; this only gathers it behind the Place
 * interface so the world builder does not have to know which chapter it is
 * standing in.
 */
export const valley: Place = {
  name: 'valley',
  height: terrainHeight,
  border: borderAmount,
  centerX: pathCenterX,
  halfWidth: valleyHalfWidth,
  pathAmount,
  isHole: inGap,
  zStart: WORLD.lengthStart,
  zEnd: WORLD.lengthEnd,
  halfWidthMax: WORLD.halfWidth,
  grassDensity: 1,
  buildTerrain(): TerrainResult {
    return buildTerrain();
  },
  buildProps(treeBlobs: number): PropsResult {
    return scatterProps(treeBlobs, {
      keepClear: [
        { x: LAYOUT.spring1.x, z: LAYOUT.spring1.z, r: 8 },
        { x: LAYOUT.spring2.x, z: LAYOUT.spring2.z, r: 9 },
        { x: LAYOUT.spring3.x, z: LAYOUT.spring3.z, r: 8 },
        { x: LAYOUT.fog.x, z: LAYOUT.fog.z, r: 11 },
        { x: LAYOUT.seedSpot.x, z: LAYOUT.seedSpot.z, r: 10 },
        { x: LAYOUT.playerStart.x, z: LAYOUT.playerStart.z, r: 9 },
        { x: LAYOUT.signStone.x, z: LAYOUT.signStone.z, r: 4 },
      ],
    });
  },
  buildFixtures(): FixturesResult {
    const fixtures = group('fixtures');
    const anchors = new Map<string, Group>();

    for (const [id, spot] of [
      ['spring1', LAYOUT.spring1],
      ['spring2', LAYOUT.spring2],
      ['spring3', LAYOUT.spring3],
    ] as const) {
      const basin = buildSpringBasin();
      basin.position.set(spot.x, terrainHeight(spot.x, spot.z), spot.z);
      basin.parent = fixtures;
      anchors.set(id, basin);
    }

    const stone = buildSignStone();
    stone.position.set(
      LAYOUT.signStone.x,
      terrainHeight(LAYOUT.signStone.x, LAYOUT.signStone.z),
      LAYOUT.signStone.z,
    );
    stone.rotation.y = -0.6;
    stone.parent = fixtures;

    return { group: fixtures, anchors, blockers: [] };
  },
  bridge: { x: LAYOUT.bridge.x, z: LAYOUT.bridge.z, deckZ: LAYOUT.gap.z1 + 3 },
};
