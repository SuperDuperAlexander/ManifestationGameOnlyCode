import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Mesh as BMesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { PALETTE, color3 } from '../config/palette';
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
    this.disc.position.set(x, groundY + TUNING.story.beaconGroundOffset, z);
    this.pillar = MeshBuilder.CreatePlane('beacon.pillar', { width: TUNING.story.beaconWidth, height: TUNING.story.beaconHeight }, scene);
    this.pillar.billboardMode = BMesh.BILLBOARDMODE_Y;
    this.pillar.position.set(x, groundY + TUNING.story.beaconHeight / 2, z);
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

  showAt(x: number, z: number, groundY: number): void {
    this.hidden = false;
    this.disc.position.set(x, groundY + TUNING.story.beaconGroundOffset, z);
    this.pillar.position.set(x, groundY + TUNING.story.beaconHeight / 2, z);
  }

  update(dt: number): void {
    this.time += dt;
    this.level += (this.target - this.level) * Math.min(1, dt * TUNING.story.beaconFadeSpeed);
    const pulse = 1 + TUNING.story.beaconPulse * Math.sin(this.time * TUNING.story.beaconPulseSpeed);
    const a = this.hidden ? 0 : this.level * pulse;
    this.disc.isVisible = this.pillar.isVisible = a > TUNING.story.beaconVisibleAlpha;
    const c = color3(PALETTE.gold);
    setPaperColor(this.mat, new Color4(c.r, c.g, c.b, a * TUNING.story.beaconAlpha));
  }
}
