import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Mesh as BMesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { createPaperMaterial, setPaperColor, type PaperMaterial } from '../shaders/paperShader';
import { procTexture } from '../world/ProceduralTextures';

/**
 * A soft gold light on the ground (with a faint pillar) that shows where to go.
 * Dim and waiting before the invitation, warm and glowing afterwards.
 */
export class Beacon {
  private readonly disc: Mesh;
  private readonly pillar: Mesh;
  private readonly mat: PaperMaterial;
  private level: number;
  private target: number;
  private time = 0;
  private hidden = false;

  constructor(scene: Scene, x: number, z: number, groundY: number) {
    this.mat = createPaperMaterial('beacon.mat', scene, { texture: procTexture(scene, 'halo'), additive: true });
    const r = TUNING.story.beaconRadius;
    this.disc = MeshBuilder.CreateGround('beacon.disc', { width: r * 2, height: r * 2 }, scene);
    this.disc.position.set(x, groundY + 0.06, z);
    this.pillar = MeshBuilder.CreatePlane('beacon.pillar', { width: 1.6, height: 5 }, scene);
    this.pillar.billboardMode = BMesh.BILLBOARDMODE_Y;
    this.pillar.position.set(x, groundY + 2.5, z);
    for (const m of [this.disc, this.pillar]) {
      m.material = this.mat;
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
    }
    this.level = this.target = TUNING.story.beaconDim;
  }

  setLit(lit: boolean): void {
    this.target = lit ? TUNING.story.beaconLit : TUNING.story.beaconDim;
  }

  hide(): void {
    this.hidden = true;
  }

  update(dt: number): void {
    this.time += dt;
    this.level += (this.target - this.level) * Math.min(1, dt * 1.5);
    const pulse = 1 + 0.12 * Math.sin(this.time * 1.6);
    const a = this.hidden ? 0 : this.level * pulse;
    this.disc.isVisible = this.pillar.isVisible = a > 0.01;
    setPaperColor(this.mat, new Color4(1, 0.86, 0.5, a * 0.7));
  }
}
