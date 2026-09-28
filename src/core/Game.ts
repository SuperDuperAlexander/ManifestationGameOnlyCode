import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { PALETTE, color4 } from '../config/palette';
import { TUNING } from '../config/tuning';
import { InputManager } from './InputManager';
import { CameraRig } from './CameraRig';
import { AssetLoader } from './AssetLoader';
import { Walkability } from '../world/Walkability';
import { PlayerController } from '../player/PlayerController';
import { PlayerVisual } from '../player/PlayerVisual';
import { DebugOverlay } from '../ui/DebugOverlay';
import { WORLD_UNIFORMS } from '../shaders/paperShader';
import { loadChapter, resolveChapter, buildWalkability, type ResolvedChapter } from '../world/ChapterLoader';
import { Terrain } from '../world/Terrain';
import { Backdrop } from '../world/Backdrop';
import { ZoneStreamer } from '../world/ZoneStreamer';
import { LightBridge } from '../gameplay/LightBridge';
import { ChapterGate } from '../gameplay/ChapterGate';
import { Transition } from '../ui/Transition';
import { Performance, isTouchDevice } from './Performance';
import { Joystick } from '../ui/Joystick';
import { BreathButton } from '../ui/BreathButton';
import { BreathSystem } from '../player/BreathSystem';
import { BreathVisuals } from '../player/BreathVisuals';
import { BreathGuide } from '../ui/BreathGuide';
import { Events } from './Events';
import { FogField } from '../gameplay/FogField';
import { LightPoints } from '../gameplay/LightPoints';
import { DialogueSystem } from '../companion/DialogueSystem';
import { Hud } from '../ui/Hud';
import { Sound } from './Sound';
import { Fairy } from '../companion/Fairy';
import { Companion } from '../companion/Companion';
import { StartScreen } from '../ui/StartScreen';
import { clamp01 } from './Random';

/** URL switches for testing: ?autostart skips the start screen, ?skipintro also skips wake-up and intro. */
const PARAMS = new URLSearchParams(location.search);

/**
 * Owns the engine, the scene and every system. One frame = one call to `frame()`.
 */
