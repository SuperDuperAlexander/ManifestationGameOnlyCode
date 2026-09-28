import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Constants } from '@babylonjs/core/Engines/constants';
import type { Material } from '@babylonjs/core/Materials/material';
import type { Color3 } from '@babylonjs/core/Maths/math.color';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PALETTE } from '../content/palette';
import type { BodyPoint } from '../content/chapter2';
import { makeRng } from '../core/math';
import { colorState } from '../render/colorRestore';
import { worldMaterial } from '../render/materials';
import {
  capsuleGeo,
  circleGeo,
  computeVertexNormals,
  cylinderGeo,
  icosahedronGeo,
  ringGeo,
  rotateXGeo,
  sphereGeo,
  torusGeo,
} from '../render/geometry';
import type { Group } from '../render/scene3d';
import {
  FRONT_FACE,
  group,
  linearColor,
  mesh as makeMesh,
  mixColor,
  setVertexColors,
  stage,
} from '../render/scene3d';
import { addWater, waterMaterial } from './water';

function stoneMaterial(tone: string | number | Color3 = 0xada79d, rim = 0.3): Material {
  return worldMaterial({ color: tone, rim });
}

/**
 * A pool that reflects the sky the world is lit by.
 *
 * The sky cube is set up before anything that stands in the place is built,
 * so it is here to be reflected. If it somehow is not, the pool falls back
 * to being a dull wet stone rather than to nothing at all.
 */
function poolMaterial(shallow: number, deep: number): Material {
  const sky = stage().environmentTexture;
  if (!sky) return worldMaterial({ color: shallow, rim: 0.3, roughness: 0.4, doubleSided: true });
  return waterMaterial(sky, shallow, deep);
}

/**
 * The symbol carved into a body stone, drawn in code.
 *
 * Each one is a flat shape sunk a little into the stone face and cut from a
 * darker tone, the way a chisel leaves a shadow. The shapes stay simple
 * enough to read from the path: two prints, a full circle, a downward point,
 * a ringed circle.
 */
function carvedSymbol(point: BodyPoint): Group {
  const symbol = group(`symbol-${point}`);
  const cut = worldMaterial({ color: 0x6b6560, rim: 0, doubleSided: true });
  const add = (geo: ReturnType<typeof circleGeo>, x: number, y: number, rot = 0): void => {
    const face = makeMesh('carve', geo);
    face.material = cut;
    face.position.set(x, y, 0);
    face.rotation.z = rot;
    face.parent = symbol;
  };

  if (point === 'feet') {
    // Two footprints, side by side.
    for (const x of [-0.12, 0.12]) add(circleGeo(0.075, 14), x, 0);
    for (const x of [-0.12, 0.12]) add(circleGeo(0.04, 10), x, 0.1);
  } else if (point === 'belly') {
    add(circleGeo(0.17, 22), 0, 0);
  } else if (point === 'heart') {
    // A point turned downward: the simplest mark that is not a circle.
    add(circleGeo(0.19, 3), 0, 0, Math.PI / 2);
  } else {
    add(circleGeo(0.1, 20), 0, 0);
    add(ringGeo(0.16, 0.19, 24), 0, 0);
  }
  return symbol;
}

/** A soft halo. Off until whatever it belongs to is the thing being lit. */
function buildHalo(name: string): Mesh {
  const halo = makeMesh(name, sphereGeo(1, 14, 12));
  const material = new StandardMaterial(`${name}-mat`, stage());
  material.emissiveColor = linearColor(PALETTE.receiveGold);
  material.diffuseColor = linearColor(0x000000);
  material.disableLighting = true;
  material.alpha = 0;
  material.disableDepthWrite = true;
  material.alphaMode = Constants.ALPHA_COMBINE;
  material.fogEnabled = false;
  material.sideOrientation = FRONT_FACE;
  halo.material = material;
  halo.isPickable = false;
  return halo;
}

/**
 * A rounded standing stone with a symbol on its face.
 *
 * The stone leans a little and is never square: these are stones somebody set
 * upright a long time ago, not posts.
 */
