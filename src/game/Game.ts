import { Engine } from '@babylonjs/core/Engines/engine';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PALETTE } from '../config/palette';
import { isTouchDevice, Performance } from '../core/Performance';
import { InnerValley } from '../inner/InnerValley';
import { VALLEY_UNIFORMS } from '../inner/valleyShader';
import { Town } from '../outer/Town';
import { WORLD_UNIFORMS } from '../shaders/paperShader';
import { LookWithin } from '../transition/LookWithin';
import { DebugOverlay } from '../ui/DebugOverlay';
import { LookWithinButton } from '../ui/LookWithinButton';
import { HandButton } from '../ui/HandButton';
import { TapPicker, type TapTarget } from '../ui/TapPicker';
import { TUNING } from '../config/tuning';
import { DialogueSystem } from '../companion/DialogueSystem';
import { Events } from '../core/Events';
import { TOWN } from '../outer/townLayout';
import { LAYOUT } from '../inner/innerLayout';
import { WaveField } from '../thought/WaveField';
import { Anger } from './Anger';
import { HeatMood } from './HeatMood';
import { BreathGuide } from '../ui/BreathGuide';
import { StartScreen } from '../ui/StartScreen';
import { HitTint } from '../ui/HitTint';
import { Lantern } from './Lantern';
import { Story } from './Story';
import { StoryState } from './StoryState';
import type { World, WorldId } from './World';
import type { ImpState } from '../inner/AngerImp';

/** One Engine, two worlds (two Scenes). Renders and updates only the active world. */
export class Game {
  readonly engine: Engine;
  readonly outer: Town;
  readonly inner: InnerValley;
  private current: World;
  private readonly transition: LookWithin;
  private readonly perf: Performance;
  private readonly overlays = new Map<WorldId, DebugOverlay>();
  private debugOn: boolean;
  /** The one hidden anger value, shared by both worlds. */
  readonly anger = new Anger();
  readonly dialogue: DialogueSystem;
  private readonly fields = new Map<WorldId, WaveField>();
  private pushQueued = false;
  private readonly heat = new HeatMood();
  private readonly hitTint: HitTint;
  readonly story: Story;
  private readonly lanterns: Lantern[];
  private lastLine = '';
  private hand: HandButton | null = null;
  private readonly guide: BreathGuide;
  private readonly touch: boolean;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.engine = new Engine(canvas, true, { stencil: false, powerPreference: 'high-performance', audioEngine: false });
    const touch = isTouchDevice();
    this.touch = touch || new URLSearchParams(location.search).has('touch');
    this.perf = new Performance(this.engine, touch);
    this.outer = new Town(this.engine, canvas, ui);
    this.inner = new InnerValley(this.engine, canvas, ui);
    this.current = this.outer;
    const a = new URLSearchParams(location.search).get('anger');
    if (a !== null && Number.isFinite(parseFloat(a))) this.anger.set(parseFloat(a));
    this.fields.set('outer', new WaveField(this.outer, this.anger, TOWN.waveSource));
    this.fields.set('inner', new WaveField(this.inner, this.anger, LAYOUT.waveSource));
    this.guide = new BreathGuide(ui);
    const start = new StartScreen(ui);
    const started = start.waitForStart();
    this.hitTint = new HitTint(ui);
    this.anger.on((e) => { if (e === 'hit') this.hitTint.flash(); });
    const events = new Events();
    events.on('lineShown', (e) => { this.lastLine = e.text; });
    this.dialogue = new DialogueSystem(ui, events);
    const outerLantern = new Lantern(this.outer.scene, this.outer.visual);
    const innerLantern = new Lantern(this.inner.scene, this.inner.visual);
    this.lanterns = [outerLantern, innerLantern];
    this.story = new Story({ engine: this.engine, ui, outer: this.outer, inner: this.inner, anger: this.anger, dialogue: this.dialogue, outerLantern, innerLantern, touch });
    void this.dialogue.load(`${import.meta.env.BASE_URL}data/dialogue/en.json`).then(() => {
      const text = this.dialogue.line('waveText');
      for (const f of this.fields.values()) f.setText(text);
      const dl = this.dialogue;
      const t = this.touch;
      this.guide.labels = {
        holdIn: dl.line(t ? 'guideHoldIn' : 'guideHoldInDesktop'),
        holdOut: dl.line(t ? 'guideHoldOut' : 'guideHoldOutDesktop'),
        breatheIn: dl.line('guideIn'),
        breatheOut: dl.line('guideOut'),
      };
      start.setTexts(dl.line('startTitle'), dl.line('startSubtitle'), dl.line('startPrompt'));
      void started.then(() => this.story.begin());
    });
    if (new URLSearchParams(location.search).has('reveal')) this.inner.reveal();
    this.applyShared(this.outer);
    this.outer.setActive(true);

    this.transition = new LookWithin(
      ui,
      (to) => {
        to.setActive(true);
        this.current = to;
        this.applyShared(to);
        this.showOverlay(to.id);
        this.story.onWorldShown(to.id);
      },
      (w) => this.syncCamera(w),
    );
    if (touch || new URLSearchParams(location.search).has('touch')) {
      document.body.classList.add('touch');
      new LookWithinButton(ui, () => this.toggle());
      this.hand = new HandButton(ui, () => this.press());
      new TapPicker(
        this.engine,
        canvas,
        () => ({ scene: this.current.scene, camera: this.current.camera, targets: this.glowTargets() }),
        () => this.press(),
      );
    }

