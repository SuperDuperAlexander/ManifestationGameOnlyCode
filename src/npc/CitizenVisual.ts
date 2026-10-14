import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE, SHADES } from '../config/palette';
import { TUNING } from '../config/tuning';
import { createToonMaterial, type ToonMaterial } from '../shaders/toonShader';
import { createPaperMaterial, type PaperMaterial } from '../shaders/paperShader';
import { procTexture } from '../world/ProceduralTextures';
import { merge, paint } from '../player/PlayerVisual';
import type { CitizenDef } from '../outer/townLayout';
import { citizenAppearance, type CitizenAppearance } from './CitizenAppearance';

export interface CitizenVisualState {
  speed: number;
  heading: number;
  /** 0..1. This changes the pose, never the clothes or identity. */
  agitation: number;
  far: boolean;
  torchRaised: boolean;
}

/** All citizens share one shadow draw. Released slots cannot leave stale shadows. */
class ShadowBatch {
  static readonly MAX = 16;
  private readonly mesh: Mesh;
  private readonly pos = new Float32Array(ShadowBatch.MAX * 12);
  private readonly slots = new Set<number>();
  constructor(scene: Scene, mat: PaperMaterial) {
    const normals: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i < ShadowBatch.MAX; i++) {
      normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2);
    }
    const data = new VertexData();
    data.positions = this.pos; data.normals = normals; data.uvs = uvs; data.indices = indices;
    this.mesh = new Mesh('citizens.shadows', scene);
    data.applyToMesh(this.mesh, true);
    this.mesh.material = mat;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    scene.onBeforeRenderObservable.add(() => this.mesh.updateVerticesData(VertexBuffer.PositionKind, this.pos));
  }
  take(): number {
    for (let i = 0; i < ShadowBatch.MAX; i++) {
      if (!this.slots.has(i)) { this.slots.add(i); return i; }
    }
    return -1;
  }
  release(slot: number): void {
    if (slot < 0) return;
    this.slots.delete(slot);
    this.pos.fill(0, slot * 12, slot * 12 + 12);
  }
  set(slot: number, x: number, y: number, z: number, hw: number, hd: number): void {
    if (slot < 0) return;
    this.pos.set([x - hw, y, z - hd, x + hw, y, z - hd, x + hw, y, z + hd, x - hw, y, z + hd], slot * 12);
  }
}

interface Shared { mat: ToonMaterial; shadows: ShadowBatch }
const sharedCache = new WeakMap<Scene, Shared>();
function sharedFor(scene: Scene): Shared {
  let shared = sharedCache.get(scene);
  if (!shared) {
    const mat = createToonMaterial('citizens.figure', scene, new Color3(1, 1, 1), new Color3(0.66, 0.5, 0.5));
    mat.backFaceCulling = false;
    const shadow = createPaperMaterial('citizens.shadow', scene, { texture: procTexture(scene, 'shadow'), alphaBlend: true });
    shared = { mat, shadows: new ShadowBatch(scene, shadow) };
    sharedCache.set(scene, shared);
  }
  return shared;
}

type JointName = 'body' | 'head' | 'browL' | 'browR' | 'mouth' | 'legL' | 'legR' | 'armL' | 'armR' | 'foreL' | 'foreR' | 'handR';
type ColourKey = keyof CitizenAppearance | 'ink' | 'gold' | 'mouthInside';
interface ColourRun { start: number; count: number; key: ColourKey; shade: number }
interface Part { joint: JointName; start: number; count: number; pos: Float32Array; nrm: Float32Array }
interface Source { joint: JointName; mesh: Mesh; runs: ColourRun[] }

