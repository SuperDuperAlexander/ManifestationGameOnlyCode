import { Engine } from '@babylonjs/core/Engines/engine';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PALETTE } from '../config/palette';
import { audio } from '../core/Audio';
import { InputManager } from '../core/InputManager';
import { isTouchDevice, Performance } from '../core/Performance';
import { InnerValley } from '../inner/InnerValley';
import { VALLEY_UNIFORMS } from '../inner/valleyShader';
import { Town } from '../outer/Town';
import { WORLD_UNIFORMS } from '../shaders/paperShader';
import { LookWithin } from '../transition/LookWithin';
import { DebugOverlay } from '../ui/DebugOverlay';
import { LookWithinButton } from '../ui/LookWithinButton';
import { HandButton } from '../ui/HandButton';
import { BreathButton } from '../ui/BreathButton';
import { TapPicker, type TapTarget } from '../ui/TapPicker';
import { TUNING } from '../config/tuning';
import { DialogueSystem } from '../companion/DialogueSystem';
import { Events } from '../core/Events';
import { TOWN } from '../outer/townLayout';
import { LAYOUT } from '../inner/innerLayout';
import { WaveField } from '../thought/WaveField';
import { BubbleField, type ThoughtField, type ThoughtLine } from '../thought/BubbleField';
import { Anger } from './Anger';
import { HeatMood } from './HeatMood';
import { BreathGuide } from '../ui/BreathGuide';
import { ControlsHint } from '../ui/ControlsHint';
import { StartScreen } from '../ui/StartScreen';
import { HitTint } from '../ui/HitTint';
import { MenuPanel } from '../ui/MenuPanel';
import { ImpBreathProgress } from '../ui/ImpBreathProgress';
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
  private readonly fields = new Map<WorldId, ThoughtField>();
  private pushQueued = false;
  private readonly heat = new HeatMood();
  private readonly hitTint: HitTint;
  /** Created after the start choice, so it reads the checkpoint only when the player continues. */
  private story!: Story;
  private storyReady = false;
  private readonly lanterns: Lantern[];
  private lastLine = '';
  private hand: HandButton | null = null;
  private readonly guide: BreathGuide;
  private controls: ControlsHint | null = null;
  private controlsState = '';
  private lastPushCueToken = '';
  private menu: MenuPanel | null = null;
  private lookWithinButton: LookWithinButton | null = null;
  private impProgress: ImpBreathProgress | null = null;
  private readonly touch: boolean;
  private completionWasOpen = false;

  /** Debug only: bubbles appear without the bump. */
  private debugBubbles = false;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.engine = new Engine(canvas, true, { stencil: false, powerPreference: 'high-performance', audioEngine: false });
    const touch = isTouchDevice();
    this.touch = touch || new URLSearchParams(location.search).has('touch');
    this.perf = new Performance(this.engine, touch);
    this.outer = new Town(this.engine, canvas, ui);
    this.inner = new InnerValley(this.engine, canvas, ui);
    this.current = this.outer;
    const a = new URLSearchParams(location.search).get('anger');
    if (a !== null && Number.isFinite(parseFloat(a))) {
      this.anger.set(parseFloat(a));
      this.debugBubbles = true;
    }
    const bubbleField = new BubbleField(this.outer, this.anger);
    // Thought Bubbles unlock with the bump (beat 3). Debug anger (URL or test hook) forces them on.
    bubbleField.unlocked = () => this.debugBubbles || (this.storyReady && this.story.state.flags.bumped);
    this.fields.set('outer', bubbleField);
    this.fields.set('inner', new WaveField(this.inner, this.anger, LAYOUT.waveSource, this.inner.waveEmitter));
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
    void this.dialogue.load(`${import.meta.env.BASE_URL}data/dialogue/en.json`).then(() => {
      this.controls = new ControlsHint(ui, (key) => this.dialogue.line(key), {
        push: () => this.press(),
        lookWithin: () => this.toggle(),
      });
      this.updateLookWithinLabels();
      BreathButton.setTexts(this.dialogue.line('controlsBreathe'), this.dialogue.line('controlsHoldRelease'));
      HandButton.setTexts(this.dialogue.line('controlsPush'), this.dialogue.line('controlsInteract'), this.dialogue.line('controlsCollectApple'), this.dialogue.line('controlsTapAction'));
      const text = this.dialogue.line('waveText');
      for (const f of this.fields.values()) f.setText(text);
      const raw = this.dialogue.data('thoughts');
      const outerField = this.fields.get('outer');
      if (Array.isArray(raw) && outerField instanceof BubbleField) {
        outerField.setThoughts((raw as ThoughtLine[]).filter((l) => typeof l?.text === 'string'));
      }
      const dl = this.dialogue;
      const t = this.touch;
      this.guide.labels = {
        holdIn: dl.line(t ? 'guideHoldIn' : 'guideHoldInDesktop'),
        holdOut: dl.line(t ? 'guideHoldOut' : 'guideHoldOutDesktop'),
        breatheIn: dl.line('guideIn'),
        breatheOut: dl.line('guideOut'),
      };
      this.impProgress = new ImpBreathProgress(ui, (key) => dl.line(key), TUNING.imp.breathsToCalm);
      const hasSave = StoryState.savedBeat() > 0;
      start.setTexts(dl.line('startTitle'), dl.line('startSubtitle'), dl.line('startPrompt'), dl.line('startBegin'), hasSave ? dl.line('startContinue') : null, dl.line('taskLantern'));
      this.menu = new MenuPanel(ui, (key) => dl.line(key), (open) => {
        if (open) {
          if (!this.storyReady || this.transition.active) return false;
          this.pushQueued = false;
          InputManager.resetAll();
          window.dispatchEvent(new Event('blur'));
          return true;
        }
        InputManager.resetAll();
        window.dispatchEvent(new Event('blur'));
        return true;
      });
      void started.then((choice) => {
        // "Begin" clears the checkpoint BEFORE the story reads it. "Continue" keeps it.
        if (choice === 'begin') StoryState.clear();
        InputManager.resetAll();
        window.dispatchEvent(new Event('blur'));
        this.story = new Story({ engine: this.engine, ui, outer: this.outer, inner: this.inner, anger: this.anger, dialogue: this.dialogue, outerLantern, innerLantern, touch, actions: { look: () => this.toggle(), press: () => this.press() } });
        this.story.endCard.setLabels(dl.line('endStatus'), dl.line('endContinue'));
        this.story.endCard.onDismiss = () => {
          InputManager.resetAll();
          window.dispatchEvent(new Event('blur'));
        };
        if (this.story.state.flags.delivered) {
          this.story.endCard.show(dl.line('endTitle'), dl.line('endLine'));
        }
        this.storyReady = true;
        this.current.setActive(true);
        this.menu?.setAvailable(true);
        this.story.begin();
      });
    });
    if (new URLSearchParams(location.search).has('reveal')) this.inner.reveal();
    this.applyShared(this.outer);
    this.outer.setActive(false);

    this.transition = new LookWithin(
      ui,
      (to) => {
        to.setActive(true);
        this.current = to;
        this.applyShared(to);
        this.showOverlay(to.id);
        this.story.onWorldShown(to.id);
        audio.setWorld(to.id);
      },
      (w) => this.syncCamera(w),
    );
    if (touch || new URLSearchParams(location.search).has('touch')) {
      document.body.classList.add('touch');
      this.lookWithinButton = new LookWithinButton(ui, () => this.toggle());
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
      if (this.menu?.isOpen) return;
      if (this.storyReady && this.story.endCard.open) return;
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
    if (this.menu?.isOpen || (this.storyReady && this.story.endCard.open) || this.transition.active || !this.storyReady || !this.story.canLookWithin()) return;
    audio.swell();
    this.transition.start(this.current, this.current === this.outer ? this.inner : this.outer);
  }

  /** E / hand button / tap: interact with a glowing object, else push a wave. */
  private press(): void {
    if (this.menu?.isOpen || (this.storyReady && this.story.endCard.open) || this.transition.active) return;
    if (!this.storyReady || !this.story.interact()) this.pushQueued = true;
  }

  /** Glowing objects the player can reach right now (tap targets). */
  private glowTargets(): TapTarget[] {
    const out: TapTarget[] = [];
    if (!this.storyReady || this.current !== this.outer || this.transition.active) return out;
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

  private updateLookWithinLabels(): void {
    const inside = this.current.id === 'inner';
    this.controls?.setLookWithinLabel(this.dialogue.line(inside ? 'controlsGoOutside' : 'controlsGoInside'));
    this.lookWithinButton?.setLabel(
      this.dialogue.line(inside ? 'controlsGoOutside' : 'touchGoInside'),
      this.dialogue.line(inside ? 'touchGoOutside' : 'touchGoInside'),
    );
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
    const completionOpen = this.storyReady && this.story.endCard.open;
    if (completionOpen && !this.completionWasOpen) {
      InputManager.resetAll();
      window.dispatchEvent(new Event('blur'));
    }
    this.completionWasOpen = completionOpen;
    const paused = (this.menu?.isOpen ?? false) || completionOpen;
    let shown: World | null = paused ? this.current : this.transition.update(dt);
    if (!paused && !shown) {
      shown = this.current;
      shown.update(dt);
    }
    shown ??= this.current;
    const field = this.fields.get(shown.id);
    if (paused) {
      audio.breath('idle', 0);
      this.controls?.setPushVisible(false);
      this.controls?.cuePushOpportunity('');
      this.controls?.setThoughtChoiceActive(false);
      this.hand?.setMode('dim');
      HandButton.setThoughtChoiceActive(false);
      BreathButton.setThoughtChoiceActive(false);
      this.lastPushCueToken = '';
    }
    if (!paused) {
      if (field && shown === this.current && !this.transition.active) {
        if (this.pushQueued) field.push();
        field.update(dt);
      }
      this.pushQueued = false;
      // The town and the imp show the anger ramped in after the bump (thought first, then the town heats up).
      const shownAnger = this.anger.value * (this.storyReady ? this.story.townGate : 1);
      this.heat.apply(shownAnger);
      this.outer.setAnger(shownAnger);
      this.inner.setAnger(shownAnger);
      this.hitTint.update(dt);
      if (this.hand) {
        const near = shown === this.current && !this.transition.active;
        const context = this.storyReady ? this.story.interactionContext() : 'push';
        const pushToken = near && !paused && context === 'push' ? this.pushCueToken(field) : '';
        const mode = near && context === 'collectApple'
          ? 'collect'
          : near && context === 'interact'
            ? 'interact'
            : pushToken !== ''
              ? 'push'
              : 'dim';
        this.hand.setMode(mode);
      }
      if (this.storyReady) {
        this.story.update(dt, shown.id, this.transition.active);
        this.impProgress?.update(this.story.impBreathProgress());
        this.guide.wanted = this.story.needsBreathHelp();
        this.controls?.setActionContext(this.story.interactionContext());
      }
      this.guide.update(dt, shown.breathSystem());
      audio.breath(shown.breathSystem().state, shown.breathSystem().breathLevel);
      const context = this.storyReady ? this.story.interactionContext() : 'push';
      const pushToken = !paused && shown === this.current && !this.transition.active && context === 'push' ? this.pushCueToken(field) : '';
      const push = !this.transition.active && (context !== 'push' || pushToken !== '');
      if (this.controls) {
        this.controls.setActionContext(context);
        this.controls.setPushVisible(push);
        const choiceActive = pushToken !== '';
        this.controls.setThoughtChoiceActive(choiceActive);
        if (choiceActive) {
          this.controls.setThoughtText(field instanceof BubbleField || field instanceof WaveField ? field.pushCueText : '');
          this.controls.setBreathLevel(shown.breathSystem().breathLevel);
        }
        HandButton.setThoughtChoiceActive(choiceActive);
        BreathButton.setThoughtChoiceActive(choiceActive);
        if (!pushToken) {
          this.controls.cuePushOpportunity('');
        } else if (this.hasNewPushOpportunity(this.lastPushCueToken, pushToken)) {
          audio.cardPop();
          this.controls.cueThoughtChoice();
          HandButton.cueThoughtChoice();
          BreathButton.cueThoughtChoice();
        }
      }
      this.lastPushCueToken = pushToken;
      const look = this.storyReady && this.story.canLookWithin();
      const state = `${push}|${look}|${this.current.id}`;
      if (this.controls && state !== this.controlsState) {
        if (!this.controlsState) this.controls.show();
        this.controlsState = state;
        this.controls.setPushVisible(push);
        this.controls.setLookWithinVisible(look);
        this.updateLookWithinLabels();
      }
    }
    shown.scene.render();
    const o = this.overlays.get(shown.id);
    if (o) {
      o.extra = {
        world: shown.id,
        anger: +this.anger.value.toFixed(2),
        pushLevel: this.anger.pushLevel,
        bubbles: field?.count ?? 0,
        ...shown.debugInfo(),
      };
      o.update(dt);
    }
  }

  private pushCueToken(field: ThoughtField | undefined): string {
    if (field instanceof BubbleField) return field.pushCueToken;
    if (field instanceof WaveField) return field.pushCueToken;
    return '';
  }

  private hasNewPushOpportunity(previous: string, current: string): boolean {
    if (!current) return false;
    if (!previous) return true;
    const oldIds = new Set(previous.split(','));
    return current.split(',').some((id) => !oldIds.has(id));
  }

  private installHooks(): void {
    const w = window as unknown as { __lw: unknown };
    w.__lw = {
      audioState: () => audio.state(),
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
      bubbles: () => this.fields.get(this.current.id)?.count ?? 0,
      pushable: () => {
        const f = this.fields.get(this.current.id);
        return this.pushCueToken(f) !== '';
      },
      pushCueToken: () => this.pushCueToken(this.fields.get(this.current.id)),
      bumps: () => this.outer.bumps,
      townAgitation: () => this.outer.meanAgitation(),
      townAnger: () => this.anger.value * (this.storyReady ? this.story.townGate : 1),
      setAnger: (v: number) => {
        this.debugBubbles = true;
        this.anger.set(v);
      },
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
      impBreathProgress: () => this.story.impBreathProgress(),
      endCardVisible: () => this.story.endCard.visible,
      line: () => this.lastLine,
      interactionContext: () => this.story.interactionContext(),
      applesLeft: () => this.outer.alley.applesLeft(),
      clearSave: () => StoryState.clear(),
      drawCalls: () => this.overlays.get(this.current.id)?.stats().drawCalls ?? 0,
    };
  }
}
