import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Constants } from '@babylonjs/core/Engines/constants';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Soft round light motes: unlit, additive, feathered edge. The vertex colour carries tint (rgb) and strength (a).
 */
const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
attribute vec4 color;
uniform mat4 viewProjection;
varying vec2 vUv;
varying vec4 vCol;
void main(void) {
  vUv = uv;
  vCol = color;
  gl_Position = viewProjection * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec4 vCol;
void main(void) {
  vec2 d = vUv * 2.0 - 1.0;
  float r = length(d);
  float soft = 1.0 - smoothstep(0.0, 1.0, r);
  float a = soft * soft * vCol.a;
  gl_FragColor = vec4(vCol.rgb * a, a);
}
`;

Effect.ShadersStore['rayVertexShader'] = VERTEX;
Effect.ShadersStore['rayFragmentShader'] = FRAGMENT;

export function createRayMaterial(scene: Scene): ShaderMaterial {
  const mat = new ShaderMaterial('breath.rayMat', scene, { vertex: 'ray', fragment: 'ray' }, {
    attributes: ['position', 'uv', 'color'],
    uniforms: ['viewProjection'],
    needAlphaBlending: true,
  });
  mat.backFaceCulling = false;
  mat.alphaMode = Constants.ALPHA_ONEONE;
  mat.disableDepthWrite = true;
  return mat;
}
