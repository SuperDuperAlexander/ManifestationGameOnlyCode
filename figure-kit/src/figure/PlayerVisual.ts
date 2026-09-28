import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Space } from '@babylonjs/core/Maths/math.axis';
import { Curve3 } from '@babylonjs/core/Maths/math.path';
import { Constants } from '@babylonjs/core/Engines/constants';
import type { Scene } from '@babylonjs/core/scene';
import { FIGURE } from './config';
import { createToonMaterial, type ToonMaterial } from './toonShader';
import { createGlowMaterial, setGlowAlpha, type GlowMaterial } from './glowShader';
import { clamp, damp, smoothstep } from './math';
import { ScarfTail, type ScarfBody } from './ScarfTail';

export interface PlayerVisualState {
  /** Ground speed, m/s. */
  speed: number;
  /** 0..1 share of the walk speed. */
  speedRatio: number;
  /** Facing angle around Y. 0 = north (+z). */
  heading: number;
  /** 0..1, how full the breath is. */
  breathLevel: number;
  /** 0..1 extra glow while inhaling. */
  glow: number;
  /** 0 = lying on the meadow, 1 = standing. */
  awake: number;
}

/**
 * The player's look. Kept behind this small interface so it can be swapped
 * for a GLB model later without touching the controller.
 */
export interface IPlayerVisual {
  readonly root: TransformNode;
  update(dt: number, state: PlayerVisualState): void;
  dispose(): void;
}

/** Cloak shape: [height, radius] from the shoulders down to the hem. Figure scale 1. */
const CLOAK_PROFILE: [number, number][] = [
  [0.8, 0.0],
  [0.79, 0.075],
  [0.765, 0.14],
  [0.71, 0.19],
  [0.63, 0.222],
  [0.53, 0.255],
  [0.43, 0.288],
  [0.33, 0.32],
  [0.25, 0.345],
  [0.19, 0.362],
];
const CLOAK_SEGMENTS = 30;
/** Soft folds in the cloak. More toward the hem. */
const CLOAK_FOLDS = 7;
const CLOAK_THICKNESS = 0.012;
const HOOD_CENTER = new Vector3(0, 0.93, 0);
/** Hood as the scarf feels it: a ball a little above the hood's middle, so the knot is outside it. */
const HOOD_COLLIDER = new Vector3(0, 0.99, 0);
const HOOD_RADIUS = 0.22;
/** The body stands this high on its legs: the legs show under the hem. */
const BODY_LIFT = 0.05;
const HIP_Y = 0.3 + BODY_LIFT;
const ANKLE_Y = 0.065;

/** A small damped spring: overshoots a little, then settles. Gives the cloak its swing. */
class Spring {
  value = 0;
  private vel = 0;
  update(dt: number, target: number, stiffness: number, damping: number): number {
    this.vel += ((target - this.value) * stiffness - this.vel * damping) * dt;
    this.value += this.vel * dt;
    return this.value;
  }
}

/**
 * A small figure in a red hooded cloak with an orange scarf, built in code.
 * - The cloak is a soft bell that trails back when walking and swings when stopping.
 * - The scarf tails are real physics: they fly behind and flutter in the breeze.
 * - Short legs and boots step with the walk. Squash & stretch on every step.
 * - Leans into the walk and into turns. Nods when stopping. Looks around when idle.
 * - Breathing in: the figure swells a little, looks up and glows.
 */
export class PlayerVisual implements IPlayerVisual {
  readonly root: TransformNode;
  private readonly body: TransformNode;
  private readonly cloak: Mesh;
  private readonly emblem: Mesh;
  private readonly hoodGroup: TransformNode;
  private readonly knot: TransformNode;
  private readonly scarves: ScarfTail[] = [];
  private readonly legs: Mesh[] = [];
  private readonly boots: Mesh[] = [];
  private readonly shadow: Mesh;
  private readonly halo: Mesh;
  private readonly mat: ToonMaterial;
  private readonly haloMat: GlowMaterial;