/** A faceted ring loft. The hem can have soft points instead of a cylinder edge. */
function cloth(scene: Scene, rings: readonly [number, number, number][], hem = false): Mesh {
  const positions: number[] = [], indices: number[] = [], normals: number[] = [];
  const n = 12;
  const point = (ring: number, side: number): number[] => {
    const theta = side / n * Math.PI * 2;
    const [y, width, depth] = rings[ring]!;
    return [Math.sin(theta) * width, y + (hem && ring === 0 ? Math.cos(theta * 3) * 0.016 : 0), Math.cos(theta) * depth];
  };
  for (let r = 0; r < rings.length - 1; r++) {
    for (let s = 0; s < n; s++) {
      const v = positions.length / 3;
      positions.push(...point(r, s), ...point(r, s + 1), ...point(r + 1, s + 1), ...point(r + 1, s));
      indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
  }
  // Hidden caps close the tunic and belt, including in raised-arm views.
  for (const r of [0, rings.length - 1]) {
    const centre = positions.length / 3;
    positions.push(0, rings[r]![0], 0);
    for (let s = 0; s <= n; s++) positions.push(...point(r, s));
    for (let s = 0; s < n; s++) indices.push(centre, centre + s + 1, centre + s + 2);
  }
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions; data.normals = normals; data.indices = indices;
  const mesh = new Mesh('citizen.cloth', scene);
  data.applyToMesh(mesh);
  return mesh;
}

/** Thick cloth strips have a folded outline on both sides and need no texture. */
function scarfTail(scene: Scene, points: readonly [number, number, number][], width: number): Mesh {
  const positions: number[] = [], indices: number[] = [], normals: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y, z] = points[i]!;
    const w = width * (i === points.length - 1 ? 0.72 : 1);
    positions.push(x - w / 2, y, z, x, y, z + 0.015, x + w / 2, y, z);
    if (i) {
      const a = (i - 1) * 3, b = i * 3;
      indices.push(a, b, b + 1, a, b + 1, a + 1, a + 1, b + 1, b + 2, a + 1, b + 2, a + 2);
    }
  }
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions; data.normals = normals; data.indices = indices;
  const mesh = new Mesh('citizen.scarfTail', scene);
  data.applyToMesh(mesh);
  return mesh;
}

/** One shared-material body mesh. All joints are posed into its existing buffers. */
export class CitizenVisual {
  readonly root: TransformNode;
  readonly torchMount: TransformNode;
  private readonly mesh: Mesh;
  private readonly parts: Part[] = [];
  private readonly colourRuns: ColourRun[] = [];
  private readonly pos: Float32Array;
  private readonly nrm: Float32Array;
  private readonly colours: Float32Array;
  private appearance: CitizenAppearance;
  private readonly joints = {} as Record<JointName, Matrix>;
  private readonly shadows: ShadowBatch;
  private readonly shadowSlot: number;
  private readonly shadowScale: number;
  private readonly seedPhase: number;
  private readonly mouthDepth: number;
  private readonly shadowPosition = Vector3.Zero();
  private readonly grip = new Vector3(0, -TUNING.citizens.visual.armLength * 0.42 * 0.28 + 0.01, 0.018);
  private readonly torchPose = Matrix.Identity();
  private phase = 0;
  private time = 0;
  private agitation = 0;
  private raise = 0;
  private farElapsed = 0;
  private disposed = false;

