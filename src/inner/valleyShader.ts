import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/instancesVertex';
import { TUNING } from '../config/tuning';
import { SHADES } from '../config/palette';

/**
 * The one shared shader of the valley. Real 3D, but it looks painted:
 * - Colours come from the vertices (no textures), in the palette.
 * - Soft toon light from the right: warm on the lit side, cool lavender in the shade, never dark.
 *   Plants get a crisper edge between light and shade, like the painted trees.
 * - The meadow gets soft painted patches and tiny strokes.
 * - Distance haze toward the sky's horizon colour gives the layered paper depth.
 * - Plants sway in the wind (vertex colour alpha = how much a point may move).
 * - "Mood": the whole world can grow darker and greyer (force) or brighter and warmer (light).
 */

/** Values shared by all valley materials. Updated once per frame. */
export const VALLEY_UNIFORMS = {
  time: 0,
  camPos: new Vector3(),
  fogColor: Color3.FromHexString(SHADES.innerHaze),
  /** -1 = dark and grey, 0 = normal, +1 = bright and golden. */
  mood: 0,
  /** 0..1 from the breath: lifts glow strength by up to 20%. */
  glow: 0,
};

const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
#ifdef VERTEXCOLOR
attribute vec4 color;
#endif
#include<instancesDeclaration>
uniform mat4 viewProjection;
uniform vec3 uCamPos;
uniform vec4 uWind;   // x: time, y: strength
uniform vec4 uFogCfg; // x: start, y: end, z: max amount
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vFog;
varying float vMask;
varying float vPhase;
void main(void) {
#include<instancesVertex>
  vec4 wp = finalWorld * vec4(position, 1.0);
#ifdef VERTEXCOLOR
  vColor = color.rgb;
  float sway = color.a;
#else
  vColor = vec3(1.0);
  float sway = 0.0;
#endif
  vMask = sway;
  vPhase = finalWorld[3].x * 0.9 + finalWorld[3].z * 1.3;
#ifdef INSTANCESCOLOR
  vColor *= instanceColor.rgb;
#endif
#ifdef WIND
  vec3 base = finalWorld[3].xyz;
  float ph = uWind.x * 1.3 + base.x * 0.31 + base.z * 0.23;
  float gust = 0.65 + 0.35 * sin(uWind.x * 0.37 + base.x * 0.05);
  wp.x += sin(ph) * uWind.y * sway * gust;
  wp.z += cos(ph * 0.83) * uWind.y * 0.6 * sway * gust;
#endif
  vNormal = normalize(mat3(finalWorld) * normal);
  vWorld = wp.xyz;
  float d = distance(wp.xyz, uCamPos);
  vFog = uFogCfg.z * smoothstep(uFogCfg.x, uFogCfg.y, d);
  gl_Position = viewProjection * wp;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uLightDir;
uniform vec3 uFogColor;
uniform vec4 uWind;
uniform vec4 uMood;  // x: mood -1..1
uniform vec3 uCamPos;
uniform vec3 uTint;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vFog;
varying float vMask;
varying float vPhase;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main(void) {
#ifdef WIND
  // Plants right in front of the camera fade out (dithered), so they never block the view.
  float dc = distance(vWorld, uCamPos);
#ifdef PAINTED
  if (dc < 3.2) discard;
#else
  if (dc < 2.6 && hash(gl_FragCoord.xy) > smoothstep(2.1, 2.6, dc)) discard;
#endif
#endif
  vec3 base = vColor * uTint;
#if defined(WIND) && !defined(PAINTED)
  base *= 0.8 + 0.4 * fract(sin(vPhase * 12.9898) * 43758.5453);
#endif
#ifdef GROUND
  // Painted meadow: soft scalloped patches of two greens and fine grass strokes.
  float p = noise(vWorld.xz * 0.32) * 0.6 + noise(vWorld.xz * 0.85 + 7.0) * 0.4;
  float patchy = smoothstep(0.47, 0.55, p);
  float strokes = smoothstep(0.62, 0.8, noise(vWorld.xz * vec2(7.0, 2.4) + vec2(p * 3.0, 0.0)));
  base *= mix(1.0, mix(0.92, 1.06, patchy) * (0.98 + strokes * 0.05), vMask);
#endif
  // Slow pulse with a phase per instance, and a cyan / violet / pink tint.
  float pu = 0.5 + 0.5 * sin(uWind.x * 1.3 + vPhase + vWorld.y * 0.4);
  vec3 gtint = mix(vec3(0.45, 0.85, 1.0), vec3(1.0, 0.6, 0.9), 0.5 + 0.5 * sin(vPhase * 2.0));
  vec3 c;
#ifdef UNLIT
  c = base;
#ifdef GLOW
  c = base * (0.9 + 0.25 * pu) * (1.0 + 0.2 * uMood.y);
#ifdef GLOWTINT
  c += gtint * (0.04 + 0.1 * pu);
#endif
#endif
#elif defined(WATER)
  // River: pale sky blue with slow drifting glints.
  float t = uWind.x;
  vec2 flow = vWorld.xz * 0.8 + vec2(t * 0.35, t * 0.12);
  float w = noise(flow) * noise(vWorld.xz * 1.6 - vec2(t * 0.2, 0.0));
  // Inner pond: a glowing cyan-blue with pale sparkles.
  c = mix(vec3(0.28, 0.82, 0.94), vec3(0.50, 0.94, 1.0), noise(vWorld.xz * 0.3 + t * 0.05));
  c += vec3(0.85, 0.95, 1.0) * smoothstep(0.4, 0.6, w) * 0.55;
  float fres = pow(1.0 - clamp(normalize(uCamPos - vWorld).y, 0.0, 1.0), 2.0);
  c = mix(c, vec3(0.80, 0.78, 1.0), fres * 0.45);
#elif defined(FALLS)
  // Waterfall: bright streaks running down.
  float t = uWind.x;
  float s = noise(vec2((vWorld.x + vWorld.z) * 2.6, vWorld.y * 0.7 + t * 3.2));
  c = mix(vec3(0.52, 0.80, 0.94), vec3(0.93, 0.96, 1.0), smoothstep(0.35, 0.75, s));
  c += vec3(0.10, 0.08, 0.16) * (0.5 + 0.5 * sin(t * 2.0 + vWorld.y * 3.0));
#else
  vec3 n = normalize(vNormal);
  float ndl = dot(n, uLightDir);
#ifdef PAINTED
  // Painted foliage: a clear lit side and a cool shaded side, and a warm highlight on top.
  float lit = smoothstep(-0.08, 0.22, ndl);
  c = mix(base * vec3(0.78, 0.74, 1.0), base * vec3(1.08, 1.02, 1.0), lit);
  // Lighter rim from the right.
  c = mix(c, c * vec3(1.08, 1.04, 1.04) + vec3(0.07, 0.06, 0.10), smoothstep(0.45, 0.85, ndl) * 0.8);
#else
  float lit = smoothstep(-0.3, 0.5, ndl);
  // Shade: deep lavender. Lit: warm pink-peach, not orange.
  c = mix(base * vec3(0.74, 0.68, 0.96), base * vec3(1.10, 1.0, 0.98), lit);
  c += vec3(0.09, 0.05, 0.05) * smoothstep(0.55, 0.95, ndl);
  c += vec3(0.05, 0.03, 0.07);
#endif
  c += vec3(0.04, 0.035, 0.07) * clamp(n.y, 0.0, 1.0);
#ifdef PAINTED
  // Soft glowing spots on the shaded undersides of crowns and bushes.
  vec3 sp = vWorld * 2.4;
  vec3 cell = floor(sp);
  float hh = hash(cell.xz + cell.y * 17.0);
  float dd = length(fract(sp) - 0.5);
  float spot = step(0.78, hh) * smoothstep(0.3, 0.08, dd) * smoothstep(0.5, -0.1, ndl);
  c += gtint * spot * (0.6 + 0.8 * pu) * 1.5 * (1.0 + 0.2 * uMood.y);
#endif
#ifdef TIPS
  c += gtint * smoothstep(0.55, 1.0, vMask) * (0.4 + 0.5 * pu) * (1.0 + 0.2 * uMood.y);
#endif
  c *= 0.9;
#endif
  // Soft paper grain: a gentle mottling, no hard pixels.
  float g = noise(vWorld.xz * 2.3 + vWorld.y * 1.7) * 0.6 + noise(vWorld.xz * 6.1 - vWorld.y * 3.3) * 0.4;
  c *= 0.975 + g * 0.05;

  // Mood: force makes the world dark and grey; light makes it warm and bright.
  float m = uMood.x;
  float lum = dot(c, vec3(0.3, 0.59, 0.11));
  vec3 dark = mix(c, vec3(lum), 0.65) * vec3(0.5, 0.52, 0.64);
  vec3 bright = mix(vec3(lum), c, 1.15) * 1.06 + vec3(0.05, 0.035, 0.0);
  c = m < 0.0 ? mix(c, dark, -m) : mix(c, bright, m);

  float mist = 0.16 * smoothstep(5.0, -1.0, vWorld.y) * smoothstep(6.0, 30.0, distance(vWorld, uCamPos));
  c = mix(c, uFogColor, max(vFog, mist));
  gl_FragColor = vec4(c, 1.0);
}
`;

Effect.ShadersStore['valleyVertexShader'] = VERTEX;
Effect.ShadersStore['valleyFragmentShader'] = FRAGMENT;

export interface ValleyMaterialOptions {
  /** Plants: sway in the wind. */
  wind?: boolean;
  /** Plants: crisp painted light. */
  painted?: boolean;
  /** Terrain: painted meadow patches (vertex alpha = how much grass). */
  ground?: boolean;
  /** No light, colour as painted (far mountains, runes, light planks). */
  unlit?: boolean;
  /** Bioluminescent: self-lit with a slow pulse. */
  glow?: boolean;
  /** With glow: cyan / violet / pink tint per instance. */
  glowTint?: boolean;
  /** Grass tips glow. */
  tips?: boolean;
  water?: boolean;
  falls?: boolean;
  /** Multiplies the haze. 0 = none (the far mountains carry their own haze colours). */
  fog?: number;
  /** Multiplies the mood. 0 = not touched by it (light things stay bright). */
  mood?: number;
  /** Multiplies the painted colours (inner tree trunk). */
  tint?: [number, number, number];
  backFaceCulling?: boolean;
}

export function createValleyMaterial(name: string, scene: Scene, opts: ValleyMaterialOptions = {}): ShaderMaterial {
  const defines: string[] = [];
  if (opts.wind) defines.push('WIND');
  if (opts.painted) defines.push('PAINTED');
  if (opts.ground) defines.push('GROUND');
  if (opts.unlit) defines.push('UNLIT');
  if (opts.water) defines.push('WATER');
  if (opts.falls) defines.push('FALLS');
  if (opts.glow) defines.push('GLOW');
  if (opts.glowTint) defines.push('GLOWTINT');
  if (opts.tips) defines.push('TIPS');
  const mat = new ShaderMaterial(
    name,
    scene,
    { vertex: 'valley', fragment: 'valley' },
    {
      attributes: ['position', 'normal'],
      uniforms: ['world', 'viewProjection', 'uCamPos', 'uWind', 'uFogCfg', 'uLightDir', 'uFogColor', 'uMood', 'uTint'],
      defines,
    },
  );
  mat.backFaceCulling = opts.backFaceCulling ?? true;
  const v = TUNING.valley;
  const light = Vector3.FromArray(v.lightDir as unknown as number[]).normalize();
  const fog = (opts.fog ?? 1) * v.fogMax;
  const moodScale = opts.mood ?? 1;
  const tint = opts.tint ?? [1, 1, 1];
  mat.onBindObservable.add(() => {
    const effect = mat.getEffect();
    if (!effect) return;
    const u = VALLEY_UNIFORMS;
    effect.setVector3('uCamPos', u.camPos);
    effect.setFloat4('uWind', u.time, v.windStrength, 0, 0);
    effect.setFloat4('uFogCfg', v.fogStart, v.fogEnd, fog, 0);
    effect.setVector3('uLightDir', light);
    effect.setFloat3('uTint', tint[0], tint[1], tint[2]);
    effect.setColor3('uFogColor', u.fogColor);
    effect.setFloat4('uMood', u.mood * moodScale, u.glow, 0, 0);
  });
  return mat;
}
