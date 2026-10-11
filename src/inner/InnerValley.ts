import type { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PALETTE } from '../config/palette';
import { TUNING } from '../config/tuning';
import { InputManager } from '../core/InputManager';
import { isTouchDevice } from '../core/Performance';
import { PlayerVisual } from '../player/PlayerVisual';
import { BreathSystem } from '../player/BreathSystem';
import { BreathVisuals } from '../player/BreathVisuals';
import { Joystick } from '../ui/Joystick';
import { BreathButton } from '../ui/BreathButton';
import { WORLD_UNIFORMS, createPaperMaterial } from '../shaders/paperShader';
import type { World, WorldId } from '../game/World';
import { VALLEY_UNIFORMS, createValleyMaterial } from './valleyShader';
import { ValleyTerrain } from './ValleyTerrain';
import { ValleyProps, type Collider } from './ValleyProps';
import { ValleySky, buildFarMountains } from './ValleySky';
import { buildRiver, buildStream, buildWaterfall } from './ValleyWater';
import { ValleyWalker, type WalkGround } from './ValleyWalker';
import { FollowCamera } from './FollowCamera';
import { LAYOUT } from './innerLayout';
import { buildTree, type TreeHandle } from '../world/TreeBuilder';
import { AngerImp, type ImpState } from './AngerImp';
import { OLD_TREE } from '../world/TreeShape';
import { procTexture } from '../world/ProceduralTextures';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import type { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';

/** One piece of a root centre line in world space, used for walking over roots. */
interface RootSeg {
  ax: number;
  az: number;
  ay: number;
  ar: number;
  bx: number;
  bz: number;
  by: number;
  br: number;
}

const FOG_NORMAL = Color3.FromHexString(PALETTE.ivory);
const FOG_BRIGHT = Color3.FromHexString(PALETTE.gold);

/**
 * The Inner World: a small calm valley (GAME_DESIGN 5.2) with the Source (pond + waterfall),
 * an entrance light column and a clear centre for the future Inner Tree.
 * Own Scene on the shared Engine. The Game renders it; this class never starts a render loop.
 */
export class InnerValley implements World, WalkGround {
  readonly id: WorldId = 'inner';
  readonly scene: Scene;
  private readonly input = new InputManager();
  private readonly terrain: ValleyTerrain;
  private readonly walker: ValleyWalker;
  private readonly cam: FollowCamera;
  get camera(): FreeCamera {
    return this.cam.camera;
  }
  readonly visual: PlayerVisual;
  private readonly breath = new BreathSystem();
  private readonly breathVisuals: BreathVisuals;
  private readonly touch: boolean;
  private readonly root: HTMLDivElement;
  private active = false;
  private readonly diamond = new Vector3();
  private shoveLeft = { x: 0, z: 0 };
  private slowFactor = 1;
  private slowTime = 0;
  private tree!: TreeHandle;
  private rootSegs: RootSeg[] = [];
  private burnedVisible = false;
  private rootHealthValue = 0;
  private stream!: Mesh;
  private drops!: ParticleSystem;
  private dropAt = new Vector3();
  private flow = 0;
  imp!: AngerImp;

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    ui: HTMLElement,
  ) {
    this.touch = isTouchDevice() || new URLSearchParams(location.search).has('touch');
    const scene = new Scene(engine);
    this.scene = scene;
    this.applyMood();
    scene.clearColor = Color4.FromColor3(VALLEY_UNIFORMS.fogColor, 1);
    scene.skipPointerMovePicking = true;
    scene.skipPointerDownPicking = true;
    scene.skipPointerUpPicking = true;
    scene.autoClear = false;

    const solid = createValleyMaterial('inner.solid', scene);
    const ground = createValleyMaterial('inner.ground', scene, { ground: true });
    const plants = createValleyMaterial('inner.plants', scene, { wind: true, painted: true });
    const grass = createValleyMaterial('inner.grass', scene, { wind: true, backFaceCulling: false });
    const far = createValleyMaterial('inner.far', scene, { unlit: true, fog: 0, backFaceCulling: false });
    const water = createValleyMaterial('inner.water', scene, { water: true, backFaceCulling: false });
    const falls = createValleyMaterial('inner.falls', scene, { falls: true, backFaceCulling: false });

    new ValleySky(scene);
    buildFarMountains(scene).material = far;
    this.terrain = new ValleyTerrain(scene, ground);
    buildRiver(scene, this.terrain, water);
    buildWaterfall(scene, this.terrain, falls, LAYOUT.waterfall);
    const props = new ValleyProps(scene, this.terrain, { plants, solid, grass });
    this.terrain.paintShadows(props.shadows);
    this.buildEntrance();
    this.buildInnerTree(solid, plants, water, props.colliders);

    // Own DOM container: hidden while this world is not active.
    this.root = document.createElement('div');
    this.root.className = 'inner-ui';
    this.root.style.display = 'none';
    ui.appendChild(this.root);
    let right: HTMLElement | null = null;
    if (this.touch) {
      const left = document.createElement('div');
      left.className = 'touch-zone touch-left';
      right = document.createElement('div');
      right.className = 'touch-zone touch-right';
      this.root.append(left, right);
      new Joystick(this.root, this.input, left);
      new BreathButton(this.root, this.input);
    }
    this.input.attach();
    this.input.enabled = false;

    this.walker = new ValleyWalker(this.input, this, props.colliders);
    const s = LAYOUT.start;
    this.walker.place(s.x, s.z, s.heading);
    this.walker.canMove = false;
    this.visual = new PlayerVisual(scene);
    this.cam = new FollowCamera(scene, this.terrain, canvas, right);
    this.cam.snapTo(this.walker.position, s.heading);
    this.breathVisuals = new BreathVisuals(scene);
    // The Anger Imp stands in its clearing, hidden until reveal() (reveal rule: after the bump).
    const w = LAYOUT.waveSource;
    const impFacing = Math.atan2(-w.x, 4 - w.z);
    this.imp = new AngerImp(scene, new Vector3(w.x, this.terrain.height(w.x, w.z), w.z), impFacing, {
      spitTarget: this.burnedRootTip(),
      clueDir: new Vector3(LAYOUT.alleyDir.x, 0, LAYOUT.alleyDir.z),
    });
    this.imp.setVisible(false);
    window.addEventListener('resize', () => this.cam.onResize());
  }

  groundAt(x: number, z: number): number | null {
    const t = this.terrain;
    if (t.isWater(x, z) || t.rimDistance(x, z) > TUNING.inner.walkLimit) return null;
    return t.height(x, z) + (this.rootSegs.length ? this.rootBump(x, z) : 0);
  }

  onDeck(): boolean {
    return false;
  }

  /** Soft column of light where the player arrives (LAYOUT.entrance). */
  private buildEntrance(): void {
    const e = TUNING.inner.entrance;
    const at = LAYOUT.entrance;
    const y = this.terrain.height(at.x, at.z);
    const gold = Color3.FromHexString(PALETTE.gold);
    const mat = createPaperMaterial('inner.entranceMat', this.scene, {
      color: new Color4(gold.r, gold.g, gold.b, e.alpha),
      alphaBlend: true,
      haze: false,
      curve: false,
      depthWrite: false,
    });
    const col = MeshBuilder.CreateCylinder(
      'inner.entranceColumn',
      { diameterTop: e.radius * 1.6, diameterBottom: e.radius * 2.4, height: e.height, tessellation: 20, cap: Mesh.NO_CAP },
      this.scene,
    );
    col.position.set(at.x, y + e.height / 2, at.z);
    const base = MeshBuilder.CreateDisc('inner.entranceBase', { radius: e.radius * 1.7, tessellation: 28 }, this.scene);
    base.rotation.x = Math.PI / 2;
    base.position.set(at.x, y + 0.05, at.z);
    for (const m of [col, base]) {
      m.material = mat;
      m.isPickable = false;
      m.freezeWorldMatrix();
    }
  }

  /** The giant Inner Tree: same silhouette as the Old Tree, huge roots above ground (GAME_DESIGN 5.2). */
  private buildInnerTree(solid: ShaderMaterial, plants: ShaderMaterial, water: ShaderMaterial, colliders: Collider[]): void {
    const T = TUNING.tree;
    const at = LAYOUT.tree;
    const scale = T.innerScale;
    const base = new Vector3(at.x, this.terrain.height(at.x, at.z) - 0.1, at.z);
    const burned = LAYOUT.burnedRoot;
    this.tree = buildTree(this.scene, OLD_TREE, scale, {
      position: base,
      woodMaterial: solid,
      leafMaterial: plants,
      dynamicBranches: [OLD_TREE.dryBranch],
      dynamicRoots: [burned],
      branchHealth: 0,
      rootHealth: 1,
    });
    colliders.push({ x: at.x, z: at.z, radius: T.trunkCollider * scale });

    // Walkable roots: the ground rises over each root.
    for (let i = 0; i < OLD_TREE.roots.length; i++) {
      const s = this.tree.rootSamples(i);
      for (let k = 2; k < s.length - 1; k++) {
        const a = s[k]!;
        const b = s[k + 1]!;
        this.rootSegs.push({
          ax: base.x + a.x,
          az: base.z + a.z,
          ay: a.y,
          ar: a.r,
          bx: base.x + b.x,
          bz: base.z + b.z,
          by: b.y,
          br: b.r,
        });
      }
    }

    // Source water: pond end -> tip of the burned root -> along the root toward the trunk.
    const s = this.tree.rootSamples(burned);
    const pts: Vector3[] = [];
    const from = LAYOUT.river.points[LAYOUT.river.points.length - 1]!;
    const tip = s[s.length - 1]!;
    const tx = base.x + tip.x;
    const tz = base.z + tip.z;
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const e = t * t * (3 - 2 * t);
      const x = from[0] + (tx - from[0]) * t + Math.sin(t * Math.PI) * 2.2;
      const z = from[1] + (tz - from[1]) * e;
      pts.push(new Vector3(x, Math.max(this.terrain.height(x, z), LAYOUT.river.level) + T.water.lift, z));
    }
    for (let k = s.length - 2; k >= 4; k--) {
      const p = s[k]!;
      pts.push(new Vector3(base.x + p.x, base.y + p.y + p.r * 0.98 + T.water.lift * 0.5, base.z + p.z));
    }
    this.stream = buildStream(this.scene, pts, T.water.halfWidth, water);
    this.stream.setEnabled(false);

    const ps = new ParticleSystem('inner.sourceDrops', T.water.dropCapacity, this.scene);
    ps.particleTexture = procTexture(this.scene, 'dot');
    ps.color1 = new Color4(0.75, 0.88, 1, 0.9);
    ps.color2 = new Color4(0.6, 0.78, 0.95, 0.8);
    ps.colorDead = new Color4(0.7, 0.85, 1, 0);
    ps.minSize = 0.12;
    ps.maxSize = 0.28;
    ps.minLifeTime = 0.8;
    ps.maxLifeTime = 1.5;
    const mid = s[Math.floor(s.length * 0.45)]!;
    const mx = base.x + mid.x;
    const mz = base.z + mid.z;
    const l = Math.hypot(mx - at.x, mz - at.z) || 1;
    // Drops flow toward the trunk.
    const ux = -(mx - at.x) / l;
    const uz = -(mz - at.z) / l;
    this.dropAt.set(mx, base.y + mid.y + mid.r + 0.25, mz);
    ps.emitter = this.dropAt;
    ps.minEmitBox = new Vector3(-0.8, 0, -0.8);
    ps.maxEmitBox = new Vector3(0.8, 0.2, 0.8);
    ps.direction1 = new Vector3(ux * 1.2 - 0.2, 0.8, uz * 1.2 - 0.2);
    ps.direction2 = new Vector3(ux * 2 + 0.2, 1.6, uz * 2 + 0.2);
    ps.minEmitPower = 0.8;
    ps.maxEmitPower = 1.6;
    ps.gravity = new Vector3(0, -3.5, 0);
    ps.emitRate = 0;
    ps.start();
    this.drops = ps;
    this.setBurnedRootVisible(false);
  }

  /** Ground bump where a root lies: the player can walk over and along roots. */
  private rootBump(x: number, z: number): number {
    const w = TUNING.tree.walk;
    let best = 0;
    for (const sg of this.rootSegs) {
      const dx = sg.bx - sg.ax;
      const dz = sg.bz - sg.az;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.min(1, Math.max(0, ((x - sg.ax) * dx + (z - sg.az) * dz) / len2));
      const px = sg.ax + dx * t - x;
      const pz = sg.az + dz * t - z;
      const r = sg.ar + (sg.br - sg.ar) * t;
      const half = r * w.widthK;
      const d = Math.hypot(px, pz);
      if (d >= half) continue;
      const flat = r * w.flatK;
      const f = d <= flat ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (d - flat)) / (half - flat));
      const top = sg.ay + (sg.by - sg.ay) * t + r * w.topK;
      if (top > 0) best = Math.max(best, top * f);
    }
    return best;
  }

  /** Health of the burned root (0 = burned, 1 = healed). Shown once setBurnedRootVisible(true). */
  setRootHealth(v: number): void {
    this.rootHealthValue = Math.min(1, Math.max(0, v));
    this.applyBurnedRoot();
  }

  /** Reveal rule: before the bump the root is healthy and there is no fire. */
  setBurnedRootVisible(visible: boolean): void {
    this.burnedVisible = visible;
    this.applyBurnedRoot();
  }

  /** The dry branch (same index as outside). */
  setBranchHealth(v: number): void {
    this.tree.setBranchHealth(OLD_TREE.dryBranch, v);
  }

  /** Reveal rule: the imp and the burned root appear (after the bump). Root health starts at 0. */
  reveal(): void {
    this.imp.setVisible(true);
    this.setBurnedRootVisible(true);
    this.setRootHealth(0);
  }

  setImpState(s: ImpState): void {
    this.imp.setState(s);
  }

  /** Anger 0..1 drives the imp's rage. */
  setAnger(v: number): void {
    this.imp.setRage(v);
  }

  /** Puts the player at (x, z) and snaps the camera. */
  teleport(x: number, z: number): void {
    this.walker.place(x, z, this.walker.heading);
    this.cam.snapTo(this.walker.position, this.walker.heading);
  }

  private applyBurnedRoot(): void {
    this.tree.setRootHealth(LAYOUT.burnedRoot, this.burnedVisible ? this.rootHealthValue : 1);
  }

  /** World position of the tip of the burned root (next to the imp clearing). */
  burnedRootTip(): Vector3 {
    const s = this.tree.rootSamples(LAYOUT.burnedRoot);
    const t = s[s.length - 1]!;
    const p = this.tree.root.position;
    return new Vector3(p.x + t.x, p.y + t.y, p.z + t.z);
  }

  private applyMood(): void {
    const m = TUNING.inner.mood;
    VALLEY_UNIFORMS.mood = m;
    Color3.LerpToRef(FOG_NORMAL, FOG_BRIGHT, Math.max(0, m), VALLEY_UNIFORMS.fogColor);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.input.enabled = active;
    this.walker.canMove = active;
    this.root.style.display = active ? '' : 'none';
    if (active) {
      // The shared paper shader must not bend this world.
      WORLD_UNIFORMS.pivotZ = 1e6;
      this.applyMood();
      const f = VALLEY_UNIFORMS.fogColor;
      this.scene.clearColor.set(f.r, f.g, f.b, 1);
      this.cam.onResize();
    } else {
      this.input.touchMoveX = 0;
      this.input.touchMoveY = 0;
      this.input.touchBreathHeld = false;
    }
  }

  update(dt: number): void {
    if (!this.active) return;
    dt = Math.min(0.05, dt);
    this.input.update();
    this.breath.update(dt, { inhale: this.input.inhaleHeld, exhale: this.input.exhaleHeld, releaseExhales: this.touch });
    this.slowTime = Math.max(0, this.slowTime - dt);
    this.walker.speedFactor = (this.breath.state === 'idle' ? 1 : 0.6) * (this.slowTime > 0 ? this.slowFactor : 1);
    this.walker.update(dt, this.cam.yaw);
    this.applyShove(dt);
    const p = this.walker.position;
    this.visual.root.position.copyFrom(p);
    this.breathVisuals.update(dt, this.breath, p);
    this.visual.update(dt, {
      speed: this.walker.speed,
      speedRatio: this.walker.speedRatio,
      heading: this.walker.heading,
      breathLevel: this.breath.breathLevel,
      glow: this.breathVisuals.glow,
      awake: 1,
    });
    this.cam.update(dt, p, this.walker.heading, this.walker.speedRatio);
    this.tree.update(dt);
    this.imp.lookAt(p);
    this.imp.update(dt);
    const target = this.burnedVisible ? this.rootHealthValue : 0;
    this.flow += (target - this.flow) * Math.min(1, dt * 2);
    const on = this.flow > 0.02;
    if (this.stream.isEnabled() !== on) this.stream.setEnabled(on);
    this.drops.emitRate = on ? TUNING.tree.water.dropRate * this.flow : 0;
    VALLEY_UNIFORMS.time += dt;
    VALLEY_UNIFORMS.camPos.copyFrom(this.cam.camera.position);
    WORLD_UNIFORMS.time = VALLEY_UNIFORMS.time;
    WORLD_UNIFORMS.pivotZ = 1e6;
    this.input.endFrame();
  }

  onBreathDone(cb: () => void): void {
    this.breath.onBreathDone(() => cb());
  }

  simulateBreath(): void {
    this.breath.simulate();
  }

  breathState(): string {
    return this.breath.state;
  }

  shove(dx: number, dz: number): void {
    this.shoveLeft.x += dx;
    this.shoveLeft.z += dz;
  }

  slow(factor: number, seconds: number): void {
    this.slowFactor = factor;
    this.slowTime = seconds;
  }

  /** Spends the pending shove over about 0.4 s. Never into water or off the walkable ground. */
  private applyShove(dt: number): void {
    const s = this.shoveLeft;
    if (Math.abs(s.x) + Math.abs(s.z) < 1e-4) return;
    const k = Math.min(1, dt / 0.4);
    const sx = s.x * k;
    const sz = s.z * k;
    const p = this.walker.position;
    const g = this.groundAt(p.x + sx, p.z + sz);
    if (g !== null) {
      p.x += sx;
      p.z += sz;
      s.x -= sx;
      s.z -= sz;
    } else {
      s.x = 0;
      s.z = 0;
    }
  }

  playerPosition(): Vector3 {
    return this.walker.position;
  }

  diamondPosition(): Vector3 {
    const emblem = this.scene.getMeshByName('player.emblem');
    if (emblem) return this.diamond.copyFrom(emblem.getAbsolutePosition());
    return this.diamond.copyFrom(this.walker.position).addInPlaceFromFloats(0, 0.9, 0);
  }

  debugInfo(): Record<string, string | number> {
    const p = this.walker.position;
    return {
      player: `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`,
      breath: `${this.breath.state} ${this.breath.breathLevel.toFixed(2)}`,
    };
  }
}
