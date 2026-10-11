import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE, SHADES } from '../config/palette';
import { createToonMaterial, type ToonMaterial } from '../shaders/toonShader';
import { createPaperMaterial, type PaperMaterial } from '../shaders/paperShader';
import { procTexture } from '../world/ProceduralTextures';
import { merge, paint } from '../player/PlayerVisual';
import type { CitizenColors, CitizenDef } from '../outer/townLayout';

/** Colour sets. Mixed everywhere; none of them means good or bad. */
const SETS: Record<CitizenColors, { tunic: string; sleeve: string; scarf: string; boots: string; hair: string }> = {
  earthy: { tunic: PALETTE.olive, sleeve: PALETTE.ivory, scarf: SHADES.scarf, boots: SHADES.umber, hair: SHADES.umber },
  muted: { tunic: PALETTE.stone, sleeve: PALETTE.ivory, scarf: PALETTE.powder, boots: SHADES.legs, hair: '#8A8378' },
  deep: { tunic: SHADES.cloakShadow, sleeve: PALETTE.sandstone, scarf: '#B9683A', boots: SHADES.umber, hair: SHADES.legs },
};

const SKIN = [PALETTE.sandstone, '#D79468', '#B97A55', '#E6B891'];

const HIP_Y = 0.36;
const SHOULDER_Y = 0.8;
const ARM_LEN = 0.3;

export interface CitizenVisualState {
  speed: number;
  heading: number;
  /** 0..1 */
  agitation: number;
  /** Kept for callers; every citizen is one mesh now, so there is nothing to drop. */
  far: boolean;
  /** Raise the right arm with the torch. */
  torchRaised: boolean;
}

/** One mesh with a soft blob quad per citizen: one draw call for all shadows. */
class ShadowBatch {
  static readonly MAX = 16;
  private readonly mesh: Mesh;
  private readonly pos = new Float32Array(ShadowBatch.MAX * 12);
  private used = 0;
  constructor(scene: Scene, mat: PaperMaterial) {
    const n = ShadowBatch.MAX;
    const nrm: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2);
    }
    const vd = new VertexData();
    vd.positions = this.pos;
    vd.normals = nrm;
    vd.uvs = uv;
    vd.indices = idx;
    this.mesh = new Mesh('citizens.shadows', scene);
    vd.applyToMesh(this.mesh, true);
    this.mesh.material = mat;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    scene.onBeforeRenderObservable.add(() => this.mesh.updateVerticesData(VertexBuffer.PositionKind, this.pos));
  }
  take(): number {
    return this.used++ % ShadowBatch.MAX;
  }
  set(slot: number, x: number, y: number, z: number, hw: number, hd: number): void {
    this.pos.set([x - hw, y, z - hd, x + hw, y, z - hd, x + hw, y, z + hd, x - hw, y, z + hd], slot * 12);
  }
}

interface Shared {
  mat: ToonMaterial;
  shadows: ShadowBatch;
}
const sharedCache = new WeakMap<Scene, Shared>();

function sharedFor(scene: Scene): Shared {
  let s = sharedCache.get(scene);
  if (!s) {
    const mat = createToonMaterial('citizens.figure', scene, new Color3(1, 1, 1), new Color3(0.66, 0.5, 0.5));
    mat.backFaceCulling = false;
    const shadow = createPaperMaterial('citizens.shadow', scene, { texture: procTexture(scene, 'shadow'), alphaBlend: true });
    s = { mat, shadows: new ShadowBatch(scene, shadow) };
    sharedCache.set(scene, s);
  }
  return s;
}

/** A body part that moves rigidly around a pivot: it is posed on the CPU into the one vertex buffer. */
interface Part {
  start: number;
  count: number;
  basePos: Float32Array;
  baseNrm: Float32Array;
  px: number;
  py: number;
  pz: number;
}

interface Source {
  pos: Float32Array;
  nrm: Float32Array;
  col: Float32Array;
  idx: number[];
  pivot: [number, number, number];
}

function grab(m: Mesh, pivot: [number, number, number]): Source {
  const r: Source = {
    pos: new Float32Array(m.getVerticesData(VertexBuffer.PositionKind)!),
    nrm: new Float32Array(m.getVerticesData(VertexBuffer.NormalKind)!),
    col: new Float32Array(m.getVerticesData(VertexBuffer.ColorKind)!),
    idx: Array.from(m.getIndices()!),
    pivot,
  };
  m.dispose();
  return r;
}

/**
 * A townsperson. Same building blocks as the player figure (painted vertex colours,
 * one shared toon material), but: hood down, a simple head with hair or cap, optional beard,
 * no diamond. ONE mesh per citizen: body, legs and arms are posed on the CPU into one
 * vertex buffer (a few hundred vertices). All shadows share one more mesh. No scarf physics.
 * Anger reads through posture: stomping, raised fists, forward lean.
 */