  // Cloak mesh buffers. Rest shape per vertex: height, radius, angle, weight (0 at the shoulders, 1 at the hem).
  private readonly ringCount = CLOAK_PROFILE.length;
  private readonly cloakPos: Float32Array;
  private readonly cloakNrm: Float32Array;
  private readonly restY: Float32Array;
  private readonly restR: Float32Array;
  private readonly restA: Float32Array;
  private readonly restW: Float32Array;

  private phase = 0;
  private time = 0;
  private lastHeading = 0;
  private turnRate = 0;
  private lastSpeed = 0;
  private accel = 0;
  private idle = 0;
  private readonly lagX = new Spring();
  private readonly lagZ = new Spring();
  private readonly nod = new Spring();
  private lookYaw = 0;
  private lookPitch = 0;
  private readonly anchorPrev: Vector3[] = [];
  private readonly scarfBody: ScarfBody;
  private readonly tmpV = new Vector3();
  private readonly tmpN = new Vector3();

  constructor(scene: Scene) {
    this.root = new TransformNode('player', scene);
    this.body = new TransformNode('player.body', scene);
    this.body.parent = this.root;
    this.root.scaling.setAll(FIGURE.scale);

    // One toon material for the whole figure. Colours are painted into the vertices.
    // No back-face culling: the cloak's inside and both faces of the scarf are real geometry.
    this.mat = createToonMaterial('player.figure', scene, new Color3(1, 1, 1), new Color3(0.66, 0.5, 0.5));
    this.mat.backFaceCulling = false;

    // --- Cloak: a dynamic bell. Outer shell + a darker inner shell. ---
    const S = CLOAK_SEGMENTS + 1;
    const R = this.ringCount;
    const n = R * S;
    this.cloakPos = new Float32Array(n * 2 * 3);
    this.cloakNrm = new Float32Array(n * 2 * 3);
    this.restY = new Float32Array(n);
    this.restR = new Float32Array(n);
    this.restA = new Float32Array(n);
    this.restW = new Float32Array(n);
    const colors = new Float32Array(n * 2 * 4);
    const top = Color3.FromHexString('#C8543C');
    const mid = Color3.FromHexString(FIGURE.colors.cloak);
    const hem = Color3.FromHexString('#A63A28');
    const inner = Color3.FromHexString(FIGURE.colors.cloakShadow);
    for (let i = 0; i < R; i++) {
      const [y, r] = CLOAK_PROFILE[i]!;
      const t = i / (R - 1);
      for (let j = 0; j < S; j++) {
        const a = (j / CLOAK_SEGMENTS) * Math.PI * 2;
        const k = i * S + j;
        // Folds grow toward the hem. The hem is a little shorter at the front.
        const fold = 1 + 0.07 * Math.pow(t, 1.4) * Math.cos(a * CLOAK_FOLDS + 0.6);
        this.restY[k] = y + 0.03 * Math.cos(a) * t * t;
        this.restR[k] = r * fold;
        this.restA[k] = a;
        this.restW[k] = Math.pow(t, 1.6);
        // Painted light: warmer at the shoulders, deeper at the hem, a touch darker in each fold.
        const base = t < 0.5 ? Color3.Lerp(top, mid, t * 2) : Color3.Lerp(mid, hem, (t - 0.5) * 2);
        const c = base.scale(1 - 0.06 * t * (1 - Math.cos(a * CLOAK_FOLDS + 0.6)) * 0.5);
        colors.set([c.r, c.g, c.b, 1], k * 4);
        colors.set([inner.r, inner.g, inner.b, 1], (n + k) * 4);
      }
    }
    const indices: number[] = [];
    for (let i = 0; i < R - 1; i++) {
      for (let j = 0; j < CLOAK_SEGMENTS; j++) {
        const a = i * S + j;
        const b = a + 1;
        const c = a + S;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
        indices.push(n + a, n + b, n + c, n + b, n + d, n + c);
      }
    }
    const data = new VertexData();
    data.positions = this.cloakPos;
    data.normals = this.cloakNrm;
    data.colors = colors;
    data.indices = indices;
    this.cloak = new Mesh('player.cloak', scene);
    data.applyToMesh(this.cloak, true);
    this.cloak.material = this.mat;
    this.cloak.parent = this.body;

    // Gold diamond on the back, like the reference art: gold, a cloak-red inset, a gold heart.
    const d1 = paint(MeshBuilder.CreateDisc('player.em1', { radius: 0.068, tessellation: 4 }, scene), FIGURE.colors.gold);
    const d2 = paint(MeshBuilder.CreateDisc('player.em2', { radius: 0.046, tessellation: 4 }, scene), '#B8452F');
    d2.position.z = -0.003;
    const d3 = paint(MeshBuilder.CreateDisc('player.em3', { radius: 0.02, tessellation: 4 }, scene), FIGURE.colors.gold);
    d3.position.z = -0.006;
    this.emblem = merge('player.emblem', [d1, d2, d3]);
    this.emblem.scaling.set(0.85, 1.3, 1);
    this.emblem.material = this.mat;
    this.emblem.parent = this.body;

    // --- Scarf wrap around the neck, with a knot at the back right. ---
    const wrap = paint(MeshBuilder.CreateTorus('player.wrap', { diameter: 0.3, thickness: 0.105, tessellation: 22 }, scene), FIGURE.colors.scarf);
    wrap.position.set(0, 0.77, 0.005);
    wrap.rotation.x = 0.28;
    wrap.scaling.set(1.05, 0.8, 1);
    const knotBall = paint(MeshBuilder.CreateSphere('player.knotBall', { diameter: 0.11, segments: 8 }, scene), '#D06F42');
    knotBall.position.set(0.1, 0.76, -0.15);
    knotBall.scaling.set(1, 0.85, 0.8);
    const scarfWrap = merge('player.scarfWrap', [wrap, knotBall]);
    scarfWrap.material = this.mat;
    scarfWrap.parent = this.body;
    this.knot = new TransformNode('player.knot', scene);
    this.knot.parent = this.body;
    this.knot.position.set(0.1, 0.74, -0.18);

    // --- Hood: big and round, with a soft point that leans back. Dark face inside. ---
    this.hoodGroup = new TransformNode('player.hoodGroup', scene);
    this.hoodGroup.parent = this.body;
    this.hoodGroup.position.copyFrom(HOOD_CENTER);
    const hoodProfile = Curve3.CreateCatmullRomSpline(
      [
        [0.19, -0.17],
        [0.24, -0.1],
        [0.262, -0.01],
        [0.255, 0.08],
        [0.22, 0.165],
        [0.165, 0.24],
        [0.105, 0.3],
        [0.05, 0.345],
        [0.0, 0.365],
      ].map(([x, y]) => new Vector3(x, y, 0)),
      3,
    ).getPoints();
    const hoodMesh = MeshBuilder.CreateLathe('player.hood', { shape: hoodProfile, tessellation: 56, cap: 0 }, scene);
    shapeHood(hoodMesh);
    hoodMesh.material = this.mat;
    hoodMesh.parent = this.hoodGroup;

    // --- Legs and boots. They live on the root, so feet stay on the ground while the body bobs. ---
    for (const side of [-1, 1]) {
      const leg = paint(
        MeshBuilder.CreateCylinder(`player.leg${side}`, { diameterTop: 0.085, diameterBottom: 0.07, height: 1, tessellation: 8 }, scene),
        FIGURE.colors.legs,
      );
      leg.bakeTransformIntoVertices(Matrix.Translation(0, -0.5, 0));
      leg.material = this.mat;
      leg.parent = this.root;
      this.legs.push(leg);
      const boot = paint(MeshBuilder.CreateSphere(`player.boot${side}`, { diameter: 0.2, segments: 10 }, scene), FIGURE.colors.umber);
      boot.bakeTransformIntoVertices(Matrix.Scaling(0.58, 0.48, 1).multiply(Matrix.Translation(0, -0.015, 0.03)));
      boot.material = this.mat;
      boot.parent = this.root;
      this.boots.push(boot);
    }

    // --- Scarf tails: physics ribbons in world space. ---
    const f = FIGURE.motion;
    f.scarfTails.forEach(([len, width, segs], i) => {
      const tail = new ScarfTail(scene, `player.scarf${i}`, this.mat, len, width, segs, i === 0 ? FIGURE.colors.scarf : '#D2703F', FIGURE.scale);
      this.scarves.push(tail);
      this.anchorPrev.push(new Vector3());
    });
    this.scarfBody = {
      world: new Matrix(),
      inverse: new Matrix(),
      radiusAt: (y) => cloakRadiusAt(y),
      hood: HOOD_COLLIDER,
      hoodRadius: HOOD_RADIUS,
      groundY: 0,
    };

    // Soft blob shadow on the ground.
    this.shadow = MeshBuilder.CreateGround('player.shadow', { width: 1.1, height: 0.9 }, scene);
    this.shadow.position.y = 0.03;
    this.shadow.material = createGlowMaterial('player.shadowMat', scene, FIGURE.colors.shadow, { alpha: 0.55 });
    this.shadow.parent = this.root;

    // Warm halo around the figure. Visible while inhaling.
    this.haloMat = createGlowMaterial('player.haloMat', scene, FIGURE.colors.halo, { alpha: 0, additive: true, core: 0.8 });
    // Light is not hidden by the ground it stands on.
    this.haloMat.depthFunction = Constants.ALWAYS;
    this.halo = MeshBuilder.CreatePlane('player.halo', { size: 2.6 }, scene);
    this.halo.position.set(0, 0.6, 0);
    this.halo.billboardMode = TransformNode.BILLBOARDMODE_ALL;
    this.halo.material = this.haloMat;
    this.halo.parent = this.root;
    this.halo.isVisible = false;

    for (const m of this.root.getChildMeshes()) {
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
    }
    this.deformCloak();
  }

