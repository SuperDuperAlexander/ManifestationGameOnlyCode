import '@babylonjs/core/Meshes/thinInstanceMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE, SHADES } from '../config/palette';
import { TUNING } from '../config/tuning';
import { createToonMaterial, type ToonMaterial } from '../shaders/toonShader';
import { WORLD_UNIFORMS } from '../shaders/paperShader';
import { ScarfTail, type ScarfBody } from '../player/ScarfTail';
import { clamp, damp, smoothstep, lerp } from '../core/Random';

export type ImpState = 'raging' | 'calming' | 'calm';

export interface AngerImpOptions {
  /** World point the imp spits its fire toward (the burned root). Default: straight ahead. */
  spitTarget?: Vector3;
  /** World direction (horizontal) the falling-figure clue points to (toward the alley). */
  clueDir?: Vector3;
}

// ---------------------------------------------------------------------------
// Unlit material for effects (supports thin instances, vertex colours, world curve).
// ---------------------------------------------------------------------------
const FX_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec4 color;
#ifdef INSTANCES
attribute vec4 world0;
attribute vec4 world1;
attribute vec4 world2;
attribute vec4 world3;
#endif
uniform mat4 world;
uniform mat4 viewProjection;
uniform vec4 uCurve;
varying vec3 vColor;
void main(void) {
  vColor = color.rgb;
#ifdef INSTANCES
  mat4 w = mat4(world0, world1, world2, world3);
#else
  mat4 w = world;
#endif
  vec4 wp = w * vec4(position, 1.0);
  float d = max(wp.z - uCurve.x - uCurve.y, 0.0);
  wp.y -= uCurve.z * d * d;
  gl_Position = viewProjection * wp;
}
`;
const FX_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uTint;
uniform float uAlpha;
varying vec3 vColor;
void main(void) {
  gl_FragColor = vec4(vColor * uTint, uAlpha);
}
`;
Effect.ShadersStore['impFxVertexShader'] = FX_VERTEX;
Effect.ShadersStore['impFxFragmentShader'] = FX_FRAGMENT;

function createFxMaterial(name: string, scene: Scene, alpha = 1): ShaderMaterial {
  const mat = new ShaderMaterial(
    name,
    scene,
    { vertex: 'impFx', fragment: 'impFx' },
    {
      attributes: ['position', 'color'],
      uniforms: ['world', 'viewProjection', 'uCurve', 'uTint', 'uAlpha'],
      needAlphaBlending: alpha < 1,
    },
  );
  mat.backFaceCulling = false;
  mat.setColor3('uTint', new Color3(1, 1, 1));
  mat.setFloat('uAlpha', alpha);
  mat.onBindObservable.add(() => {
    const effect = mat.getEffect();
    if (effect) effect.setFloat4('uCurve', WORLD_UNIFORMS.pivotZ, TUNING.curve.flatDistance, TUNING.curve.strength, 0);
  });
  return mat;
}

// ---------------------------------------------------------------------------
// Mesh helpers
// ---------------------------------------------------------------------------
const LIGHT = new Vector3(0.45, 0.8, -0.3).normalize();

/** Paints each vertex from its position and normal. */
function paintBy(mesh: Mesh, pick: (p: Vector3, n: Vector3) => Color3): Mesh {
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  const nrm = mesh.getVerticesData(VertexBuffer.NormalKind)!;
  const count = pos.length / 3;
  const colors = new Float32Array(count * 4);
  const p = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < count; i++) {
    p.set(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!);
    n.set(nrm[i * 3]!, nrm[i * 3 + 1]!, nrm[i * 3 + 2]!);
    const c = pick(p, n);
    colors.set([c.r, c.g, c.b, 1], i * 4);
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  return mesh;
}

/** Faceted (flat-shaded) and painted in one colour with a soft top-to-bottom gradient. */
function facet(mesh: Mesh, hex: string, gradient = 0.14): Mesh {
  mesh.convertToFlatShadedMesh();
  const base = Color3.FromHexString(hex);
  return paintBy(mesh, (p) => base.scale(1 - gradient * 0.5 + gradient * clamp(p.y + 0.5, 0, 1)));
}

/** Faceted, painted with a fake light from the normal. For effects that have no real lighting. */
function lit(mesh: Mesh, hex: string): Mesh {
  mesh.convertToFlatShadedMesh();
  const base = Color3.FromHexString(hex);
  return paintBy(mesh, (_p, n) => base.scale(0.82 + 0.22 * clamp(Vector3.Dot(n, LIGHT), -0.4, 1)));
}

function merge(name: string, parts: Mesh[]): Mesh {
  const merged = Mesh.MergeMeshes(parts, true, true)!;
  merged.name = name;
  return merged;
}

function ball(scene: Scene, hex: string, sx: number, sy: number, sz: number, x: number, y: number, z: number, seg = 7): Mesh {
  const m = facet(MeshBuilder.CreateSphere('imp.ball', { diameter: 1, segments: seg }, scene), hex);
  m.scaling.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}

function cone(scene: Scene, hex: string, d: number, h: number, tess: number, x: number, y: number, z: number, rx = 0, rz = 0): Mesh {
  const m = facet(MeshBuilder.CreateCylinder('imp.cone', { height: h, diameterTop: 0, diameterBottom: d, tessellation: tess }, scene), hex, 0.1);
  m.position.set(x, y, z);
  m.rotation.set(rx, 0, rz);
  return m;
}

function tube(scene: Scene, hex: string, path: Vector3[], r0: number, r1: number, tess = 5): Mesh {
  const m = MeshBuilder.CreateTube(
    'imp.tube',
    { path, radiusFunction: (i: number) => lerp(r0, r1, i / (path.length - 1)), tessellation: tess, cap: Mesh.CAP_ALL },
    scene,
  );
  return facet(m, hex, 0.1);
}

