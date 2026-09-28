import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Material } from '@babylonjs/core/Materials/material';
import type { Scene } from '@babylonjs/core/scene';
import { FIGURE } from './config';

/** What a scarf tail must not go through, in the body's local space. */
export interface ScarfBody {
  /** Body space → world, and back. */
  world: Matrix;
  inverse: Matrix;
  /** Radius of the body at a local height, or 0 where there is no body. */
  radiusAt(y: number): number;
  /** Hood: centre and radius in body space. */
  hood: Vector3;
  hoodRadius: number;
  /** World height of the ground under the figure. */
  groundY: number;
}

/**
 * One scarf tail: a chain of points (verlet physics) drawn as a soft ribbon.
 * It hangs from the scarf knot, trails behind when walking and flutters in the breeze.
 * Simulated in world space, so it lags behind the body on its own.
 */
export class ScarfTail {
  readonly mesh: Mesh;
  private readonly count: number;
  private readonly seg: number;
  private readonly width: number;
  private readonly pos: Float32Array;
  private readonly prev: Float32Array;
  private readonly verts: Float32Array;
  private readonly normals: Float32Array;
  private started = false;
  private readonly tmp = new Vector3();
  private readonly local = new Vector3();

  constructor(scene: Scene, name: string, material: Material, length: number, width: number, segments: number, color: string, scale: number) {
    this.count = segments + 1;
    this.seg = (length / segments) * scale;
    this.width = width * scale;
    this.pos = new Float32Array(this.count * 3);
    this.prev = new Float32Array(this.count * 3);
    // 4 vertices per point: two on the front side, two on the back side.
    const n = this.count * 4;
    this.verts = new Float32Array(n * 3);
    this.normals = new Float32Array(n * 3);
    const colors = new Float32Array(n * 4);
    const front = Color3.FromHexString(color);
    const back = front.scale(0.82);
    const indices: number[] = [];
    for (let i = 0; i < this.count; i++) {
      // Slightly lighter toward the tip: the sun catches the loose end.
      const t = i / (this.count - 1);
      const f = Color3.Lerp(front, new Color3(1, 0.72, 0.5), t * 0.18);
      for (let k = 0; k < 4; k++) {
        const c = k < 2 ? f : back;
        colors.set([c.r, c.g, c.b, 1], (i * 4 + k) * 4);
      }
      if (i < this.count - 1) {
        const a = i * 4;
        const b = a + 4;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
        indices.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
      }
    }
    const data = new VertexData();
    data.positions = this.verts;
    data.normals = this.normals;
    data.colors = colors;
    data.indices = indices;
    this.mesh = new Mesh(name, scene);
    data.applyToMesh(this.mesh, true);
    this.mesh.material = material;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
  }

  /** Lays the tail straight down from the anchor, at rest. */
  reset(anchor: Vector3, back: Vector3): void {
    for (let i = 0; i < this.count; i++) {
      const x = anchor.x + back.x * this.seg * i * 0.3;
      const y = anchor.y - this.seg * i;
      const z = anchor.z + back.z * this.seg * i * 0.3;
      this.pos.set([x, y, z], i * 3);
      this.prev.set([x, y, z], i * 3);
    }
    this.started = true;
  }