    this.debugOn = new URLSearchParams(location.search).has('debug');
    this.overlays.set('outer', new DebugOverlay(this.outer.scene, document.body));
    this.overlays.set('inner', new DebugOverlay(this.inner.scene, document.body));
    this.showOverlay('outer');

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'KeyQ') this.toggle();
      if (e.code === 'KeyE') this.press();
      if (e.code === 'F3') {
        e.preventDefault();
        this.debugOn = !this.debugOn;
        this.showOverlay(this.current.id);
      }
    });
    window.addEventListener('resize', () => this.engine.resize());

    this.engine.runRenderLoop(() => this.frame());
    this.installHooks();
  }

  toggle(): void {
    if (this.transition.active || !this.story.canLookWithin()) return;
    this.transition.start(this.current, this.current === this.outer ? this.inner : this.outer);
  }

  /** E / hand button / tap: interact with a glowing object, else push a wave. */
  private press(): void {
    if (this.transition.active) return;
    if (!this.story.interact()) this.pushQueued = true;
  }

  /** Glowing objects the player can reach right now (tap targets). */
  private glowTargets(): TapTarget[] {
    const out: TapTarget[] = [];
    if (this.current !== this.outer || this.transition.active) return out;
    const f = this.story.state.flags;
    const p = this.outer.playerPosition();
    if (f.bumped && !f.helped) {
      const i = this.outer.alley.nearestPickable(p);
      if (i !== null) {
        const a = TOWN.alleyStory.apples[i]!;
        out.push({ x: a[0], y: 0.3, z: a[1] });
      }
    }
    if (f.bumped && !f.delivered) {
      const n = this.outer.treeNiche();
      if (Math.hypot(p.x - n.x, p.z - n.z) < TUNING.story.nicheRadius) out.push({ x: n.x, y: n.y, z: n.z });
    }
    return out;
  }

  private showOverlay(id: WorldId): void {
    for (const [k, o] of this.overlays) o.setVisible(this.debugOn && k === id);
  }

  /** Shared global values must match the shown world. */
  private applyShared(w: World): void {
    if (w.id === 'inner') {
      const f = VALLEY_UNIFORMS.fogColor;
      w.scene.clearColor.set(f.r, f.g, f.b, 1);
    } else {
      const c = Color3.FromHexString(PALETTE.powder);
      w.scene.clearColor.set(c.r, c.g, c.b, 1);
    }
    WORLD_UNIFORMS.pivotZ = 1e6;
  }

  private syncCamera(w: World): void {
    if (w.id === 'inner') VALLEY_UNIFORMS.camPos.copyFrom(w.camera.position);
  }

  private frame(): void {
    const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);
    this.perf.update(dt);
    let shown: World | null = this.transition.update(dt);
    if (!shown) {
      shown = this.current;
      shown.update(dt);
    }
    const field = this.fields.get(shown.id);
    if (field && shown === this.current && !this.transition.active) {
      if (this.pushQueued) field.push();
      field.update(dt);
    }
    this.pushQueued = false;
    this.heat.apply(this.anger.value);
    this.outer.setAnger(this.anger.value);
    this.inner.setAnger(this.anger.value);
    this.hitTint.update(dt);
    if (this.hand) {
      const near = shown === this.current && !this.transition.active;
      this.hand.setMode(near && this.glowTargets().length > 0 ? 'interact' : near && (field?.count ?? 0) > 0 ? 'push' : 'dim');
    }
    this.story.update(dt, shown.id, this.transition.active);
    this.guide.wanted = this.story.needsBreathHelp();
    this.guide.update(dt, shown.breathSystem());
    shown.scene.render();
    const o = this.overlays.get(shown.id);
    if (o) {
      o.extra = {
        world: shown.id,
        anger: +this.anger.value.toFixed(2),
        pushLevel: this.anger.pushLevel,
        waves: field?.count ?? 0,
        ...shown.debugInfo(),
      };
      o.update(dt);
    }
  }

  private installHooks(): void {
    const w = window as unknown as { __lw: unknown };
    w.__lw = {
      world: () => this.current.id,
      transitioning: () => this.transition.active,
      playerPos: () => {
        const p = this.current.playerPosition();
        return { x: p.x, y: p.y, z: p.z };
      },
      toggle: () => this.toggle(),
      anger: () => this.anger.value,
      pushLevel: () => this.anger.pushLevel,
      waves: () => this.fields.get(this.current.id)?.count ?? 0,
      setAnger: (v: number) => this.anger.set(v),
      teleport: (x: number, z: number) => this.current.teleport(x, z),
      setImpState: (s: ImpState) => this.inner.setImpState(s),
      setRootHealth: (v: number) => this.inner.setRootHealth(v),
      reveal: () => this.inner.reveal(),
      breathState: () => this.current.breathState(),
      beat: () => this.story.beat,
      flags: () => ({ ...this.story.state.flags }),
      lanternLight: () => this.lanterns[0]!.light,
      debugBreath: () => this.current.simulateBreath(),
      interact: () => this.story.interact(),
      alleyApplePositions: () => this.story.alleyApplePositions(),
      bumpTrigger: () => this.story.bumpTrigger(),
      oldTreeNiche: () => this.story.oldTreeNiche(),
      impPos: () => this.story.impPos(),
      endCardVisible: () => this.story.endCard.visible,
      line: () => this.lastLine,
      clearSave: () => StoryState.clear(),
      drawCalls: () => this.overlays.get(this.current.id)?.stats().drawCalls ?? 0,
    };
  }
}
