import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Vector4 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { LAYOUT } from '../content/chapter1';
import { PALETTE } from '../content/palette';
import { makeRng } from '../core/math';
import { COLOR_STATE_GLSL, COLOR_STATE_UNIFORMS, bindColorState } from '../render/colorRestore';
import { planeGeo, translateGeo } from '../render/geometry';
import { linearColor, mesh as makeMesh, stage } from '../render/scene3d';
import { place } from './place';

const GRASS = 'lwGrass';

/**
 * Grass and flowers as camera-facing cards with a brush-stroke alpha made in
 * the shader. The cards bend in the wind, and bend harder near the fog.
 *
 * Each card is one thin instance of a single small plane. Where it stands
 * comes from the instance's own transform, which is what the engine already
 * carries; its width, height, kind and phase come from one extra buffer.
 */
Effect.ShadersStore[`${GRASS}VertexShader`] = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  attribute vec4 world0;
  attribute vec4 world1;
  attribute vec4 world2;
  attribute vec4 world3;
  attribute vec4 aParams;
  uniform mat4 view;
  uniform mat4 viewProjection;
  uniform vec3 cameraPosition;
  uniform float uTime;
  uniform vec4 uWind;
  uniform float uFadeStart;
  uniform float uFadeEnd;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vKind;
  varying float vPhase;

  void main() {
    vUv = uv;
    vKind = aParams.z;
    vPhase = aParams.w;
    vec3 aOffset = world3.xyz;

    // Grass far from the camera collapses to nothing. Distant cards are
    // almost invisible anyway, and they are what costs the most to draw.
    float camDist = distance(cameraPosition.xz, aOffset.xz);
    float near = 1.0 - smoothstep(uFadeStart, uFadeEnd, camDist);
    if (near <= 0.001) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    // Camera-facing card.
    vec3 right = normalize(vec3(view[0][0], view[1][0], view[2][0]));
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 local = (right * position.x * aParams.x + up * position.y * aParams.y) * near;

    // Each blade leans a little in its own direction.
    float lean = sin(vPhase * 3.7) * 0.5;
    float bend = uv.y * uv.y;
    local.x += lean * bend * aParams.y;
    // Wind waves travel across the field, so whole bands of grass lean
    // together and the meadow reads as moving rather than twitching.
    float wave = sin(aOffset.x * 0.13 + aOffset.z * 0.08 - uTime * 1.05);
    float wave2 = sin(aOffset.x * 0.29 - aOffset.z * 0.2 - uTime * 0.62);
    float gust = wave * 0.62 + wave2 * 0.38;
    float sway = sin(uTime * 1.35 + vPhase + aOffset.x * 0.35) * 0.09 + gust * 0.2;
    // A soft wind pushes out from the fog while the player feels it.
    vec2 away = aOffset.xz - uWind.xy;
    float d = length(away);
    float push = uWind.z * smoothstep(uWind.w, 0.0, d);
    sway += push * 0.42;
    local.xz += normalize(away + vec2(0.001)) * push * bend * aParams.y * 0.5;
    local.x += sway * bend * aParams.y;

    vec3 world = aOffset + local;
    vWorld = world;
    gl_Position = viewProjection * vec4(world, 1.0);
  }
`;

Effect.ShadersStore[`${GRASS}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vKind;
  varying float vPhase;
  uniform vec3 uGreen;
  uniform vec3 uDeep;
  uniform vec3 uRose;
  uniform vec3 uGold;
  ${COLOR_STATE_GLSL}

  void main() {
    // Procedural brush-stroke alpha. The stroke is widest a third of the
    // way up and closes to a point at the tip, like a painted blade.
    float y = vUv.y;
    float taper = pow(1.0 - y, 0.7) * (0.45 + 0.35 * sin(vPhase));
    float edge = abs(vUv.x - 0.5) * 2.0;
    float blade = smoothstep(taper, taper * 0.35, edge) * smoothstep(1.0, 0.86, y);
    // A flower is a soft round stroke on a thin stem.
    float head = 1.0 - smoothstep(0.2, 0.46, distance(vUv, vec2(0.5, 0.76)));
    float stem = smoothstep(0.22, 0.06, edge) * step(y, 0.76);
    float alpha = mix(blade, max(head, stem), vKind);
    // A little noise so the stroke edge is not perfectly clean.
    alpha *= 0.72 + 0.46 * fract(sin(vPhase + y * 9.0) * 43758.5453);
    if (alpha < 0.5) discard;

    vec3 col = mix(uDeep, uGreen, vUv.y * 0.8 + 0.2);
    vec3 petal = mix(uRose, uGold, fract(vPhase * 0.37));
    col = mix(col, petal * 0.55, vKind * head);
    // Light is baked in, the same way the terrain bakes it into its
    // vertex colours: darker at the root, a soft lift toward the sun.
    col *= 0.4 + vUv.y * 0.44;
    col *= 0.72 + 0.56 * fract(sin(vPhase * 12.9898) * 43758.5453);
    vec3 sunDir = normalize(vec3(0.45, 0.42, -0.79));
    col *= 0.78 + 0.34 * max(dot(normalize(vec3(0.0, 1.0, 0.0)), sunDir), 0.0);

    // Same rule as every other world material: the grey side is held below
    // the restored one in brightness, so the change reads without colour.
    vec3 outCol = mix(lwGrey(col), col, lwColorAmount(vWorld));
    // The same moonlight the world materials get, so the grass does not
    // stay a field of bright scratches after dark.
    if (uNight > 0.001) {
      outCol = mix(outCol, mix(outCol, uNightTint * 2.2, 0.38) * 0.8, uNight);
    }
    gl_FragColor = vec4(outCol, 1.0);
  }
