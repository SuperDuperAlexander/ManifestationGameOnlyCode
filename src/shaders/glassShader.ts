import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Unlit frosted-glass shader for the thought bubbles: clear in the middle, brighter toward the
 * silhouette (fresnel-like), plus a soft diagonal highlight streak. No backdrop blur (too costly on phones).
 */
const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
uniform vec3 uShape;
varying vec3 vN;
varying vec3 vW;
varying vec3 vL;
void main(void) {
  vec4 wp = world * vec4(position, 1.0);
  vW = wp.xyz;
  // Smooth blob normal from the position: inner lobes give no edge rings.
  vN = normalize(mat3(world) * (position * uShape));
  vL = position;
  gl_Position = viewProjection * wp;
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uCamPos;
uniform vec3 uColor;
uniform vec3 uEdgeColor;
uniform vec4 uCfg; // x centre alpha, y edge alpha, z power, w visibility
uniform float uStreak;
varying vec3 vN;
varying vec3 vW;
varying vec3 vL;
void main(void) {
  vec3 v = normalize(uCamPos - vW);
  float f = pow(1.0 - abs(dot(normalize(vN), v)), uCfg.z);
  float a = mix(uCfg.x, uCfg.y, f);
  vec3 c = mix(uColor, uEdgeColor, f);
  // soft diagonal highlight band (object space)
  float d = vL.x * 0.8 + vL.y * 1.2;
  float band = smoothstep(0.1, 0.0, abs(d + 0.28)) + 0.6 * smoothstep(0.04, 0.0, abs(d + 0.45));
  band *= uStreak;
  c = mix(c, vec3(1.0), band * 0.8);
  a = max(a, band * 0.4);
  gl_FragColor = vec4(c, a * uCfg.w);
}`;

export interface GlassOpts {
  color: Color3;
  edgeColor: Color3;
  centerAlpha: number;
  edgeAlpha: number;
  power: number;
  streak: number;
  /** Per-axis scale that turns a local position into a blob normal. */
  shape: Vector3;
}

export function createGlassMaterial(name: string, scene: Scene, o: GlassOpts): ShaderMaterial {
  Effect.ShadersStore['glassVertexShader'] = VERTEX;
  Effect.ShadersStore['glassFragmentShader'] = FRAGMENT;
  const m = new ShaderMaterial(name, scene, 'glass', {
    attributes: ['position'],
    uniforms: ['world', 'viewProjection', 'uCamPos', 'uColor', 'uEdgeColor', 'uCfg', 'uStreak', 'uShape'],
    needAlphaBlending: true,
  });
  m.backFaceCulling = true;
  m.disableDepthWrite = true;
  m.setColor3('uColor', o.color);
  m.setColor3('uEdgeColor', o.edgeColor);
  m.setFloat('uStreak', o.streak);
  m.setVector3('uShape', o.shape);
  m.setVector4('uCfg', { x: o.centerAlpha, y: o.edgeAlpha, z: o.power, w: 1 } as never);
  m.onBindObservable.add(() => {
    const cam = scene.activeCamera;
    if (cam) m.getEffect()?.setVector3('uCamPos', cam.globalPosition);
  });
  return m;
}
