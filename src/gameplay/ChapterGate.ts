import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import type { AssetLoader } from '../core/AssetLoader';
import type { Events } from '../core/Events';
import { damp } from '../core/Random';
import type { AssetMeta, GateSpec } from '../types/chapter';
import { createPaperMaterial, setPaperColor, type PaperMaterial } from '../shaders/paperShader';
import { PaperCardSet } from '../world/PaperCard';
import { procTexture } from '../world/ProceduralTextures';
import type { FogField } from './FogField';

export const GATE_FOG_ID = 'gate_fog';

/**
 * The chapter gate on the far side of the chasm. A big fog stands in front of it.
 * When the bridge is walkable the fog opens and the gate glows.
 * Walking into the gate ends the chapter.
 */
export class ChapterGate {
  readonly root: TransformNode;
  private card: PaperCardSet | null = null;
  private readonly glow: Mesh;
  private readonly glowMat: PaperMaterial;
  private open = false;
  private glowLevel = 0.15;
  private time = 0;
  private triggered = false;

  constructor(
    private readonly scene: Scene,
    private readonly spec: GateSpec,
    private readonly events: Events,
    private readonly fogs: FogField,
  ) {
    this.root = new TransformNode('gate', scene);
    this.glowMat = createPaperMaterial('gate.glowMat', scene, {
      texture: procTexture(scene, 'halo'),
      additive: true,
      haze: false,
    });
    this.glow = MeshBuilder.CreatePlane('gate.glow', { width: 5, height: 7 }, scene);
    this.glow.rotation.x = (TUNING.cards.leanBackDeg * Math.PI) / 180;
    this.glow.position.set(spec.pos[0], spec.height * 0.42, spec.pos[1] - 0.3);
    this.glow.material = this.glowMat;
    this.glow.parent = this.root;
    this.glow.isPickable = false;
    this.glow.alwaysSelectAsActiveMesh = true;
  }

  async build(assets: AssetLoader, meta: AssetMeta | undefined): Promise<void> {
    const img = await assets.acquire(this.spec.asset);
    this.card = new PaperCardSet(this.scene, 'gate', img, [
      {
        x: this.spec.pos[0],
        z: this.spec.pos[1],
        height: this.spec.height,
        rotY: 0,
        mirror: false,
        tint: [1, 1, 1],
        shadow: (meta?.shadow ?? 3) * (this.spec.height / (meta?.height ?? this.spec.height)),
      },
    ]);
    this.card.mesh.parent = this.root;
    if (this.card.shadowMesh) this.card.shadowMesh.parent = this.root;
    this.addFog();
  }

  /** The big fog in front of the gate (again after loading, unless it was opened). */
  addFog(): void {
    if (this.open || this.fogs.isReleased(GATE_FOG_ID)) return;
    this.fogs.add({
      id: GATE_FOG_ID,
      x: this.spec.fogPos[0],
      z: this.spec.fogPos[1],
      text: '',
      release: '',
      points: 0,
      size: this.spec.fogSize ?? 1.8,
      stretch: this.spec.fogStretch ?? 1.3,
      breathable: false,
    });
  }

  openGate(): void {
    if (this.open) return;
    this.open = true;
    this.fogs.open(GATE_FOG_ID);
    this.events.emit('gateOpened', {});
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Returns true once, when the player walks into the open gate. */
  update(dt: number, px: number, pz: number): boolean {
    this.time += dt;
    const target = this.open ? 1 : 0.15;
    this.glowLevel += (target - this.glowLevel) * damp(1.2, dt);
    const pulse = 0.85 + 0.15 * Math.sin(this.time * 1.6);
    setPaperColor(this.glowMat, new Color4(1, 1, 1, this.glowLevel * 0.9 * pulse));
    if (!this.open || this.triggered) return false;
    const d = Math.hypot(px - this.spec.exit[0], pz - this.spec.exit[1]);
    if (d < TUNING.gate.triggerRadius) {
      this.triggered = true;
      return true;
    }
    return false;
  }

  setVisible(v: boolean): void {
    if (v === this.root.isEnabled()) return;
    this.root.setEnabled(v);
    this.fogs.get(GATE_FOG_ID)?.setVisible(v);
  }
}
