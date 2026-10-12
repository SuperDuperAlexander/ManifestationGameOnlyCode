import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector';
import { createGlassMaterial } from '../shaders/glassShader';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE, SHADES, color3 } from '../config/palette';
import { TUNING } from '../config/tuning';
import { clamp01, smoothstep } from '../core/Random';

export type BubbleState = 'gone' | 'forming' | 'idle' | 'pushed' | 'dissolving' | 'bursting';

/** What a bubble tells the field when its life ends. */
export interface BubbleHooks {
  /** Dissolved by breathing. */
  passed(b: ThoughtBubble): void;
  /** Sank onto the head and burst (the player did nothing). */
  burst(b: ThoughtBubble): void;
}

const TEX_W = 1024;
const TEX_H = 512;
/** Text plane size inside the cloud (share of the bubble width). */
const TEXT_W = 0.83;

/** Shared geometry and materials of one scene's bubbles. */
export interface BubbleKit {
  cloud: Mesh;
  rim: Mesh;
  sphere: Mesh;
}

/** Puffy cloud in a 1 m wide box (a flattened ellipse of merged spheres). Made in code. */
function cloudGeometry(scene: Scene, name: string, grow: number): Mesh {
  const parts: Mesh[] = [];
  const main = MeshBuilder.CreateSphere(`${name}.core`, { diameter: 1, segments: 8 }, scene);
  main.scaling.set(0.8 * grow, 0.54 * grow, 0.34 * grow);
  parts.push(main);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const d = (0.4 + 0.06 * Math.sin(i * 2.3 + 1)) * grow;
    const p = MeshBuilder.CreateSphere(`${name}.bump${i}`, { diameter: d, segments: 6 }, scene);
    p.position.set(Math.cos(a) * 0.33 * grow, Math.sin(a) * 0.19 * grow, 0);
    p.scaling.z = 0.6;
    parts.push(p);
  }
  const merged = Mesh.MergeMeshes(parts, true, true);
  if (!merged) throw new Error('ThoughtBubble: cloud merge failed');
  merged.name = name;
  merged.isPickable = false;
  merged.setEnabled(false);
  return merged;
}

export function createBubbleKit(scene: Scene): BubbleKit {
  // Group 1 renders after the world; keep its depth so bubbles still hide behind buildings.
  scene.setRenderingAutoClearDepthStencil(1, false);
  const sphere = MeshBuilder.CreateSphere('bubble.sphereT', { diameter: 1, segments: 8 }, scene);
  sphere.isPickable = false;
  sphere.setEnabled(false);
  return { cloud: cloudGeometry(scene, 'bubble.cloudT', 1), rim: cloudGeometry(scene, 'bubble.rimT', 1.035), sphere };
}

/** One comic Thought Bubble (GAME_DESIGN 7.3): spheres rise from the head, then a puffy cloud with text forms. */
export class ThoughtBubble {
  state: BubbleState = 'gone';
  x = 0;
  y = 0;
  z = 0;
  /** Width in metres of the finished bubble. */
  size = 1;
  /** Horizontal unit direction away from the player (set at the push). */
  private dirX = 1;
  private dirZ = 0;
  private t = 0;
  private breathT = 0;
  private silent = false;
  private flash = 0;
  private readonly root: TransformNode;
  private readonly cloud: Mesh;
  private readonly rim: Mesh;
  private readonly textPlane: Mesh;
  private readonly spheres: Mesh[] = [];
  private readonly fill: ShaderMaterial;
  private readonly rimMat: ShaderMaterial;
  private readonly sphereMat: ShaderMaterial;
  private readonly prepass: Mesh;
  private readonly textMat: StandardMaterial;
  private readonly tex: DynamicTexture;
  private readonly ivory = color3(PALETTE.ivory);
  private readonly hot = color3(SHADES.heatOrange);
  private readonly tint = new Color3();

