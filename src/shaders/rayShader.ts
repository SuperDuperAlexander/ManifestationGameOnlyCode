import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Constants } from '@babylonjs/core/Engines/constants';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Soft light-ray streaks: unlit, additive. uv.x runs across the streak, uv.y along it
 * (0 = tail, 1 = head). The vertex colour carries tint (rgb) and strength (a).
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
  float x = abs(vUv.x * 2.0 - 1.0);
  float across = pow(1.0 - x, 2.0);
  float core = pow(1.0 - x, 6.0);
  float along = smoothstep(0.0, 0.75, vUv.y) * (1.0 - smoothstep(0.8, 1.0, vUv.y));
  float a = (across * 0.8 + core * 1.0) * along * vCol.a;
  vec3 rgb = mix(vCol.rgb, vec3(1.0, 0.97, 0.88), core * 0.6);
  gl_FragColor = vec4(rgb * a, a);
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
