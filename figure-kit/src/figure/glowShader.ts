import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';

/**
 * A soft round spot, painted in the shader (no texture):
 * the blob shadow under the figure, and the warm halo while breathing in.
 */
const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
void main(void) {
  vUV = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uCore;
varying vec2 vUV;
void main(void) {
  float d = length(vUV - 0.5) * 2.0;
  // Soft falloff to the edge. uCore > 0 keeps the middle calmer (halo: the figure stays readable).
  float a = (1.0 - smoothstep(0.0, 1.0, d)) * mix(1.0, smoothstep(0.0, 0.45, d), uCore);
  gl_FragColor = vec4(uColor, a * uAlpha);
}
`;

Effect.ShadersStore['figureGlowVertexShader'] = VERTEX;
Effect.ShadersStore['figureGlowFragmentShader'] = FRAGMENT;

export type GlowMaterial = ShaderMaterial;

export function createGlowMaterial(
  name: string,
  scene: Scene,
  hex: string,
  opts: { alpha: number; additive?: boolean; core?: number },
): GlowMaterial {
  const mat = new ShaderMaterial(
    name,
    scene,
    { vertex: 'figureGlow', fragment: 'figureGlow' },
    {
      attributes: ['position', 'uv'],
      uniforms: ['worldViewProjection', 'uColor', 'uAlpha', 'uCore'],
      needAlphaBlending: true,
    },
  );
  mat.setColor3('uColor', Color3.FromHexString(hex));
  mat.setFloat('uAlpha', opts.alpha);
  mat.setFloat('uCore', opts.core ?? 0);
  mat.alphaMode = opts.additive ? Constants.ALPHA_ADD : Constants.ALPHA_COMBINE;
  mat.disableDepthWrite = true;
  mat.backFaceCulling = false;
  return mat;
}

export function setGlowAlpha(mat: GlowMaterial, alpha: number): void {
  mat.setFloat('uAlpha', alpha);
}
