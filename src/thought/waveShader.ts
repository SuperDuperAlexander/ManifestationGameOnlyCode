import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Constants } from '@babylonjs/core/Engines/constants';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE } from '../config/palette';

/** Per-wave look values, read by the shared material when each wave mesh is drawn. */
export interface WaveLook {
  alpha: number;
  /** 0..1: the ribbon opens in the middle (a passing wave). */
  split: number;
  /** 0..1: hot flash (a pushed wave). */
  flash: number;
  /** 0..1: how readable the text is. */
  textAlpha: number;
}

const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
uniform float time;
uniform vec4 uState; // x alpha, y split, z flash, w textAlpha
varying vec2 vUv;
void main(void) {
  vec3 p = position;
  float ax = abs(p.x) * 2.0;
  p.x += sign(p.x) * uState.y * (0.1 + 0.4 * ax);
  p.z += 0.14 * ax * ax;
  p.y += sin(time * 2.0 + p.x * 9.0 + p.y * 5.0) * 0.014 * (1.0 + uState.z * 2.0);
  p.x += sin(time * 1.7 + p.y * 8.0) * 0.01;
  vUv = uv;
  gl_Position = worldViewProjection * vec4(p, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float time;
uniform vec4 uState;
uniform vec3 uCol1;
uniform vec3 uCol2;
uniform vec3 uGold;
uniform sampler2D uTex;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main(void) {
  vec2 q = vUv - 0.5;
  float edge = 1.0 - smoothstep(0.22, 0.5, length(vec2(q.x, q.y * 1.7)));
  float n = noise(vec2(vUv.x * 6.0 - time * 0.8, vUv.y * 4.0 + time * 1.3)) * 0.6
          + noise(vUv * 14.0 + vec2(-time * 0.6, time * 1.8)) * 0.4;
  // Rising heat streaks: the shimmer.
  float streak = 0.5 + 0.5 * sin(vUv.x * 24.0 + n * 6.0 - time * 2.4);
  float body = edge * (0.3 + 0.45 * n) * (0.65 + 0.35 * streak);
  vec3 col = mix(uCol1, uCol2, n);
  col = mix(col, uGold, uState.z * 0.8);
  // Text, wobbling a little in the heat.
  vec4 t = texture2D(uTex, vUv + vec2(sin(time * 1.6 + vUv.y * 11.0) * 0.004, sin(time * 1.3 + vUv.x * 7.0) * 0.003));
  float ta = t.a * uState.w;
  float a = body * 1.3 + uState.z * edge * 0.6;
  float ax = abs(vUv.x - 0.5) * 2.0;
  float gap = uState.y * 0.6;
  float keep = 1.0 - uState.y * (1.0 - smoothstep(gap, gap + 0.35, ax));
  a *= keep;
  ta *= keep;
  vec3 rgb = mix(col, t.rgb, clamp(ta, 0.0, 1.0));
  a = max(a, ta) * uState.x;
  if (a < 0.003) discard;
  gl_FragColor = vec4(rgb, a);
}
`;

let registered = false;

/**
 * One material for all waves of a scene. Per-wave values come from `lookOf(mesh)` when a mesh is bound.
 * Soft red-orange heat shimmer with a text texture inside. No fog, no lights.
 */
export function createWaveMaterial(
  scene: Scene,
  texture: Texture,
  lookOf: (mesh: AbstractMesh) => WaveLook | undefined,
  clock: { time: number },
): ShaderMaterial {
  if (!registered) {
    Effect.ShadersStore['lwWaveVertexShader'] = VERTEX;
    Effect.ShadersStore['lwWaveFragmentShader'] = FRAGMENT;
    registered = true;
  }
  const mat = new ShaderMaterial('wave.mat', scene, 'lwWave', {
    attributes: ['position', 'uv'],
    uniforms: ['worldViewProjection', 'time', 'uState', 'uCol1', 'uCol2', 'uGold'],
    samplers: ['uTex'],
    needAlphaBlending: true,
  });
  mat.setTexture('uTex', texture);
  mat.backFaceCulling = false;
  mat.disableDepthWrite = true;
  mat.alphaMode = Constants.ALPHA_COMBINE;
  const c1 = Color3.FromHexString(PALETTE.cloak);
  const c2 = Color3.FromHexString(PALETTE.sandstone).scale(1.05);
  const gold = Color3.FromHexString(PALETTE.gold);
  mat.onBindObservable.add((mesh) => {
    const fx = mat.getEffect();
    const look = lookOf(mesh);
    if (!fx || !look) return;
    fx.setFloat('time', clock.time);
    fx.setFloat4('uState', look.alpha, look.split, look.flash, look.textAlpha);
    fx.setColor3('uCol1', c1);
    fx.setColor3('uCol2', c2);
    fx.setColor3('uGold', gold);
  });
  return mat;
}
