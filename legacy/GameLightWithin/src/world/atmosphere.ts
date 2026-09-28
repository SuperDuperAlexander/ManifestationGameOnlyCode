import { Constants } from '@babylonjs/core/Engines/constants';
import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PALETTE } from '../content/palette';
import { makeRng } from '../core/math';
import { colorState } from '../render/colorRestore';
import { linearColor, stage } from '../render/scene3d';

/** Side of the box of motes that follows the camera, in metres. */
const BOX = 44;
const POLLEN = 'lwPollen';

/**
 * Pollen and dust drifting in the air.
 *
 * Empty air is the thing that most gives away a made world: light with nothing
 * in it looks like light in a vacuum. A few hundred slow specks catching the
 * sun are cheap and do more for the feeling of a real outdoor place than
 * almost anything else on screen.
 *
 * The specks live in a box that repeats around the camera, so the player never
 * walks out of the weather and nothing has to be moved on the processor.
 */
Effect.ShadersStore[`${POLLEN}VertexShader`] = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec3 aParams;
  uniform mat4 view;
  uniform mat4 projection;
  uniform float uTime;
  uniform vec3 uAnchor;
  uniform float uScale;
  varying float vFade;
  varying float vPhase;

  void main() {
    // Drift, then wrap the whole box around the camera.
    vec3 p = position;
    p.y += uTime * aParams.y;
    p.x += sin(uTime * 0.21 + aParams.z) * 1.4;
    p.z += cos(uTime * 0.17 + aParams.z) * 1.4;

    float box = ${BOX.toFixed(1)};
    vec3 rel = mod(p - uAnchor + box * 0.5, box) - box * 0.5;
    vec3 world = uAnchor + rel;

    vec4 viewPos = view * vec4(world, 1.0);
    // Fade in at the far edge of the box and out very close to the eye, so
    // nothing pops in and nothing sits on the lens.
    float d = length(viewPos.xyz);
    vFade = smoothstep(box * 0.5, box * 0.32, d) * smoothstep(0.6, 3.0, d);
    vPhase = aParams.z;
    gl_PointSize = aParams.x * uScale * (14.0 / max(d, 0.6));
    gl_Position = projection * viewPos;
  }
`;

Effect.ShadersStore[`${POLLEN}FragmentShader`] = /* glsl */ `
  // Must match the vertex stage: uTime is declared in both, and a uniform
  // with two different precisions fails to link.
  precision highp float;
  varying float vFade;
  varying float vPhase;
  uniform float uGlobalColor;
  uniform vec3 uCold;
  uniform vec3 uWarm;
  uniform float uTime;

  void main() {
    // A soft round speck, brightest in the middle.
    float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float a = (1.0 - smoothstep(0.25, 1.0, d)) * vFade;
    if (a < 0.01) discard;
    // Each speck turns slowly in the light, so the air never looks static.
    float twinkle = 0.55 + 0.45 * sin(uTime * 1.3 + vPhase * 3.1);
    vec3 col = mix(uCold, uWarm, uGlobalColor * 0.85);
    gl_FragColor = vec4(col, a * twinkle * 0.5);
  }
`;

export function buildAtmosphere(count: number): Mesh {
  const rng = makeRng(5150);
  const positions = new Float32Array(count * 3);
  const params = new Float32Array(count * 3);
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = rng() * BOX;
    positions[i * 3 + 1] = rng() * BOX;
    positions[i * 3 + 2] = rng() * BOX;
    // size, rise speed, phase
    params[i * 3] = 0.5 + rng() * 1.6;
    params[i * 3 + 1] = 0.12 + rng() * 0.4;
    params[i * 3 + 2] = rng() * Math.PI * 2;
    indices.push(i);
  }

  const scene = stage();
  const points = new Mesh('atmosphere', scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.applyToMesh(points, false);
  points.setVerticesData('aParams', params, false, 3);

  const material = new ShaderMaterial(
    POLLEN,
    scene,
    { vertex: POLLEN, fragment: POLLEN },
    {
      attributes: [VertexBuffer.PositionKind, 'aParams'],
      uniforms: [
        'view',
        'projection',
        'uTime',
        'uAnchor',
        'uScale',
        'uGlobalColor',
        'uCold',
        'uWarm',
      ],
      needAlphaBlending: true,
    },
  );
  material.setColor3('uCold', linearColor(PALETTE.skyGrey));
  material.setColor3('uWarm', linearColor(PALETTE.receiveGold));
  material.setFloat('uScale', 1);
  material.setFloat('uTime', 0);
  material.setFloat('uGlobalColor', 0);
  material.setVector3('uAnchor', points.position);
  material.alphaMode = Constants.ALPHA_ADD;
  material.disableDepthWrite = true;
  material.backFaceCulling = false;
  material.fogEnabled = false;
  material.pointsCloud = true;

  points.material = material;
  points.alwaysSelectAsActiveMesh = true;
  points.doNotSyncBoundingInfo = true;
  points.isPickable = false;
  points.alphaIndex = 3;
  maxSpecks.set(points, count);
  return points;
}

/** The full speck count, so a tier change can raise the density again. */
const maxSpecks = new WeakMap<Mesh, number>();

/** The specks are drawn from the front of the buffer, so a lower tier draws fewer. */
export function setAtmosphereCount(points: Mesh, count: number): void {
  const sub = points.subMeshes[0];
  if (!sub) return;
  const max = maxSpecks.get(points) ?? sub.indexCount;
  maxSpecks.set(points, max);
  sub.indexCount = Math.max(0, Math.min(max, Math.round(count)));
  // Drawing part of a buffer makes this no longer the whole mesh, and a part
  // has to say how big it is or the renderer cannot sort it.
  sub.setBoundingInfo(points.getBoundingInfo());
}

export function updateAtmosphere(points: Mesh, time: number, anchor: Vector3): void {
  const material = points.material as ShaderMaterial;
  material.setFloat('uTime', time);
  material.setVector3('uAnchor', anchor);
  material.setFloat('uGlobalColor', colorState.globalColor);
}
