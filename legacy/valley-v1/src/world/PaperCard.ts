import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { TUNING } from '../config/tuning';
import type { LoadedImage } from '../core/AssetLoader';
import { createPaperMaterial, type PaperMaterial } from '../shaders/paperShader';
import { procTexture } from './ProceduralTextures';

export interface CardInstance {
  x: number;
  y?: number;
  z: number;
  /** Card height in metres. Width follows the image aspect ratio. */
  height: number;
  /** Small turn around Y, radians. */
  rotY: number;
  mirror: boolean;
  /** Colour multiplier for free variation. */
  tint: [number, number, number];
  /** Blob shadow width in metres (0 = none). */
  shadow: number;
}

/**
 * One image, many paper cards: a single mesh drawn with thin instances.
 * Pivot is the bottom centre. Cards stand upright facing the camera and lean back a little.
 * Their soft blob shadows are one more thin-instanced mesh.
 */
export class PaperCardSet {
  readonly mesh: Mesh;
  readonly shadowMesh: Mesh | null = null;
  readonly material: PaperMaterial;
  readonly aspect: number;

  constructor(scene: Scene, name: string, image: LoadedImage, instances: CardInstance[], opts: { shadows?: boolean } = {}) {
    this.aspect = image.width / image.height;
    this.mesh = MeshBuilder.CreatePlane(`card:${name}`, { width: this.aspect, height: 1 }, scene);
    this.mesh.bakeTransformIntoVertices(Matrix.Translation(0, 0.5, 0));
    this.material = createPaperMaterial(`cardMat:${name}`, scene, {
      texture: image.texture,
      alphaTest: true,
    });
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    // Cards bend with the world in the shader, so CPU culling could drop visible ones.
    this.mesh.alwaysSelectAsActiveMesh = true;

    const lean = (TUNING.cards.leanBackDeg * Math.PI) / 180;
    const matrices = new Float32Array(instances.length * 16);
    const colors = new Float32Array(instances.length * 4);
    const m = new Matrix();
    const q = new Quaternion();
    const scale = new Vector3();
    const pos = new Vector3();
    // Back to front along the view direction: the camera never turns, so this order holds.
    const sorted = [...instances].sort((a, b) => b.z - a.z);
    sorted.forEach((inst, i) => {
      scale.set(inst.height * (inst.mirror ? -1 : 1), inst.height, inst.height);
      Quaternion.FromEulerAnglesToRef(lean, inst.rotY, 0, q);
      pos.set(inst.x, inst.y ?? 0, inst.z);
      Matrix.ComposeToRef(scale, q, pos, m);
      m.copyToArray(matrices, i * 16);
      colors.set([inst.tint[0], inst.tint[1], inst.tint[2], 1], i * 4);
    });
    this.mesh.thinInstanceSetBuffer('matrix', matrices, 16, true);
    this.mesh.thinInstanceSetBuffer('color', colors, 4, true);

    const withShadow = opts.shadows === false ? [] : sorted.filter((s) => s.shadow > 0);
    if (withShadow.length) {
      const sh = MeshBuilder.CreateGround(`cardShadow:${name}`, { width: 1, height: 1 }, scene);
      sh.material = createPaperMaterial(`cardShadowMat:${name}`, scene, {
        texture: procTexture(scene, 'shadow'),
        alphaBlend: true,
      });
      sh.isPickable = false;
      sh.alwaysSelectAsActiveMesh = true;
      const sm = new Float32Array(withShadow.length * 16);
      withShadow.forEach((inst, i) => {
        scale.set(inst.shadow, 1, inst.shadow * 0.55);
        pos.set(inst.x, (inst.y ?? 0) + 0.025, inst.z + 0.1);
        Matrix.ComposeToRef(scale, Quaternion.Identity(), pos, m);
        m.copyToArray(sm, i * 16);
      });
      sh.thinInstanceSetBuffer('matrix', sm, 16, true);
      (this as { shadowMesh: Mesh | null }).shadowMesh = sh;
    }
  }

  /** Textures are shared and counted by the AssetLoader, so they are not disposed here. */
  dispose(): void {
    this.mesh.dispose();
    this.material.dispose(false, false);
    if (this.shadowMesh) {
      this.shadowMesh.material?.dispose(false, false);
      this.shadowMesh.dispose();
    }
  }
}