export class CitizenVisual {
  readonly root: TransformNode;
  /** Mount point for the torch: follows the right hand, always upright. */
  readonly torchMount: TransformNode;
  private readonly mesh: Mesh;
  private readonly bodyPart: Part;
  private readonly legs: Part[] = [];
  private readonly arms: Part[] = [];
  private readonly pos: Float32Array;
  private readonly nrm: Float32Array;
  private readonly shadows: ShadowBatch;
  private readonly shadowSlot: number;
  private readonly shadowScale: number;
  private phase = 0;
  private time = 0;
  private readonly seedPhase: number;
  private lean = 0;
  private raise = 0;

  constructor(scene: Scene, def: CitizenDef) {
    const set = SETS[def.colors];
    const { mat, shadows } = sharedFor(scene);
    this.seedPhase = def.seed * 1.7;
    this.root = new TransformNode(`citizen${def.seed}`, scene);
    this.root.scaling.setAll(def.scale * 1.1);
    const skin = SKIN[def.seed % SKIN.length]!;

    // Body: tunic, neck scarf with a tail, head, hair/cap, optional beard.
    const parts: Mesh[] = [];
    const tunic = paint(MeshBuilder.CreateCylinder('t', { diameterTop: 0.3, diameterBottom: 0.46, height: 0.55, tessellation: 14 }, scene), set.tunic);
    tunic.position.y = 0.58;
    parts.push(tunic);
    const wrap = paint(MeshBuilder.CreateTorus('w', { diameter: 0.27, thickness: 0.1, tessellation: 14 }, scene), set.scarf);
    wrap.position.y = 0.84;
    parts.push(wrap);
    const tail = paint(MeshBuilder.CreateBox('st', { width: 0.1, height: 0.34, depth: 0.04 }, scene), set.scarf);
    tail.position.set(0.07, 0.68, -0.15);
    tail.rotation.x = 0.15;
    parts.push(tail);
    const head = paint(MeshBuilder.CreateSphere('h', { diameter: 0.3, segments: 10 }, scene), skin);
    head.position.y = 1.0;
    parts.push(head);
    if (def.head === 'hair') {
      const hair = paint(MeshBuilder.CreateSphere('hr', { diameter: 0.33, segments: 10, slice: 0.6 }, scene), set.hair);
      hair.position.set(0, 1.01, -0.015);
      parts.push(hair);
    } else if (def.head === 'cap') {
      const cap = paint(MeshBuilder.CreateSphere('cp', { diameter: 0.34, segments: 10, slice: 0.5 }, scene), def.colors === 'earthy' ? PALETTE.sandstone : set.scarf);
      cap.position.set(0, 1.03, 0);
      parts.push(cap);
      const brim = paint(MeshBuilder.CreateBox('cb', { width: 0.24, height: 0.025, depth: 0.12 }, scene), set.hair);
      brim.position.set(0, 1.04, 0.15);
      parts.push(brim);
    }
    if (def.beard) {
      const beard = paint(MeshBuilder.CreateBox('bd', { width: 0.2, height: 0.12, depth: 0.1 }, scene), set.hair);
      beard.position.set(0, 0.93, 0.095);
      parts.push(beard);
    }
    const sources: Source[] = [grab(merge('b', parts), [0, 0, 0])];

    // Legs with boots, hinged at the hip.
    for (const side of [-1, 1]) {
      const leg = paint(MeshBuilder.CreateCylinder('l', { diameter: 0.09, height: HIP_Y - 0.06, tessellation: 8 }, scene), SHADES.legs);
      leg.bakeTransformIntoVertices(Matrix.Translation(0, -(HIP_Y - 0.06) / 2, 0));
      const boot = paint(MeshBuilder.CreateSphere('b', { diameter: 0.18, segments: 8 }, scene), set.boots);
      boot.bakeTransformIntoVertices(Matrix.Scaling(0.62, 0.5, 1.1).multiply(Matrix.Translation(0, -(HIP_Y - 0.05), 0.03)));
      sources.push(grab(merge('leg', [leg, boot]), [0.08 * side, HIP_Y, 0]));
    }
    // Arms: sleeves with a hand, hinged at the shoulder.
    for (const side of [-1, 1]) {
      const sleeve = paint(MeshBuilder.CreateCylinder('s', { diameterTop: 0.1, diameterBottom: 0.085, height: ARM_LEN, tessellation: 8 }, scene), set.sleeve);
      sleeve.bakeTransformIntoVertices(Matrix.Translation(0, -ARM_LEN / 2, 0));
      const hand = paint(MeshBuilder.CreateSphere('hd', { diameter: 0.1, segments: 6 }, scene), skin);
      hand.position.y = -ARM_LEN;
      sources.push(grab(merge('arm', [sleeve, hand]), [0.19 * side, SHOULDER_Y, 0]));
    }

    // Concatenate everything into one mesh.
    const total = sources.reduce((n, p) => n + p.pos.length / 3, 0);
    this.pos = new Float32Array(total * 3);
    this.nrm = new Float32Array(total * 3);
    const col = new Float32Array(total * 4);
    const idx: number[] = [];
    const all: Part[] = [];
    let v = 0;
    for (const src of sources) {
      const count = src.pos.length / 3;
      this.nrm.set(src.nrm, v * 3);
      col.set(src.col, v * 4);
      for (const i of src.idx) idx.push(i + v);
      all.push({ start: v, count, basePos: src.pos, baseNrm: src.nrm, px: src.pivot[0], py: src.pivot[1], pz: src.pivot[2] });
      v += count;
    }
    this.bodyPart = all[0]!;
    this.legs.push(all[1]!, all[2]!);
    this.arms.push(all[3]!, all[4]!);
    this.poseAll(0, 0, 0, 0, 0, 0, 0, 0);
    const vd = new VertexData();
    vd.positions = this.pos;
    vd.normals = this.nrm;
    vd.colors = col;
    vd.indices = idx;
    this.mesh = new Mesh(`citizen${def.seed}.mesh`, scene);
    vd.applyToMesh(this.mesh, true);
    this.mesh.material = mat;
    this.mesh.parent = this.root;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;

    this.torchMount = new TransformNode('citizen.torchMount', scene);
    this.torchMount.parent = this.root;
    this.torchMount.position.set(0.19, SHOULDER_Y - ARM_LEN, 0.02);

    this.shadows = shadows;
    this.shadowSlot = shadows.take();
    this.shadowScale = def.scale * 1.1;
  }

