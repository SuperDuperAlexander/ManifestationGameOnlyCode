import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CAMERA, PLAYER, SCENE_STARTS } from './content/chapter1';
import { PALETTE } from './content/palette';
import { FollowCamera } from './core/camera';
import type { DebugFlags } from './core/debugFlags';
import { EventBus } from './core/events';
import { InputState } from './core/input';
import { clamp01, damp } from './core/math';
import {
  FpsMeter,
  QualityProbe,
  QualityWatchdog,
  pixelRatioCap,
  settingsFor,
} from './core/quality';
import type { QualitySettings, QualityTier } from './core/quality';
import { readDiagnostics, watchShaderErrors } from './core/diagnostics';
import type { Diagnostics } from './core/diagnostics';
import { loadSettings } from './core/save';
import { PainterlyRenderer } from './render/painterly';
import { linearColor, setStage } from './render/scene3d';
import { World } from './world/world';
import { border } from './world/place';

/** The fixed simulation step, in seconds. */
const FIXED_STEP = 1 / 60;
/** The most real time a single frame may catch up on, in seconds. */
const MAX_CATCHUP = 1;
/** A hard step limit, so one very slow frame cannot lock the page. */
const MAX_STEPS = 90;

/**
 * The game loop and everything that ties the world, the systems and the UI
 * together. Chapter flow lives in `Chapter1`, which this class drives.
 */
export class Game {
  readonly bus = new EventBus();
  readonly canvas: HTMLCanvasElement;
  readonly engine: Engine;
  readonly scene: Scene;
  readonly input = new InputState();
  readonly fps = new FpsMeter();
  camera!: FollowCamera;
  view!: TargetCamera;
  world!: World;
  painter!: PainterlyRenderer;
  quality!: QualitySettings;

  private readonly probe = new QualityProbe();
  private readonly watchdog = new QualityWatchdog();
  /** True while the tier is chosen automatically. */
  private autoQuality = true;
  private last = 0;
  private accumulator = 0;
  private running = false;
  private rafId = 0;
  /** Metres per second the player moved on the last frame. */
  speed = 0;
  private facing = Math.PI;
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly eye = new Vector3();
  paused = false;
  /** Set by the chapter while a panel is open. */
  worldInputBlocked = false;
  /** 0 to 1, how much the border mist pushes the player back. */
  borderPush = 0;
  onFrame: ((dt: number, time: number) => void) | null = null;
  time = 0;
  /** The chapter writes these each frame so the world can draw them. */
  calm = 0;
  light = 0;
  /**
   * A point the player walks to on their own. Only the browser tests set this,
   * through the debug test API. It drives the same movement and collision code
   * the player's own input does.
   */
  autoWalk: { x: number; z: number } | null = null;
  readonly wind = { x: 0, z: 0, strength: 0, radius: 1 };
  /** 0 to 1, how much of their walking speed the player currently has. */
  strideFactor = 1;

  constructor(
    readonly root: HTMLElement,
    readonly flags: DebugFlags,
  ) {
    // Before the engine exists, so nothing the driver says is missed.
    watchShaderErrors();
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'scene';
    this.root.appendChild(this.canvas);

    this.engine = new Engine(
      this.canvas,
      false,
      { powerPreference: 'high-performance', alpha: false, stencil: false, antialias: false },
      false,
    );
    this.engine.setHardwareScalingLevel(1 / pixelRatioCap());

    this.scene = new Scene(this.engine);
    // The world is right-handed with y up, the way every position, angle and
    // piece of shader maths in the game is written.
    this.scene.useRightHandedSystem = true;
    // A sky that fails to draw should leave a pale sky, not a black one.
    const clear = linearColor(PALETTE.skyGrey);
    this.scene.clearColor = new Color4(clear.r, clear.g, clear.b, 1);
    // The game does its own input. Nothing on screen is picked with a ray.
    this.scene.skipPointerMovePicking = true;
    this.scene.constantlyUpdateMeshUnderPointer = false;
    setStage(this.scene);
  }

  /** What this device's graphics really are. Read once, after the first frame. */
  diagnostics: Diagnostics | null = null;

  async start(): Promise<void> {
    const settings = loadSettings();
    const tier: QualityTier =
      this.flags.quality ?? (settings.quality === 'auto' ? 'medium' : settings.quality);
    this.autoQuality = this.flags.quality === null && settings.quality === 'auto';
    this.quality = settingsFor(tier);

    this.camera = new FollowCamera(window.innerWidth / Math.max(1, window.innerHeight));
    this.camera.reducedMotion = settings.reducedMotion;
    this.view = new TargetCamera('view', new Vector3(0, 6, 12), this.scene);
    this.view.fov = (CAMERA.fov * Math.PI) / 180;
    this.view.minZ = CAMERA.near;
    this.view.maxZ = CAMERA.far;
    this.scene.activeCamera = this.view;

    this.world = new World(this.scene, this.quality);
    this.world.color.reducedMotion = settings.reducedMotion;

    this.painter = new PainterlyRenderer(
      this.engine,
      this.scene,
      this.view,
      !this.flags.noPaint,
      this.flags.safe,
    );
    this.painter.applyQuality(this.quality);

    const start = SCENE_STARTS[this.flags.startScene ?? 1];
    this.world.placePlayer(start.x, start.z);
    this.camera.snapTo(this.world.playerPosition);
    this.syncCamera();

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.running = true;
    this.last = performance.now();
    this.loop(this.last);
    // Read after the first frame, so anything the driver refused while
    // compiling has already been said.
    this.diagnostics = readDiagnostics(this.engine);
  }