  constructor(scene: Scene, def: CitizenDef, appearance: Partial<CitizenAppearance> = {}) {
    const cfg = TUNING.citizens.visual;
    const female = def.gender === 'female';
    const beard = def.beard && !female;
    this.appearance = citizenAppearance(def.colors, def.seed, appearance);
    this.seedPhase = def.seed * 1.7;
    this.mouthDepth = cfg.headSize * (beard ? 0.50 : 0.43);
    this.root = new TransformNode(`citizen${def.seed}`, scene);
    this.root.scaling.setAll(def.scale * cfg.scale);
    this.shadowScale = def.scale * cfg.scale;
    const sources: Source[] = [];
    const hip = cfg.hipY;
    const headY = cfg.shoulderY + cfg.headSize * 0.69;
    const upper = cfg.armLength * 0.58;
    const lower = cfg.armLength * 0.42;
    const h = cfg.headSize;
    let group: Mesh[] = [], runs: ColourRun[] = [], groupCount = 0;
    const add = (mesh: Mesh, key: ColourKey, x = 0, y = 0, z = 0, shade = 1): Mesh => {
      mesh.position.set(x, y, z);
      // The figure shader uses position, normal and colour only.
      // Primitive builders add UVs; custom cloth does not. Match before merging.
      mesh.removeVerticesData(VertexBuffer.UVKind);
      paint(mesh, key === 'ink' ? SHADES.umber : key === 'gold' ? PALETTE.gold : key === 'mouthInside' ? SHADES.cloakShadow : this.appearance[key]);
      runs.push({ start: groupCount, count: mesh.getTotalVertices(), key, shade });
      groupCount += mesh.getTotalVertices(); group.push(mesh);
      return mesh;
    };
    const finish = (joint: JointName): void => {
      sources.push({ joint, mesh: merge(`citizen.${joint}`, group), runs });
      this.joints[joint] = Matrix.Identity();
      group = []; runs = []; groupCount = 0;
    };
    const box = (w: number, height: number, d: number): Mesh => MeshBuilder.CreateBox('citizen.block', { width: w, height, depth: d }, scene);
    const round = (rx: number, ry: number, rz: number, detail = 1): Mesh => {
      const mesh = MeshBuilder.CreateIcoSphere('citizen.facet', { radius: 1, subdivisions: detail, flat: true }, scene);
      mesh.bakeTransformIntoVertices(Matrix.Scaling(rx, ry, rz)); return mesh;
    };
    const tube = (top: number, bottom: number, height: number): Mesh => MeshBuilder.CreateCylinder('citizen.fold', { diameterTop: top, diameterBottom: bottom, height, tessellation: 10 }, scene);

    // Shoulder, waist and flared hem give the tunic a sewn silhouette.
    const base = cfg.shoulderY - cfg.bodyHeight - (female ? cfg.female.hemDrop : 0);
    const hemWidth = female ? cfg.female.hemWidth : 0.235;
    add(cloth(scene, [[base - hip, hemWidth, 0.148], [0.56 - hip, 0.158, 0.115], [0.72 - hip, 0.185, 0.135], [cfg.shoulderY + 0.025 - hip, 0.176, 0.105]], true), 'tunic');
    add(cloth(scene, [[base - hip + 0.014, hemWidth + 0.001, 0.15], [base - hip + 0.036, hemWidth - 0.005, 0.146]], true), 'tunic', 0, 0, 0, 0.78);
    add(box(0.012, 0.175, 0.012), 'tunic', 0, 0.43 - hip, 0.145, 0.77);
    add(cloth(scene, [[0.555 - hip, 0.166, 0.123], [0.607 - hip, 0.168, 0.125]]), 'belt');
    add(box(0.055, 0.047, 0.018), 'gold', 0.015, 0.581 - hip, 0.132);
    add(box(0.031, 0.026, 0.021), 'belt', 0.015, 0.581 - hip, 0.138);
    add(box(0.036, 0.10, 0.016), 'belt', 0.055, 0.513 - hip, 0.126).rotation.z = 0.14;
    add(tube(0.10, 0.12, 0.11), 'skin', 0, cfg.shoulderY + 0.065 - hip);
    const collar = add(MeshBuilder.CreateTorus('citizen.scarf', { diameter: 0.23, thickness: 0.085, tessellation: 12 }, scene), 'scarf', 0, cfg.shoulderY + 0.035 - hip, 0.006);
    collar.scaling.set(1.12, 0.8, 0.86);
    add(scarfTail(scene, [[-0.13, 0.83 - hip, 0.04], [0.02, 0.765 - hip, 0.145], [0.14, 0.80 - hip, 0.07]], 0.095), 'scarf', 0, 0, 0, 1.05);
    add(scarfTail(scene, [[-0.06, 0.82 - hip, -0.12], [-0.10, 0.70 - hip, -0.165], [-0.15, 0.53 - hip, -0.18]], 0.105), 'scarf');
    add(scarfTail(scene, [[0.055, 0.82 - hip, -0.125], [0.08, 0.69 - hip, -0.17], [0.05, 0.59 - hip, -0.19]], 0.075), 'scarf', 0, 0, 0, 0.86);
    finish('body');

    // The face looks toward +Z. Large planes do the work, with only a few marks.
    add(round(h * 0.47 * (female ? cfg.female.headWidth : 1), h * 0.54 * (female ? cfg.female.headHeight : 1), h * 0.43, 2), 'skin');
    for (const side of [-1, 1]) {
      add(round(h * 0.12, h * 0.17, h * 0.105), 'skin', side * h * 0.47, -h * 0.025, -h * 0.005);
      add(round(h * 0.032, h * 0.068, h * 0.024), 'skin', side * h * 0.53, -h * 0.025, h * 0.075, 0.8);
      add(round(h * 0.025, h * 0.053, h * 0.02), 'ink', side * h * 0.175, h * 0.035, h * 0.413);
    }
    add(round(h * 0.09, h * 0.105, h * 0.12), 'skin', 0, -h * 0.05, h * 0.44, 1.07);
    if (def.head === 'hair') {
      add(round(h * 0.49, h * 0.30, h * 0.44, 2), 'hair', 0, h * 0.34, -h * 0.065);
      for (const side of [-1, 1]) {
        add(round(h * 0.17, h * (female ? 0.38 : 0.23), h * 0.22), 'hair', side * h * 0.34, h * (female ? 0.04 : 0.18), -h * 0.18);
        add(round(h * 0.19, h * 0.10, h * 0.17), 'hair', side * h * 0.21, h * 0.37, h * 0.23).rotation.z = side * 0.25;
      }
    } else if (def.head === 'cap') {
      add(round(h * 0.51, h * 0.29, h * 0.46, 2), 'tunic', -h * 0.025, h * 0.37, -h * 0.045);
      add(tube(h * 0.96, h * 0.96, h * 0.08), 'tunic', 0, h * 0.28, -h * 0.01, 0.8).scaling.z = 0.89;
      add(round(h * 0.37, h * 0.035, h * 0.21), 'tunic', 0, h * 0.27, h * 0.30, 0.9);
    }
    if (female && def.head !== 'bald') {
      // A few broad facets make tied hair readable, including below a cap.
      // The seed fixes the hairstyle across calm and angry poses.
      if (def.head === 'cap') {
        for (const side of [-1, 1]) {
          add(round(h * 0.13, h * 0.31, h * 0.20), 'hair', side * h * 0.39, -h * 0.035, -h * 0.17);
        }
      }
      if (def.seed % 2 === 0) {
        // Three large overlapping lobes read as a practical side braid.
        for (let i = 0; i < 3; i++) {
          add(round(h * (0.17 - i * 0.025), h * 0.18, h * 0.15), 'hair', -h * (0.43 + i * 0.015), -h * (0.26 + i * 0.22), -h * 0.11, 1 - i * 0.04);
        }
        add(tube(h * 0.18, h * 0.18, h * 0.065), 'scarf', -h * 0.46, -h * 0.78, -h * 0.11);
      } else {
        add(round(h * 0.30, h * 0.28, h * 0.26), 'hair', -h * 0.32, h * 0.05, -h * 0.47);
        add(round(h * 0.22, h * 0.20, h * 0.12), 'hair', -h * 0.36, h * 0.05, -h * 0.65, 0.9);
      }
    }
    if (beard) {
      add(round(h * 0.40, h * 0.24, h * 0.20, 2), 'hair', 0, -h * 0.31, h * 0.25);
      for (const side of [-1, 1]) {
        add(round(h * 0.13, h * 0.20, h * 0.13), 'hair', side * h * 0.30, -h * 0.19, h * 0.245);
        add(round(h * 0.18, h * 0.055, h * 0.06), 'hair', side * h * 0.13, -h * 0.15, h * 0.437).rotation.z = side * 0.18;
      }
    }
    finish('head');
    for (const side of [-1, 1]) {
      add(box(h * 0.21, h * 0.047, h * 0.04), 'hair');
      finish(side < 0 ? 'browL' : 'browR');
    }
    // Eight boundary vertices let one mouth pass from a smile to a soft open shout.
    const mouth = new Mesh('citizen.mouth', scene);
    const mouthData = new VertexData();
    mouthData.positions = Array.from({ length: 8 }, (_, i) => [Math.cos(i / 8 * Math.PI * 2) * h * 0.12, Math.sin(i / 8 * Math.PI * 2) * h * 0.025, 0]).flat();
    mouthData.indices = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 7];
    mouthData.normals = Array.from({ length: 8 }, () => [0, 0, 1]).flat();
    mouthData.applyToMesh(mouth);
    add(mouth, 'mouthInside'); finish('mouth');

