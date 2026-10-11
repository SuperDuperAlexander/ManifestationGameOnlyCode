import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { damp } from '../core/Random';
import { createPaperMaterial, curveDrop, setPaperColor, type PaperMaterial } from '../shaders/paperShader';
import { procTexture } from '../world/ProceduralTextures';

export type FairyMode = 'away' | 'arriving' | 'orbit' | 'visiting' | 'returning' | 'leading';

/**
 * The fairy: a small pale-gold orb with two soft wings and a trail of light.
 * She circles the player at head height, flies to things worth seeing, and comes back.
 */
export class Fairy {
  readonly root: TransformNode;
  readonly position = new Vector3(0, 30, 80);
  mode: FairyMode = 'away';
  private readonly orb: Mesh;
  private readonly wings: Mesh[] = [];
  private readonly halo: Mesh;
  private readonly haloMat: PaperMaterial;
  private readonly glowCard: Mesh;
  private readonly glowMat: PaperMaterial;
  private readonly shadow: Mesh;
  private readonly trail: ParticleSystem;
  private readonly trailEmitter = new Vector3();
  private readonly target = new Vector3();
  private readonly velocity = new Vector3();
  private orbitAngle = 0;
  private time = 0;
  /** Extra brightness, 0..1 (when showing something). */
  private boost = 0;
  private boostTarget = 0;
  private arriveResolve: (() => void) | null = null;
  private visitTarget: Vector3 | null = null;

  constructor(scene: Scene) {
    this.root = new TransformNode('fairy', scene);

    const orbMat = createPaperMaterial('fairy.orbMat', scene, { color: new Color4(1, 0.97, 0.86, 1), haze: false });
    this.orb = MeshBuilder.CreateSphere('fairy.orb', { diameter: 0.24, segments: 12 }, scene);
    this.orb.material = orbMat;
    this.orb.parent = this.root;

    const wingMat = createPaperMaterial('fairy.wingMat', scene, {
      texture: procTexture(scene, 'wing'),
      alphaBlend: true,
      haze: false,
    });
    for (const side of [-1, 1]) {
      const wing = MeshBuilder.CreatePlane(`fairy.wing${side}`, { width: 0.56, height: 0.56 }, scene);
      // The wing starts at the body (x = 0) and reaches outward; the left one is mirrored.
      wing.bakeTransformIntoVertices(Matrix.Translation(0.28, 0, 0));
      wing.position.set(0, 0.06, 0.03);
      wing.scaling.x = side;
      wing.material = wingMat;
      wing.parent = this.root;
      this.wings.push(wing);
    }

    this.haloMat = createPaperMaterial('fairy.haloMat', scene, {
      texture: procTexture(scene, 'halo'),
      additive: true,
      haze: false,
    });
    this.halo = MeshBuilder.CreatePlane('fairy.halo', { size: 1.1 }, scene);
    this.halo.billboardMode = TransformNode.BILLBOARDMODE_ALL;
    this.halo.material = this.haloMat;
    this.halo.parent = this.root;

    this.glowMat = createPaperMaterial('fairy.glowMat', scene, {
      texture: procTexture(scene, 'halo'),
      additive: true,
      haze: false,
    });
    this.glowCard = MeshBuilder.CreatePlane('fairy.glow', { size: 3.4 }, scene);
    this.glowCard.billboardMode = TransformNode.BILLBOARDMODE_ALL;
    this.glowCard.material = this.glowMat;
    this.glowCard.parent = this.root;

    this.shadow = MeshBuilder.CreateGround('fairy.shadow', { width: 0.7, height: 0.5 }, scene);
    this.shadow.material = createPaperMaterial('fairy.shadowMat', scene, {
      texture: procTexture(scene, 'shadow'),
      alphaBlend: true,
      color: new Color4(1, 1, 1, 0.5),
    });

    for (const m of [this.orb, ...this.wings, this.halo, this.glowCard, this.shadow]) {
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
    }

    const ps = new ParticleSystem('fairy.trail', 160, scene);
    ps.particleTexture = procTexture(scene, 'dot');
    ps.emitter = this.trailEmitter;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.minEmitBox = new Vector3(-0.05, -0.05, -0.05);
    ps.maxEmitBox = new Vector3(0.05, 0.05, 0.05);
    ps.color1 = new Color4(1, 0.95, 0.8, 0.9);
    ps.color2 = new Color4(0.92, 0.77, 0.48, 0.8);
    ps.colorDead = new Color4(0.92, 0.77, 0.48, 0);
    ps.minSize = 0.04;
    ps.maxSize = 0.11;
    ps.minLifeTime = 0.5;
    ps.maxLifeTime = 1.1;
    ps.emitRate = 45;
    ps.direction1 = new Vector3(-0.1, -0.25, -0.1);
    ps.direction2 = new Vector3(0.1, -0.05, 0.1);
    ps.minEmitPower = 0.2;
    ps.maxEmitPower = 0.5;
    ps.gravity = new Vector3(0, -0.15, 0);
    ps.start();
    this.trail = ps;
    this.setVisible(false);
  }