export class Game {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly input = new InputManager();
  readonly rig: CameraRig;
  readonly assets: AssetLoader;
  readonly walk = new Walkability();
  readonly player: PlayerController;
  readonly playerVisual: PlayerVisual;
  readonly debug: DebugOverlay;
  readonly breath = new BreathSystem();
  readonly breathVisuals: BreathVisuals;
  readonly breathGuide: BreathGuide;
  readonly events = new Events();
  readonly fogs: FogField;
  readonly lightPoints: LightPoints;
  readonly dialogue: DialogueSystem;
  readonly hud: Hud;
  readonly sound = new Sound();
  readonly fairy: Fairy;
  readonly companion: Companion;
  /** 0 = lying on the meadow, 1 = standing. */
  private awake = 1;
  private waking = false;
  private wakeDone = false;
  private introPending = false;
  private readonly firedEvents = new Set<string>();
  chapter: ResolvedChapter | null = null;
  terrain: Terrain;
  backdrop: Backdrop;
  streamer: ZoneStreamer | null = null;
  bridge: LightBridge | null = null;
  gate: ChapterGate | null = null;
  readonly transition: Transition;
  private blockadesReleased = 0;
  private complete = false;
  readonly performance: Performance;
  /** True on touch devices: letting go of the breath button breathes out. */
  touchMode = false;
  private time = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly ui: HTMLElement,
  ) {
    this.engine = new Engine(
      canvas,
      true,
      { stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance', audioEngine: false },
      true,
    );
    this.scene = new Scene(this.engine);
    this.scene.clearColor = color4(PALETTE.ivory) as Color4;
    this.scene.skipPointerMovePicking = true;
    this.scene.skipPointerDownPicking = true;
    this.scene.skipPointerUpPicking = true;
    this.scene.autoClearDepthAndStencil = true;

    this.rig = new CameraRig(this.scene);
    this.assets = new AssetLoader(this.scene, './assets/ch1/');
    this.player = new PlayerController(this.input, this.walk);
    this.playerVisual = new PlayerVisual(this.scene);
    this.debug = new DebugOverlay(this.scene, ui);
    this.breathVisuals = new BreathVisuals(this.scene);
    this.breathGuide = new BreathGuide(ui);
    this.fogs = new FogField(this.scene, this.walk, this.events);
    this.lightPoints = new LightPoints(this.events);
    this.hud = new Hud(ui, this.events);
    this.dialogue = new DialogueSystem(ui, this.events);
    this.fairy = new Fairy(this.scene);
    this.companion = new Companion(this.fairy, this.dialogue, this.events, this.sound, () => this.touchMode);
    this.input.attach();
    this.input.onFirstInteraction(() => this.sound.unlock());
    // Touch screens: joystick on the left, one breath button on the right, tap near fog to push.
    this.touchMode = PARAMS.has('touch') || isTouchDevice();
    this.performance = new Performance(this.engine, this.touchMode);
    if (this.touchMode) this.setupTouch();
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.terrain = new Terrain(this.scene, this.assets);
    this.backdrop = new Backdrop(this.scene, this.rig, this.assets);
    this.events.on('zoneEntered', (e) => this.onZoneEntered(e.id));
    this.transition = new Transition(ui);
    this.events.on('blockadeReleased', () => {
      this.blockadesReleased++;
      this.bridge?.setEarned(this.blockadesReleased);
    });
    this.events.on('plankAdded', (e) => {
      this.fairy.pulse();
      if (e.index === 0) void this.companion.say('bridge', { once: true });
    });
    this.events.on('bridgeWalkable', () => {
      this.gate?.openGate();
      void this.companion.say('bridgeReady', { once: true });
    });
    this.events.on('gateOpened', () => {
      this.sound.gate();
      void this.companion.say('gateOpen', { once: true });
    });

    window.addEventListener('resize', () => {
      this.engine.resize();
      this.rig.onResize();
      this.backdrop.layout();
    });
  }

  async start(): Promise<void> {
    await Promise.all([
      document.fonts.load('400 64px "Work Sans"'),
      document.fonts.load('700 64px "Work Sans"'),
      this.dialogue.load('./data/dialogue/en.json'),
    ]);
    const spec = await loadChapter(`${import.meta.env.BASE_URL}data/chapters/ch1.json`);
    const chapter = resolveChapter(spec);
    this.chapter = chapter;
    this.assets.setBase(import.meta.env.BASE_URL + spec.assetBase.replace(/^\//, ''));
    buildWalkability(chapter, this.walk);
    for (const zone of chapter.zones.values()) {
      for (const h of zone.hints) this.companion.addHint(h);
      for (const b of zone.blockades) this.companion.addHint({ id: b.id, x: b.x, z: b.z, line: 'hint', blockade: true, y: 2.8 });
    }
    const xs = [...chapter.zones.values()].flatMap((z) => [z.bounds.minX, z.bounds.maxX]);
    this.backdrop.centreX = (Math.min(...xs) + Math.max(...xs)) / 2;
    this.player.teleport(chapter.start.x, chapter.start.z);
    this.rig.snapTo(this.player.position);
    this.streamer = new ZoneStreamer(this.scene, chapter, this.assets, this.fogs, this.events, this.rig, this.terrain);
    await Promise.all([this.terrain.build(spec.terrain), this.backdrop.build(spec.backdrop)]);
    if (spec.bridge) this.bridge = new LightBridge(this.scene, spec.bridge, this.walk, this.events, this.sound);
    if (spec.gate) {
      this.gate = new ChapterGate(this.scene, spec.gate, this.events, this.fogs);
      await this.gate.build(this.assets, spec.assets[spec.gate.asset]);
    }
    // The start zone and its neighbours are ready before the first frame is shown.
    this.pauseZoneEvents = true;
    await this.streamer.prime(chapter.start.zone);
    this.pauseZoneEvents = false;
    this.engine.runRenderLoop(() => this.frame());
    (window as unknown as { __lw: { ready: boolean } }).__lw.ready = true;

    if (PARAMS.has('skipintro')) {
      this.companion.skipIntro();
      this.wakeDone = true;
      this.firedEvents.add(`${chapter.start.zone}:0`);
      return;
    }
    this.onZoneEntered(chapter.start.zone);
    // The player lies on the meadow until the game begins.
    this.awake = 0;
    this.player.canMove = false;
    if (!PARAMS.has('autostart')) {
      const start = new StartScreen(this.ui, this.dialogue.line('startPrompt'));
      await start.waitForStart();
      this.sound.unlock();
    }
    await this.wakeUp();
  }

  /** Waking on the meadow: a slow rise. The fairy intro follows if the zone asks for it. */
  private async wakeUp(): Promise<void> {
    await wait(1.2);
    this.waking = true;
    await wait(2.6);
    this.player.canMove = true;
    this.wakeDone = true;
    if (this.introPending) {
      this.introPending = false;
      await wait(TUNING.fairy.introDelay);
      await this.companion.playIntro();
    }
  }

  private pauseZoneEvents = false;

  /** Runs the events of a zone the player walked into (from the chapter file). */
  private onZoneEntered(zoneId: string): void {
    if (this.pauseZoneEvents || !this.chapter) return;
    const zone = this.chapter.zones.get(zoneId);
    if (!zone) return;
    zone.spec.events.forEach((ev, i) => {
      const key = `${zoneId}:${i}`;
      if (ev.once !== false && this.firedEvents.has(key)) return;
      this.firedEvents.add(key);
      if (ev.type === 'fairyIntro') {
        if (this.wakeDone) void this.companion.playIntro();
        else this.introPending = true;
      } else if (ev.type === 'say' && ev.line) {
        void this.companion.say(ev.line);
      }
    });
    // At the bridge zone the fairy explains the bridge once, depending on how much light there is.
    const bridge = this.chapter.spec.bridge;
    if (bridge && zoneId === bridge.zone && this.bridge && !this.bridge.isWalkable) {
      if (this.blockadesReleased === 0) void this.companion.say('hintChasmEarly', { once: true });
      else if (this.blockadesReleased < bridge.planksRequired) void this.companion.say('bridgeMore', { once: true });
    }
  }

  private setupTouch(): void {
    document.body.classList.add('touch');
    const left = document.createElement('div');
    left.className = 'touch-zone touch-left';
    const right = document.createElement('div');
    right.className = 'touch-zone touch-right';
    this.ui.append(left, right);
    new Joystick(this.ui, this.input, left);
    new BreathButton(this.ui, this.input);
    // A short tap on the right side counts as a push (only does something next to a fog).
    let downAt = 0;
    let downX = 0;
    let downY = 0;
    right.addEventListener('pointerdown', (e) => {
      downAt = performance.now();
      downX = e.clientX;
      downY = e.clientY;
      this.input.markInteracted();
    });
    right.addEventListener('pointerup', (e) => {
      if (performance.now() - downAt < 300 && Math.hypot(e.clientX - downX, e.clientY - downY) < 20) {
        this.input.pushPressed = true;
      }
    });
  }

  /** The bridge, the gate and walking through it. */
  private updateGoal(dt: number): void {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    if (this.bridge && this.chapter?.spec.bridge) {
      const [bx, bz] = this.chapter.spec.bridge.from;
      this.bridge.playerNear = Math.hypot(px - bx, pz - bz) < 15;
      this.bridge.update(dt);
      this.bridge.setVisible(
        this.streamer?.boundsVisible({ minX: bx - 3, maxX: bx + 3, minZ: bz - 1, maxZ: this.chapter.spec.bridge.to[1] + 1, top: 2 }) ?? true,
      );
    }
    if (this.gate && this.chapter?.spec.gate) {
      const [gx, gz] = this.chapter.spec.gate.pos;
      this.gate.setVisible(this.streamer?.boundsVisible({ minX: gx - 3, maxX: gx + 3, minZ: gz - 1, maxZ: gz + 5, top: 7 }) ?? true);
      if (this.gate.update(dt, px, pz)) void this.finishChapter();
    }
  }

  /** Walking through the gate: light and fog fill the screen, then the chapter card. */
  private async finishChapter(): Promise<void> {
    if (this.complete || !this.chapter) return;
    this.complete = true;
    this.input.enabled = false;
    this.sound.gate();
    this.events.emit('chapterComplete', { id: this.chapter.spec.id });
    await this.transition.blendIn(TUNING.gate.transitionTime);
    this.transition.showCard(
      this.dialogue.line('chapterEndTitle'),
      this.chapter.spec.title,
      this.dialogue.line('chapterEnd'),
      this.dialogue.line('chapterEndNext'),
    );
  }

  /** Test helper (used by scripts/check-browser.mjs): releases every loaded blockade. */
  debugReleaseLoaded(): number {
    let n = 0;
    for (const zone of this.chapter?.zones.values() ?? []) {
      for (const b of zone.blockades) if (this.fogs.debugRelease(b.id)) n++;
    }
    return n;
  }

  private frame(): void {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 1 / 20);
    this.time += dt;
    WORLD_UNIFORMS.time = this.time;
    this.input.update();
    if (this.input.debugTogglePressed) this.debug.toggle();

    this.breath.update(dt, {
      inhale: this.input.inhaleHeld,
      exhale: this.input.exhaleHeld,
      releaseExhales: this.touchMode,
    });
    // Breathing slows the walk: a calm pace to go with the breath.
    this.player.speedFactor = this.breath.state === 'idle' ? 1 : 0.7;
    if (this.waking) this.awake = clamp01(this.awake + dt / 2.4);
    this.player.update(dt);
    this.streamer?.update(dt, this.player.position.x, this.player.position.z);
    this.terrain.update(dt);
    this.updateGoal(dt);
    this.fogs.update(dt, this.player, this.breath, this.input.pushPressed);
    this.breathVisuals.target = this.fogs.hasTarget ? this.fogs.streamTarget : null;
    this.breathVisuals.update(dt, this.breath, this.player.position);
    this.breathGuide.wanted = this.fogs.nearestDistance < TUNING.breath.reach + 2;
    WORLD_UNIFORMS.revealX = this.player.position.x;
    WORLD_UNIFORMS.revealZ = this.player.position.z;
    WORLD_UNIFORMS.revealRadius = this.breath.lightRadius;

    this.playerVisual.root.position.copyFrom(this.player.position);
    this.playerVisual.update(dt, {
      speed: this.player.speed,
      speedRatio: this.player.speedRatio,
      heading: this.player.heading,
      breathLevel: this.breath.breathLevel,
      glow: this.breathVisuals.glow,
      awake: this.awake,
    });
    this.companion.update(dt, this.player.position);
    this.breathGuide.update(dt, this.breath);
    this.dialogue.update(dt);
    this.hud.update(dt);
    this.rig.update(dt, this.player.position);
    this.backdrop.update();
    this.debug.loadedZones = this.streamer?.loadedIds ?? [];

    this.debug.extra = {
      player: `${this.player.position.x.toFixed(1)}, ${this.player.position.z.toFixed(1)}`,
      zone: this.streamer?.current ?? '-',
      horizon: this.rig.horizonFromTop.toFixed(2),
      breath: `${this.breath.state} ${this.breath.breathLevel.toFixed(2)}`,
      rhythm: this.breath.rhythmScore.toFixed(2),
      breaths: this.breath.breaths,
      light: this.lightPoints.total,
      planks: this.bridge ? `${this.bridge.plankCount}${this.bridge.isWalkable ? ' walkable' : ''}` : '-',
      fog: this.fogs.nearest ? `${this.fogs.nearest.id} d=${this.fogs.nearest.density.toFixed(2)}` : '-',
    };
    this.performance.update(dt);
    this.debug.update(dt);
    this.scene.render();
    this.input.endFrame();
  }
}

function wait(seconds: number): Promise<void> {
  return new Promise((r) => setTimeout(r, seconds * 1000));
}