  constructor(scene: Scene, kit: BubbleKit, id: number) {
    this.root = new TransformNode(`bubble.${id}`, scene);
    this.fill = createGlassMaterial(`bubble.fill.${id}`, scene, {
      color: this.ivory,
      edgeColor: color3('#FFFFFF'),
      centerAlpha: TUNING.bubbles.alpha,
      edgeAlpha: TUNING.bubbles.edgeAlpha,
      power: TUNING.bubbles.edgePower,
      streak: TUNING.bubbles.streak,
      shape: new Vector3(2, 3.2, 6),
    });
    this.sphereMat = createGlassMaterial(`bubble.sphereMat.${id}`, scene, {
      color: this.ivory,
      edgeColor: color3('#FFFFFF'),
      centerAlpha: TUNING.bubbles.alpha,
      edgeAlpha: TUNING.bubbles.edgeAlpha,
      power: TUNING.bubbles.edgePower,
      streak: TUNING.bubbles.streak,
      shape: new Vector3(2, 2, 2),
    });
    this.rimMat = createGlassMaterial(`bubble.rimMat.${id}`, scene, {
      color: this.hot,
      edgeColor: this.hot,
      centerAlpha: 0,
      edgeAlpha: TUNING.bubbles.rimAlpha,
      power: TUNING.bubbles.rimPower,
      streak: 0,
      shape: new Vector3(2, 3.2, 6),
    });
    this.tex = new DynamicTexture(`bubble.text.${id}`, { width: TEX_W, height: TEX_H }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    this.tex.hasAlpha = true;
    this.textMat = new StandardMaterial(`bubble.textMat.${id}`, scene);
    this.textMat.disableLighting = true;
    this.textMat.diffuseColor = Color3.Black();
    this.textMat.emissiveTexture = this.tex;
    this.textMat.opacityTexture = this.tex;
    this.textMat.specularColor = Color3.Black();
    this.textMat.backFaceCulling = false;
    this.textMat.disableDepthWrite = true;

    this.cloud = kit.cloud.clone(`bubble.cloud.${id}`);
    this.cloud.material = this.fill;
    this.cloud.parent = this.root;
    // Depth-only copy: only the front-most surface of the blob is drawn by the glass, so no inner lobe rings.
    this.prepass = this.cloud.clone(`bubble.prepass.${id}`);
    const pm = new StandardMaterial(`bubble.prepassMat.${id}`, scene);
    pm.disableColorWrite = true;
    pm.disableLighting = true;
    pm.backFaceCulling = true;
    this.prepass.material = pm;
    this.prepass.parent = this.root;
    this.cloud.alphaIndex = 11;
    this.rim = kit.rim.clone(`bubble.rimMesh.${id}`);
    this.rim.material = this.rimMat;
    this.rim.parent = this.root;
    this.rim.position.z = 0.05;
    this.rim.alphaIndex = 10;
    this.textPlane = MeshBuilder.CreatePlane(`bubble.plane.${id}`, { width: TEXT_W, height: TEXT_W * (TEX_H / TEX_W) }, scene);
    this.textPlane.material = this.textMat;
    this.textPlane.parent = this.root;
    this.textPlane.position.z = -0.2;
    this.textPlane.alphaIndex = 12;
    const meshes = [this.cloud, this.rim, this.textPlane, this.prepass];
    for (let i = 0; i < TUNING.bubbles.sphereSize.length; i++) {
      const s = kit.sphere.clone(`bubble.sphere.${id}.${i}`);
      s.material = this.sphereMat;
      s.alphaIndex = 9;
      meshes.push(s);
      this.spheres.push(s);
    }
    for (const m of meshes) {
      m.renderingGroupId = 1;
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
      m.setEnabled(false);
    }
  }

  get alive(): boolean {
    return this.state !== 'gone';
  }

  /** True while a push can still shove this bubble. */
  get pushable(): boolean {
    return this.state === 'idle' || (this.state === 'forming' && this.t / TUNING.bubbles.formTime >= TUNING.bubbles.pushableAfter);
  }

  /** True while the bubble blocks the next one (alive and not already flying away). */
  get holding(): boolean {
    return this.state !== 'gone' && this.state !== 'pushed';
  }

  spawn(text: string, size: number, cx: number, cy: number, cz: number): void {
    this.size = size;
    this.x = cx;
    this.y = cy;
    this.z = cz;
    this.t = 0;
    this.breathT = 0;
    this.silent = false;
    this.flash = 0;
    this.state = 'forming';
    this.drawText(text);
    this.apply(0, 1, 0, { x: cx, y: cy, z: cz }, 0);
    for (const m of this.all()) m.setEnabled(true);
  }

  push(awayX: number, awayZ: number): void {
    if (!this.pushable) return;
    const d = Math.hypot(awayX, awayZ) || 1;
    this.dirX = awayX / d;
    this.dirZ = awayZ / d;
    this.enter('pushed');
  }

  /** Fade out. `silent` = no effect on anger (anger is gone). */
  dissolve(silent: boolean): void {
    if (this.state !== 'forming' && this.state !== 'idle') return;
    this.silent = silent;
    this.enter('dissolving');
  }

  private enter(s: BubbleState): void {
    this.state = s;
    this.t = 0;
  }

  /** `head`: the player's head top. `cx, cy, cz`: where the bubble wants to float. */
  update(dt: number, head: { x: number; y: number; z: number }, cx: number, cy: number, cz: number, breathing: boolean, hooks: BubbleHooks): void {
    if (this.state === 'gone') return;
    const B = TUNING.bubbles;
    this.t += dt;
    let scaleK = 1;
    let vis = 1;
    let textVis = 1;
    let sphereK = 1;
    const track = Math.min(1, dt * 4);

    switch (this.state) {
      case 'forming': {
        const p = clamp01(this.t / B.formTime);
        const bp = clamp01((p - 0.5) / 0.5);
        scaleK = easeOutBack(bp);
        textVis = smoothstep(0.55, 1, bp);
        this.follow(cx, cy, cz, track);
        if (breathing) this.breathT += dt;
        if (p >= 1) this.enter('idle');
        break;
      }
      case 'idle': {
        scaleK = 1 + 0.025 * Math.sin(this.t * 1.7);
        this.follow(cx, cy + 0.06 * Math.sin(this.t * 1.1), cz, track);
        if (breathing) {
          this.breathT += dt;
          if (this.breathT >= B.breathHold) this.dissolve(false);
        } else {
          this.breathT = Math.max(0, this.breathT - dt);
        }
        if (this.t > B.holdTime) this.enter('bursting');
        break;
      }
      case 'dissolving': {
        const q = clamp01(this.t / B.dissolveTime);
        scaleK = 1 - 0.75 * smoothstep(0, 1, q);
        vis = 1 - smoothstep(0.3, 1, q);
        textVis = 1 - smoothstep(0, 0.5, q);
        sphereK = 1 - smoothstep(0, 0.35, q);
        this.follow(cx, cy + 0.5 * q, cz, track * 0.5);
        if (q >= 1) {
          this.kill();
          if (!this.silent) hooks.passed(this);
          return;
        }
        break;
      }
      case 'pushed': {
        const q = clamp01(this.t / B.pushedTime);
        const v = B.pushedSpeed * (1 - q) + 1;
        this.x += this.dirX * v * dt;
        this.z += this.dirZ * v * dt;
        this.y += (1.2 + 2 * (1 - q)) * dt;
        scaleK = 1 + 0.3 * smoothstep(0, 1, q);
        this.flash = 1 - smoothstep(0, 0.65, q);
        vis = 1 - smoothstep(0.3, 1, q);
        textVis = 1 - smoothstep(0, 0.4, q);
        sphereK = 1 - smoothstep(0, 0.25, q);
        if (q >= 1) {
          this.kill();
          return;
        }
        break;
      }
      case 'bursting': {
        const q = clamp01(this.t / B.burstTime);
        this.follow(head.x, head.y + 0.2, head.z, Math.min(1, dt * 5));
        scaleK = 1 - 0.65 * smoothstep(0, 1, q);
        vis = 1 - smoothstep(0.6, 1, q);
        textVis = 1 - smoothstep(0, 0.4, q);
        sphereK = 1 - smoothstep(0, 0.3, q);
        if (q >= 1) {
          this.kill();
          hooks.burst(this);
          return;
        }
        break;
      }
    }
    this.apply(scaleK, vis, textVis, head, sphereK);
  }

  private follow(cx: number, cy: number, cz: number, k: number): void {
    this.x += (cx - this.x) * k;
    this.y += (cy - this.y) * k;
    this.z += (cz - this.z) * k;
  }

  private kill(): void {
    this.state = 'gone';
    for (const m of this.all()) m.setEnabled(false);
  }

  private all(): Mesh[] {
    return [this.cloud, this.rim, this.textPlane, this.prepass, ...this.spheres];
  }

  /** Faces the camera: set by the field each frame. */
  faceCamera(camX: number, camZ: number): void {
    this.root.rotation.y = Math.atan2(this.x - camX, this.z - camZ);
  }

  private apply(scaleK: number, vis: number, textVis: number, head: { x: number; y: number; z: number }, sphereK: number): void {
    const B = TUNING.bubbles;
    const s = Math.max(0.001, this.size * scaleK);
    this.root.position.set(this.x, this.y, this.z);
    this.root.scaling.set(s, s, s);
    this.fill.setVector4('uCfg', new Vector4(B.alpha, B.edgeAlpha, B.edgePower, vis));
    this.sphereMat.setVector4('uCfg', new Vector4(B.alpha, B.edgeAlpha, B.edgePower, vis));
    this.cloud.visibility = 1;
    this.rimMat.setVector4('uCfg', new Vector4(0, B.rimAlpha, B.rimPower, vis));
    this.textMat.alpha = textVis;
    this.textPlane.visibility = vis;
    this.textPlane.setEnabled(textVis > 0.01 && this.state !== 'gone');
    this.tint.copyFrom(this.ivory).scaleInPlace(1 - this.flash * 0.6).addInPlace(this.hot.scale(this.flash * 0.6));
    this.sphereMat.setColor3('uColor', this.tint);
    this.fill.setColor3('uColor', this.tint);

    // The tail: small spheres from the head toward the bubble, appearing one after another.
    const n = this.spheres.length;
    const endY = this.y - this.size * 0.28;
    const baseY = head.y + 0.05;
    const wide = this.size / B.width;
    for (let i = 0; i < n; i++) {
      const m = this.spheres[i]!;
      const grow = easeOutBack(clamp01((this.stateTime() - i * 0.14 * B.formTime) / 0.3));
      const k = B.spherePath[i]!;
      const bob = Math.sin(this.t * 2.2 + i * 1.3) * 0.03;
      m.position.set(head.x + (this.x - head.x) * k, baseY + (endY - baseY) * k + bob, head.z + (this.z - head.z) * k);
      const d = B.sphereSize[i]! * (0.75 + 0.25 * wide) * grow * sphereK;
      m.scaling.setAll(Math.max(0.001, d));
      m.setEnabled(d > 0.004);
    }
  }

  /** Time since spawn for the sphere cascade (the state clock restarts, so forming time is kept apart). */
  private stateTime(): number {
    return this.state === 'forming' ? this.t : 99;
  }

  private drawText(text: string): void {
    const ctx = this.tex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, TEX_W, TEX_H);
    const maxW = TEX_W * 0.86;
    let size = 112;
    let lines: string[] = [];
    for (; size >= 40; size -= 6) {
      ctx.font = `500 ${size}px "Work Sans", system-ui, sans-serif`;
      lines = wrap(ctx, text, maxW);
      if (lines.length <= 3 && lines.length * size * 1.15 < TEX_H * 0.8) break;
    }
    // Soft frosted pad behind the text so it reads over any background.
    const pad = ctx.createRadialGradient(TEX_W / 2, TEX_H / 2, 0, TEX_W / 2, TEX_H / 2, TEX_W * 0.46);
    pad.addColorStop(0, 'rgba(244,238,223,0.62)');
    pad.addColorStop(0.7, 'rgba(244,238,223,0.4)');
    pad.addColorStop(1, 'rgba(244,238,223,0)');
    ctx.save();
    ctx.translate(TEX_W / 2, TEX_H / 2);
    ctx.scale(1, 0.62);
    ctx.translate(-TEX_W / 2, -TEX_H / 2);
    ctx.fillStyle = pad;
    ctx.fillRect(0, 0, TEX_W, TEX_H);
    ctx.restore();
    // Soft diagonal highlight streaks (fake glass reflection).
    ctx.save();
    ctx.translate(TEX_W / 2, TEX_H / 2);
    ctx.rotate(-0.5);
    for (const [ox, w, a] of [[-0.3, 0.07, 0.16], [-0.18, 0.025, 0.12]] as const) {
      const g = ctx.createLinearGradient((ox - w) * TEX_W, 0, (ox + w) * TEX_W, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect((ox - w) * TEX_W, -TEX_H, 2 * w * TEX_W, TEX_H * 2);
    }
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lh = size * 1.15;
    const y0 = TEX_H / 2 - ((lines.length - 1) * lh) / 2;
    // Light halo, then opaque ink.
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = 'rgba(244,238,223,0.75)';
    ctx.shadowColor = 'rgba(244,238,223,0.9)';
    ctx.shadowBlur = size * 0.2;
    lines.forEach((l, i) => ctx.strokeText(l, TEX_W / 2, y0 + i * lh));
    ctx.shadowBlur = 0;
    ctx.fillStyle = SHADES.ink;
    lines.forEach((l, i) => ctx.fillText(l, TEX_W / 2, y0 + i * lh));
    this.tex.update();
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(test).width > maxW) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function easeOutBack(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