  private setVisible(v: boolean): void {
    this.root.setEnabled(v);
    this.shadow.setEnabled(v);
    this.trail.emitRate = v ? 45 : 0;
  }

  /** Starts far away in the sky and flies to the player. Resolves on arrival. */
  arrive(from: Vector3): Promise<void> {
    this.position.copyFrom(from);
    this.velocity.set(0, 0, 0);
    this.mode = 'arriving';
    this.setVisible(true);
    return new Promise((resolve) => {
      this.arriveResolve = resolve;
    });
  }

  /** Flies to a point and hovers there, brighter, until `comeBack()` is called. Resolves on arrival. */
  visit(point: Vector3): Promise<void> {
    this.visitTarget = point.clone();
    this.mode = 'visiting';
    this.boostTarget = 1;
    return new Promise((resolve) => {
      this.arriveResolve = resolve;
    });
  }

  comeBack(): void {
    this.visitTarget = null;
    this.boostTarget = 0;
    if (this.mode !== 'away') this.mode = 'returning';
  }

  /** A short bright pulse (a fog released, a plank placed). */
  pulse(): void {
    this.boost = 1;
  }

  get isHome(): boolean {
    return this.mode === 'orbit';
  }

  update(dt: number, playerPos: Vector3): void {
    this.time += dt;
    const f = TUNING.fairy;
    this.orbitAngle += f.orbitSpeed * dt;
    const bob = Math.sin(this.time * 2.1) * f.bobAmplitude;

    // Where she wants to be.
    if (this.mode === 'visiting' && this.visitTarget) {
      this.target.set(
        this.visitTarget.x + Math.cos(this.time * 1.3) * 0.5,
        this.visitTarget.y + bob,
        this.visitTarget.z + Math.sin(this.time * 1.3) * 0.3,
      );
    } else {
      // Orbit: a slow ellipse around the head, a little behind so she never hides the figure.
      this.target.set(
        playerPos.x + Math.cos(this.orbitAngle) * f.orbitRadius,
        playerPos.y + f.orbitHeight + bob,
        playerPos.z + Math.sin(this.orbitAngle) * f.orbitRadius * 0.7 + 0.2,
      );
    }

    if (this.mode !== 'away') {
      // Smooth flight with a speed limit: calm, never snapping.
      const dx = this.target.x - this.position.x;
      const dy = this.target.y - this.position.y;
      const dz = this.target.z - this.position.z;
      const dist = Math.hypot(dx, dy, dz);
      const speed = this.mode === 'orbit' ? f.flySpeed * 1.5 : f.flySpeed;
      const want = Math.min(dist * f.followSharpness, speed);
      const k = damp(3, dt);
      if (dist > 0.0001) {
        this.velocity.x += ((dx / dist) * want - this.velocity.x) * k;
        this.velocity.y += ((dy / dist) * want - this.velocity.y) * k;
        this.velocity.z += ((dz / dist) * want - this.velocity.z) * k;
      }
      this.position.addInPlace(this.velocity.scale(dt));

      const arrived = dist < 0.6;
      if (arrived && (this.mode === 'arriving' || this.mode === 'returning')) this.mode = 'orbit';
      if (arrived && this.arriveResolve && this.mode !== 'returning') {
        const r = this.arriveResolve;
        this.arriveResolve = null;
        r();
      }
    }

    this.root.position.copyFrom(this.position);

    // Wings flap as paper: the card narrows and widens.
    const flap = 0.3 + 0.7 * Math.abs(Math.cos(this.time * 13));
    for (const w of this.wings) {
      w.scaling.y = 0.9 + 0.1 * flap;
      w.scaling.x = (w.scaling.x < 0 ? -1 : 1) * flap;
    }

    // Glow: brighter when showing something.
    this.boost = Math.max(this.boostTarget, this.boost - dt * 0.8);
    const pulse = 0.85 + 0.15 * Math.sin(this.time * 3.2);
    setPaperColor(this.haloMat, new Color4(1, 1, 1, (0.75 + 0.25 * this.boost) * pulse));
    setPaperColor(this.glowMat, new Color4(1, 1, 1, 0.22 + 0.4 * this.boost));
    const gs = 1 + this.boost * 0.5;
    this.glowCard.scaling.set(gs, gs, gs);

    // Shadow on the ground under her; particles follow the bent world by hand.
    this.shadow.position.set(this.position.x, playerPos.y + 0.03, this.position.z);
    const sh = Math.max(0.3, 1 - (this.position.y - playerPos.y) / 6);
    this.shadow.scaling.set(sh, 1, sh);
    this.trailEmitter.set(this.position.x, this.position.y - curveDrop(this.position.z), this.position.z);
  }
}
