import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { fbm, noise2 } from './noise';
import { mixRgb, rgb } from './colors';
import { SHADES } from '../config/palette';
import { VALLEY_UNIFORMS } from './valleyShader';

/**
 * Sky and far mountains, all in code.
 * - Sky: a dome with a soft gradient, a warm morning sun and slow cream clouds.
 * - Far mountains: three rings of flat-topped mesas around the valley. Each ring is
 *   paler and bluer than the one in front: the layered paper depth of the reference.
 */

const SKY_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDir;
void main(void) {
  vDir = position;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uSunDir;
uniform float uTime;
uniform float uMood;
uniform vec3 uGlow;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main(void) {
  vec3 d = normalize(vDir);
  float up = d.y;
  vec3 c = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, up));
  // Soft pink-magenta glow around the light, and a gentle pearl disc.
  float s = max(dot(d, uSunDir), 0.0);
  c += uGlow * (pow(s, 4.0) * 0.25 + pow(s, 40.0) * 0.2);
  c = mix(c, vec3(1.0, 0.94, 0.98), smoothstep(0.9965, 0.9985, s));
  // A few twinkling stars and a faint spiral nebula high up.
  vec2 sp = d.xz / (up + 0.35) * 38.0;
  vec2 cell = floor(sp);
  float h = hash(cell);
  vec2 off = vec2(hash(cell + 3.1), hash(cell + 7.7));
  float star = step(0.88, h) * smoothstep(0.16, 0.0, length(fract(sp) - off)) * (0.65 + 0.35 * sin(uTime * 1.3 + h * 40.0));
  c += vec3(1.0, 0.96, 1.0) * star * smoothstep(0.25, 0.6, up);
  vec2 q = d.xz / (up + 0.35) - vec2(0.35, -0.55);
  float ang = atan(q.y, q.x) + length(q) * 4.0 - uTime * 0.01;
  float neb = pow(0.5 + 0.5 * cos(ang * 2.0), 3.0) * exp(-length(q) * 1.8) * smoothstep(0.1, 0.4, up);
  c += vec3(0.75, 0.45, 0.95) * neb * 0.9;
  // Soft cream clouds, drifting slowly. Only above the horizon.
  vec2 p = d.xz / (up + 0.25) * 1.6 + vec2(uTime * 0.006, uTime * 0.002);
  float n = noise(p * 1.1) * 0.62 + noise(p * 2.6 + 3.1) * 0.38;
  float cloud = smoothstep(0.56, 0.78, n) * smoothstep(0.03, 0.18, up) * (1.0 - smoothstep(0.45, 0.85, up));
  vec3 cloudCol = mix(vec3(0.86, 0.78, 0.96), vec3(1.0, 0.82, 0.92), pow(s, 3.0));
  c = mix(c, cloudCol, cloud * 0.5);
  // Mood: a grey, heavy sky with force; a warm, golden one with light.
  float lum = dot(c, vec3(0.3, 0.59, 0.11));
  if (uMood < 0.0) c = mix(c, vec3(lum) * vec3(0.55, 0.57, 0.68), -uMood);
  else c = mix(c, c * vec3(1.04, 1.0, 0.92) + vec3(0.04, 0.03, 0.0), uMood);
  gl_FragColor = vec4(c, 1.0);
}
`;

Effect.ShadersStore['valleySkyVertexShader'] = SKY_VERTEX;
Effect.ShadersStore['valleySkyFragmentShader'] = SKY_FRAGMENT;

/** Sun direction in the sky: ahead and to the right of the start view, low morning sun. */
export const SUN_DIR = new Vector3(0.45, 0.32, 0.83).normalize();

export class ValleySky {
  readonly dome: Mesh;
  private readonly mat: ShaderMaterial;

  constructor(scene: Scene) {
    this.dome = MeshBuilder.CreateSphere('valley.sky', { diameter: 1200, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene);
    this.dome.infiniteDistance = true;
    this.dome.isPickable = false;
    this.dome.renderingGroupId = 0;
    this.mat = new ShaderMaterial(
      'valley.skyMat',
      scene,
      { vertex: 'valleySky', fragment: 'valleySky' },
      { attributes: ['position'], uniforms: ['worldViewProjection', 'uHorizon', 'uZenith', 'uSunDir', 'uTime', 'uMood', 'uGlow'] },
    );
    this.mat.disableDepthWrite = true;
    this.mat.backFaceCulling = false;
    const horizon = VALLEY_UNIFORMS.fogColor;
    const zenith = rgb(SHADES.innerSkyTop);
    const glow = rgb(SHADES.innerSkyGlow);
    this.mat.onBindObservable.add(() => {
      const e = this.mat.getEffect();
      if (!e) return;
      e.setColor3('uHorizon', horizon);
      e.setFloat3('uZenith', zenith[0], zenith[1], zenith[2]);
      e.setVector3('uSunDir', SUN_DIR);
      e.setFloat('uTime', VALLEY_UNIFORMS.time);
      e.setFloat('uMood', VALLEY_UNIFORMS.mood);
      e.setFloat3('uGlow', glow[0] * 0.5, glow[1] * 0.5, glow[2] * 0.5);
    });
    this.dome.material = this.mat;
  }
}

/**
 * Three rings of far mesas, merged into one mesh. Colours are painted in:
 * each ring hazier than the one before, and every ring fades into the haze at its foot.
 */
export function buildFarMountains(scene: Scene): Mesh {
  const haze = rgb(SHADES.innerHaze);
  const rings = [
    { radius: 150, base: 8, amp: 46, freq: 5, color: SHADES.innerFarNear, top: '#AE98D8', seed: 1 },
    { radius: 230, base: 30, amp: 60, freq: 4, color: '#A894D4', top: '#B8A6E0', seed: 2 },
    { radius: 330, base: 55, amp: 70, freq: 3, color: SHADES.innerFarFar, top: '#C8B6EA', seed: 3 },
  ];
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const seg = 180;
  for (const r of rings) {
    const start = positions.length / 3;
    const body = rgb(r.color);
    const top = rgb(r.top);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const cx = Math.cos(a);
      const sz = Math.sin(a);
      // Flat-topped mesas: noise pushed through a soft step, plus a little detail.
      const n = noise2(cx * r.freq + r.seed * 10, sz * r.freq - r.seed * 7);
      const mesa = smooth(0.38, 0.52, n) * 0.75 + smooth(0.62, 0.7, n) * 0.25;
      const h = r.base + r.amp * mesa + fbm(cx * 20 + r.seed, sz * 20, 2) * 4;
      const x = cx * r.radius;
      const z = sz * r.radius;
      positions.push(x, h, z, x, -30, z);
      const topC = mixRgb(top, body, 0.3);
      const footC = mixRgb(body, haze, 0.85);
      colors.push(topC[0], topC[1], topC[2], 0, footC[0], footC[1], footC[2], 0);
      normals.push(-cx, 0, -sz, -cx, 0, -sz);
    }
    for (let i = 0; i < seg; i++) {
      const a = start + i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const mesh = new Mesh('valley.farMountains', scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.colors = colors;
  data.normals = normals;
  data.applyToMesh(mesh);
  mesh.isPickable = false;
  mesh.infiniteDistance = false;
  mesh.freezeWorldMatrix();
  return mesh;
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