    for (const side of [-1, 1]) {
      add(tube(0.125, 0.095, hip * 0.65), 'trousers', 0, -hip * 0.30);
      add(tube(0.12, 0.115, hip * 0.43), 'boots', 0, -hip * 0.68);
      add(tube(0.151, 0.145, hip * 0.14), 'boots', 0, -hip * 0.51, 0, 1.12);
      add(round(0.069, 0.045, 0.115, 2), 'boots', 0, -hip + 0.049, 0.032);
      add(box(0.131, 0.025, 0.196), 'boots', 0, -hip + 0.018, 0.03, 0.72);
      finish(side < 0 ? 'legL' : 'legR');
      add(tube(0.145, 0.125, upper), 'sleeve', 0, -upper / 2);
      add(tube(0.146, 0.144, 0.038), 'sleeve', 0, -upper + 0.015, 0, 0.86);
      add(round(0.067, 0.066, 0.066), 'sleeve', 0, -0.025);
      finish(side < 0 ? 'armL' : 'armR');
      add(tube(0.087, 0.07, lower * 0.71), 'skin', 0, -lower * 0.30);
      if (side > 0) finish('foreR');
      const wrist = side > 0 ? lower * 0.72 : 0;
      add(round(0.053, 0.06, 0.047, 2), 'skin', 0, -lower + wrist + 0.01, 0.007);
      add(round(0.024, 0.033, 0.033), 'skin', -side * 0.039, -lower + wrist + 0.02, 0.03, 1.04);
      add(box(0.069, 0.022, 0.015), 'skin', 0, -lower + wrist + 0.015, 0.046, 1.06);
      finish(side < 0 ? 'foreL' : 'handR');
    }

