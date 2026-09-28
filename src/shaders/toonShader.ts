import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import type { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { WORLD_UNIFORMS } from './paperShader';

/**
 * Flat, soft toon shading for the code-made 3D figures (player).
 * One fixed light from the upper right, like the painted art. No real lights.
 * A glow value mixes the colour toward warm light (used while inhaling).
 */
const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 world;
uniform mat4 viewProjection;
uniform vec4 uCurve;
varying vec3 vNormal;
#ifdef VERTEXCOLOR
attribute vec4 color;
varying vec3 vColor;
#endif
void main(void) {
#ifdef VERTEXCOLOR
  vColor = color.rgb;
#endif
  vec4 wp = world * vec4(position, 1.0);
  float d = max(wp.z - uCurve.x - uCurve.y, 0.0);
  wp.y -= uCurve.z * d * d;
  vNormal = normalize(mat3(world) * normal);
  gl_Position = viewProjection * wp;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform vec3 uShadow;
uniform float uGlow;
varying vec3 vNormal;
#ifdef VERTEXCOLOR
varying vec3 vColor;
#endif
void main(void) {
  vec3 L = normalize(vec3(0.75, 0.9, -0.35));
  float ndl = dot(normalize(vNormal), L);
  // Two soft bands: paper-like, no hard terminator.
  float lit = smoothstep(-0.35, 0.45, ndl);
#ifdef VERTEXCOLOR
  // Vertex colour is the lit colour; uColor and uShadow scale it for each side.
  vec3 c = mix(vColor * uShadow, vColor * uColor, lit);
#else
  vec3 c = mix(uShadow, uColor, lit);
#endif
  // Gentle warm rim on the right edge.
  c += vec3(0.06, 0.04, 0.0) * smoothstep(0.5, 1.0, ndl);
  c = mix(c, vec3(1.0, 0.93, 0.74), uGlow * 0.55);
  gl_FragColor = vec4(c, 1.0);
}
`;

Effect.ShadersStore['toonVertexShader'] = VERTEX;
Effect.ShadersStore['toonFragmentShader'] = FRAGMENT;

export type ToonMaterial = ShaderMaterial & { glow: number };

export function createToonMaterial(name: string, scene: Scene, color: Color3, shadow: Color3): ToonMaterial {
  const mat = new ShaderMaterial(
    name,
    scene,
    { vertex: 'toon', fragment: 'toon' },
    {
      attributes: ['position', 'normal'],
      uniforms: ['world', 'viewProjection', 'uCurve', 'uColor', 'uShadow', 'uGlow'],
    },
  ) as ToonMaterial;
  mat.glow = 0;
  mat.setColor3('uColor', color);
  mat.setColor3('uShadow', shadow);
  mat.backFaceCulling = true;
  mat.onBindObservable.add(() => {
    const effect = mat.getEffect();
    if (!effect) return;
    effect.setFloat4('uCurve', WORLD_UNIFORMS.pivotZ, TUNING.curve.flatDistance, TUNING.curve.strength, 0);
    effect.setFloat('uGlow', mat.glow);
  });
  return mat;
}