  /** Swaps the quality tier at runtime. */
  setQuality(tier: QualityTier): void {
    if (this.quality?.tier === tier) return;
    this.quality = settingsFor(tier);
    this.engine.setHardwareScalingLevel(1 / this.quality.pixelRatio);
    this.painter.applyQuality(this.quality);
    this.world.applyQuality(this.quality);
    this.resize();
    // Give the new tier a fresh window before the watchdog judges again.
    this.watchdog.restart();
  }

  /** The settings panel calls this when the player picks a tier by hand. */
  setAutoQuality(on: boolean): void {
    this.autoQuality = on;
    if (on) this.watchdog.restart();
  }

  /** How many times the watchdog has stepped the tier down. */
  get qualityDrops(): number {
    return this.watchdog.steps;
  }

  setReducedMotion(on: boolean): void {
    this.camera.reducedMotion = on;
    this.world.color.reducedMotion = on;
  }

  resize(): void {
    this.engine.resize();
    this.camera.resize(window.innerWidth, window.innerHeight);
    this.painter.setSize();
  }

  /** Copies the follow camera's eye and look-at onto the camera that draws. */
  private syncCamera(): void {
    this.view.position.copyFrom(this.camera.eye(this.eye));
    this.view.setTarget(this.camera.lookAt);
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const real = Math.max(0.0001, (now - this.last) / 1000);
    this.last = now;
    this.fps.update(real);

    // The start probe picks a tier once; the watchdog keeps checking during
    // play, because the probe runs before the player has walked anywhere.
    if (this.flags.quality === null && this.autoQuality) {
      const picked = this.probe.sample(real);
      if (picked) this.setQuality(picked);
      else if (this.probe.finished) {
        const drop = this.watchdog.sample(real, this.quality.tier);
        if (drop) this.setQuality(drop);
      }
    }

    // The world runs in fixed steps, so a slow frame does not make the breath
    // rhythm or the seed timer run slow with it. The catch-up is capped, so a
    // hidden tab cannot jump the world forward when it comes back.
    this.accumulator = Math.min(this.accumulator + real, MAX_CATCHUP);
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < MAX_STEPS) {
      this.accumulator -= FIXED_STEP;
      steps++;
      this.simulate(FIXED_STEP);
    }
    if (steps === MAX_STEPS) this.accumulator = 0;

    this.syncCamera();
    this.engine.beginFrame();
    this.painter.render(this.time);
    this.engine.endFrame();
  };

  /** One fixed simulation step. */
  private simulate(dt: number): void {
    this.time += dt;
    this.input.sample();
    if (!this.paused) this.moveAndAim(dt);
    // The chapter runs every step, even while a panel is open, so the world
    // keeps drawing behind it. The chapter itself decides what may advance.
    this.onFrame?.(dt, this.time);
    this.world.playerSpeed = this.speed;
    this.world.update(
      dt,
      this.calm,
      this.light,
      this.wind.strength,
      this.wind.radius,
      this.wind.x,
      this.wind.z,
    );
    this.camera.update(dt, this.world.playerPosition);
    this.input.endFrame();
  }

  /** Camera and player movement. Skipped while the game is paused. */
  private moveAndAim(dt: number): void {
    this.camera.rotate(this.input.yawDelta, this.input.pitchDelta);
    this.movePlayer(dt);
  }

  private movePlayer(dt: number): void {
    const p = this.world.playerPosition;
    let mx = 0;
    let mz = 0;
    if (!this.worldInputBlocked && this.autoWalk) {
      const dx = this.autoWalk.x - p.x;
      const dz = this.autoWalk.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.8) this.autoWalk = null;
      else {
        mx = dx / d;
        mz = dz / d;
      }
    } else if (!this.worldInputBlocked && (this.input.moveX !== 0 || this.input.moveY !== 0)) {
      this.camera.forward(this.forward);
      this.camera.right(this.right);
      mx = this.forward.x * this.input.moveY + this.right.x * this.input.moveX;
      mz = this.forward.z * this.input.moveY + this.right.z * this.input.moveX;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len;
      mz /= len;
    }

    // The border mist turns the player back gently. There are no invisible
    // walls. Which way "back" is belongs to the place: the chapter 1 valley
    // runs down the middle, but the meadows path wanders, so pushing toward
    // x = 0 there pushes across the floor instead of back onto it.
    const here = this.world.place;
    this.borderPush = border(p.x, p.z);
    if (this.borderPush > 0.01) {
      const inwardX = -Math.sign(p.x - here.centerX(p.z)) * 0.35;
      const inwardZ = p.z > here.zStart ? -1 : p.z < here.zEnd ? 1 : 0;
      mx += inwardX * this.borderPush * 1.6;
      mz += inwardZ * this.borderPush * 1.6;
    }

    const step = PLAYER.walkSpeed * this.strideFactor * dt;
    const moved = this.world.ground.resolveMove(p.x, p.z, mx * step, mz * step);
    const dx = moved.x - p.x;
    const dz = moved.z - p.z;
    this.speed = Math.hypot(dx, dz) / dt;

    const y = this.world.groundAt(moved.x, moved.z);
    this.world.player.setPosition(moved.x, y ?? p.y, moved.z);

    if (this.speed > 0.05) {
      const want = Math.atan2(dx, dz);
      let delta = want - this.facing;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.facing += delta * clamp01(PLAYER.turnSpeed * dt);
      this.world.player.setFacing(this.facing);
    }
  }

  /** Used by the pause screen and by panels that take over the screen. */
  setPaused(on: boolean): void {
    this.paused = on;
    this.input.setEnabled(!on);
  }

  /** Smoothly darkens the screen, for example inside the fog. */
  setDarken(target: number, dt: number): void {
    const current = this.darken;
    this.darken = damp(current, target, 2.2, dt);
    this.painter.setDarken(this.darken);
  }
  private darken = 0;

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.input.dispose();
    this.painter.dispose();
    this.world.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}

export { CAMERA };
