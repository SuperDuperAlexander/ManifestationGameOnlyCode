import { Constants } from '@babylonjs/core/Engines/constants';
import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import type { Material } from '@babylonjs/core/Materials/material';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import {
  COLOR_STATE_GLSL,
  COLOR_STATE_UNIFORMS,
  bindColorState,
  colorState,
} from '../render/colorRestore';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';
import { FRONT_FACE, linearColor, stage } from '../render/scene3d';

const WATER = 'lwWater';

/**
 * Standing water: a spring basin, the pool in the light well.
 *
 * Two things make water read as water and neither of them is a picture of
 * water. The first is that it moves: a slow crossing of two noise fields,
 * which bends the surface just enough to break the reflection up. The second
 * is that it reflects the sky, and reflects more of it the flatter you look
 * across it.
 *
 * The sky it reflects is the cube the world is already lit from. Rendering
 * the scene again for each pool would cost more than everything else in the
 * basin put together, and over a basin a metre across the sky is very nearly
 * all there is to see anyway.
 */
Effect.ShadersStore[`${WATER}VertexShader`] = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec3 normal;
  uniform mat4 world;
  uniform mat4 viewProjection;
  uniform mat4 view;
  uniform vec3 cameraPosition;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vDepth;
  void main() {
    vec4 w = world * vec4(position, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(world[0].xyz, world[1].xyz, world[2].xyz) * normal);
    vDepth = -(view * w).z;
    gl_Position = viewProjection * w;
  }
`;

Effect.ShadersStore[`${WATER}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vDepth;
  uniform vec3 cameraPosition;
  uniform samplerCube uSky;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform float uTime;
  uniform float uRipple;
  uniform vec3 uHazeColor;
  uniform vec2 uHaze;
  ${COLOR_STATE_GLSL}

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    // Two noise fields crossing at different speeds. Their slope is the
    // ripple: no texture, no normal map, and it never repeats visibly.
    vec2 a = vWorld.xz * 2.7 + vec2(uTime * 0.09, uTime * 0.06);
    vec2 b = vWorld.xz * 4.3 - vec2(uTime * 0.05, uTime * 0.11);
    float e = 0.06;
    float hx = (noise(a + vec2(e, 0.0)) - noise(a - vec2(e, 0.0)))
             + (noise(b + vec2(e, 0.0)) - noise(b - vec2(e, 0.0))) * 0.6;
    float hz = (noise(a + vec2(0.0, e)) - noise(a - vec2(0.0, e)))
             + (noise(b + vec2(0.0, e)) - noise(b - vec2(0.0, e))) * 0.6;
    vec3 n = normalize(vN + vec3(-hx, 0.0, -hz) * uRipple);

    vec3 toEye = normalize(cameraPosition - vWorld);
    // Flat on, you see the bottom. Across the surface, you see the sky.
    float fresnel = pow(1.0 - clamp(dot(n, toEye), 0.0, 1.0), 3.0);
    fresnel = 0.03 + fresnel * 0.9;

    vec3 sky = textureCube(uSky, reflect(-toEye, n)).rgb;
    // The water's own colour under the reflection: paler at the rim where it
    // is shallow, deeper toward the middle.
    vec3 body = mix(uShallow, uDeep, clamp(0.5 + n.y * 0.3, 0.0, 1.0));
    vec3 col = mix(body, sky, fresnel);
    // A soft bright line where the surface catches the sun straight on.
    col += vec3(1.0) * pow(max(dot(reflect(-toEye, n), normalize(vec3(0.45, 0.42, -0.79))), 0.0), 60.0) * 0.5;

    // The same grey-to-colour rule as every other surface in the world.
    col = mix(lwGrey(col), col, lwColorAmount(vWorld));
    if (uNight > 0.001) {
      col = mix(col, mix(col, uNightTint * 2.2, 0.38) * 0.92, uNight);
    }
    // And the same distance haze.
    col = mix(col, uHazeColor, smoothstep(uHaze.x, uHaze.y, vDepth));
    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * A water surface. `sky` is the cube the world is lit from, so the pool
 * reflects the same sky the player is standing under.
 */
export function waterMaterial(sky: BaseTexture, shallow: number, deep: number): ShaderMaterial {
  const material = new ShaderMaterial(
    WATER,
    stage(),
    { vertex: WATER, fragment: WATER },
    {
      attributes: ['position', 'normal'],
      uniforms: [
        'world',
        'view',
        'viewProjection',
        'cameraPosition',
        'uShallow',
        'uDeep',
        'uTime',
        'uRipple',
        'uHazeColor',
        'uHaze',
        ...COLOR_STATE_UNIFORMS,
      ],
      samplers: ['uSky'],
    },
  );
  material.setTexture('uSky', sky);
  material.setColor3('uShallow', linearColor(shallow));
  material.setColor3('uDeep', linearColor(deep));
  material.setFloat('uTime', 0);
  material.setFloat('uRipple', 0.55);
  material.sideOrientation = FRONT_FACE;
  material.backFaceCulling = false;
  material.fogEnabled = false;
  material.alphaMode = Constants.ALPHA_DISABLE;
  return material;
}

/** Every water surface in the world, so one call can drive them all. */
const surfaces: Mesh[] = [];
const haze = new Vector2();

/**
 * Registers a mesh as water. The world updates them together.
 *
 * It takes any material, because a device without a sky cube gets a plain
 * wet stone instead and that one has nothing to update.
 */
export function addWater(mesh: Mesh, material: Material): void {
  mesh.material = material;
  mesh.receiveShadows = false;
  if (!surfaces.includes(mesh)) surfaces.push(mesh);
}

/** Moves the ripples on and keeps the water in step with the valley's colour. */
export function updateWater(time: number, hazeStart: number, hazeEnd: number): void {
  for (const mesh of surfaces) {
    const material = mesh.material;
    if (!(material instanceof ShaderMaterial)) continue;
    material.setFloat('uTime', time);
    material.setVector2('uHaze', haze.set(hazeStart, hazeEnd));
    material.setColor3('uHazeColor', colorState.hazeColor);
    bindColorState(material);
  }
}

/** Forgets the water of a world that has been torn down. */
export function clearWater(): void {
  surfaces.length = 0;
}
