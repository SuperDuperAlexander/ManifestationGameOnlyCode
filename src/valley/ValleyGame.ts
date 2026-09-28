import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TUNING } from '../config/tuning';
import { InputManager } from '../core/InputManager';
import { Performance, isTouchDevice } from '../core/Performance';
import { Events } from '../core/Events';
import { Sound } from '../core/Sound';
import { clamp, clamp01, damp } from '../core/Random';
import { PlayerVisual } from '../player/PlayerVisual';
import { BreathSystem } from '../player/BreathSystem';
import { BreathVisuals } from '../player/BreathVisuals';
import { Fairy } from '../companion/Fairy';
import { DialogueSystem } from '../companion/DialogueSystem';
import { LightPoints } from '../gameplay/LightPoints';
import { Joystick } from '../ui/Joystick';
import { BreathButton } from '../ui/BreathButton';
import { BreathGuide } from '../ui/BreathGuide';
import { Hud } from '../ui/Hud';
import { DebugOverlay } from '../ui/DebugOverlay';
import { StartScreen } from '../ui/StartScreen';
import { Transition } from '../ui/Transition';
import { WORLD_UNIFORMS } from '../shaders/paperShader';
import { VALLEY_UNIFORMS, createValleyMaterial } from './valleyShader';
import { ValleyTerrain } from './ValleyTerrain';
import { ValleyProps } from './ValleyProps';
import { ValleyLandmarks } from './ValleyLandmarks';
import { ValleySky, buildFarMountains } from './ValleySky';
import { buildChasmMist, buildRiver, buildWaterfall } from './ValleyWater';
import { ValleyWalker, type WalkGround } from './ValleyWalker';
import { FollowCamera } from './FollowCamera';
import { ValleyFog } from './ValleyFog';
import { ValleyLightBridge } from './ValleyLightBridge';
import { ValleyStory } from './ValleyStory';
import { LAYOUT } from './valleyLayout';

const PARAMS = new URLSearchParams(location.search);

/** Haze colours for a dark world, a normal one and a bright one. */
const FOG_DARK = Color3.FromHexString('#8C92A3');
const FOG_NORMAL = Color3.FromHexString('#EAE3D5');
const FOG_BRIGHT = Color3.FromHexString('#F6EACB');

/**
 * The MVP level: a closed 3D valley made only in code, with a free third-person camera.
 * Walk the winding path, meet two fog blockades, learn that pushing makes them stronger
 * and breathing dissolves them, earn 20 light points, cross the chasm on a bridge of light.
 */