  update(dt: number, s: PlayerVisualState): void {
    const f = FIGURE.motion;
    this.time += dt;
    const moving = s.speedRatio;

    // Heading, turn rate and acceleration (for leaning and the cloak's swing).
    const dh = Math.atan2(Math.sin(s.heading - this.lastHeading), Math.cos(s.heading - this.lastHeading));
    this.lastHeading = s.heading;
    this.turnRate += (clamp(dt > 0 ? dh / dt : 0, -6, 6) - this.turnRate) * damp(6, dt);
    this.accel += (clamp(dt > 0 ? (s.speed - this.lastSpeed) / dt : 0, -20, 20) - this.accel) * damp(8, dt);
    this.lastSpeed = s.speed;
    this.root.rotation.y = s.heading;
    this.idle = moving < 0.05 ? this.idle + dt : 0;

    // Step cycle follows the distance walked.
    this.phase += s.speed * dt * f.stepRate;
    const step = Math.sin(this.phase);
    const contact = Math.abs(Math.cos(this.phase)); // 1 = legs passing, 0 = a foot lands
    const bob = contact * f.bob * moving;
    // Squash when a foot lands, stretch when the legs pass.
    const squash = (contact - 0.55) * f.squash * moving;

    // Idle breathing: a slow, small swell. Inhaling fills the figure a little.
    const idleBreath = Math.sin(this.time * 1.7) * 0.012 * (1 - moving);
    const swell = s.breathLevel * 0.045;

    // Waking up: lying curled on the grass, then rising.
    const lie = 1 - s.awake;
    this.body.position.y = BODY_LIFT + bob - lie * 0.32;
    this.body.rotation.x = lie * 1.2 + moving * f.lean + clamp(this.accel * 0.012, -0.08, 0.1);
    this.body.rotation.z = -clamp(this.turnRate * moving * 0.05, -0.14, 0.14) + step * 0.025 * moving;
    this.body.scaling.set(1 + swell * 0.6 - squash * 0.5, 1 + idleBreath + swell + squash, 1 + swell * 0.6 - squash * 0.5);

    // Cloak: trails back with speed, swings outward in turns and side to side with the steps.
    // The spring overshoots, so the cloak swings forward and settles when the figure stops.
    const tz = -f.cloakTrail * moving - clamp(this.accel * 0.006, -0.05, 0.05);
    const tx = -clamp(this.turnRate * moving * 0.05, -0.12, 0.12) + step * 0.025 * moving;
    this.lagZ.update(dt, tz, f.cloakStiffness, f.cloakDamping);
    this.lagX.update(dt, tx, f.cloakStiffness, f.cloakDamping);
    this.deformCloak(moving);

    // Hood: nods when stopping, looks into turns, looks up while breathing in, looks around when idle.
    this.nod.update(dt, clamp(-this.accel * 0.02, -0.12, 0.18), 60, 7);
    const lookAround = smoothstep(f.lookAroundAfter, f.lookAroundAfter + 1.5, this.idle);
    const it = this.idle - f.lookAroundAfter;
    const wantYaw = clamp(this.turnRate * 0.07, -0.25, 0.25) + lookAround * 0.55 * Math.sin(it * 0.55) * Math.min(1, Math.abs(Math.sin(it * 0.55)) * 2.5);
    const wantPitch = -s.breathLevel * 0.14 - lookAround * 0.06 * (0.5 + 0.5 * Math.sin(it * 0.8));
    this.lookYaw += (wantYaw - this.lookYaw) * damp(3.5, dt);
    this.lookPitch += (wantPitch - this.lookPitch) * damp(3, dt);
    this.hoodGroup.rotation.x = this.nod.value + this.lookPitch - this.lagZ.value * 0.3 + Math.sin(this.time * 1.1) * 0.012;
    this.hoodGroup.rotation.y = this.lookYaw;
    this.hoodGroup.rotation.z = -step * 0.04 * moving + this.lookYaw * -0.12;

    // Legs and boots: a foot lifts while it swings forward, toe up before it lands.
    const stride = f.stride * moving;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const p = this.phase + (i === 0 ? 0 : Math.PI);
      const fz = Math.sin(p) * stride + 0.02;
      const swing = Math.cos(p) > 0 ? Math.cos(p) : 0;
      const fy = ANKLE_Y + swing * f.stepLift * moving;
      const boot = this.boots[i]!;
      boot.position.set(0.085 * side, fy, fz);
      boot.rotation.x = -0.45 * Math.sin(p) * moving * (swing > 0 ? 1 : 0.25);
      // The leg runs from the hip (which bobs with the body) down to the ankle.
      const leg = this.legs[i]!;
      const hy = HIP_Y + bob - lie * 0.32;
      leg.position.set(0.08 * side, hy, 0);
      const vy = fy + 0.03 - hy;
      const vz = fz;
      leg.scaling.y = Math.max(0.01, Math.hypot(vy, vz));
      leg.rotation.x = Math.atan2(-vz, -vy);
      leg.isVisible = boot.isVisible = s.awake > 0.5;
    }