`;

/** How many cards were actually placed, so a tier change can raise it again. */
const maxInstances = new WeakMap<Mesh, number>();

export function buildGrass(count: number): Mesh {
  const rng = makeRng(77001);
  const base = translateGeo(planeGeo(1, 1, 1, 2), 0, 0.5, 0);

  const matrices = new Float32Array(count * 16);
  const params = new Float32Array(count * 4);
  let placed = 0;

  const here = place();
  for (let i = 0; i < count * 6 && placed < count; i++) {
    const z = here.zEnd + rng() * (here.zStart - here.zEnd);
    const half = here.halfWidth(z);
    // Two samples added together bunch the cards toward the middle of the
    // floor, where the player walks. A wide place then reads as a meadow at
    // the player's feet instead of as a lawn seen from far away.
    const across = (rng() + rng() - 1) * 1.15;
    const x = here.centerX(z) + across * half;
    if (Math.abs(x) > here.halfWidthMax - 2) continue;
    if (here.isHole(x, z)) continue;
    // The walked track is bare earth, so no grass grows on it.
    if (here.pathAmount(x, z) > 0.35) continue;
    const y = here.height(x, z);
    const m = placed * 16;
    matrices[m] = 1;
    matrices[m + 5] = 1;
    matrices[m + 10] = 1;
    matrices[m + 12] = x;
    matrices[m + 13] = y;
    matrices[m + 14] = z;
    matrices[m + 15] = 1;
    // width, height, kind (0 grass, 1 flower), phase
    const flower = rng() < 0.13 ? 1 : 0;
    params[placed * 4] = flower ? 0.13 + rng() * 0.08 : 0.08 + rng() * 0.1;
    // A wide spread of heights reads as a real meadow rather than a mown lawn.
    const tall = rng() < 0.22 ? 1.7 : 1;
    params[placed * 4 + 1] = flower ? 0.32 + rng() * 0.22 : (0.34 + rng() * 0.5) * tall;
    params[placed * 4 + 2] = flower;
    params[placed * 4 + 3] = rng() * Math.PI * 2;
    placed++;
  }

  const material = new ShaderMaterial(
    GRASS,
    stage(),
    { vertex: GRASS, fragment: GRASS },
    {
      attributes: ['position', 'uv', 'aParams'],
      uniforms: [
        'view',
        'viewProjection',
        'cameraPosition',
        'uTime',
        'uWind',
        'uFadeStart',
        'uFadeEnd',
        'uGreen',
        'uDeep',
        'uRose',
        'uGold',
        ...COLOR_STATE_UNIFORMS,
      ],
    },
  );
  material.setColor3('uGreen', linearColor(PALETTE.growthGreen));
  material.setColor3('uDeep', linearColor(PALETTE.deepGreen));
  material.setColor3('uRose', linearColor(PALETTE.heartRose));
  material.setColor3('uGold', linearColor(PALETTE.receiveGold));
  /** Fog centre and strength, so grass bends away from the blockage. */
  material.setVector4('uWind', new Vector4(LAYOUT.fog.x, LAYOUT.fog.z, 0, 0));
  material.setFloat('uFadeStart', 48);
  material.setFloat('uFadeEnd', 64);
  material.setFloat('uTime', 0);
  material.backFaceCulling = false;
  material.fogEnabled = false;

  const grass = makeMesh('grass', base);
  grass.material = material;
  // The cards are moved about in the shader, so nothing outside it knows
  // where they end up. They cover the whole place anyway.
  grass.doNotSyncBoundingInfo = true;
  grass.alwaysSelectAsActiveMesh = true;
  grass.isPickable = false;
  grass.thinInstanceSetBuffer('matrix', matrices, 16, true);
  grass.thinInstanceSetBuffer('aParams', params, 4, true);
  grass.thinInstanceCount = placed;
  maxInstances.set(grass, placed);
  return grass;
}

/**
 * Sets how much grass is drawn, without rebuilding anything.
 *
 * The cards were placed in a random order, so drawing the first `count` of
 * them thins the meadow evenly instead of clearing one end of the valley.
 * This is what makes a quality change take effect during play.
 */
export function setGrassDensity(grass: Mesh, count: number, fadeMetres: number): void {
  const max = maxInstances.get(grass) ?? grass.thinInstanceCount;
  grass.thinInstanceCount = Math.max(0, Math.min(max, Math.round(count)));
  const material = grass.material as ShaderMaterial;
  material.setFloat('uFadeStart', fadeMetres);
  material.setFloat('uFadeEnd', fadeMetres * 1.35);
}

/** Drives the sway and the wind that blows out of the fog. */
export function updateGrass(
  grass: Mesh,
  time: number,
  windStrength: number,
  windRadius: number,
  fogX: number,
  fogZ: number,
): void {
  const material = grass.material as ShaderMaterial;
  material.setFloat('uTime', time);
  material.setVector4('uWind', new Vector4(fogX, fogZ, windStrength, windRadius));
  bindColorState(material);
}
