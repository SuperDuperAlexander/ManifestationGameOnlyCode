import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { PALETTE, SHADES, color3 } from '../config/palette';
import { createPaperMaterial } from '../shaders/paperShader';

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (v: number): number => {
  const k = clamp01(v);
  return k * k * (3 - 2 * k);
};

/**
 * Soft gold chevrons on the ground that flow from the player toward the current target,
 * plus one larger floating chevron when the target is far away.
 * One mesh, one material, thin instances: one draw call.
 */
export class Wayfinding {
  private readonly mesh: Mesh;
  private readonly matrices: Float32Array;
  private readonly colors: Float32Array;
  private readonly total: number;
  private readonly tint: Color3;
  private readonly under: Color3;
  private readonly reduced = reducedMotion();
  private time = 0;
  private level = 0;
  private far = 0;

  constructor(
    scene: Scene,
    private readonly groundY: (x: number, z: number) => number,
  ) {
    const W = TUNING.wayfinding;
    this.total = W.count * 2 + 1;
    const hw = W.width / 2;
    const hl = W.length / 2;
    const th = W.thickness;
    // Chevron lying on the ground, pointing +Z.
    const positions = [-hw, 0, -hl, 0, 0, hl, hw, 0, -hl, -hw, 0, -hl - th, 0, 0, hl - th, hw, 0, -hl - th];
    const indices = [0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4];
    const normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
    const uvs = [0, 0, 0.5, 1, 1, 0, 0, 0, 0.5, 1, 1, 0];
    this.mesh = new Mesh('wayfinding.chevrons', scene);
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.normals = normals;
    vd.uvs = uvs;
    vd.applyToMesh(this.mesh);
    this.mesh.material = createPaperMaterial('wayfinding.mat', scene, { alphaBlend: true, depthWrite: false });
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.matrices = new Float32Array(this.total * 16);
    this.colors = new Float32Array(this.total * 4);
    this.tint = Color3.Lerp(color3(PALETTE.gold), color3(SHADES.lanternWarm), W.warmMix);
    this.under = color3(SHADES.timberDark);
    this.mesh.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    this.mesh.thinInstanceSetBuffer('color', this.colors, 4, false);
    this.mesh.setEnabled(false);
  }

  /** `target` is the ground point to go to, or null (no target, busy, or transition). */
  update(dt: number, player: Vector3, target: Vector3 | null): void {
    const W = TUNING.wayfinding;
    let dx = 0;
    let dz = 0;
    let dist = 0;
    if (target) {
      dx = target.x - player.x;
      dz = target.z - player.z;
      dist = Math.hypot(dx, dz);
    }
    const valid = !!target && dist > W.fadeEnd;
    const wantLevel = valid ? smooth((dist - W.fadeEnd) / (W.fadeNear - W.fadeEnd)) : 0;
    const wantFar = valid ? smooth((dist - W.farDistance) / 4) : 0;
    const k = Math.min(1, dt * W.fadeSpeed);
    this.level += (wantLevel - this.level) * k;
    this.far += (wantFar - this.far) * k;
    if (this.level < 0.01 && this.far < 0.01) {
      this.mesh.setEnabled(false);
      return;
    }
    this.mesh.setEnabled(true);
    if (!this.reduced) this.time += dt;
    // Keep the last direction while fading out.
    if (dist > 1e-3) {
      this.dirX = dx / dist;
      this.dirZ = dz / dist;
    }
    const ux = this.dirX;
    const uz = this.dirZ;
    const yaw = Math.atan2(ux, uz);
    const phase = this.reduced ? 0.5 : (this.time * W.flowSpeed / W.spacing) % 1;
    const reach = Math.min(W.maxLength, dist - W.fadeEnd);
    for (let i = 0; i < W.count; i++) {
      const u = i + phase;
      const s = W.startOffset + u * W.spacing;
      const env = this.reduced ? Math.sin(Math.PI * (i + 0.5) / W.count) * 0.6 + 0.4 : Math.sin(Math.PI * u / W.count);
      const reachFade = clamp01((reach - s) / 1.5 + 0.2);
      const x = player.x + ux * s;
      const z = player.z + uz * s;
      const a = this.level * env * reachFade;
      const y = this.groundY(x, z) + W.groundOffset;
      this.put(i, x, y - 0.03, z, yaw, W.underScale, a * W.underAlpha, this.under);
      this.put(W.count + i, x, y, z, yaw, 1, a * W.alpha);
    }
    const bob = this.reduced ? 0 : Math.sin(this.time * W.farBobSpeed) * W.farBob;
    const fx = player.x + ux * W.farForward;
    const fz = player.z + uz * W.farForward;
    this.put(W.count * 2, fx, player.y + W.farHeight + bob, fz, yaw, W.farScale, this.far * W.farAlpha);
    this.mesh.thinInstanceBufferUpdated('matrix');
    this.mesh.thinInstanceBufferUpdated('color');
  }

  private dirX = 0;
  private dirZ = 1;

  private put(i: number, x: number, y: number, z: number, yaw: number, scale: number, alpha: number, col: Color3 = this.tint): void {
    const c = Math.cos(yaw) * scale;
    const s = Math.sin(yaw) * scale;
    const m = this.matrices;
    const o = i * 16;
    m[o] = c;
    m[o + 1] = 0;
    m[o + 2] = -s;
    m[o + 3] = 0;
    m[o + 4] = 0;
    m[o + 5] = scale;
    m[o + 6] = 0;
    m[o + 7] = 0;
    m[o + 8] = s;
    m[o + 9] = 0;
    m[o + 10] = c;
    m[o + 11] = 0;
    m[o + 12] = x;
    m[o + 13] = y;
    m[o + 14] = z;
    m[o + 15] = 1;
    const q = i * 4;
    this.colors[q] = col.r;
    this.colors[q + 1] = col.g;
    this.colors[q + 2] = col.b;
    this.colors[q + 3] = alpha;
  }
}