export function buildStandingStone(point: BodyPoint, seed: number): Group {
  const stone = group(`stone-${point}`);
  const rng = makeRng(seed);
  const height = 1.9 + rng() * 0.5;

  const geo = capsuleGeo(0.42, height - 0.84, 3, 10);
  for (let i = 0; i < geo.positions.length; i += 3) {
    const y = geo.positions[i + 1] ?? 0;
    // Wider at the base, narrower at the top, and rough all over.
    const taper = 1 - (y / height) * 0.22;
    const rough = 0.94 + rng() * 0.14;
    geo.positions[i] = (geo.positions[i] ?? 0) * taper * rough;
    geo.positions[i + 2] = (geo.positions[i + 2] ?? 0) * taper * rough * 0.66;
  }
  computeVertexNormals(geo);
  const body = makeMesh('standingStone', geo);
  body.material = stoneMaterial(0xb3ada2);
  body.position.y = height / 2;
  body.parent = stone;

  const symbol = carvedSymbol(point);
  symbol.position.set(0, height * 0.6, 0.28);
  symbol.scaling.setAll(1.25);
  symbol.parent = stone;

  const glow = buildHalo('stoneGlow');
  glow.position.y = height * 0.62;
  glow.scaling.setAll(1.35);
  glow.setEnabled(false);
  glow.parent = stone;

  stone.rotation.z = (rng() - 0.5) * 0.09;
  return stone;
}

/**
 * Lights the halo on a body stone.
 *
 * Only the next stone in the order is ever lit, which is the whole of the
 * guidance in that scene: no text, no marker, just the one stone that is
 * waiting. `amount` is 0 to 1.
 */
export function setStoneGlow(stone: TransformNode, amount: number): void {
  const glow = stone.getChildMeshes(false, (n) => n.name === 'stoneGlow')[0];
  if (!glow) return;
  const a = Math.max(0, Math.min(1, amount));
  glow.setEnabled(a > 0.01);
  const material = glow.material as StandardMaterial | null;
  if (material) material.alpha = a * 0.3;
  glow.scaling.setAll(1.25 + a * 0.25);
}

/**
 * The tall stone that hums. It is the only thing in the meadows taller than a
 * tree, so the player can find it from anywhere on the ridge path.
 */
export function buildSingingStone(): Group {
  const singing = group('singingStone');
  const rng = makeRng(5150);
  const height = 5.2;

  const geo = cylinderGeo(0.34, 0.72, height, 7, 4);
  for (let i = 0; i < geo.positions.length; i += 3) {
    const s = 0.9 + rng() * 0.2;
    geo.positions[i] = (geo.positions[i] ?? 0) * s;
    geo.positions[i + 2] = (geo.positions[i + 2] ?? 0) * s;
  }
  computeVertexNormals(geo);
  const stone = makeMesh('singingStoneBody', geo);
  stone.material = stoneMaterial(0xa9a398);
  stone.position.y = height / 2;
  stone.parent = singing;

  // Three shallow bands around it, like the grooves a long hum would wear.
  for (let i = 0; i < 3; i++) {
    const r = 0.52 - i * 0.05;
    const band = makeMesh('band', rotateXGeo(torusGeo(r, 0.035, 5, 18), Math.PI / 2));
    band.material = worldMaterial({ color: 0x5f5b56, rim: 0 });
    band.position.y = height * (0.32 + i * 0.16);
    band.parent = singing;
  }
  return singing;
}

/**
 * The light well: a low ring of stones around a small pool.
 *
 * It is deliberately plain. Nothing about it should read as a reward; it is
 * there so a player who spends their light cannot end up stuck.
 */
export function buildLightWell(): Group {
  const well = group('lightWell');
  const rng = makeRng(8801);

  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const r = 1.25 + rng() * 0.12;
    const size = 0.2 + rng() * 0.16;
    const stone = makeMesh('wellStone', icosahedronGeo(size, 0));
    stone.material = stoneMaterial(0xb6b0a5);
    stone.position.set(Math.cos(a) * r, size * 0.6, Math.sin(a) * r);
    stone.rotation.set(rng(), rng(), rng());
    stone.parent = well;
  }

  const water = makeMesh('wellWater', rotateXGeo(circleGeo(1.15, 26), -Math.PI / 2));
  addWater(water, poolMaterial(0x9fb6c2, 0x5f7d8e));
  water.position.y = 0.06;
  water.parent = well;
  return well;
}

const MOUNTAINS = 'lwMountains';

/**
 * A ring of distant mountains in soft violet.
 *
 * They sit outside the walkable ground and never move, so they cost one draw
 * call and give the meadows a horizon that is not just haze. They are drawn
 * without the grey-to-colour shader on purpose: distance already takes their
 * colour away.
 */
Effect.ShadersStore[`${MOUNTAINS}VertexShader`] = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec4 color;
  uniform mat4 worldViewProjection;
  varying vec3 vColor;
  void main() {
    vColor = color.rgb;
    gl_Position = worldViewProjection * vec4(position, 1.0);
  }