  /**
   * `from`/`to`: the anchor at the start and end of this frame.
   * `right`: the figure's right side (the ribbon lies flat across it).
   */
  update(dt: number, time: number, from: Vector3, to: Vector3, right: Vector3, back: Vector3, body: ScarfBody): void {
    // A teleport or the first frame: start fresh instead of whipping across the world.
    if (!this.started || Vector3.DistanceSquared(from, to) > 4) this.reset(to, back);
    if (dt <= 0) return;
    const f = FIGURE.motion;
    const steps = Math.min(4, Math.max(1, Math.ceil(dt * 120)));
    const h = dt / steps;
    const drag = Math.exp(-f.scarfDrag * h);
    const p = this.pos;
    const q = this.prev;
    // How fast the figure moves through the air. Drives the flutter.
    const air = Math.min(4, Vector3.Distance(from, to) / dt);
    for (let s = 1; s <= steps; s++) {
      const t = time - dt + h * s;
      const a = s / steps;
      p[0] = from.x + (to.x - from.x) * a;
      p[1] = from.y + (to.y - from.y) * a;
      p[2] = from.z + (to.z - from.z) * a;
      q[0] = p[0];
      q[1] = p[1];
      q[2] = p[2];
      // Breeze from the right (+x), with slow gusts.
      const gust = f.wind * (0.55 + 0.45 * Math.sin(t * 0.9) * Math.sin(t * 2.3 + 1));
      for (let i = 1; i < this.count; i++) {
        const o = i * 3;
        let vx = (p[o]! - q[o]!) * drag;
        let vy = (p[o + 1]! - q[o + 1]!) * drag;
        let vz = (p[o + 2]! - q[o + 2]!) * drag;
        q[o] = p[o]!;
        q[o + 1] = p[o + 1]!;
        q[o + 2] = p[o + 2]!;
        // Flutter: waves that run down the ribbon, stronger the faster the figure walks.
        const reach = i / (this.count - 1);
        const wave = (Math.sin(t * 11 - i * 1.3) * f.flutter * air + Math.sin(t * 3.1 - i * 0.7) * 0.6) * reach;
        const ax = -gust + right.x * wave;
        const ay = -f.scarfGravity + Math.sin(t * 7 - i) * 0.5 * air * reach;
        const az = right.z * wave;
        vx += ax * h * h;
        vy += ay * h * h;
        vz += az * h * h;
        p[o] = p[o]! + vx;
        p[o + 1] = p[o + 1]! + vy;
        p[o + 2] = p[o + 2]! + vz;
      }
      for (let it = 0; it < 4; it++) {
        this.keepLengths();
        this.collide(body);
      }
    }
    this.writeMesh(right, body, time);
  }

  /** Neighbour points stay one segment apart. Points two apart may not fold onto each other. */
  private keepLengths(): void {
    const p = this.pos;
    for (let i = 1; i < this.count; i++) {
      this.pull(i - 1, i, this.seg);
      if (i >= 2) {
        const o = i * 3;
        const m = (i - 2) * 3;
        const d = Math.hypot(p[o]! - p[m]!, p[o + 1]! - p[m + 1]!, p[o + 2]! - p[m + 2]!);
        if (d < this.seg * 1.4) this.pull(i - 2, i, this.seg * 1.4);
      }
    }
  }