/** Flat shape in the xy plane from triangles. Used for effects that face the camera. */
function flatShape(scene: Scene, name: string, pts: number[][], tris: number[][], colorOf: (tri: number) => Color3): Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  tris.forEach((t, ti) => {
    const c = colorOf(ti);
    for (const i of t) {
      positions.push(pts[i]![0]!, pts[i]![1]!, 0);
      colors.push(c.r, c.g, c.b, 1);
      indices.push(indices.length);
    }
  });
  const data = new VertexData();
  data.positions = positions;
  data.colors = colors;
  data.indices = indices;
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Particle pool (one mesh, thin instances)
// ---------------------------------------------------------------------------
interface Particle {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  rot: number;
  spin: number;
}

interface PoolOptions {
  billboard: boolean;
  gravity: number;
  drag: number;
  scaleAt: (t: number) => number;
  /** Ground height: particles come to rest there and fade. */
  floorY?: number;
  steer?: (p: Particle, dt: number) => void;
}

class Pool {
  readonly mesh: Mesh;
  private readonly items: Particle[] = [];
  private readonly buf: Float32Array;
  private live = 0;
  private readonly m = new Matrix();
  private readonly s = new Vector3();
  private readonly t = new Vector3();
  private readonly q = new Quaternion();
  private readonly roll = new Quaternion();
  private readonly axisZ = new Vector3(0, 0, 1);

  constructor(mesh: Mesh, count: number, private readonly o: PoolOptions, material: ShaderMaterial) {
    this.mesh = mesh;
    for (let i = 0; i < count; i++) {
      this.items.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, size: 1, rot: 0, spin: 0 });
    }
    this.buf = new Float32Array(count * 16);
    mesh.material = material;
    mesh.thinInstanceSetBuffer('matrix', this.buf, 16, false);
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.isVisible = false;
  }

  setFloor(y: number): void {
    this.o.floorY = y;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, rot = 0, spin = 0): Particle | null {
    for (const p of this.items) {
      if (p.alive) continue;
      p.alive = true;
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = vx;
      p.vy = vy;
      p.vz = vz;
      p.age = 0;
      p.life = life;
      p.size = size;
      p.rot = rot;
      p.spin = spin;
      this.live++;
      this.mesh.isVisible = true;
      return p;
    }
    return null;
  }

  update(dt: number, camQ: Quaternion): void {
    if (this.live === 0) return;
    const o = this.o;
    let live = 0;
    const k = Math.exp(-o.drag * dt);
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i]!;
      if (p.alive) {
        p.age += dt;
        if (p.age >= p.life) {
          p.alive = false;
        } else {
          if (o.steer) o.steer(p, dt);
          p.vx *= k;
          p.vy = p.vy * k - o.gravity * dt;
          p.vz *= k;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (o.floorY !== undefined && p.y < o.floorY && p.vy < 0) {
            p.y = o.floorY;
            p.vx = p.vy = p.vz = 0;
            p.age = Math.max(p.age, p.life * 0.8);
          }
          live++;
        }
      }
      if (p.alive) {
        const sc = p.size * o.scaleAt(p.age / p.life);
        this.s.set(sc, sc, sc);
        this.t.set(p.x, p.y, p.z);
        const a = p.rot + p.spin * p.age;
        if (o.billboard) {
          Quaternion.RotationAxisToRef(this.axisZ, a, this.roll);
          camQ.multiplyToRef(this.roll, this.q);
        } else {
          Quaternion.RotationYawPitchRollToRef(a, a * 0.7, 0, this.q);
        }
        Matrix.ComposeToRef(this.s, this.q, this.t, this.m);
        this.m.copyToArray(this.buf, i * 16);
      } else {
        this.buf.fill(0, i * 16, i * 16 + 16);
      }
    }
    this.live = live;
    this.mesh.thinInstanceBufferUpdated('matrix');
    if (live === 0) this.mesh.isVisible = false;
  }

  clear(): void {
    for (const p of this.items) p.alive = false;
    this.live = 0;
    this.buf.fill(0);
    this.mesh.thinInstanceBufferUpdated('matrix');
    this.mesh.isVisible = false;
  }

  dispose(): void {
    this.mesh.dispose();
  }
}

// ---------------------------------------------------------------------------
// The Anger Imp
// ---------------------------------------------------------------------------
/** Head pivot height and the head's ellipsoid radii (model units), for placing the face. */
const HEAD_PIVOT_Y = 0.85;
const HEAD_C = 0.2;
const HEAD_RX = 0.32;
const HEAD_RY = 0.28;
const HEAD_RZ = 0.29;
const SHOULDER_X = 0.34;
const SHOULDER_Y = 0.72;
const FLAME_LOCAL = new Vector3(0, 0.64, 0.4);
const KNOT_LOCAL = new Vector3(0.13, 0.8, -0.25);
const MOUTH_LOCAL = new Vector3(0, 0.04, 0.32);

/** z on the head's front surface at (x, y) in head-pivot space. */
function frontZ(x: number, y: number): number {
  const yy = y - HEAD_C;
  const t = 1 - (x / HEAD_RX) ** 2 - (yy / HEAD_RY) ** 2;
  return HEAD_RZ * Math.sqrt(Math.max(t, 0.03)) + 0.012;
}

/**
 * The Anger Imp: the player's own anger, never an enemy.
 * raging: wide stance, fists up, stomps, steam, bolts, rocks, spits fire (with a clue in it).
 * calming: softer, looks at the player.
 * calm: eyes closed, smile, scarf like the player's, holds a warm flame.
 * Draw calls: about 13 at most (see report). All effects are pooled thin instances.
 */
export class AngerImp {
  readonly root: TransformNode;
  /** Set false to stop automatic fire spits (e.g. while a cutscene runs). */
  autoSpit = true;

