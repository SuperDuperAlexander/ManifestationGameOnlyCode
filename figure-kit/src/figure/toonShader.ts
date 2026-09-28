import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import type { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Flat, soft toon shading for the figure. One fixed light from the upper right,
 * like painted art. No real lights needed in the scene.
 * Vertex colours carry the paint. A glow value mixes toward warm light (breathing in).
 */
const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vNormal;
#ifdef VERTEXCOLOR
attribute vec4 color;
varying vec3 vColor;
#endif
void main(void) {
#ifdef VERTEXCOLOR
  vColor = color.rgb;
#endif
  vNormal = normalize(mat3(world) * normal);
  gl_Position = viewProjection * world * vec4(position, 1.0);
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

Effect.ShadersStore['figureToonVertexShader'] = VERTEX;
Effect.ShadersStore['figureToonFragmentShader'] = FRAGMENT;

export type ToonMaterial = ShaderMaterial & { glow: number };

export function createToonMaterial(name: string, scene: Scene, color: Color3, shadow: Color3): ToonMaterial {
  const mat = new ShaderMaterial(
    name,
    scene,
    { vertex: 'figureToon', fragment: 'figureToon' },
    {
      attributes: ['position', 'normal'],
      uniforms: ['world', 'viewProjection', 'uColor', 'uShadow', 'uGlow'],
    },
  ) as ToonMaterial;
  mat.glow = 0;
  mat.setColor3('uColor', color);
  mat.setColor3('uShadow', shadow);
  mat.onBindObservable.add(() => {
    mat.getEffect()?.setFloat('uGlow', mat.glow);
  });
  return mat;
}