    // Glow while inhaling.
    const glow = Math.max(s.glow, 0);
    this.mat.glow = glow * 0.45;
    this.halo.isVisible = glow > 0.02;
    setGlowAlpha(this.haloMat, Math.min(0.5, glow * 0.65));
    const hs = 0.9 + glow * 0.5;
    this.halo.scaling.set(hs, hs, hs);

    this.updateScarf(dt);
  }

  /** Bends the cloak: trail, swing, a soft flutter along the hem. Writes positions and normals. */
  private deformCloak(moving = 0): void {
    const S = CLOAK_SEGMENTS + 1;
    const R = this.ringCount;
    const n = R * S;
    const p = this.cloakPos;
    const lx = this.lagX.value;
    const lz = this.lagZ.value;
    const lift = Math.hypot(lx, lz) * 0.45;
    const t = this.time;
    for (let k = 0; k < n; k++) {
      const a = this.restA[k]!;
      const w = this.restW[k]!;
      const flutter = (Math.sin(a * 3 - t * 7) * 0.012 * (0.2 + moving) + Math.sin(a * 2 + t * 1.6) * 0.005) * w;
      const r = this.restR[k]! * (1 + flutter);
      const sa = Math.sin(a);
      const ca = Math.cos(a);
      p[k * 3] = sa * r + lx * w;
      p[k * 3 + 1] = this.restY[k]! + lift * w;
      p[k * 3 + 2] = ca * r + lz * w;
    }
    // Normals from the grid: across the ring × down the cloak points outward.
    const nr = this.cloakNrm;
    for (let i = 0; i < R; i++) {
      const up = Math.max(0, i - 1);
      const down = Math.min(R - 1, i + 1);
      for (let j = 0; j < S; j++) {
        const k = i * S + j;
        const jl = j === 0 ? CLOAK_SEGMENTS - 1 : j - 1;
        const jr = j === CLOAK_SEGMENTS ? 1 : j + 1;
        const ax = p[(i * S + jr) * 3]! - p[(i * S + jl) * 3]!;
        const ay = p[(i * S + jr) * 3 + 1]! - p[(i * S + jl) * 3 + 1]!;
        const az = p[(i * S + jr) * 3 + 2]! - p[(i * S + jl) * 3 + 2]!;
        const dx = p[(down * S + j) * 3]! - p[(up * S + j) * 3]!;
        const dy = p[(down * S + j) * 3 + 1]! - p[(up * S + j) * 3 + 1]!;
        const dz = p[(down * S + j) * 3 + 2]! - p[(up * S + j) * 3 + 2]!;
        let nx = dy * az - dz * ay;
        let ny = dz * ax - dx * az;
        let nz = dx * ay - dy * ax;
        const l = Math.hypot(nx, ny, nz);
        if (l < 1e-6) {
          nx = 0;
          ny = 1;
          nz = 0;
        } else {
          nx /= l;
          ny /= l;
          nz /= l;
        }
        nr[k * 3] = nx;
        nr[k * 3 + 1] = ny;
        nr[k * 3 + 2] = nz;
        // Inner shell: a little inside, facing in.
        const o = (n + k) * 3;
        p[o] = p[k * 3]! - nx * CLOAK_THICKNESS;
        p[o + 1] = p[k * 3 + 1]! - ny * CLOAK_THICKNESS;
        p[o + 2] = p[k * 3 + 2]! - nz * CLOAK_THICKNESS;
        nr[o] = -nx;
        nr[o + 1] = -ny;
        nr[o + 2] = -nz;
      }
    }
    this.cloak.updateVerticesData(VertexBuffer.PositionKind, p, false, false);
    this.cloak.updateVerticesData(VertexBuffer.NormalKind, nr, false, false);

    // The emblem rides on the cloak's back, about halfway down.
    const ring = 5;
    const k = ring * S + CLOAK_SEGMENTS / 2;
    this.tmpN.set(nr[k * 3]!, nr[k * 3 + 1]!, nr[k * 3 + 2]!);
    this.tmpV.set(p[k * 3]!, p[k * 3 + 1]!, p[k * 3 + 2]!).addInPlace(this.tmpN.scale(0.004));
    this.emblem.position.copyFrom(this.tmpV);
    this.emblem.lookAt(this.tmpV.subtract(this.tmpN), 0, 0, 0, Space.LOCAL);
  }

  private updateScarf(dt: number): void {
    this.root.computeWorldMatrix(true);
    this.body.computeWorldMatrix(true);
    this.knot.computeWorldMatrix(true);
    const b = this.scarfBody;
    b.world.copyFrom(this.body.getWorldMatrix());
    b.world.invertToRef(b.inverse);
    b.groundY = this.root.position.y;
    const wm = this.root.getWorldMatrix();
    const right = Vector3.TransformNormal(Vector3.Right(), wm).normalize();
    const back = Vector3.TransformNormal(Vector3.Backward(), wm).normalize();
    const anchor = this.knot.getAbsolutePosition();
    this.scarves.forEach((tail, i) => {
      // The short tail hangs a little further left of the long one.
      const to = anchor.add(right.scale(i === 0 ? 0.02 : -0.04));
      const from = this.anchorPrev[i]!;
      if (from.lengthSquared() === 0) from.copyFrom(to);
      tail.update(dt, this.time, from, to, right, back, b);
      from.copyFrom(to);
    });
  }

  dispose(): void {
    for (const tail of this.scarves) tail.dispose();
    this.root.dispose(false, false);
  }
}

