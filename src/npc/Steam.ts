import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Material } from '@babylonjs/core/Materials/material';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { SHADES, color3 } from '../config/palette';
import { TUNING } from '../config/tuning';

/**
 * Pooled steam puffs for the citizens (GAME_DESIGN 6.1): soft ivory clouds that rise,
 * each with a tiny gold-orange zig-zag lightning bolt that flickers on and off.
 *
 * Draw calls: two meshes (cloud, bolt), both drawn as thin instances.
 * All puffs are pre-allocated in the constructor. No meshes are created later.
 */

interface Puff {
  active: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  strength: number;
  drift: number;
  boltPhase: number;
  boltSide: number;
}

/** Zig-zag bolt as one flat ribbon in the XY plane, about 1 unit tall. */
function buildBoltGeometry(scene: Scene): Mesh {
  const pts: [number, number][] = [
    [0.0, 0.5],
    [0.25, 0.25],
    [-0.1, 0.05],
    [0.22, -0.2],
    [-0.05, -0.5],
  ];
  const half = 0.07;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    const base = positions.length / 3;
    positions.push(ax + nx, ay + ny, 0, ax - nx, ay - ny, 0, bx + nx, by + ny, 0, bx - nx, by - ny, 0);
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const normals: number[] = [];
  for (let i = 0; i < positions.length / 3; i++) normals.push(0, 0, -1);

  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  const mesh = new Mesh('steamBoltTemplate', scene);
  data.applyToMesh(mesh);
  return mesh;
}

/** Soft low-poly cloud: three merged spheres. */
function buildCloudGeometry(scene: Scene): Mesh {
  const parts = [
    { d: 1.0, x: 0, y: 0, z: 0 },
    { d: 0.7, x: 0.35, y: -0.1, z: 0.1 },
    { d: 0.65, x: -0.3, y: -0.05, z: -0.1 },
  ].map((p, i) => {
    const s = MeshBuilder.CreateSphere(`steamPart${i}`, { diameter: p.d, segments: 4 }, scene);
    s.position.set(p.x, p.y, p.z);
    return s;
  });
  const merged = Mesh.MergeMeshes(parts, true, true);
  if (!merged) throw new Error('SteamPool: could not merge cloud template');
  merged.name = 'steamCloudTemplate';
  return merged;
}

export class SteamPool {
  private readonly cloud: Mesh;
  private readonly bolt: Mesh;
  private readonly cloudMat: StandardMaterial;
  private readonly boltMat: StandardMaterial;
  private readonly max: number;
  private readonly puffs: Puff[];
  private readonly cloudMatrices: Float32Array;
  private readonly cloudColors: Float32Array;
  private readonly boltMatrices: Float32Array;
  private readonly boltColors: Float32Array;
  private cursor = 0;
  private time = 0;

  constructor(scene: Scene, max: number) {
    this.max = Math.max(1, Math.floor(max));

    this.cloudMat = new StandardMaterial('steamCloudMat', scene);
    this.cloudMat.disableLighting = true;
    this.cloudMat.diffuseColor = color3(SHADES.smokeIvory);
    this.cloudMat.emissiveColor = color3(SHADES.smokeIvory);
    this.cloudMat.specularColor = color3(SHADES.smokeIvory).scale(0);
    this.cloudMat.backFaceCulling = false;
    this.cloudMat.transparencyMode = Material.MATERIAL_ALPHABLEND;
    this.cloudMat.disableDepthWrite = true;

    this.boltMat = new StandardMaterial('steamBoltMat', scene);
    this.boltMat.disableLighting = true;
    this.boltMat.diffuseColor = color3(SHADES.boltOrange);
    this.boltMat.emissiveColor = color3(SHADES.boltOrange);
    this.boltMat.specularColor = color3(SHADES.boltOrange).scale(0);
    this.boltMat.backFaceCulling = false;
    this.boltMat.transparencyMode = Material.MATERIAL_ALPHABLEND;
    this.boltMat.disableDepthWrite = true;

    this.cloud = buildCloudGeometry(scene);
    this.cloud.material = this.cloudMat;
    this.bolt = buildBoltGeometry(scene);
    this.bolt.material = this.boltMat;

    this.puffs = Array.from({ length: this.max }, () => ({
      active: false,
      age: 0,
      life: 1,
      x: 0,
      y: 0,
      z: 0,
      strength: 0,
      drift: 0,
      boltPhase: 0,
      boltSide: 1,
    }));
    this.cloudMatrices = new Float32Array(this.max * 16);
    this.boltMatrices = new Float32Array(this.max * 16);
    this.cloudColors = new Float32Array(this.max * 4);
    this.boltColors = new Float32Array(this.max * 4);

    // Thin instances: one buffer per attribute, updated each frame.
    this.cloud.thinInstanceSetBuffer('matrix', this.cloudMatrices, 16, false);
    this.cloud.thinInstanceSetBuffer('color', this.cloudColors, 4, false);
    this.bolt.thinInstanceSetBuffer('matrix', this.boltMatrices, 16, false);
    this.bolt.thinInstanceSetBuffer('color', this.boltColors, 4, false);
    // The bounding box is not kept up to date for instances, so never cull these.
    this.cloud.alwaysSelectAsActiveMesh = true;
    this.bolt.alwaysSelectAsActiveMesh = true;
    this.cloud.isPickable = false;
    this.bolt.isPickable = false;
  }