    const total = sources.reduce((n, source) => n + source.mesh.getTotalVertices(), 0);
    this.pos = new Float32Array(total * 3); this.nrm = new Float32Array(total * 3); this.colours = new Float32Array(total * 4);
    const indices: number[] = [];
    let offset = 0;
    for (const source of sources) {
      const count = source.mesh.getTotalVertices();
      this.parts.push({ joint: source.joint, start: offset, count, pos: new Float32Array(source.mesh.getVerticesData(VertexBuffer.PositionKind)!), nrm: new Float32Array(source.mesh.getVerticesData(VertexBuffer.NormalKind)!) });
      for (const run of source.runs) this.colourRuns.push({ ...run, start: run.start + offset });
      for (const index of source.mesh.getIndices()!) indices.push(index + offset);
      offset += count; source.mesh.dispose();
    }
    const data = new VertexData();
    data.positions = this.pos; data.normals = this.nrm; data.colors = this.colours; data.indices = indices;
    this.mesh = new Mesh(`citizen${def.seed}.mesh`, scene);
    data.applyToMesh(this.mesh, true);
    const shared = sharedFor(scene);
    this.mesh.material = shared.mat;
    this.mesh.parent = this.root;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.torchMount = new TransformNode('citizen.torchMount', scene);
    this.torchMount.parent = this.root;
    this.torchMount.rotationQuaternion = Quaternion.Identity();
    this.torchMount.scaling.setAll(cfg.torchScale);
    this.shadows = shared.shadows;
    this.shadowSlot = this.shadows.take();
    this.setAppearance({});
    this.pose(0, 0, headY, upper);
  }

  /** Repaint the existing buffer. No shape, seed, mesh or material is replaced. */
  setAppearance(overrides: Partial<CitizenAppearance>): void {
    this.appearance = { ...this.appearance, ...overrides };
    for (const run of this.colourRuns) {
      const hex = run.key === 'ink' ? SHADES.umber : run.key === 'gold' ? PALETTE.gold : run.key === 'mouthInside' ? SHADES.cloakShadow : this.appearance[run.key];
      const color = Color3.FromHexString(hex);
      for (let i = run.start; i < run.start + run.count; i++) this.colours.set([color.r * run.shade, color.g * run.shade, color.b * run.shade, 1], i * 4);
    }
    this.mesh.updateVerticesData(VertexBuffer.ColorKind, this.colours);
  }

  private joint(name: JointName, parent: JointName | null, x: number, y: number, z: number, rx = 0, rz = 0): void {
    const matrix = this.joints[name];
    Matrix.RotationYawPitchRollToRef(0, rx, rz, matrix);
    matrix.setTranslationFromFloats(x, y, z);
    if (parent) matrix.multiplyToRef(this.joints[parent], matrix);
  }

  private pose(walking: number, swing: number, headY: number, upper: number): void {
    const cfg = TUNING.citizens.visual;
    const a = this.agitation;
    const fist = Math.max(0, (a - 0.2) / 0.8);
    const idle = Math.sin(this.time * 1.5 + this.seedPhase) * cfg.calmSway * (1 - walking);
    const stomp = Math.max(walking, fist);
    const bob = Math.abs(Math.cos(this.phase)) * (0.012 + a * 0.016) * stomp;
    const shake = Math.sin(this.time * 15 + this.seedPhase) * 0.045 * fist;
    this.joint('body', null, 0, cfg.hipY + bob + idle, 0, a * cfg.angryLean + walking * 0.035, idle * 0.7);
    this.joint('head', 'body', 0, headY - cfg.hipY, 0, -a * 0.065);
    for (const side of [-1, 1]) {
      const left = side < 0;
      this.joint(left ? 'browL' : 'browR', 'head', side * cfg.headSize * 0.18, cfg.headSize * (0.16 - a * 0.022), cfg.headSize * 0.412, 0, side * (a * 0.38 - 0.06));
      this.joint(left ? 'legL' : 'legR', null, side * 0.092, cfg.hipY + Math.max(0, side * Math.cos(this.phase)) * 0.025 * stomp, 0, side * swing * (walking * 0.40 + fist * 0.18), -side * 0.035);
      const arm = left ? 'armL' : 'armR';
      const fore = left ? 'foreL' : 'foreR';
      const normalArm = -side * swing * 0.35 * walking * (1 - fist) - fist * (0.60 + side * shake);
      const raised = left ? 0 : this.raise;
      const carrySway = Math.sin(this.time * cfg.torchSwayRate + this.seedPhase) * cfg.torchSway;
      const angle = normalArm * (1 - raised) + (cfg.torchUpperPitch + carrySway) * raised;
      const roll = side * (0.10 + fist * 0.19) * (1 - raised) + cfg.torchUpperRoll * raised;
      this.joint(arm, 'body', side * 0.213, cfg.shoulderY - cfg.hipY, 0, angle, roll);
      const elbow = (-0.10 - fist * 0.95) * (1 - raised) + cfg.torchElbowPitch * raised;
      this.joint(fore, arm, 0, -upper, 0, elbow, cfg.torchElbowRoll * raised);
      if (!left) this.joint('handR', 'foreR', 0, -cfg.armLength * 0.42 * 0.72, 0, cfg.torchWristPitch * raised);
    }
    this.joint('mouth', 'head', 0, -cfg.headSize * 0.245, this.mouthDepth + cfg.headSize * a * 0.012);
    for (const part of this.parts) {
      const m = this.joints[part.joint].m;
      for (let i = 0; i < part.count; i++) {
        const j = i * 3, out = (part.start + i) * 3;
        let x = part.pos[j]!, y = part.pos[j + 1]!, z = part.pos[j + 2]!;
        if (part.joint === 'mouth') {
          // Small smile corners rise; the same outline opens as anger rises.
          y = y * (1 + a * 4.5) + (Math.abs(x) / (cfg.headSize * 0.12)) ** 2 * cfg.headSize * 0.035 * (1 - a);
        }
        this.pos[out] = x * m[0]! + y * m[4]! + z * m[8]! + m[12]!;
        this.pos[out + 1] = x * m[1]! + y * m[5]! + z * m[9]! + m[13]!;
        this.pos[out + 2] = x * m[2]! + y * m[6]! + z * m[10]! + m[14]!;
        x = part.nrm[j]!; y = part.nrm[j + 1]!; z = part.nrm[j + 2]!;
        this.nrm[out] = x * m[0]! + y * m[4]! + z * m[8]!;
        this.nrm[out + 1] = x * m[1]! + y * m[5]! + z * m[9]!;
        this.nrm[out + 2] = x * m[2]! + y * m[6]! + z * m[10]!;
      }
    }
    this.mesh.updateVerticesData(VertexBuffer.PositionKind, this.pos);
    this.mesh.updateVerticesData(VertexBuffer.NormalKind, this.nrm);
    // The shaft crosses the same closed hand that supplies its mount transform.
    Vector3.TransformCoordinatesToRef(this.grip, this.joints.handR, this.torchMount.position);
    Matrix.RotationXToRef(cfg.torchGripPitch * this.raise, this.torchPose);
    this.torchPose.multiplyToRef(this.joints.handR, this.torchPose);
    Quaternion.FromRotationMatrixToRef(this.torchPose, this.torchMount.rotationQuaternion!);
    const axis = this.torchPose.m;
    this.torchMount.position.x -= axis[4]! * cfg.torchHandleBelowGrip;
    this.torchMount.position.y -= axis[5]! * cfg.torchHandleBelowGrip;
    this.torchMount.position.z -= axis[6]! * cfg.torchHandleBelowGrip;
  }

  update(dt: number, state: CitizenVisualState): void {
    const cfg = TUNING.citizens.visual;
    this.time += dt;
    const k = 1 - Math.exp(-Math.max(0, dt) * 5);
    this.agitation += (Math.min(1, Math.max(0, state.agitation)) - this.agitation) * k;
    this.raise += ((state.torchRaised ? 1 : 0) - this.raise) * k;
    this.root.rotation.y = state.heading;
    const walking = Math.min(1, Math.max(0, state.speed) / 1.2);
    this.phase += dt * (Math.max(0, state.speed) * cfg.stepRate + (1 - walking) * Math.max(0, this.agitation - 0.3) * 8);
    this.farElapsed += dt;
    // Keep walking time continuous, but pose distant figures at 12 updates/second.
    if (!state.far || this.farElapsed >= 1 / 12) {
      this.farElapsed = 0;
      this.pose(walking, Math.sin(this.phase), cfg.shoulderY + cfg.headSize * 0.69, cfg.armLength * 0.58);
    }
    this.root.computeWorldMatrix(true);
    this.shadowPosition.copyFrom(this.root.getAbsolutePosition());
    const p = this.shadowPosition;
    const visible = this.root.isEnabled();
    this.shadows.set(this.shadowSlot, p.x, p.y + 0.03, p.z, visible ? 0.34 * this.shadowScale : 0, visible ? 0.27 * this.shadowScale : 0);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.shadows.release(this.shadowSlot);
    this.root.dispose(false, false);
  }
}