/** Radius of the cloak at a height (figure space), for the scarf to collide with. 0 = no cloak there. */
function cloakRadiusAt(y: number): number {
  const top = CLOAK_PROFILE[0]![0];
  const bottom = CLOAK_PROFILE[CLOAK_PROFILE.length - 1]![0];
  if (y > top || y < bottom - 0.02) return 0;
  for (let i = 1; i < CLOAK_PROFILE.length; i++) {
    const [y1, r1] = CLOAK_PROFILE[i]!;
    const [y0, r0] = CLOAK_PROFILE[i - 1]!;
    if (y >= y1) return r0 + ((y0 - y) / (y0 - y1)) * (r1 - r0);
  }
  return CLOAK_PROFILE[CLOAK_PROFILE.length - 1]![1];
}

/**
 * Shapes the hood: a dish for the face with a soft brim around it, and the point leaning back.
 * Paints it too: the face is a deep warm shadow that fades into the hood at the brim.
 */
function shapeHood(mesh: Mesh): void {
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  const count = pos.length / 3;
  const colors = new Float32Array(count * 4);
  const low = Color3.FromHexString('#BD4631');
  const high = Color3.FromHexString('#CF5A40');
  const brimColor = Color3.FromHexString('#D2613F');
  const faceColor = Color3.FromHexString(FIGURE.colors.umber);
  for (let i = 0; i < count; i++) {
    const x = pos[i * 3]!;
    const y = pos[i * 3 + 1]!;
    const z = pos[i * 3 + 2]!;
    // Face opening: an oval on the front, in (angle, height).
    const u = Math.atan2(x, z) / 0.78;
    const v = (y + 0.04) / 0.15;
    const d = Math.hypot(u, v);
    let scale = 1;
    if (d < 1) scale -= 0.22 * Math.pow(1 - d * d, 0.6);
    // The brim: a soft roll just outside the opening.
    scale += 0.07 * Math.exp(-Math.pow((d - 1.08) / 0.2, 2));
    let px = x * scale;
    let py = y;
    let pz = z * scale;
    // The point leans back.
    const up = Math.max(0, py - 0.08);
    pz -= up * up * 1.9;
    py -= up * up * 0.35;
    pos[i * 3] = px;
    pos[i * 3 + 1] = py;
    pos[i * 3 + 2] = pz;
    const base = Color3.Lerp(low, high, smoothstep(-0.15, 0.3, y));
    const withBrim = Color3.Lerp(base, brimColor, Math.exp(-Math.pow((d - 1.1) / 0.18, 2)) * 0.8);
    const c = Color3.Lerp(faceColor, withBrim, smoothstep(0.78, 1.0, d));
    colors.set([c.r, c.g, c.b, 1], i * 4);
  }
  mesh.setVerticesData(VertexBuffer.PositionKind, pos);
  const normals: number[] = [];
  VertexData.ComputeNormals(pos, mesh.getIndices()!, normals);
  mesh.setVerticesData(VertexBuffer.NormalKind, normals);
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
}

/** Paints a mesh in one colour (vertex colours). */
function paint(mesh: Mesh, hex: string): Mesh {
  const c = Color3.FromHexString(hex);
  return paintBy(mesh, () => c);
}

/** Paints each vertex with a colour picked from its position. */
function paintBy(mesh: Mesh, pick: (p: Vector3) => Color3): Mesh {
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind)!;
  const count = pos.length / 3;
  const colors = new Float32Array(count * 4);
  const p = new Vector3();
  for (let i = 0; i < count; i++) {
    p.set(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!);
    const c = pick(p);
    colors.set([c.r, c.g, c.b, 1], i * 4);
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  return mesh;
}

/** Bakes the parts' transforms and merges them into one mesh. */
function merge(name: string, parts: Mesh[]): Mesh {
  const merged = Mesh.MergeMeshes(parts, true, true)!;
  merged.name = name;
  return merged;
}