  private readonly scene: Scene;
  private readonly upper: TransformNode;
  private readonly headPivot: TransformNode;
  private readonly armL: TransformNode;
  private readonly armR: TransformNode;
  private readonly tailPivot: TransformNode;
  private readonly flameNode: TransformNode;
  private readonly knot: TransformNode;
  private readonly legs: Mesh;
  private readonly faces: Mesh[];
  private readonly wrap: Mesh;
  private readonly flame: Mesh;
  private readonly shadow: Mesh;
  private readonly scarf: ScarfTail;
  private readonly scarfBody: ScarfBody;
  private readonly anchorPrev = new Vector3();
  private readonly toon: ToonMaterial;
  private readonly fx: ShaderMaterial;
  private readonly fxShadow: ShaderMaterial;
  private readonly fxSoft: ShaderMaterial;
  private readonly steam: Pool;
  private readonly bolts: Pool;
  private readonly rocks: Pool;
  private readonly fire: Pool;
  private readonly sparks: Pool;
  private readonly clue: Pool;
  private readonly pools: Pool[];
  private readonly camQ = new Quaternion();
  private S: number;
  private readonly baseS: number;
  private sizeK = 1;

  private current: ImpState = 'raging';
  private calm = 0;
  private rage = 1;
  private time = 0;
  private stompPhase = 0;
  private visible = true;
  private lookPos: Vector3 | null = null;
  private headYaw = 0;
  private spitT = -1;
  private spitFired = false;
  private roarT = -1;
  private roarFired = false;
  private walk = 0;
  private walkPhase = 0;
  private spitCd = 1.2;
  private steamAcc = 0;
  private boltAcc = 0;
  private sparkAcc = 0;
  private spitTarget: Vector3 | null;
  private clueDir: Vector3 | null;
  private readonly spitCbs: Array<(from: Vector3, dir: Vector3) => void> = [];
  private readonly tmpA = new Vector3();
  private readonly tmpB = new Vector3();

