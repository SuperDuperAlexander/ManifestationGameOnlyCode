import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import { procTexture } from '../world/ProceduralTextures';
import type { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { createPaperMaterial } from '../shaders/paperShader';
import { LAYOUT } from './valleyLayout';
import type { ValleyTerrain } from './ValleyTerrain';

/** The river surface: one ribbon along the river line. The shader paints flow and glints. */
export function buildRiver(scene: Scene, terrain: ValleyTerrain, material: ShaderMaterial): Mesh {
  const line = terrain.riverLine;
  const half = LAYOUT.river.halfWidth + 0.9;
  const y = LAYOUT.river.level;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < line.length; i++) {
    const [x, z] = line[i]!;
    const [ax, az] = line[Math.max(0, i - 1)]!;
    const [bx, bz] = line[Math.min(line.length - 1, i + 1)]!;
    let dx = bx - ax;
    let dz = bz - az;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    // Sideways: perpendicular to the flow.
    positions.push(x - dz * half, y, z + dx * half, x + dz * half, y, z - dx * half);
    normals.push(0, 1, 0, 0, 1, 0);
    if (i < line.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const mesh = new Mesh('valley.river', scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.applyToMesh(mesh);
  mesh.material = material;
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  return mesh;
}

/**
 * A cascade: a ribbon of water that runs up the terraced cliff from a start point,
 * following the ground, so it falls over each ledge and runs across it.
 */
export function buildWaterfall(
  scene: Scene,
  terrain: ValleyTerrain,
  material: ShaderMaterial,
  from: { x: number; z: number; dirX: number; dirZ: number; width: number; top: number },
): Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  let x = from.x;
  let z = from.z;
  const sideX = -from.dirZ;
  const sideZ = from.dirX;
  const lift = 0.3;
  for (let i = 0; i <= 120; i++) {
    const h = terrain.height(x, z);
    // Push the water a little out of the ground, along the ground's normal.
    const e = 0.3;
    const dx = (terrain.height(x + e, z) - terrain.height(x - e, z)) / (2 * e);
    const dz = (terrain.height(x, z + e) - terrain.height(x, z - e)) / (2 * e);
    const nl = Math.hypot(dx, 1, dz);
    const nx = -dx / nl;
    const ny = 1 / nl;
    const nz = -dz / nl;
    const half = from.width * (1 - 0.4 * Math.min(1, i / 60));
    const y = Math.max(h, LAYOUT.river.level + 0.02);
    const px = x + nx * lift;
    const py = y + ny * lift;
    const pz = z + nz * lift;
    positions.push(px + sideX * half, py, pz + sideZ * half, px - sideX * half, py, pz - sideZ * half);
    normals.push(nx, ny, nz, nx, ny, nz);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    x += from.dirX * 0.22;
    z += from.dirZ * 0.22;
    if (h > from.top) break;
  }
  const mesh = new Mesh('valley.falls', scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.applyToMesh(mesh);
  mesh.material = material;
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  return mesh;
}

/**
 * Soft blue mist deep in the chasm: it hides the bottom and makes it feel endless.
 * Slow clouds of mist rise out of it and fade before they reach the edge.
 */
export function buildChasmMist(scene: Scene): Mesh[] {
  const c = LAYOUT.chasm;
  const out: Mesh[] = [];
  const layers: [number, number][] = [[-17, 0.75]];
  for (const [y, a] of layers) {
    const mist = MeshBuilder.CreateGround('valley.chasmMist', { width: 150, height: c.halfWidth * 2 + 4 }, scene);
    mist.position.set(0, y, c.z);
    mist.material = createPaperMaterial('valley.chasmMistMat', scene, {
      color: new Color4(0.8, 0.85, 0.92, a),
      alphaBlend: true,
      haze: false,
      curve: false,
    });
    mist.isPickable = false;
    mist.freezeWorldMatrix();
    out.push(mist);
  }
  const ps = new ParticleSystem('valley.chasmClouds', 70, scene);
  ps.particleTexture = procTexture(scene, 'puff');
  ps.emitter = new Vector3(0, -12, c.z);
  ps.minEmitBox = new Vector3(-45, 0, -c.halfWidth * 0.6);
  ps.maxEmitBox = new Vector3(45, 4, c.halfWidth * 0.6);
  ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  ps.color1 = new Color4(0.93, 0.94, 0.98, 0.42);
  ps.color2 = new Color4(0.85, 0.89, 0.96, 0.32);
  ps.colorDead = new Color4(0.9, 0.92, 0.97, 0);
  ps.minSize = 5;
  ps.maxSize = 9;
  ps.minLifeTime = 9;
  ps.maxLifeTime = 14;
  ps.emitRate = 5;
  ps.direction1 = new Vector3(-0.15, 0.35, -0.05);
  ps.direction2 = new Vector3(0.15, 0.6, 0.05);
  ps.minEmitPower = 0.5;
  ps.maxEmitPower = 0.8;
  ps.minAngularSpeed = -0.05;
  ps.maxAngularSpeed = 0.05;
  ps.preWarmCycles = 120;
  ps.preWarmStepOffset = 10;
  ps.start();
  return out;
}