  /**
   * Moves points `a` and `b` so they are `len` apart, half each. Point 0 (the knot) never moves.
   * Moving both halves matters: moving only one side pumps energy into the chain.
   */
  private pull(a: number, b: number, len: number): void {
    const p = this.pos;
    const oa = a * 3;
    const ob = b * 3;
    const dx = p[ob]! - p[oa]!;
    const dy = p[ob + 1]! - p[oa + 1]!;
    const dz = p[ob + 2]! - p[oa + 2]!;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-6) return;
    const k = (d - len) / d;
    const wa = a > 0 ? 0.5 : 0;
    const wb = 1 - wa;
    p[oa] = p[oa]! + dx * k * wa;
    p[oa + 1] = p[oa + 1]! + dy * k * wa;
    p[oa + 2] = p[oa + 2]! + dz * k * wa;
    p[ob] = p[ob]! - dx * k * wb;
    p[ob + 1] = p[ob + 1]! - dy * k * wb;
    p[ob + 2] = p[ob + 2]! - dz * k * wb;
  }

  /** Keeps the ribbon outside the cloak, the hood and the ground. */
  private collide(body: ScarfBody): void {
    const p = this.pos;
    const l = this.local;
    const margin = 0.035;
    for (let i = 1; i < this.count; i++) {
      const o = i * 3;
      this.tmp.set(p[o]!, p[o + 1]!, p[o + 2]!);
      Vector3.TransformCoordinatesToRef(this.tmp, body.inverse, l);
      let moved = false;
      const r = body.radiusAt(l.y);
      if (r > 0) {
        const d = Math.hypot(l.x, l.z);
        const min = r + margin;
        if (d < min) {
          const s = d > 1e-5 ? min / d : 1;
          l.x = d > 1e-5 ? l.x * s : 0;
          l.z = d > 1e-5 ? l.z * s : -min;
          moved = true;
        }
      }
      const hx = l.x - body.hood.x;
      const hy = l.y - body.hood.y;
      const hz = l.z - body.hood.z;
      const hd = Math.sqrt(hx * hx + hy * hy + hz * hz);
      const hmin = body.hoodRadius + margin;
      if (hd < hmin && hd > 1e-5) {
        const s = hmin / hd;
        l.set(body.hood.x + hx * s, body.hood.y + hy * s, body.hood.z + hz * s);
        moved = true;
      }
      if (moved) {
        Vector3.TransformCoordinatesToRef(l, body.world, this.tmp);
        p[o] = this.tmp.x;
        p[o + 1] = this.tmp.y;
        p[o + 2] = this.tmp.z;
      }
      const floor = body.groundY + 0.02;
      if (p[o + 1]! < floor) p[o + 1] = floor;
    }
  }

  /**
   * Builds the ribbon around the chain. The ribbon lies flat on the body where it touches it,
   * and flat in the air (face up) where it flies behind.
   */
  private writeMesh(right: Vector3, body: ScarfBody, time: number): void {
    const p = this.pos;
    const v = this.verts;
    const nrm = this.normals;
    const off = 0.004;
    const m = body.world.m;
    // Body axis: origin and up direction in world space.
    const ox = m[12]!;
    const oz = m[14]!;
    let ux = m[4]!;
    let uy = m[5]!;
    let uz = m[6]!;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    let lsx = right.x;
    let lsy = right.y;
    let lsz = right.z;
    for (let i = 0; i < this.count; i++) {
      const a = Math.max(0, i - 1) * 3;
      const b = Math.min(this.count - 1, i + 1) * 3;
      let dx = p[b]! - p[a]!;
      let dy = p[b + 1]! - p[a + 1]!;
      let dz = p[b + 2]! - p[a + 2]!;
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl;
      dy /= dl;
      dz /= dl;
      const o = i * 3;
      // Wanted ribbon normal: away from the body axis, tipped up a little.
      let rx = p[o]! - ox;
      let rz = p[o + 2]! - oz;
      const rl = Math.hypot(rx, rz) || 1;
      rx /= rl;
      rz /= rl;
      const t = i / (this.count - 1);
      const twist = Math.sin(time * 2.2 + i * 0.6) * 0.3 * t;
      const wx = rx + ux * 0.6 + right.x * twist;
      const wy = uy * 0.6;
      const wz = rz + uz * 0.6 + right.z * twist;
      // Side = direction × wanted normal. Fall back to the last side where they line up.
      let sx = dy * wz - dz * wy;
      let sy = dz * wx - dx * wz;
      let sz = dx * wy - dy * wx;
      let sl = Math.hypot(sx, sy, sz);
      if (sl < 0.15) {
        sx = lsx;
        sy = lsy;
        sz = lsz;
        const dot = sx * dx + sy * dy + sz * dz;
        sx -= dx * dot;
        sy -= dy * dot;
        sz -= dz * dot;
        sl = Math.hypot(sx, sy, sz) || 1;
      }
      sx /= sl;
      sy /= sl;
      sz /= sl;
      // Keep the same side up along the ribbon (no sudden flips).
      if (sx * lsx + sy * lsy + sz * lsz < 0) {
        sx = -sx;
        sy = -sy;
        sz = -sz;
      }
      lsx = sx;
      lsy = sy;
      lsz = sz;
      const nx = dy * sz - dz * sy;
      const ny = dz * sx - dx * sz;
      const nz = dx * sy - dy * sx;
      const w = this.width * 0.5 * (1 - 0.3 * t);
      for (let k = 0; k < 4; k++) {
        const side = k % 2 === 0 ? -1 : 1;
        const face = k < 2 ? 1 : -1;
        const vo = (i * 4 + k) * 3;
        v[vo] = p[o]! + sx * w * side + nx * off * face;
        v[vo + 1] = p[o + 1]! + sy * w * side + ny * off * face;
        v[vo + 2] = p[o + 2]! + sz * w * side + nz * off * face;
        nrm[vo] = nx * face;
        nrm[vo + 1] = ny * face;
        nrm[vo + 2] = nz * face;
      }
    }
    this.mesh.updateVerticesData(VertexBuffer.PositionKind, v, false, false);
    this.mesh.updateVerticesData(VertexBuffer.NormalKind, nrm, false, false);
  }

  dispose(): void {
    this.mesh.dispose();
  }
}