export class ValleyGame implements WalkGround {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly input = new InputManager();
  private readonly events = new Events();
  private readonly sound = new Sound();
  private readonly perf: Performance;
  private readonly debug: DebugOverlay;
  private readonly terrain: ValleyTerrain;
  private readonly landmarks: ValleyLandmarks;
  private readonly walker: ValleyWalker;
  private readonly cam: FollowCamera;
  private readonly visual: PlayerVisual;
  private readonly fairy: Fairy;
  private readonly breath = new BreathSystem();
  private readonly breathVisuals: BreathVisuals;
  private readonly breathGuide: BreathGuide;
  private readonly dialogue: DialogueSystem;
  private readonly lightPoints: LightPoints;
  private readonly hud: Hud;
  private readonly story: ValleyStory;
  private readonly fogs: ValleyFog[] = [];
  private readonly bridge: ValleyLightBridge;
  private readonly transition: Transition;
  private readonly touch: boolean;
  private readonly keysEl: HTMLDivElement;
  private readonly pushEl: HTMLDivElement | null = null;
  private readonly buildMs: number;
  private released = 0;
  /** Darkness from pushing. Only breathing clears it. */
  private pushDark = 0;
  /** A short dark flash right after a push. */
  private flash = 0;
  private mood: number = TUNING.valley.mood.byProgress[0];
  /** Extra glow of the figure, grows with every released blockade. */
  private playerGlow = 0;
  private releaseGlow = 0;
  private pushAnim = 0;
  private finished = false;
  private started = false;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly ui: HTMLElement,
  ) {
    const t0 = performance.now();
    this.touch = isTouchDevice() || PARAMS.has('touch');
    this.engine = new Engine(canvas, !this.touch, { stencil: false, powerPreference: 'high-performance', audioEngine: false });
    this.perf = new Performance(this.engine, this.touch);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = Color4.FromColor3(VALLEY_UNIFORMS.fogColor, 1);
    this.scene.skipPointerMovePicking = true;
    this.scene.skipPointerDownPicking = true;
    this.scene.skipPointerUpPicking = true;
    this.scene.autoClear = false;
    // The shared paper shader (player shadow, glows) must not bend the world here.
    WORLD_UNIFORMS.pivotZ = 1e6;

    const solid = createValleyMaterial('valley.solid', this.scene);
    const ground = createValleyMaterial('valley.ground', this.scene, { ground: true });
    const plants = createValleyMaterial('valley.plants', this.scene, { wind: true, painted: true });
    const grass = createValleyMaterial('valley.grass', this.scene, { wind: true, backFaceCulling: false });
    const unlit = createValleyMaterial('valley.unlit', this.scene, { unlit: true, mood: 0.3 });
    const light = createValleyMaterial('valley.light', this.scene, { unlit: true, mood: 0, fog: 0.3 });
    const far = createValleyMaterial('valley.far', this.scene, { unlit: true, fog: 0, backFaceCulling: false });
    const water = createValleyMaterial('valley.water', this.scene, { water: true, backFaceCulling: false });
    const falls = createValleyMaterial('valley.falls', this.scene, { falls: true, backFaceCulling: false });

    new ValleySky(this.scene);
    buildFarMountains(this.scene).material = far;
    this.terrain = new ValleyTerrain(this.scene, ground);
    buildRiver(this.scene, this.terrain, water);
    buildWaterfall(this.scene, this.terrain, falls, { x: 26, z: 0, dirX: 1, dirZ: 0.05, width: 1.4, top: 13 });
    buildChasmMist(this.scene);
    const props = new ValleyProps(this.scene, this.terrain, { plants, solid, grass });
    this.landmarks = new ValleyLandmarks(this.scene, this.terrain, { solid, unlit });
    this.terrain.paintShadows([...props.shadows, ...this.landmarks.shadows]);

    for (const spec of LAYOUT.fogs) this.fogs.push(new ValleyFog(this.scene, spec, this.terrain.height(spec.x, spec.z)));
    const b = LAYOUT.lightBridge;
    const lip = Math.max(this.terrain.height(b.x, b.fromZ), this.terrain.height(b.x, b.toZ));
    this.bridge = new ValleyLightBridge(this.scene, light, this.sound, lip);

    // Touch: left half walks (joystick), right half turns the camera, buttons for breath and push.
    let right: HTMLElement | null = null;
    if (this.touch) {
      document.body.classList.add('touch');
      const left = document.createElement('div');
      left.className = 'touch-zone touch-left';
      right = document.createElement('div');
      right.className = 'touch-zone touch-right';
      ui.append(left, right);
      new Joystick(ui, this.input, left);
      new BreathButton(ui, this.input);
      const push = document.createElement('div');
      push.className = 'push-button';
      push.setAttribute('role', 'button');
      push.setAttribute('aria-label', 'Push');
      push.innerHTML = '<span>✋</span>';
      push.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.input.pushPressed = true;
        this.input.markInteracted();
      });
      ui.appendChild(push);
      this.pushEl = push;
    }
    this.input.attach();
    this.input.onFirstInteraction(() => this.sound.unlock());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.keysEl = document.createElement('div');
    this.keysEl.className = 'valley-keys';
    this.keysEl.innerHTML = '<b>E</b> push <i>·</i> <b>Space</b> breathe in <i>·</i> <b>Shift</b> breathe out';
    if (!this.touch) ui.appendChild(this.keysEl);

    const colliders = [...props.colliders, ...this.landmarks.colliders, ...this.fogs.map((f) => f.collider)];
    this.walker = new ValleyWalker(this.input, this, colliders);
    const s = LAYOUT.start;
    this.walker.place(s.x, s.z, s.heading);
    this.visual = new PlayerVisual(this.scene);
    this.cam = new FollowCamera(this.scene, this.terrain, canvas, right);
    this.cam.snapTo(this.walker.position, s.heading);

    this.breathVisuals = new BreathVisuals(this.scene);
    this.breathGuide = new BreathGuide(ui);
    this.dialogue = new DialogueSystem(ui, this.events);
    this.lightPoints = new LightPoints(this.events);
    this.hud = new Hud(ui, this.events);
    this.transition = new Transition(ui);
    this.fairy = new Fairy(this.scene);
    this.story = new ValleyStory(this.fairy, this.dialogue, this.sound, this.touch);

    this.debug = new DebugOverlay(this.scene, ui);
    window.addEventListener('resize', () => {
      this.engine.resize();
      this.cam.onResize();
    });
    this.buildMs = Math.round(performance.now() - t0);
  }

  // --- WalkGround: where the player can stand ---

  groundAt(x: number, z: number): number | null {
    const sb = this.landmarks.stoneBridgeHeight(x, z);
    if (sb !== null) return sb;
    if (this.bridge.walkable && this.bridge.contains(x, z)) return this.bridge.deckY;
    const t = this.terrain;
    if (t.isWater(x, z) || t.isChasm(x, z) || t.rimDistance(x, z) > TUNING.valley.walkLimit) return null;
    return t.height(x, z);
  }

  onDeck(x: number, z: number): boolean {
    return this.landmarks.stoneBridgeHeight(x, z) !== null || (this.bridge.walkable && this.bridge.contains(x, z));
  }

  async start(): Promise<void> {
    await Promise.all([
      document.fonts.load('400 64px "Work Sans"'),
      document.fonts.load('700 64px "Work Sans"'),
      this.dialogue.load(`${import.meta.env.BASE_URL}data/dialogue/en.json`),
    ]);
    this.engine.runRenderLoop(() => this.frame());
    if (!PARAMS.has('autostart')) {
      const screen = new StartScreen(this.ui, this.dialogue.line('startPrompt'));
      await screen.waitForStart();
      this.sound.unlock();
    }
    this.started = true;
    await wait(0.8);
    const p = LAYOUT.path[3]!;
    await this.story.intro(new Vector3(p[0], this.terrain.height(p[0], p[1]) + 2.4, p[1]));
  }

  private frame(): void {
    const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);
    const v = TUNING.valley;
    this.input.update();
    if (this.input.debugTogglePressed) this.debug.toggle();

    this.breath.update(dt, { inhale: this.input.inhaleHeld, exhale: this.input.exhaleHeld, releaseExhales: this.touch });
    // Breathing slows the walk: a calm pace to go with the breath.
    this.walker.speedFactor = this.breath.state === 'idle' ? 1 : 0.6;
    this.walker.canMove = this.started && !this.finished;
    this.walker.update(dt, this.cam.yaw);
    const p = this.walker.position;

    this.updateFogs(dt);
    this.updateGoal(dt);
    this.updateMood(dt);

    // The figure: a small push forward when pushing, and a light that grows with every release.
    this.pushAnim = Math.max(0, this.pushAnim - dt * 3);
    const lunge = Math.sin(this.pushAnim * Math.PI) * 0.45;
    this.visual.root.position.set(p.x + Math.sin(this.walker.heading) * lunge, p.y, p.z + Math.cos(this.walker.heading) * lunge);
    this.releaseGlow = Math.max(0, this.releaseGlow - dt * 0.4);
    this.breathVisuals.update(dt, this.breath, p);
    this.visual.update(dt, {
      speed: this.walker.speed,
      speedRatio: this.walker.speedRatio,
      heading: this.walker.heading,
      breathLevel: this.breath.breathLevel,
      glow: Math.min(1, Math.max(this.breathVisuals.glow, this.playerGlow) + this.releaseGlow),
      awake: 1,
    });
    this.story.update(dt, p, this.fogs, this.lightPoints.total);
    this.landmarks.update(dt);
    this.bridge.update(dt);
    this.cam.update(dt, p, this.walker.heading, this.walker.speedRatio);
    this.breathGuide.update(dt, this.breath);
    this.dialogue.update(dt);
    this.hud.update(dt);

    VALLEY_UNIFORMS.time += dt;
    VALLEY_UNIFORMS.camPos.copyFrom(this.cam.camera.position);
    WORLD_UNIFORMS.time = VALLEY_UNIFORMS.time;

    this.perf.update(dt);
    const near = this.nearestFog();
    this.debug.extra = {
      player: `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`,
      build: `${this.buildMs} ms`,
      breath: `${this.breath.state} ${this.breath.breathLevel.toFixed(2)}`,
      light: this.lightPoints.total,
      mood: this.mood.toFixed(2),
      fog: near ? `${near.id} d=${near.density.toFixed(2)} x${near.grow.toFixed(2)}` : '-',
      grass: v.counts.grassTufts,
    };
    this.debug.update(dt);
    this.scene.render();
    this.input.endFrame();
  }

  private nearestFog(): ValleyFog | null {
    const p = this.walker.position;
    let best: ValleyFog | null = null;
    let bestD = Infinity;
    for (const f of this.fogs) {
      if (!f.active) continue;
      const d = f.edgeDistance(p.x, p.z);
      if (d < bestD) {
        best = f;
        bestD = d;
      }
    }
    return best;
  }

  /** Push and breath at the fogs. */
  private updateFogs(dt: number): void {
    const b = TUNING.valley.blockade;
    const m = TUNING.valley.mood;
    const p = this.walker.position;
    const fog = this.nearestFog();
    const edge = fog ? fog.edgeDistance(p.x, p.z) : Infinity;

    // Force: the fog grows, gets denser, and the world goes dark.
    if (fog && this.input.pushPressed && edge < b.pushRange) {
      fog.push();
      this.sound.push();
      this.pushDark = Math.min(m.maxPushDark, this.pushDark + m.pushDark);
      this.flash = 1;
      this.pushAnim = 1;
      this.walker.heading = Math.atan2(fog.center.x - p.x, fog.center.z - p.z);
      this.story.onPush();
    }

    // Breath: exhaled light flows to the fog within reach.
    const inReach = fog !== null && edge < TUNING.breath.reach;
    this.breathVisuals.target = inReach ? fog.center.add(new Vector3(0, 1.6, 0)) : null;
    const light = this.breath.lightThisFrame;
    if (fog && inReach && light > 0) {
      this.pushDark = Math.max(0, this.pushDark - light * m.clearPerLight);
      this.story.onBreathHit();
      if (fog.receiveLight(light)) this.onReleased(fog);
    }

    for (const f of this.fogs) {
      f.setDarkness(clamp01(this.pushDark * 1.1 + this.flash * 0.5));
      f.update(dt, this.cam.camera);
    }

    // Help near a fog: the key line on desktop, the push button on touch screens.
    const close = fog !== null && edge < b.noticeRange * 0.6;
    this.breathGuide.wanted = close;
    this.keysEl.classList.toggle('show', close && this.started);
    this.pushEl?.classList.toggle('show', close && edge < b.pushRange + 1);
  }

  private onReleased(fog: ValleyFog): void {
    const index = this.released;
    this.released++;
    this.lightPoints.add(fog.spec.points);
    this.playerGlow = Math.min(0.7, this.released * TUNING.valley.playerGlowPerRelease);
    this.releaseGlow = 0.6;
    this.pushDark = 0;
    const next = this.fogs.find((f) => f.active);
    const target = next
      ? next.center.add(new Vector3(0, 3.2, -4))
      : new Vector3(0, this.terrain.height(0, LAYOUT.lightBridge.fromZ - 3) + 2.6, LAYOUT.lightBridge.fromZ - 3);
    this.story.onRelease(index, target);
  }

  /** The bridge of light and the arch. */
  private updateGoal(_dt: number): void {
    const p = this.walker.position;
    const c = LAYOUT.chasm;
    if (!this.bridge.isBuilding && this.lightPoints.total >= LAYOUT.pointsForBridge && p.z > c.z - c.halfWidth - 9) {
      void this.story.onBridge();
      void this.bridge.build().then(() => this.story.onBridgeReady());
    }
    const gateTarget = this.bridge.walkable ? 1 : 0.25;
    this.landmarks.gateLevel += (gateTarget - this.landmarks.gateLevel) * 0.02;
    const g = LAYOUT.arch;
    if (this.bridge.walkable && !this.finished && Math.abs(p.x - g.x) < 1.6 && Math.abs(p.z - g.z) < 1.2) {
      void this.finish();
    }
  }

  private async finish(): Promise<void> {
    this.finished = true;
    this.sound.gate();
    await this.transition.blendIn(TUNING.gate.transitionTime);
    this.transition.showCard(
      this.dialogue.line('valleyEndTitle'),
      this.dialogue.line('valleyEndSubtitle'),
      this.dialogue.line('valleyEnd'),
      this.dialogue.line('valleyEndNext'),
    );
    // The card covers everything: stop drawing the world (saves the battery on phones).
    setTimeout(() => this.engine.stopRenderLoop(), 2600);
  }

  /** The world's light: dark with force, brighter with every release. */
  private updateMood(dt: number): void {
    const m = TUNING.valley.mood;
    this.flash = Math.max(0, this.flash - dt / m.flashTime);
    const step = this.bridge.walkable ? 3 : this.released;
    const base = m.byProgress[Math.min(step, m.byProgress.length - 1)]!;
    this.mood += (base - this.mood) * damp(m.follow, dt);
    const shown = clamp(this.mood - this.pushDark - this.flash * m.flash, -1, 1);
    VALLEY_UNIFORMS.mood = shown;
    const fc = VALLEY_UNIFORMS.fogColor;
    if (shown < 0) Color3.LerpToRef(FOG_NORMAL, FOG_DARK, -shown, fc);
    else Color3.LerpToRef(FOG_NORMAL, FOG_BRIGHT, shown, fc);
    this.scene.clearColor.set(fc.r, fc.g, fc.b, 1);
  }

  // --- Hooks for automatic browser checks ---

  stats(): ReturnType<DebugOverlay['stats']> {
    return this.debug.stats();
  }

  teleport(x: number, z: number, heading: number): void {
    this.walker.place(x, z, heading);
    this.cam.snapTo(this.walker.position, heading);
  }

  state(): Record<string, unknown> {
    return {
      player: this.walker.position.asArray().map((n) => +n.toFixed(2)),
      light: this.lightPoints.total,
      mood: +VALLEY_UNIFORMS.mood.toFixed(2),
      fogs: this.fogs.map((f) => ({ id: f.id, state: f.state, density: +f.density.toFixed(2), grow: +f.grow.toFixed(2) })),
      bridge: this.bridge.walkable,
      finished: this.finished,
    };
  }

  /**
   * Which parts of the valley can be reached from the start, walking by the real rules
   * (fogs still solid)? Returns the farthest north point reached. Used to prove the fogs block the way.
   */
  reach(bandMin = 1e9, bandMax = -1e9): { maxZ: number; cells: number; band: number[][] } {
    const cell = 0.5;
    const key = (i: number, j: number): number => (j + 400) * 1000 + (i + 400);
    const s = LAYOUT.start;
    const seen = new Set<number>([key(Math.round(s.x / cell), Math.round(s.z / cell))]);
    const todo: [number, number][] = [[Math.round(s.x / cell), Math.round(s.z / cell)]];
    const colliders = (this.walker as unknown as { colliders: { x: number; z: number; radius: number; active?: boolean }[] }).colliders;
    const blocked = (x: number, z: number): boolean =>
      colliders.some((c) => c.active !== false && Math.hypot(x - c.x, z - c.z) < c.radius + TUNING.player.radius * 0.9);
    let maxZ = -Infinity;
    const band: number[][] = [];
    while (todo.length) {
      const [i, j] = todo.pop()!;
      const x = i * cell;
      const z = j * cell;
      maxZ = Math.max(maxZ, z);
      if (z >= bandMin && z <= bandMax) band.push([x, z]);
      const h = this.groundAt(x, z)!;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const ni = i + di;
        const nj = j + dj;
        const k = key(ni, nj);
        if (seen.has(k)) continue;
        const nx = ni * cell;
        const nz = nj * cell;
        const g = this.groundAt(nx, nz);
        if (g === null || blocked(nx, nz)) continue;
        const deck = this.onDeck(nx, nz) || this.onDeck(x, z);
        if (!deck && (g - h) / cell > TUNING.valley.maxSlope) continue;
        seen.add(k);
        todo.push([ni, nj]);
      }
    }
    return { maxZ, cells: seen.size, band: band.slice(0, 400) };
  }

  /** Test helper: breath light straight into the nearest fog. */
  debugBreathe(light: number): void {
    const fog = this.nearestFog();
    if (fog && fog.receiveLight(light)) this.onReleased(fog);
  }
}

function wait(seconds: number): Promise<void> {
  return new Promise((r) => setTimeout(r, seconds * 1000));
}