  /** Starts a puff at worldPos. strength 0..1 makes it bigger and more opaque. */
  puff(worldPos: Vector3, strength: number): void {
    // Use a free slot. If none is free, the next slot in turn is reused.
    let slot = -1;
    for (let i = 0; i < this.max; i++) {
      const idx = (this.cursor + i) % this.max;
      if (!this.puffs[idx].active) {
        slot = idx;
        break;
      }
    }
    if (slot < 0) slot = this.cursor;
    this.cursor = (slot + 1) % this.max;

    const p = this.puffs[slot];
    p.active = true;
    p.age = 0;
    p.life = TUNING.steam.lifeS * (0.85 + Math.random() * 0.3);
    p.x = worldPos.x;
    p.y = worldPos.y;
    p.z = worldPos.z;
    p.strength = Math.min(1, Math.max(0, strength));
    p.drift = (Math.random() * 2 - 1) * TUNING.steam.drift;
    p.boltPhase = Math.random() * Math.PI * 2;
    p.boltSide = Math.random() < 0.5 ? -1 : 1;
  }

  update(dt: number): void {
    const cfg = TUNING.steam;
    this.time += dt;

    for (let i = 0; i < this.max; i++) {
      const p = this.puffs[i];
      const cOff = i * 16;
      const kOff = i * 4;

      if (p.active) {
        p.age += dt;
        if (p.age >= p.life) p.active = false;
      }
      if (!p.active) {
        // Hidden: zero scale, fully transparent.
        this.cloudMatrices.fill(0, cOff, cOff + 16);
        this.boltMatrices.fill(0, cOff, cOff + 16);
        this.cloudColors[kOff + 3] = 0;
        this.boltColors[kOff + 3] = 0;
        continue;
      }

      const t = p.age / p.life;
      const rise = cfg.riseHeight * (1 - (1 - t) * (1 - t));
      const x = p.x + p.drift * t;
      const y = p.y + rise;
      const z = p.z;

      const fadeIn = Math.min(1, t / 0.15);
      const fadeOut = Math.min(1, Math.max(0, (1 - t) / 0.5));
      const fade = fadeIn * fadeOut;
      const strengthMix = 0.5 + 0.5 * p.strength;

      // Cloud: radius grows over its life, bigger with strength.
      const radius = (cfg.puffSize + cfg.puffGrow * t) * (1 + p.strength * cfg.strengthGrow);
      writeMatrix(this.cloudMatrices, cOff, 2 * radius, 0, x, y, z);
      this.cloudColors[kOff] = 1;
      this.cloudColors[kOff + 1] = 1;
      this.cloudColors[kOff + 2] = 1;
      this.cloudColors[kOff + 3] = cfg.peakAlpha * strengthMix * fade;

      // Bolt: sits on the upper side of the cloud and flickers on and off.
      const flick = Math.sin(p.age * cfg.boltFlickerRate + p.boltPhase) > 0.2 ? 1 : 0;
      const boltSize = cfg.boltSize * (0.8 + 0.4 * p.strength);
      const bx = x + p.boltSide * radius * 0.45;
      const by = y + radius * 0.35;
      const bz = z + 0.02;
      writeMatrix(this.boltMatrices, cOff, boltSize, p.boltSide * 0.25, bx, by, bz);
      this.boltColors[kOff] = 1;
      this.boltColors[kOff + 1] = 1;
      this.boltColors[kOff + 2] = 1;
      this.boltColors[kOff + 3] = cfg.peakAlpha * strengthMix * fade * flick;
    }

    this.cloud.thinInstanceBufferUpdated('matrix');
    this.cloud.thinInstanceBufferUpdated('color');
    this.bolt.thinInstanceBufferUpdated('matrix');
    this.bolt.thinInstanceBufferUpdated('color');
  }

  dispose(): void {
    this.cloud.dispose();
    this.bolt.dispose();
    this.cloudMat.dispose();
    this.boltMat.dispose();
  }
}

/** Writes a scale + Z-rotation + translation matrix (row-major, Babylon layout) into arr at off. */
function writeMatrix(arr: Float32Array, off: number, s: number, rot: number, x: number, y: number, z: number): void {
  const c = Math.cos(rot) * s;
  const sn = Math.sin(rot) * s;
  arr[off + 0] = c;
  arr[off + 1] = sn;
  arr[off + 2] = 0;
  arr[off + 3] = 0;
  arr[off + 4] = -sn;
  arr[off + 5] = c;
  arr[off + 6] = 0;
  arr[off + 7] = 0;
  arr[off + 8] = 0;
  arr[off + 9] = 0;
  arr[off + 10] = s;
  arr[off + 11] = 0;
  arr[off + 12] = x;
  arr[off + 13] = y;
  arr[off + 14] = z;
  arr[off + 15] = 1;
}