`;

Effect.ShadersStore[`${MOUNTAINS}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  uniform float uNight;
  uniform vec3 uNightTint;
  uniform float uGlobalColor;
  uniform vec3 uGreyTint;
  void main() {
    // Distance already takes most of a mountain's colour, so they only
    // follow the valley's own grey and the night, never a zone.
    float lum = dot(vColor, vec3(0.299, 0.587, 0.114));
    vec3 grey = mix(vec3(lum), uGreyTint * (0.6 + lum * 0.8), 0.4) * 0.9;
    vec3 col = mix(grey, vColor, clamp(uGlobalColor + 0.35, 0.0, 1.0));
    if (uNight > 0.001) {
      col = mix(col, mix(col, uNightTint * 1.6, 0.62) * 0.34, uNight);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function buildMountains(): Mesh {
  const rng = makeRng(31337);
  const positions: number[] = [];
  const colors: number[] = [];
  const near = mixColor(linearColor(PALETTE.farHillsViolet), linearColor(PALETTE.skyGrey), 0.3);
  const far = mixColor(linearColor(PALETTE.farHillsViolet), linearColor(PALETTE.skyGrey), 0.72);

  // Two bands at different distances, so the horizon has depth.
  for (const [radius, count, minH, maxH, blend] of [
    [250, 26, 26, 58, 0.85],
    [195, 22, 18, 40, 0.35],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng() * 0.12;
      const span = ((Math.PI * 2) / count) * (0.9 + rng() * 0.7);
      const h = minH + rng() * (maxH - minH);
      const cx = Math.cos(a) * radius;
      const cz = Math.sin(a) * radius;
      const lx = Math.cos(a + span / 2) * radius;
      const lz = Math.sin(a + span / 2) * radius;
      const rx = Math.cos(a - span / 2) * radius;
      const rz = Math.sin(a - span / 2) * radius;
      positions.push(lx, -20, lz, rx, -20, rz, cx, h, cz);
      const tone = mixColor(far, near, blend);
      for (let k = 0; k < 3; k++) {
        // Barely any shading. A mountain at this distance is a silhouette;
        // contrast on it only makes it look like a building.
        const shade = k === 2 ? 1.04 : 0.95;
        colors.push(tone.r * shade, tone.g * shade, tone.b * shade);
      }
    }
  }

  const mountains = makeMesh('mountains', {
    positions,
    normals: new Array<number>(positions.length).fill(0),
    uvs: new Array<number>((positions.length / 3) * 2).fill(0),
    indices: [],
  });
  setVertexColors(mountains, colors);

  const material = new ShaderMaterial(
    MOUNTAINS,
    stage(),
    { vertex: MOUNTAINS, fragment: MOUNTAINS },
    {
      attributes: ['position', 'color'],
      uniforms: ['worldViewProjection', 'uNight', 'uNightTint', 'uGlobalColor', 'uGreyTint'],
    },
  );
  material.backFaceCulling = false;
  material.fogEnabled = false;
  mountains.material = material;
  mountains.alwaysSelectAsActiveMesh = true;
  mountains.isPickable = false;
  mountains.receiveShadows = false;
  return mountains;
}

/** The distant mountains follow the valley's grey and the night. */
export function updateMountains(mountains: Mesh): void {
  const material = mountains.material as ShaderMaterial;
  material.setFloat('uNight', colorState.night);
  material.setColor3('uNightTint', colorState.nightTint);
  material.setFloat('uGlobalColor', colorState.globalColor);
  material.setColor3('uGreyTint', colorState.greyTint);
}

/** A shallow stone basin, the one spring of the meadows. */
export function buildMeadowSpring(): Group {
  const spring = group('meadowSpring');
  const rng = makeRng(6120);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const size = 0.26 + rng() * 0.16;
    const stone = makeMesh('springStone', icosahedronGeo(size, 0));
    stone.material = stoneMaterial(0xbab3a7);
    stone.position.set(Math.cos(a) * 1.05, size * 0.5, Math.sin(a) * 1.05);
    stone.rotation.set(rng(), rng(), rng());
    stone.parent = spring;
  }
  const water = makeMesh('springWater', rotateXGeo(circleGeo(0.95, 24), -Math.PI / 2));
  addWater(water, poolMaterial(0xa8c0cc, 0x69889b));
  water.position.y = 0.08;
  water.parent = spring;
  return spring;
}
