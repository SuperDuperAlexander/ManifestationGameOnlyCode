import type { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Constants } from '@babylonjs/core/Engines/constants';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TUNING } from '../config/tuning';
import { VALLEY_UNIFORMS } from './valleyShader';

/**
 * Soft light rays: a few tall, additive gradient strips behind the inner tree.
 * One mesh, one draw call. They sway very slowly.
 */
const VERT = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUv;
void main(void) {
  vUv = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;
const FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uAlpha;
varying vec2 vUv;
void main(void) {
  float side = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float a = pow(side, 1.6) * smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
  a *= 0.75 + 0.25 * sin(uTime * 0.25 + vUv.x * 9.0);
  vec3 col = mix(vec3(1.0, 0.86, 0.62), vec3(1.0, 0.7, 0.9), vUv.y);
  gl_FragColor = vec4(col * a * uAlpha, a * uAlpha);
}
`;
Effect.ShadersStore['lightRaysVertexShader'] = VERT;
Effect.ShadersStore['lightRaysFragmentShader'] = FRAG;

export class LightRays {
  private readonly mesh: Mesh;

  constructor(scene: Scene, treeBase: Vector3) {
    const R = TUNING.inner.glow.rays;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    // Strips fan out behind the tree (away from the entrance), leaning outward.
    for (let i = 0; i < R.count; i++) {
      const t = i / (R.count - 1);
      const x = (t - 0.5) * 46;
      const lean = (t - 0.5) * 14;
      const w = 5 + (i % 2) * 3;
      const h = 70;
      const z = 10 + (i % 3) * 4;
      const n = positions.length / 3;
      positions.push(x - w, 0, z, x + w, 0, z, x + lean + w * 2, h, z, x + lean - w * 2, h, z);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
    }
    const m = new Mesh('inner.rays', scene);
    const d = new VertexData();
    d.positions = positions;
    d.indices = indices;
    d.uvs = uvs;
    d.applyToMesh(m);
    m.position.set(treeBase.x, treeBase.y + 4, treeBase.z);
    m.isPickable = false;
    m.alwaysSelectAsActiveMesh = true;
    const mat = new ShaderMaterial('inner.raysMat', scene, { vertex: 'lightRays', fragment: 'lightRays' }, {
      attributes: ['position', 'uv'],
      uniforms: ['worldViewProjection', 'uTime', 'uAlpha'],
    });
    mat.backFaceCulling = false;
    mat.alphaMode = Constants.ALPHA_ADD;
    mat.disableDepthWrite = true;
    mat.onBindObservable.add(() => {
      const e = mat.getEffect();
      if (!e) return;
      e.setFloat('uTime', VALLEY_UNIFORMS.time);
      e.setFloat('uAlpha', R.alpha);
    });
    m.material = mat;
    m.alphaIndex = 5;
    mat.needAlphaBlending = () => true;
    this.mesh = m;
  }

  update(_player: Vector3): void {
    // Static: the sway is in the shader.
  }

  dispose(): void {
    this.mesh.dispose();
  }
}