  /** Writes the pose into the buffers. Angles are rotations around X; lifts are in metres. */
  private poseAll(lean: number, bodyY: number, legL: number, legR: number, legLy: number, legRy: number, armL: number, armR: number): void {
    this.poseOne(this.bodyPart, lean, bodyY);
    this.poseOne(this.legs[0]!, legL, legLy);
    this.poseOne(this.legs[1]!, legR, legRy);
    this.poseOne(this.arms[0]!, armL, 0);
    this.poseOne(this.arms[1]!, armR, 0);
  }

  private poseOne(p: Part, ang: number, lift: number): void {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const bp = p.basePos;
    const bn = p.baseNrm;
    for (let i = 0; i < p.count; i++) {
      const k = i * 3;
      const o = (p.start + i) * 3;
      const y = bp[k + 1]!;
      const z = bp[k + 2]!;
      this.pos[o] = bp[k]! + p.px;
      this.pos[o + 1] = y * c - z * s + p.py + lift;
      this.pos[o + 2] = y * s + z * c + p.pz;
      const ny = bn[k + 1]!;
      const nz = bn[k + 2]!;
      this.nrm[o] = bn[k]!;
      this.nrm[o + 1] = ny * c - nz * s;
      this.nrm[o + 2] = ny * s + nz * c;
    }
  }

  update(dt: number, s: CitizenVisualState): void {
    this.time += dt;
    const a = s.agitation;
    this.root.rotation.y = s.heading;
    const walking = Math.min(1, s.speed / 1.2);
    // Walking advances the step; angry standing still stomps in place.
    const stomping = a > 0.3 ? 1 : 0;
    const stompRate = stomping ? 5 + a * 4 : 0;
    this.phase += s.speed * dt * 4.5 + (1 - walking) * stompRate * dt;
    const swing = Math.sin(this.phase);
    const active = Math.max(walking, stomping);
    const amp = walking * 0.5 + (1 - walking) * stomping * (0.25 + a * 0.35);
    const bob = Math.abs(Math.cos(this.phase)) * (0.015 + 0.02 * a) * active;
    const idle = Math.sin(this.time * 1.5 + this.seedPhase) * 0.01 * (1 - walking);

    // Anger leans the body forward.
    const wantLean = a * 0.18 + walking * 0.05;
    this.lean += (wantLean - this.lean) * Math.min(1, dt * 5);

    // Calm: arms swing. Angry: fists come up and shake. The torch arm lifts the torch.
    const fist = Math.max(0, (a - 0.25) / 0.75);
    const shake = Math.sin(this.time * 18 + this.seedPhase) * 0.12 * fist;
    this.raise += ((s.torchRaised ? 2.5 : 0) - this.raise) * Math.min(1, dt * 4);
    const armL = swing * 0.45 * walking * (1 - fist) - fist * (1.1 + shake);
    const free = -swing * 0.45 * walking * (1 - fist) - fist * (1.1 - shake);
    const armR = s.torchRaised ? -this.raise + shake : free;

    this.poseAll(
      this.lean,
      bob + idle,
      swing * amp,
      -swing * amp,
      Math.max(0, Math.cos(this.phase)) * 0.03 * active,
      Math.max(0, -Math.cos(this.phase)) * 0.03 * active,
      armL,
      armR,
    );
    this.mesh.updateVerticesData(VertexBuffer.PositionKind, this.pos);
    this.mesh.updateVerticesData(VertexBuffer.NormalKind, this.nrm);

    // The torch sits in the right hand and stays upright.
    this.torchMount.position.set(0.19, SHOULDER_Y - ARM_LEN * Math.cos(armR), -ARM_LEN * Math.sin(armR) + 0.02);

    const p = this.root.position;
    this.shadows.set(this.shadowSlot, p.x, p.y + 0.03, p.z, 0.4 * this.shadowScale, 0.33 * this.shadowScale);
  }

  dispose(): void {
    this.root.dispose(false, false);
  }
}
