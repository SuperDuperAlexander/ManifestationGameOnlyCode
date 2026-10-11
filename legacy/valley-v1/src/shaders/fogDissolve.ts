import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Constants } from '@babylonjs/core/Engines/constants';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/instancesVertex';
import { TUNING } from '../config/tuning';
import { WORLD_UNIFORMS } from './paperShader';

/**
 * Fog cloud shader. Soft painted puffs that drift and wobble.
 * Dissolve: a noise pattern eats the puffs from the edges inward as the density falls.
 * Push: the puffs shake and grow darker and denser for a moment.
 */
const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
#include<instancesDeclaration>
uniform mat4 viewProjection;
uniform vec4 uCurve;
uniform vec4 uFog; // x: time, y: wobble, z: surge, w: seed
varying vec2 vUv;
varying vec3 vWorld;
varying float vPhase;
#ifdef INSTANCESCOLOR
varying vec4 vTint;
#endif
void main(void) {
#include<instancesVertex>
  vec4 wp = finalWorld * vec4(position, 1.0);
  vec3 origin = (finalWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float phase = fract(sin(dot(origin.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
  vPhase = phase;
  // Calm drift, plus a quick shake when pushed.
  float t = uFog.x;
  wp.x += sin(t * 0.5 + phase) * 0.12 + sin(t * 17.0 + phase * 3.0) * uFog.y * 0.22;
  wp.y += sin(t * 0.37 + phase * 1.7) * 0.08 + cos(t * 13.0 + phase) * uFog.y * 0.12;
  // Grow a little when surging.
  wp.xyz = origin + (wp.xyz - origin) * (1.0 + uFog.z * 0.18);
  float d = max(wp.z - uCurve.x - uCurve.y, 0.0);
  wp.y -= uCurve.z * d * d;
  vUv = uv;
  vWorld = wp.xyz;
#ifdef INSTANCESCOLOR
  vTint = instanceColor;
#endif
  gl_Position = viewProjection * wp;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec4 uFog;
uniform vec4 uFade; // x: density 0..1+, y: global alpha, z: gold (0..1)
varying vec2 vUv;
varying vec3 vWorld;
varying float vPhase;
#ifdef INSTANCESCOLOR
varying vec4 vTint;
#endif
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main(void) {
  vec4 c = texture2D(uTex, vUv);
#ifdef INSTANCESCOLOR
  c.rgb *= vTint.rgb;
  c.a *= vTint.a;
#endif
  // Pushed: denser and a touch darker, bluish grey.
  c.rgb = mix(c.rgb, c.rgb * vec3(0.78, 0.8, 0.9), uFog.z * 0.8);
  c.a = min(1.0, c.a * (1.0 + uFog.z * 0.6));
  // Dissolve: noise threshold. Lower density = more of the cloud is gone.
  float n = noise(vUv * 5.0 + vPhase) * 0.6 + noise(vUv * 11.0 - vPhase) * 0.4;
  float edge = length(vUv - 0.5) * 1.1;
  float keep = clamp(uFade.x, 0.0, 1.2);
  float cut = n * 0.7 + (1.0 - edge) * 0.3;
  float vis = smoothstep(1.0 - keep - 0.12, 1.0 - keep + 0.12, cut);
  c.a *= vis * uFade.y;
  // Turning into light: warm gold at the dissolving edges.
  float rim = smoothstep(0.0, 0.25, vis) * (1.0 - smoothstep(0.25, 0.9, vis));
  c.rgb = mix(c.rgb, vec3(1.0, 0.86, 0.55), clamp(rim * 0.9 + uFade.z * 0.5, 0.0, 1.0) * (1.0 - smoothstep(0.9, 1.1, keep)));
  gl_FragColor = c;
}
`;

Effect.ShadersStore['fogVertexShader'] = VERTEX;
Effect.ShadersStore['fogFragmentShader'] = FRAGMENT;

export type FogMaterial = ShaderMaterial & {
  fog: { wobble: number; surge: number; density: number; alpha: number; gold: number; seed: number };
};

export function createFogMaterial(name: string, scene: Scene, texture: BaseTexture): FogMaterial {
  const mat = new ShaderMaterial(
    name,
    scene,
    { vertex: 'fog', fragment: 'fog' },
    {
      attributes: ['position', 'uv'],
      uniforms: ['world', 'viewProjection', 'uCurve', 'uFog', 'uFade'],
      samplers: ['uTex'],
      needAlphaBlending: true,
    },
  ) as FogMaterial;
  mat.fog = { wobble: 0, surge: 0, density: 1, alpha: 1, gold: 0, seed: Math.random() * 10 };
  mat.setTexture('uTex', texture);
  mat.backFaceCulling = false;
  mat.disableDepthWrite = true;
  mat.alphaMode = Constants.ALPHA_COMBINE;
  mat.onBindObservable.add(() => {
    const effect = mat.getEffect();
    if (!effect) return;
    const f = mat.fog;
    effect.setFloat4('uCurve', WORLD_UNIFORMS.pivotZ, TUNING.curve.flatDistance, TUNING.curve.strength, 0);
    effect.setFloat4('uFog', WORLD_UNIFORMS.time + f.seed, f.wobble, f.surge, f.seed);
    effect.setFloat4('uFade', f.density, f.alpha, f.gold, 0);
  });
  return mat;
}