  constructor(scene: Scene, pos: Vector3, facing: number, opts: AngerImpOptions = {}) {
    const T = TUNING.imp;
    this.scene = scene;
    this.spitTarget = opts.spitTarget ? opts.spitTarget.clone() : null;
    this.clueDir = opts.clueDir ? opts.clueDir.clone() : null;
    this.baseS = T.scale * T.modelUnit * TUNING.player.visualScale;
    this.sizeK = lerp(T.sizeAtCalm, T.sizeAtRage, 1);
    this.S = this.baseS * this.sizeK;

    this.root = new TransformNode('imp', scene);
    this.root.position.copyFrom(pos);
    this.root.rotation.y = facing;
    this.root.scaling.setAll(this.S);
    this.upper = new TransformNode('imp.upper', scene);
    this.upper.parent = this.root;

    this.toon = createToonMaterial('imp.body', scene, new Color3(1, 1, 1), new Color3(0.66, 0.5, 0.5));
    this.toon.backFaceCulling = false;
    this.fx = createFxMaterial('imp.fx', scene);
    this.fxShadow = createFxMaterial('imp.fxShadow', scene, 0.28);
    this.fxSoft = createFxMaterial('imp.fxSoft', scene, 0.62);

    const body = SHADES.impBody;
    const belly = SHADES.impBelly;
    const umber = SHADES.impHorn;
    const own = (m: Mesh, parent: TransformNode): Mesh => {
      m.material = this.toon;
      m.parent = parent;
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
      return m;
    };

    // Torso with cream belly.
    own(merge('imp.torso', [ball(scene, body, 0.72, 0.8, 0.64, 0, 0.5, 0), ball(scene, belly, 0.44, 0.5, 0.2, 0, 0.46, 0.27)]), this.upper);

    // Legs and feet: their own mesh so the stance can widen.
    const legParts: Mesh[] = [];
    for (const s of [-1, 1]) {
      legParts.push(ball(scene, body, 0.2, 0.3, 0.2, 0.15 * s, 0.17, 0));
      legParts.push(ball(scene, umber, 0.26, 0.12, 0.34, 0.16 * s, 0.06, 0.06));
    }
    this.legs = own(merge('imp.legs', legParts), this.root);

    // Head: ball, pointed ears, two curved horns, hair tufts. Face is a separate mesh per state.
    this.headPivot = new TransformNode('imp.head', scene);
    this.headPivot.parent = this.upper;
    this.headPivot.position.y = HEAD_PIVOT_Y;
    const head = ball(scene, body, HEAD_RX * 2, HEAD_RY * 2, HEAD_RZ * 2, 0, HEAD_C, 0, 8);
    // Lighter muzzle area on the front (like the concept images).
    const baseBody = Color3.FromHexString(body);
    const baseBelly = Color3.FromHexString(belly);
    paintBy(head, (p) => {
      const front = smoothstep(0.02, 0.1, p.z / 1);
      const area = 1 - smoothstep(0.1, 0.3, Math.hypot(p.x / 1, (p.y - 0.05) / 1.1));
      const c = Color3.Lerp(baseBody, baseBelly, 0.38 * front * area);
      return c.scale(0.93 + 0.14 * clamp(p.y + 0.5, 0, 1));
    });
    const headParts: Mesh[] = [head];
    for (const s of [-1, 1]) {
      headParts.push(cone(scene, body, 0.17, 0.32, 4, 0.33 * s, 0.26, -0.02, 0, -1.25 * s));
      headParts.push(
        tube(
          scene,
          umber,
          [new Vector3(0.17 * s, 0.4, 0), new Vector3(0.22 * s, 0.5, 0), new Vector3(0.32 * s, 0.64, 0.01), new Vector3(0.35 * s, 0.82, 0.03), new Vector3(0.25 * s, 0.95, 0.05)],
          0.075,
          0.012,
        ),
      );
    }
    headParts.push(cone(scene, body, 0.13, 0.22, 4, 0, 0.53, 0.06, 0.15, 0));
    headParts.push(cone(scene, body, 0.1, 0.17, 4, 0.1, 0.5, 0.05, 0.1, -0.5));
    headParts.push(cone(scene, body, 0.1, 0.17, 4, -0.1, 0.5, 0.05, 0.1, 0.5));
    own(merge('imp.head', headParts), this.headPivot);

    this.faces = [this.buildFaceRaging(), this.buildFaceCalming(), this.buildFaceCalm()];
    this.faces.forEach((f, i) => {
      own(f, this.headPivot);
      f.isVisible = i === 0;
    });

    // Arms: a shoulder pivot each; the arm hangs down along -y, fist at the end.
    this.armL = new TransformNode('imp.armL', scene);
    this.armR = new TransformNode('imp.armR', scene);
    this.armL.parent = this.upper;
    this.armR.parent = this.upper;
    this.armL.position.set(-SHOULDER_X, SHOULDER_Y, 0.02);
    this.armR.position.set(SHOULDER_X, SHOULDER_Y, 0.02);
    own(this.buildArm('imp.armLMesh'), this.armL);
    own(this.buildArm('imp.armRMesh'), this.armR);

    // Tail with a triangle tip.
    this.tailPivot = new TransformNode('imp.tail', scene);
    this.tailPivot.parent = this.upper;
    this.tailPivot.position.set(0, 0.27, -0.3);
    own(
      merge('imp.tailMesh', [
        tube(scene, body, [new Vector3(0, 0, 0), new Vector3(0, -0.06, -0.14), new Vector3(0, -0.02, -0.28), new Vector3(0, 0.1, -0.38), new Vector3(0, 0.22, -0.4)], 0.05, 0.03),
        cone(scene, body, 0.17, 0.2, 3, 0, 0.32, -0.4, -0.25, 0),
      ]),
      this.tailPivot,
    );

    // Scarf (calm form): neck wrap + a physics tail, like the player's.
    const wrapTorus = facet(MeshBuilder.CreateTorus('imp.wrapT', { diameter: 0.5, thickness: 0.11, tessellation: 16 }, scene), SHADES.scarf, 0.1);
    wrapTorus.position.set(0, 0.83, 0);
    wrapTorus.rotation.x = 0.12;
    const knotBall = facet(MeshBuilder.CreateSphere('imp.knotB', { diameter: 0.13, segments: 6 }, scene), '#D06F42', 0.1);
    knotBall.position.copyFrom(KNOT_LOCAL);
    this.wrap = own(merge('imp.wrap', [wrapTorus, knotBall]), this.upper);
    this.wrap.isVisible = false;
    this.knot = new TransformNode('imp.knot', scene);
    this.knot.parent = this.upper;
    this.knot.position.copyFrom(KNOT_LOCAL);
    this.scarf = new ScarfTail(scene, 'imp.scarf', this.toon, 0.8, 0.22, 8, SHADES.scarf, this.baseS * T.sizeAtCalm);
    this.scarf.mesh.isVisible = false;
    this.scarfBody = {
      world: new Matrix(),
      inverse: new Matrix(),
      radiusAt: (y) => (y < 0.12 || y > 0.9 ? 0 : 0.38 * Math.sqrt(Math.max(0, 1 - ((y - 0.5) / 0.4) ** 2))),
      hood: new Vector3(0, HEAD_PIVOT_Y + HEAD_C, 0),
      hoodRadius: 0.3,
      groundY: 0,
    };

    // The warm flame between the hands.
    this.flameNode = new TransformNode('imp.flameNode', scene);
    this.flameNode.parent = this.upper;
    this.flameNode.position.copyFrom(FLAME_LOCAL);
    const outer = lit(MeshBuilder.CreateSphere('imp.flameO', { diameter: 0.2, segments: 6 }, scene), SHADES.impFlame);
    const tip = lit(MeshBuilder.CreateCylinder('imp.flameT', { height: 0.3, diameterTop: 0, diameterBottom: 0.18, tessellation: 6 }, scene), SHADES.impFlame);
    tip.position.y = 0.13;
    const core = lit(MeshBuilder.CreateIcoSphere('imp.flameC', { radius: 0.05, subdivisions: 1 }, scene), PALETTE.ivory);
    core.position.y = 0.04;
    core.scaling.set(0.9, 1.5, 0.9);
    this.flame = merge('imp.flame', [outer, tip, core]);
    this.flame.material = this.fx;
    this.flame.parent = this.flameNode;
    this.flame.isPickable = false;
    this.flame.alwaysSelectAsActiveMesh = true;
    this.flame.isVisible = false;

    // Blob shadow.
    this.shadow = MeshBuilder.CreateDisc('imp.shadow', { radius: 0.55, tessellation: 20 }, scene);
    paintBy(this.shadow, () => Color3.FromHexString(SHADES.umber));
    this.shadow.rotation.x = Math.PI / 2;
    this.shadow.position.y = 0.03;
    this.shadow.material = this.fxShadow;
    this.shadow.parent = this.root;
    this.shadow.isPickable = false;

    // Effect pools. Positions are in world space, so the meshes are not parented.
    const S = this.S;
    const P = T.pool;
    const steamMesh = lit(MeshBuilder.CreateSphere('imp.steam', { diameter: 1, segments: 5 }, scene), SHADES.smokeIvory);
    this.steam = new Pool(steamMesh, P.steam, { billboard: false, gravity: -0.15 * S, drag: 0.4, scaleAt: (t) => (0.45 + 0.85 * t) * (1 - smoothstep(0.65, 1, t)) }, this.fxSoft);
    const boltMesh = flatShape(
      scene,
      'imp.bolt',
      [[0.2, 1], [-0.3, 0.1], [0.02, 0.1], [-0.2, -1], [0.32, -0.15], [0, -0.15]],
      [[0, 1, 2], [1, 5, 2], [2, 5, 4], [5, 3, 4]],
      (i) => Color3.Lerp(Color3.FromHexString(PALETTE.gold), Color3.FromHexString(SHADES.heatOrange), i / 3 * 0.7),
    );
    this.bolts = new Pool(boltMesh, P.bolt, { billboard: true, gravity: 0, drag: 0, scaleAt: (t) => Math.sin(Math.PI * t) * (0.78 + 0.22 * Math.sin(t * 60)) }, this.fx);
    const rockMesh = lit(MeshBuilder.CreateIcoSphere('imp.rock', { radius: 0.5, subdivisions: 1 }, scene), '#8A7B6A');
    this.rocks = new Pool(rockMesh, P.rock, { billboard: false, gravity: 7 * S, drag: 0.1, scaleAt: (t) => 1 - smoothstep(0.8, 1, t), floorY: pos.y }, this.fx);
    const fireMesh = lit(MeshBuilder.CreateIcoSphere('imp.fire', { radius: 0.5, subdivisions: 1 }, scene), SHADES.heatOrange);
    this.fire = new Pool(fireMesh, P.fire, { billboard: false, gravity: 3.2 * S, drag: 0.5, scaleAt: (t) => (1 - t * t) * (0.55 + 0.5 * Math.sin(Math.min(1, t * 3) * Math.PI * 0.5)) }, this.fxSoft);
    const sparkMesh = flatShape(scene, 'imp.spark', [[0, 1], [0.5, 0], [0, -1], [-0.5, 0]], [[0, 1, 2], [0, 2, 3]], () => Color3.FromHexString(SHADES.impFlame));
    this.sparks = new Pool(sparkMesh, P.spark, { billboard: true, gravity: -0.1 * S, drag: 0.2, scaleAt: (t) => Math.sin(Math.PI * t) }, this.fx);
    // The clue: a tiny figure (round head, little cloak) that falls and drifts toward the alley.
    const clueMesh = flatShape(
      scene,
      'imp.clue',
      [[0, 0.55], [0.22, 0.4], [0.22, 0.7], [0, 0.85], [-0.22, 0.7], [-0.22, 0.4], [0, 0.3], [-0.38, -0.6], [0.38, -0.6]],
      [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 5], [6, 7, 8]],
      (i) => Color3.FromHexString(i < 4 ? PALETTE.ivory : PALETTE.gold),
    );
    this.clue = new Pool(
      clueMesh,
      1,
      {
        billboard: true,
        gravity: 2.4 * S,
        drag: 0.3,
        scaleAt: (t) => smoothstep(0, 0.12, t) * (1 - smoothstep(0.8, 1, t)),
        steer: (p, dt) => {
          const d = this.clueDir;
          if (!d) return;
          const k = Math.min(1, 2.2 * dt);
          p.vx += (d.x * 1.6 * S - p.vx) * k;
          p.vz += (d.z * 1.6 * S - p.vz) * k;
        },
      },
      this.fx,
    );
    this.pools = [this.steam, this.bolts, this.rocks, this.fire, this.sparks, this.clue];

