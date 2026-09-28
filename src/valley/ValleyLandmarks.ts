import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { createPaperMaterial, setPaperColor, type PaperMaterial } from '../shaders/paperShader';
import { procTexture } from '../world/ProceduralTextures';
import { paintFlat, paintGradient } from './colors';
import { LAYOUT } from './valleyLayout';
import type { ValleyTerrain } from './ValleyTerrain';
import type { Collider, ShadowSpot } from './ValleyProps';

/**
 * The places of the valley, all from simple shapes: the rune monolith, the old well,
 * the stone bridge over the river, the arch beyond the chasm and broken pillars.
 * All stone is merged into one mesh (one draw call). The lights are soft glow cards.
 */
export class ValleyLandmarks {
  readonly colliders: Collider[] = [];
  readonly shadows: ShadowSpot[] = [];
  readonly stone: Mesh;
  readonly rune: Mesh;
  /** 0..1: how bright the arch's light is (it opens when the bridge is ready). */
  gateLevel = 0.25;
  private readonly glows: { mat: PaperMaterial; base: number; speed: number; phase: number; gate: boolean }[] = [];
  private time = 0;
  private readonly bridgeBaseY: number;

  constructor(
    scene: Scene,
    terrain: ValleyTerrain,
    materials: { solid: ShaderMaterial; unlit: ShaderMaterial },
  ) {
    const parts: Mesh[] = [];
    const runeParts: Mesh[] = [];

    // Monolith: a tall tapered stone with a gold diamond rune facing the path.
    const mo = LAYOUT.monolith;
    const moY = terrain.height(mo.x, mo.z) - 0.3;
    const mono = MeshBuilder.CreateCylinder('mono', { height: 5.4, diameterTop: 1.35, diameterBottom: 1.9, tessellation: 4 }, scene);
    // Turn first, then flatten: so the faces stay flat and square.
    mono.rotation.y = Math.PI / 4;
    mono.bakeCurrentTransformIntoVertices();
    mono.scaling.z = 0.55;
    mono.rotation.y = 0.8;
    mono.position.set(mo.x, moY + 2.7, mo.z);
    paintGradient(mono, '#8C8984', '#C3BBAE');
    parts.push(mono);
    const cap = MeshBuilder.CreateCylinder('mono.cap', { height: 0.5, diameterTop: 0.2, diameterBottom: 1.35, tessellation: 4 }, scene);
    cap.rotation.y = Math.PI / 4;
    cap.bakeCurrentTransformIntoVertices();
    cap.scaling.z = 0.55;
    cap.rotation.y = 0.8;
    cap.position.set(mo.x, moY + 5.65, mo.z);
    paintFlat(cap, '#C9C1B4');
    parts.push(cap);
    // The rune sits on the face that looks toward the path (west).
    const runeRoot = new TransformNode('rune.root', scene);
    runeRoot.position.set(mo.x, moY + 3.2, mo.z);
    runeRoot.rotation.y = 0.8;
    for (let i = 0; i < 4; i++) {
      const bar = MeshBuilder.CreateBox('rune', { width: 0.09, height: 0.75, depth: 0.05 }, scene);
      const sx = i < 2 ? -1 : 1;
      const sy = i % 2 === 0 ? 1 : -1;
      bar.parent = runeRoot;
      bar.position.set(sx * 0.24, sy * 0.3, -0.37);
      bar.rotation.z = sx * sy * 0.68;
      paintFlat(bar, '#FFE3A0');
      runeParts.push(bar);
    }
    const dot = MeshBuilder.CreateBox('rune.dot', { width: 0.14, height: 0.14, depth: 0.05 }, scene);
    dot.parent = runeRoot;
    dot.rotation.z = Math.PI / 4;
    dot.position.set(0, 0, -0.37);
    paintFlat(dot, '#FFF1C9');
    runeParts.push(dot);
    this.colliders.push({ x: mo.x, z: mo.z, radius: 1.0 });
    this.shadows.push({ x: mo.x, z: mo.z, radius: 2.4, strength: 0.35 });
    const facing = new Vector3(Math.sin(0.8), 0, Math.cos(0.8));
    this.glow(scene, new Vector3(mo.x - facing.x * 0.55, moY + 3.2, mo.z - facing.z * 0.55), 2.2, 0.55, 1.4);

    // Well: a ring of stones around dark water.
    const we = LAYOUT.well;
    const weY = terrain.height(we.x, we.z) - 0.1;
    const stones = 12;
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < stones; i++) {
        const a = ((i + layer * 0.5) / stones) * Math.PI * 2;
        const s = MeshBuilder.CreateBox('well.stone', { width: 0.58, height: 0.4, depth: 0.34 }, scene);
        s.position.set(we.x + Math.cos(a) * 1.05, weY + 0.2 + layer * 0.4, we.z + Math.sin(a) * 1.05);
        s.rotation.y = -a + Math.PI / 2;
        paintGradient(s, layer === 0 ? '#9A948C' : '#AFA89C', layer === 0 ? '#AFA89C' : '#CFC6B6');
        parts.push(s);
      }
    }
    const water = MeshBuilder.CreateDisc('well.water', { radius: 0.9, tessellation: 14 }, scene);
    water.rotation.x = Math.PI / 2;
    water.position.set(we.x, weY + 0.55, we.z);
    paintFlat(water, '#4F6E7C');
    parts.push(water);
    this.colliders.push({ x: we.x, z: we.z, radius: 1.45 });
    this.shadows.push({ x: we.x, z: we.z, radius: 2.2, strength: 0.3 });

    // Stone bridge over the river: a gentle arch with low walls on both sides.
    const sb = LAYOUT.stoneBridge;
    const z0 = sb.z - sb.length / 2;
    const z1 = sb.z + sb.length / 2;
    this.bridgeBaseY = Math.max(terrain.height(sb.x, z0), terrain.height(sb.x, z1)) - 0.05;
    const segs = 10;
    for (let i = 0; i < segs; i++) {
      const za = z0 + (i / segs) * sb.length;
      const zb = z0 + ((i + 1) / segs) * sb.length;
      const ya = this.stoneDeckY(sb.x, za);
      const yb = this.stoneDeckY(sb.x, zb);
      const len = Math.hypot(zb - za, yb - ya);
      const tilt = -Math.atan2(yb - ya, zb - za);
      const deck = MeshBuilder.CreateBox('sb.deck', { width: sb.width, height: 0.4, depth: len + 0.05 }, scene);
      deck.rotation.x = tilt;
      deck.position.set(sb.x, (ya + yb) / 2 - 0.2, (za + zb) / 2);
      paintGradient(deck, '#A69C90', '#D6CBBB');
      parts.push(deck);
      for (const side of [-1, 1]) {
        const wall = MeshBuilder.CreateBox('sb.wall', { width: 0.3, height: 0.55, depth: len + 0.05 }, scene);
        wall.rotation.x = tilt;
        wall.position.set(sb.x + side * (sb.width / 2 - 0.05), (ya + yb) / 2 + 0.25, (za + zb) / 2);
        paintGradient(wall, '#B2A898', '#DCD2C2');
        parts.push(wall);
      }
    }
    // The walls block the sides; the bridge is entered only at its ends.
    for (let z = z0 + 0.5; z <= z1 - 0.5; z += 0.5) {
      for (const side of [-1, 1]) this.colliders.push({ x: sb.x + side * (sb.width / 2 + 0.1), z, radius: 0.3 });
    }

    // Arch beyond the chasm: two pillars and a round top. Its light opens when the bridge is ready.
    const ar = LAYOUT.arch;
    const arY = terrain.height(ar.x, ar.z) - 0.2;
    for (const side of [-1, 1]) {
      const pil = MeshBuilder.CreateBox('arch.pillar', { width: 0.95, height: 5.2, depth: 0.95 }, scene);
      pil.position.set(ar.x + side * 2.3, arY + 2.6, ar.z);
      paintGradient(pil, '#B9A58E', '#E3D2BA');
      parts.push(pil);
      const base = MeshBuilder.CreateBox('arch.base', { width: 1.25, height: 0.5, depth: 1.25 }, scene);
      base.position.set(ar.x + side * 2.3, arY + 0.25, ar.z);
      paintFlat(base, '#B5A18A');
      parts.push(base);
      this.colliders.push({ x: ar.x + side * 2.3, z: ar.z, radius: 0.8 });
    }
    const curve: Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      curve.push(new Vector3(ar.x + Math.cos(a) * 2.3, arY + 5.2 + Math.sin(a) * 2.3, ar.z));
    }
    const top = MeshBuilder.CreateTube('arch.top', { path: curve, radius: 0.46, tessellation: 7, cap: Mesh.CAP_ALL }, scene);
    paintGradient(top, '#D4C1A8', '#EDE0CA');
    parts.push(top);
    this.shadows.push({ x: ar.x, z: ar.z, radius: 3.5, strength: 0.25 });
    this.glow(scene, new Vector3(ar.x, arY + 3.4, ar.z), 7, 0.6, 0.8, true);
    this.glow(scene, new Vector3(ar.x, arY + 2.6, ar.z - 0.2), 3.6, 0.8, 1.1, true);

    // Broken pillars around the arch.
    for (const p of LAYOUT.pillars) {
      const y = terrain.height(p.x, p.z) - 0.15;
      const col = MeshBuilder.CreateCylinder('pillar', { height: p.height, diameter: 0.8, tessellation: 10 }, scene);
      col.position.set(p.x, y + p.height / 2, p.z);
      col.rotation.z = (p.x > 0 ? 1 : -1) * 0.04;
      paintGradient(col, '#B3A38F', '#E0D0B8');
      parts.push(col);
      this.colliders.push({ x: p.x, z: p.z, radius: 0.55 });
      this.shadows.push({ x: p.x, z: p.z, radius: 1.3, strength: 0.3 });
    }

    this.stone = Mesh.MergeMeshes(parts, true, true)!;
    this.stone.name = 'valley.landmarks';
    this.stone.material = materials.solid;
    this.stone.isPickable = false;
    this.stone.freezeWorldMatrix();

    this.rune = Mesh.MergeMeshes(runeParts, true, true)!;
    this.rune.name = 'valley.rune';
    this.rune.material = materials.unlit;
    this.rune.isPickable = false;
    this.rune.freezeWorldMatrix();
    runeRoot.dispose();
  }

  /** Deck height of the stone bridge at a point along it. */
  private stoneDeckY(_x: number, z: number): number {
    const sb = LAYOUT.stoneBridge;
    const t = (z - (sb.z - sb.length / 2)) / sb.length;
    return this.bridgeBaseY + 0.2 + 0.7 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  }

  /** The walkable height on the stone bridge, or null when the point is not on it. */
  stoneBridgeHeight(x: number, z: number): number | null {
    const sb = LAYOUT.stoneBridge;
    if (Math.abs(x - sb.x) > sb.width / 2 || Math.abs(z - sb.z) > sb.length / 2) return null;
    return this.stoneDeckY(x, z);
  }

  /** The point where the player walks through the arch. */
  get gatePoint(): Vector3 {
    return new Vector3(LAYOUT.arch.x, 0, LAYOUT.arch.z);
  }

  /** A soft warm light card that gently pulses. */
  private glow(scene: Scene, at: Vector3, size: number, strength: number, speed: number, gate = false): void {
    const mat = createPaperMaterial('valley.glowMat', scene, {
      texture: procTexture(scene, 'halo'),
      additive: true,
      haze: false,
      curve: false,
    });
    const card = MeshBuilder.CreatePlane('valley.glow', { size }, scene);
    card.billboardMode = TransformNode.BILLBOARDMODE_ALL;
    card.position.copyFrom(at);
    card.material = mat;
    card.isPickable = false;
    this.glows.push({ mat, base: strength, speed, phase: this.glows.length * 1.7, gate });
  }

  update(dt: number): void {
    this.time += dt;
    for (const g of this.glows) {
      const level = g.gate ? this.gateLevel : 1;
      const a = g.base * level * (0.82 + 0.18 * Math.sin(this.time * g.speed + g.phase));
      setPaperColor(g.mat, new Color4(1, 1, 1, a));
    }
  }
}
