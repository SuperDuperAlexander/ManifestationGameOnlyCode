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
import { ValleyProps } from './ValleyProps';
import { ValleySky, buildFarMountains } from './ValleySky';
import { buildRiver, buildWaterfall } from './ValleyWater';
import { ValleyWalker, type WalkGround } from './ValleyWalker';
import { FollowCamera } from './FollowCamera';
import { LAYOUT } from './innerLayout';

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
  private readonly visual: PlayerVisual;
  private readonly breath = new BreathSystem();
  private readonly breathVisuals: BreathVisuals;
  private readonly touch: boolean;
  private readonly root: HTMLDivElement;
  private active = false;
  private readonly diamond = new Vector3();

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
    this.buildTreeMarker();

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
    window.addEventListener('resize', () => this.cam.onResize());
  }

  groundAt(x: number, z: number): number | null {
    const t = this.terrain;
    if (t.isWater(x, z) || t.rimDistance(x, z) > TUNING.inner.walkLimit) return null;
    return t.height(x, z);
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

  /** A soft disc where the Inner Tree will stand. Remove when the tree exists. */
  private buildTreeMarker(): void {
    const m = TUNING.inner.treeMarker;
    const at = LAYOUT.tree;
    const ivory = Color3.FromHexString(PALETTE.ivory);
    const mat = createPaperMaterial('inner.treeMarkerMat', this.scene, {
      color: new Color4(ivory.r, ivory.g, ivory.b, m.alpha),
      alphaBlend: true,
      haze: false,
      curve: false,
      depthWrite: false,
      radialEdge: 0.5,
    });
    const disc = MeshBuilder.CreateDisc('inner.treeMarker', { radius: m.radius, tessellation: 32 }, this.scene);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(at.x, this.terrain.height(at.x, at.z) + 0.06, at.z);
    disc.material = mat;
    disc.isPickable = false;
    disc.freezeWorldMatrix();
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
    this.walker.speedFactor = this.breath.state === 'idle' ? 1 : 0.6;
    this.walker.update(dt, this.cam.yaw);
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
    VALLEY_UNIFORMS.time += dt;
    VALLEY_UNIFORMS.camPos.copyFrom(this.cam.camera.position);
    WORLD_UNIFORMS.time = VALLEY_UNIFORMS.time;
    WORLD_UNIFORMS.pivotZ = 1e6;
    this.input.endFrame();
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