    // Starting pose.
    this.update(0);
  }

  // ---- public API --------------------------------------------------------

  get state(): ImpState {
    return this.current;
  }

  setState(s: ImpState): void {
    this.current = s;
  }

  /** 0..1 from the anger value. Stronger rage = more steam, bolts and spits. */
  setRage(v: number): void {
    this.rage = clamp(v, 0, 1);
  }

  /** Current world height of the imp (feet to horn tips). */
  height(): number {
    return TUNING.imp.modelHeight * this.S;
  }

  /** Radius around the root that the player cannot enter. */
  bodyRadius(): number {
    return TUNING.imp.bodyRadius * this.S;
  }

  setVisible(b: boolean): void {
    this.visible = b;
    this.root.setEnabled(b);
    if (!b) {
      for (const p of this.pools) p.clear();
      this.scarf.mesh.isVisible = false;
    }
  }

  /** The imp looks toward this world point (the player). */
  lookAt(pos: Vector3): void {
    this.lookPos = pos.clone();
  }

  /** World point the imp spits toward (the burned root). */
  setSpitTarget(p: Vector3 | null): void {
    this.spitTarget = p ? p.clone() : null;
  }

  /** World direction the falling-figure clue points to. */
  setClueDir(d: Vector3 | null): void {
    this.clueDir = d ? d.clone() : null;
  }

  onSpit(cb: (from: Vector3, dir: Vector3) => void): void {
    this.spitCbs.push(cb);
  }

  /** Starts one fire spit now (raging or calming only). */
  spit(): void {
    if (this.spitT < 0) {
      this.spitT = 0;
      this.spitFired = false;
    }
  }

  /** Starts the roar: lean forward, flame flare, ember burst. Used when a Thought Wave leaves the imp. */
  roar(): void {
    if (!this.visible || this.current === 'calm') return;
    this.roarT = 0;
    this.roarFired = false;
  }

  /** 0..1 how much it is walking (waddle). */
  setWalk(v: number): void {
    this.walk = clamp(v, 0, 1);
  }

  /** World point of the mouth (where a Thought Wave starts). */
  mouthPosition(): Vector3 {
    this.root.computeWorldMatrix(true);
    this.upper.computeWorldMatrix(true);
    this.headPivot.computeWorldMatrix(true);
    return Vector3.TransformCoordinates(MOUTH_LOCAL, this.headPivot.getWorldMatrix());
  }

  /** Where a wave appears: at the mouth, a little toward the player so the head does not hide it. */
  waveSpawnPosition(): Vector3 {
    const m = this.mouthPosition();
    const h = this.tmpA;
    if (this.lookPos) h.set(this.lookPos.x - m.x, 0, this.lookPos.z - m.z);
    else h.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    if (h.lengthSquared() < 1e-6) h.set(0, 0, 1);
    h.normalize();
    const k = TUNING.imp.roar.spawnForward * this.S;
    m.x += h.x * k;
    m.z += h.z * k;
    m.y = this.root.position.y + TUNING.imp.roar.chestY * this.S;
    return m;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  /** Where the warm flame is, in world space (for the flame that floats to the lantern). */
  flamePosition(): Vector3 {
    this.upper.computeWorldMatrix(true);
    this.flameNode.computeWorldMatrix(true);
    return this.flameNode.getAbsolutePosition().clone();
  }

  dispose(): void {
    for (const p of this.pools) p.dispose();
    this.scarf.dispose();
    this.fx.dispose();
    this.fxSoft.dispose();
    this.fxShadow.dispose();
    this.toon.dispose();
    this.root.dispose(false, false);
  }

  // ---- update ------------------------------------------------------------

  update(dt: number): void {
    if (!this.visible) return;
    const T = TUNING.imp;
    this.time += dt;
    // Size follows the outer anger, smoothly (calm = smaller, never gone).
    this.sizeK += (lerp(T.sizeAtCalm, T.sizeAtRage, this.rage) - this.sizeK) * damp(T.sizeRate, dt);
    this.S = this.baseS * this.sizeK;
    this.root.scaling.setAll(this.S);
    const target = this.current === 'raging' ? 0 : this.current === 'calming' ? 0.5 : 1;
    this.calm += (target - this.calm) * damp(T.blendRate, dt);
    const v = this.calm;
    // Energy: how wild it is right now (0..1).
    const e = (1 - v) * (0.55 + 0.45 * this.rage);
    const cam = this.scene.activeCamera;
    if (cam) Quaternion.FromRotationMatrixToRef(cam.getWorldMatrix(), this.camQ);
    const t = this.time;

    // Stomping: hop and land. Landing throws rocks and a puff.
    const prevStomp = Math.floor(this.stompPhase / Math.PI);
    this.stompPhase += dt * T.stompRate * (0.4 + 0.6 * e);
    const hop = Math.abs(Math.sin(this.stompPhase));
    const squash = Math.pow(1 - hop, 6) * 0.08 * e;
    if (e > 0.25 && Math.floor(this.stompPhase / Math.PI) !== prevStomp && dt > 0) this.onLand(e);
    const breathe = Math.sin(t * 1.4) * 0.012 * v;
    const W = T.wander;
    this.walkPhase += dt * W.stepRate * this.walk;
    const step = Math.sin(this.walkPhase);
    this.upper.position.y = hop * 0.07 * e + Math.sin(t * 1.1) * 0.012 * v + Math.abs(step) * W.hop * this.walk;
    this.upper.scaling.set(1 + squash * 0.6, 1 - squash + breathe, 1 + squash * 0.6);
    this.upper.rotation.z = Math.sin(this.stompPhase * 0.5) * 0.05 * e + step * W.sway * this.walk;
    this.legs.scaling.set((1 + 0.32 * (1 - v)) * (1 + squash * 0.3), 1 - squash * 0.5, 1);

    // Spit envelope: head up, small lean back.
    let spitK = 0;
    if (this.spitT >= 0) {
      this.spitT += dt;
      spitK = Math.sin(Math.PI * clamp(this.spitT / 0.55, 0, 1));
      if (!this.spitFired && this.spitT >= 0.22) {
        this.spitFired = true;
        this.fireSpit();
      }
      if (this.spitT >= 0.55) this.spitT = -1;
    } else if (this.autoSpit && this.current === 'raging' && v < 0.15) {
      this.spitCd -= dt;
      if (this.spitCd <= 0) {
        this.spit();
        this.spitCd = lerp(T.spitEveryS[0], T.spitEveryS[1], this.rage) * (0.8 + Math.random() * 0.4);
      }
    }
    // Roar: lean toward the player, flare, burst of embers.
    let roarK = 0;
    if (this.roarT >= 0) {
      const R = T.roar;
      this.roarT += dt;
      roarK = Math.sin(Math.PI * clamp(this.roarT / R.durationS, 0, 1));
      if (!this.roarFired && this.roarT >= R.fireAtS) {
        this.roarFired = true;
        this.roarBurst();
      }
      if (this.roarT >= R.durationS) this.roarT = -1;
    }
    this.upper.rotation.x = -spitK * 0.12 + roarK * T.roar.lean;

    // Arms: raised and shaking when raging, lower when calming, cupped around the flame when calm.
    const shake = Math.sin(t * 21) * 0.08 * e;
    const a = lerp(0.4, -1.15, v) + shake * 0.5;
    const b = lerp(-2.3, 0.62, v) + shake;
    this.armL.rotation.set(a, 0, b);
    this.armR.rotation.set(a, 0, -b - shake * 2);

    // Head: nods, looks toward the player while calming, turns up when spitting.
    let wantYaw = 0;
    if (this.lookPos) {
      this.root.computeWorldMatrix(true);
      const p = this.root.getAbsolutePosition();
      const dx = this.lookPos.x - p.x;
      const dz = this.lookPos.z - p.z;
      let rel = Math.atan2(dx, dz) - this.root.rotation.y;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const w = lerp(0.3, 0.95, smoothstep(0.1, 0.5, v)) * (1 - 0.6 * smoothstep(0.75, 1, v));
      wantYaw = clamp(rel, -1, 1) * w;
    }
    this.headYaw += (wantYaw - this.headYaw) * damp(4, dt);
    this.headPivot.rotation.set(lerp(-0.05, 0.12, v) - spitK * 0.45 + roarK * T.roar.headDip + Math.sin(t * 1.3) * 0.015 * v, this.headYaw, Math.sin(t * 17) * 0.03 * e);

    // Tail wag.
    this.tailPivot.rotation.set(Math.sin(t * 2.1) * 0.06, Math.sin(t * (3 + 7 * e)) * (0.15 + 0.3 * e), 0);

    // Face by state (switches halfway through the blend).
    const face = v < 0.25 ? 0 : v < 0.75 ? 1 : 2;
    this.faces.forEach((f, i) => (f.isVisible = i === face));
    this.wrap.isVisible = face === 2;

    // Flame and warm glow in the calm form.
    const f = smoothstep(0.55, 0.95, v);
    const fl = Math.max(f, roarK * T.roar.flare);
    this.flame.isVisible = fl > 0.02;
    if (fl > 0.02) {
      const w1 = 1 + 0.06 * Math.sin(t * 9);
      const h1 = 1 + 0.12 * Math.sin(t * 7.3 + 1) + 0.05 * Math.sin(t * 13);
      this.flame.scaling.set(fl * w1, fl * h1, fl * w1);
      this.flameNode.position.y = FLAME_LOCAL.y + Math.sin(t * 2) * 0.015;
    }
    this.toon.glow = f * (0.1 + 0.04 * Math.sin(t * 2.4));

    this.spawnEffects(dt, e, f);
    for (const p of this.pools) p.update(dt, this.camQ);
    this.updateScarf(dt, face === 2);
  }

  // ---- effects -----------------------------------------------------------

  private onLand(e: number): void {
    const S = this.S;
    const o = this.root.position;
    const n = Math.random() < 0.55 + 0.3 * e ? (Math.random() < 0.4 ? 2 : 1) : 0;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = (0.3 + Math.random() * 0.5) * S;
      this.rocks.spawn(o.x + Math.cos(a) * r, o.y + 0.05 * S, o.z + Math.sin(a) * r, Math.cos(a) * 0.5 * S, (2.4 + Math.random() * 1.6) * S, Math.sin(a) * 0.5 * S, 1.6, (0.1 + Math.random() * 0.1) * S, Math.random() * 6, 3);
    }
  }

  private spawnEffects(dt: number, e: number, f: number): void {
    const T = TUNING.imp;
    const S = this.S;
    const o = this.root.position;
    // Steam: puffs rise around the body.
    this.steamAcc += dt * T.steamPerS * e * e * 1.4;
    // Puffs are small next to the imp (size ~ sqrt of its scale) and rise above and beside the horns, never in front of the face.
    const puff = Math.sqrt(S);
    while (this.steamAcc >= 1) {
      this.steamAcc -= 1;
      const a = Math.random() * Math.PI * 2;
      const r = (0.35 + Math.random() * 0.35) * S;
      this.steam.spawn(o.x + Math.cos(a) * r, o.y + (2.0 + Math.random() * 0.5) * S, o.z + Math.sin(a) * r, Math.cos(a) * 0.1 * S, (0.2 + Math.random() * 0.1) * S, Math.sin(a) * 0.1 * S, 1.7 + Math.random() * 0.8, (0.3 + Math.random() * 0.25) * puff * 1.2, 0, 0.6);
    }
    // Lightning bolts around the head.
    if (e > 0.3) {
      this.boltAcc += dt * T.boltPerS * (e - 0.2);
      while (this.boltAcc >= 1) {
        this.boltAcc -= 1;
        const a = Math.random() * Math.PI * 2;
        const r = (0.85 + Math.random() * 0.3) * S;
        this.bolts.spawn(o.x + Math.cos(a) * r, o.y + (0.9 + Math.random() * 0.8) * S, o.z + Math.sin(a) * r, 0, 0, 0, 0.35 + Math.random() * 0.2, 0.33 * S, (Math.random() - 0.5) * 1, 0);
      }
    } else {
      this.boltAcc = 0;
    }
    // Sparkles around the calm flame.
    if (f > 0.5) {
      this.sparkAcc += dt * T.sparklePerS * f;
      while (this.sparkAcc >= 1) {
        this.sparkAcc -= 1;
        const p = this.flamePosition();
        const a = Math.random() * Math.PI * 2;
        const r = (0.15 + Math.random() * 0.45) * S;
        this.sparks.spawn(p.x + Math.cos(a) * r, p.y + (Math.random() - 0.2) * 0.4 * S, p.z + Math.sin(a) * r, 0, (0.25 + Math.random() * 0.2) * S, 0, 1.3 + Math.random() * 0.8, (0.07 + Math.random() * 0.05) * S, Math.random() * 3, 0.8);
      }
    } else {
      this.sparkAcc = 0;
    }
  }

  /** The flare: fire puffs from the mouth toward the player, and sparks around it. */
  private roarBurst(): void {
    const S = this.S;
    const R = TUNING.imp.roar;
    const from = this.mouthPosition();
    const h = this.tmpA;
    if (this.lookPos) h.set(this.lookPos.x - from.x, 0, this.lookPos.z - from.z);
    else h.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    if (h.lengthSquared() < 1e-6) h.set(0, 0, 1);
    h.normalize();
    const sp = R.speed * S;
    for (let i = 0; i < R.puffs; i++) {
      const k = (0.7 + Math.random() * 0.6) * sp;
      const j = 0.35;
      this.fire.spawn(from.x, from.y, from.z, (h.x * 0.9 + (Math.random() - 0.5) * j) * k, (0.25 + Math.random() * 0.3) * k, (h.z * 0.9 + (Math.random() - 0.5) * j) * k, 0.8 + Math.random() * 0.3, (0.22 + Math.random() * 0.14) * S, Math.random() * 6, 2);
    }
    for (let i = 0; i < R.sparks; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.25 * S;
      this.sparks.spawn(from.x + Math.cos(a) * r, from.y + (Math.random() - 0.3) * 0.2 * S, from.z + Math.sin(a) * r, h.x * 0.8 * S + Math.cos(a) * 0.4 * S, (0.3 + Math.random() * 0.5) * S, h.z * 0.8 * S + Math.sin(a) * 0.4 * S, 0.8 + Math.random() * 0.6, (0.1 + Math.random() * 0.08) * S, Math.random() * 3, 1);
    }
  }

  /** Three fire puffs from the mouth, toward the target and up. The clue figure rides in the first one. */
  private fireSpit(): void {
    const S = this.S;
    const T = TUNING.imp;
    this.headPivot.computeWorldMatrix(true);
    const from = Vector3.TransformCoordinates(MOUTH_LOCAL, this.headPivot.getWorldMatrix());
    // Horizontal direction: to the target, or straight ahead.
    const h = this.tmpA;
    if (this.spitTarget) h.set(this.spitTarget.x - from.x, 0, this.spitTarget.z - from.z);
    else h.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    if (h.lengthSquared() < 1e-6) h.set(0, 0, 1);
    h.normalize();
    const dir = this.tmpB.set(h.x * 0.75, 0.65, h.z * 0.75).normalize().clone();
    const sp = T.spitSpeed * S;
    for (let i = 0; i < 3; i++) {
      const k = (0.85 + Math.random() * 0.3) * sp;
      const j = 0.18;
      const vx = (dir.x + (Math.random() - 0.5) * j) * k;
      const vy = (dir.y + (Math.random() - 0.5) * j) * k;
      const vz = (dir.z + (Math.random() - 0.5) * j) * k;
      this.fire.spawn(from.x, from.y, from.z, vx, vy, vz, 1.0 + Math.random() * 0.3, (0.26 + Math.random() * 0.12) * S, Math.random() * 6, 2);
      if (i === 0 && this.clueDir) {
        // The falling figure, toward the camera so the fire does not hide it.
        const c = this.scene.activeCamera;
        const toCam = c ? c.position.subtract(from).normalize().scale(0.3 * S) : Vector3.Zero();
        this.clue.spawn(from.x + toCam.x, from.y + toCam.y, from.z + toCam.z, vx, vy, vz, T.clueLifeS, 0.24 * S, Math.PI * 0.8, 0.35);
      }
    }
    for (const cb of this.spitCbs) cb(from.clone(), dir);
  }

  private updateScarf(dt: number, on: boolean): void {
    this.scarf.mesh.isVisible = on;
    if (!on) return;
    this.root.computeWorldMatrix(true);
    this.upper.computeWorldMatrix(true);
    this.knot.computeWorldMatrix(true);
    const b = this.scarfBody;
    b.world.copyFrom(this.upper.getWorldMatrix());
    b.world.invertToRef(b.inverse);
    b.groundY = this.root.position.y;
    const wm = this.root.getWorldMatrix();
    const right = Vector3.TransformNormal(Vector3.Right(), wm).normalize();
    const back = Vector3.TransformNormal(Vector3.Backward(), wm).normalize();
    const to = this.knot.getAbsolutePosition().clone();
    if (this.anchorPrev.lengthSquared() === 0) this.anchorPrev.copyFrom(to);
    this.scarf.update(dt, this.time, this.anchorPrev, to, right, back, b);
    this.anchorPrev.copyFrom(to);
  }

  // ---- building the parts ------------------------------------------------

  private buildArm(name: string): Mesh {
    const sc = this.scene;
    return merge(name, [ball(sc, SHADES.impBody, 0.19, 0.4, 0.19, 0, -0.15, 0), ball(sc, SHADES.impHorn, 0.21, 0.19, 0.21, 0, -0.37, 0, 6)]);
  }

  private features(parts: Mesh[], hex: string): Mesh[] {
    const c = Color3.FromHexString(hex);
    for (const p of parts) paintBy(p, () => c);
    return parts;
  }

  /** A line along the head's surface: from (x0,y0) to (x1,y1) bent by `sag` (negative = smile). */
  private stroke(name: string, x0: number, y0: number, x1: number, y1: number, sag: number, r: number): Mesh {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      const x = lerp(x0, x1, u);
      const y = lerp(y0, y1, u) + sag * (1 - (2 * u - 1) ** 2);
      pts.push(new Vector3(x, y, frontZ(x, y) + 0.004));
    }
    return MeshBuilder.CreateTube(name, { path: pts, radius: r, tessellation: 4, cap: Mesh.CAP_ALL }, this.scene);
  }

  private spot(name: string, x: number, y: number, rx: number, ry: number, tess = 10): Mesh {
    const d = MeshBuilder.CreateDisc(name, { radius: 1, tessellation: tess }, this.scene);
    d.scaling.set(rx, ry, 1);
    d.position.set(x, y, frontZ(x, y) + 0.006);
    return d;
  }

  private buildFaceRaging(): Mesh {
    const sc = this.scene;
    const ink = SHADES.umber;
    const parts: Mesh[] = [];
    for (const s of [-1, 1]) {
      // Angry brows (inner end low) and squinting ">" "<" eyes.
      parts.push(...this.features([this.stroke('b', 0.24 * s, 0.34, 0.05 * s, 0.27, 0, 0.017)], ink));
      parts.push(...this.features([this.stroke('e1', 0.22 * s, 0.26, 0.08 * s, 0.21, 0, 0.014), this.stroke('e2', 0.22 * s, 0.16, 0.08 * s, 0.21, 0, 0.014)], ink));
      // Fangs.
      const fang = cone(sc, PALETTE.ivory, 0.04, 0.06, 3, 0, 0, 0, Math.PI, 0);
      fang.position.set(0.06 * s, 0.075, frontZ(0.06 * s, 0.075) + 0.012);
      parts.push(fang);
    }
    const mouth = this.spot('m', 0, 0.03, 0.12, 0.1);
    paintBy(mouth, () => Color3.FromHexString(ink));
    const tongue = this.spot('t', 0, -0.02, 0.07, 0.04);
    tongue.position.z += 0.004;
    paintBy(tongue, () => Color3.FromHexString('#D97868'));
    parts.push(mouth, tongue);
    return merge('imp.faceRaging', parts);
  }

  private buildFaceCalming(): Mesh {
    const ink = SHADES.umber;
    const parts: Mesh[] = [];
    for (const s of [-1, 1]) {
      parts.push(...this.features([this.stroke('b', 0.2 * s, 0.33, 0.06 * s, 0.31, 0.01, 0.014)], ink));
      const eye = this.spot('e', 0.1 * s, 0.21, 0.034, 0.045);
      parts.push(...this.features([eye], ink));
      const blush = this.spot('c', 0.21 * s, 0.1, 0.05, 0.033);
      paintBy(blush, () => Color3.FromHexString('#E58F70'));
      parts.push(blush);
    }
    parts.push(...this.features([this.stroke('m', -0.045, 0.085, 0.045, 0.085, -0.004, 0.012)], ink));
    return merge('imp.faceCalming', parts);
  }

  private buildFaceCalm(): Mesh {
    const ink = SHADES.umber;
    const parts: Mesh[] = [];
    for (const s of [-1, 1]) {
      // Closed eyes: soft arcs curving down. Small triangle brows.
      parts.push(...this.features([this.stroke('e', 0.07 * s, 0.215, 0.15 * s, 0.215, -0.022, 0.012)], ink));
      const brow = this.spot('b', 0.11 * s, 0.31, 0.05, 0.035, 3);
      paintBy(brow, () => Color3.FromHexString('#C0502F'));
      parts.push(brow);
      const blush = this.spot('c', 0.21 * s, 0.1, 0.055, 0.036);
      paintBy(blush, () => Color3.FromHexString('#E58F70'));
      parts.push(blush);
    }
    parts.push(...this.features([this.stroke('m', -0.05, 0.09, 0.05, 0.09, -0.024, 0.012)], ink));
    return merge('imp.faceCalm', parts);
  }
}
