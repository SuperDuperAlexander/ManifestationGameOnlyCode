import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Shaders/ShadersInclude/instancesDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/instancesVertex';
import { TUNING } from '../config/tuning';
import { PALETTE, color4 } from '../config/palette';

/**
 * The one shared, unlit "paper" shader. Light and shade are painted into the textures,
 * so the shader only samples, tints and hazes. It also bends the world down beyond a
 * flat zone in front of the camera (see TUNING.curve), which makes the horizon visible.
 *
 * Every world material uses it, so the bend is the same for all of them.
 */

/** Values shared by all paper materials. Updated once per frame by the game. */
export const WORLD_UNIFORMS = {
  /** Z of the camera's look-at point. The flat zone starts here. */
  pivotZ: 0,
  time: 0,
  /** Player position and light radius, for hidden paths that only show in the light. */
  revealX: 0,
  revealZ: 0,
  revealRadius: 0,
  hazeColor: color4(PALETTE.ivory),
};

/** Metres the world drops at a world z. Same formula as the vertex shader. */
export function curveDrop(z: number): number {
  const d = Math.max(z - WORLD_UNIFORMS.pivotZ - TUNING.curve.flatDistance, 0);
  return TUNING.curve.strength * d * d;
}

const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
#include<instancesDeclaration>
uniform mat4 viewProjection;
uniform vec4 uCurve;
uniform vec4 uHazeCfg;
uniform vec4 uUv;
varying vec2 vUv;
varying vec2 vLocal;
varying vec3 vWorld;
varying float vHaze;
#ifdef INSTANCESCOLOR
varying vec4 vTint;
#endif
void main(void) {
#include<instancesVertex>
  vec4 wp = finalWorld * vec4(position, 1.0);
  float dz = wp.z - uCurve.x - uCurve.y;
  float d = max(dz, 0.0);
  wp.y -= uCurve.z * d * d;
  vHaze = uHazeCfg.x * smoothstep(uHazeCfg.y, uHazeCfg.z, dz);
#ifdef WORLDUV
  vUv = wp.xz * uUv.xy + uUv.zw;
#else
  vUv = uv * uUv.xy + uUv.zw;
#endif
  vLocal = uv;
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
uniform vec4 uColor;
uniform vec4 uHazeColor;
uniform vec4 uEdge;
uniform vec4 uReveal;
uniform vec4 uUv;
uniform float uAlphaCut;
uniform float uTime;
uniform vec4 uLayer;
varying vec2 vUv;
varying vec2 vLocal;
varying vec3 vWorld;
varying float vHaze;
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
#ifdef NOTEX
  vec4 c = vec4(1.0);
#elif defined(WATER)
  vec4 a = texture2D(uTex, vUv);
  vec4 b = texture2D(uTex, vUv * 0.83 + vec2(0.37, 0.11) - uUv.zw * 1.6);
  vec4 c = mix(a, b, 0.5);
  c.rgb += 0.05 * sin(uTime * 1.3 + vWorld.x * 0.7 + vWorld.z * 0.5);
#else
  vec4 c = texture2D(uTex, vUv);
#endif
  c *= uColor;
#ifdef INSTANCESCOLOR
  c.rgb *= vTint.rgb;
  c.a *= vTint.a;
#endif
  float n = noise(vWorld.xz * 0.9) - 0.5;
#ifdef SOFTEDGE
  // Ribbon: vLocal.x runs across (0..1), vLocal.y along, in metres.
  float across = min(vLocal.x, 1.0 - vLocal.x) + n * uEdge.x * 0.6;
  float ends = min(vLocal.y, uEdge.z - vLocal.y) + n * uEdge.y * 0.6;
  c.a *= smoothstep(0.0, uEdge.x, across) * smoothstep(0.0, uEdge.y, ends);
#endif
#ifdef RADIAL
  float r = length(vLocal - 0.5) * 2.0 + n * uEdge.x * 0.8;
  c.a *= 1.0 - smoothstep(1.0 - uEdge.x, 1.0, r);
#endif
#ifdef REVEAL
  float dist = length(vWorld.xz - uReveal.xy);
  c.a *= 1.0 - smoothstep(uReveal.z * 0.55, uReveal.z, dist);
#endif
#ifdef ALPHATEST
  if (c.a < uAlphaCut) discard;
  c.a = 1.0;
#endif
  c.rgb = mix(c.rgb, uHazeColor.rgb, vHaze);
#ifdef LAYERHAZE
  // Far layers: lower contrast and blend toward the pale sky colour.
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  c.rgb = mix(c.rgb, vec3(lum), uLayer.x * 0.35);
  c.rgb = mix(c.rgb, uLayer.yzw, uLayer.x);
#endif
  gl_FragColor = c;
}
`;

Effect.ShadersStore['paperVertexShader'] = VERTEX;
Effect.ShadersStore['paperFragmentShader'] = FRAGMENT;

export interface PaperMaterialOptions {
  texture?: BaseTexture | null;
  /** Colour multiplier. Alpha multiplies too. */
  color?: Color4;
  /** Hard cut-out edges (paper cards). Writes depth, needs no sorting. */
  alphaTest?: boolean;
  /** Soft transparency. Drawn after opaque things. */
  alphaBlend?: boolean;
  /** Add light instead of covering. For glows and halos. */
  additive?: boolean;
  /** Texture repeats every N metres in world space (ground). */
  worldTile?: number;
  /** Soft painted edges for a ribbon mesh: across (uv units), ends (metres), length (metres). */
  ribbonEdge?: { across: number; ends: number; length: number };
  /** Soft round edge for a disc mesh (share of the radius). */
  radialEdge?: number;
  water?: boolean;
  /** Only visible inside the player's light radius. */
  reveal?: boolean;
  /** Backdrop layers: haze toward a colour (set with setPaperLayerHaze). */
  layerHaze?: boolean;
  /** Set false for things in the sky or backdrop. */
  haze?: boolean;
  /** Set false for things that must not bend (none in the world). */
  curve?: boolean;
  depthWrite?: boolean;
  backFaceCulling?: boolean;
}

export type PaperMaterial = ShaderMaterial & { paper: PaperMaterialOptions };

export function createPaperMaterial(name: string, scene: Scene, opts: PaperMaterialOptions): PaperMaterial {
  const defines: string[] = [];
  if (!opts.texture) defines.push('NOTEX');
  if (opts.worldTile) defines.push('WORLDUV');
  if (opts.ribbonEdge) defines.push('SOFTEDGE');
  if (opts.radialEdge !== undefined) defines.push('RADIAL');
  if (opts.water) defines.push('WATER');
  if (opts.reveal) defines.push('REVEAL');
  if (opts.layerHaze) defines.push('LAYERHAZE');

  const blend = !!(opts.alphaBlend || opts.additive);
  const mat = new ShaderMaterial(
    name,
    scene,
    { vertex: 'paper', fragment: 'paper' },
    {
      attributes: ['position', 'uv'],
      uniforms: [
        'world',
        'viewProjection',
        'uCurve',
        'uHazeCfg',
        'uUv',
        'uColor',
        'uHazeColor',
        'uEdge',
        'uReveal',
        'uAlphaCut',
        'uTime',
        'uLayer',
      ],
      samplers: ['uTex'],
      defines,
      needAlphaTesting: !!opts.alphaTest,
      needAlphaBlending: blend,
    },
  ) as PaperMaterial;
  mat.paper = opts;
  mat.backFaceCulling = opts.backFaceCulling ?? false;
  if (opts.additive) mat.alphaMode = Constants.ALPHA_ADD;
  else if (blend) mat.alphaMode = Constants.ALPHA_COMBINE;
  if (opts.depthWrite !== undefined) mat.disableDepthWrite = !opts.depthWrite;
  else if (blend) mat.disableDepthWrite = true;

  if (opts.texture) mat.setTexture('uTex', opts.texture);
  mat.setColor4('uColor', opts.color ?? new Color4(1, 1, 1, 1));
  mat.setFloat('uAlphaCut', TUNING.cards.alphaCutoff);
  const tile = opts.worldTile ? 1 / opts.worldTile : 1;
  mat.setArray4('uUv', [tile, tile, 0, 0]);
  const edge = opts.ribbonEdge
    ? [opts.ribbonEdge.across, opts.ribbonEdge.ends, opts.ribbonEdge.length, 0]
    : [opts.radialEdge ?? 0.2, 0, 0, 0];
  mat.setArray4('uEdge', edge);

  const useCurve = opts.curve ?? true;
  const useHaze = opts.haze ?? true;
  mat.onBindObservable.add(() => {
    const effect = mat.getEffect();
    if (!effect) return;
    const u = WORLD_UNIFORMS;
    effect.setFloat4('uCurve', u.pivotZ, TUNING.curve.flatDistance, useCurve ? TUNING.curve.strength : 0, 0);
    effect.setFloat4('uHazeCfg', useHaze ? TUNING.curve.hazeAmount : 0, TUNING.curve.hazeStart, TUNING.curve.hazeEnd, 0);
    effect.setDirectColor4('uHazeColor', u.hazeColor);
    effect.setFloat4('uReveal', u.revealX, u.revealZ, u.revealRadius, 0);
    effect.setFloat('uTime', u.time);
  });
  return mat;
}

/** Sets the texture offset (for flowing water) and the repeat. */
export function setPaperUv(mat: PaperMaterial, scaleX: number, scaleY: number, offsetX: number, offsetY: number): void {
  mat.setArray4('uUv', [scaleX, scaleY, offsetX, offsetY]);
}

/** Backdrop haze: amount 0..1 toward a colour. */
export function setPaperLayerHaze(mat: PaperMaterial, amount: number, r: number, g: number, b: number): void {
  mat.setArray4('uLayer', [amount, r, g, b]);
}

/** Sets the colour multiplier (alpha included). */
export function setPaperColor(mat: PaperMaterial, color: Color4): void {
  mat.setColor4('uColor', color);
}
