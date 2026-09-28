import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import {
  BREATH,
  CALM,
  COLOR,
  HINTS,
  LAYOUT,
  MANIFEST,
  PLAYER,
  RECEIVE,
  SCENE_GOALS,
  SCENE_STARTS,
  THANKS,
  TRANSFORM,
} from './content/chapter1';
import type { SceneId } from './content/chapter1';
import { t } from './content/strings.en';
import { AudioEngine } from './audio/audio';
import type { Game } from './game';
import { clamp01, dist2d, smoothstep } from './core/math';
import type { SettingsData } from './core/save';
import { isLastChapter, nextChapter } from './content/chapters';
import type { ChapterId } from './content/chapters';
import {
  chapterProgress,
  isChapterComplete,
  loadSave,
  loadSettings,
  saveSave,
  saveSettings,
  setChapterProgress,
  unlockedChapters,
} from './core/save';

import { BreathSystem } from './systems/breath';
import { CalmSystem } from './systems/calm';
import { ChecksSystem } from './systems/checks';
import { HintSystem } from './systems/hints';
import { LightSystem } from './systems/light';
import { ManifestSystem } from './systems/manifest';
import { ReceiveSystem } from './systems/receive';
import { ThanksSystem } from './systems/thanks';
import { TransformSystem } from './systems/transform';
import {
  Butterfly,
  FogVolume,
  MoteFlow,
  Sprout,
  SpringGlow,
  WakingMist,
  buildBird,
} from './world/effects';
import { height as groundHeight } from './world/place';
import { GuideSystem } from './systems/guide';
import { DebugPanel } from './ui/debug';
import { GuidePanel } from './ui/guidePanel';
import { Hud } from './ui/hud';
import { Panels } from './ui/panels';

type Phase =
  | 'start'
  | 'startQuestions'
  | 'playing'
  | 'reflect'
  | 'understand'
  | 'apply'
  | 'endQuestions'
  | 'end';

/** How many calm breaths scene 1 needs before the glow appears. */
const WAKE_BREATHS = BREATH.wakeBreaths;

/**
 * Chapter 1 "Receive". This class owns the flow: the start screen, the six
 * scenes, and the learning cycle after the play.
 */
export class Chapter1 {
  private readonly bus;
  private readonly breath: BreathSystem;
  private readonly calm: CalmSystem;
  private readonly light: LightSystem;
  private readonly receive: ReceiveSystem;
  private readonly transform: TransformSystem;
  private readonly manifest: ManifestSystem;
  private readonly thanks: ThanksSystem;
  private readonly hints: HintSystem;
  private readonly checks = new ChecksSystem();
  private readonly audio: AudioEngine;
  private readonly hud: Hud;
  private readonly panels = new Panels();
  /** The guide's judgement about when to speak, and what she says. */
  private readonly guide: GuideSystem;
  private readonly guidePanel = new GuidePanel(t().guide.close);
  private readonly debug: DebugPanel | null;

  private readonly motes: MoteFlow;
  private readonly springGlows = new Map<string, SpringGlow>();
  private readonly fogVolume: FogVolume;
  private readonly sprout = new Sprout();
  private readonly bird = buildBird();
  private readonly butterfly = new Butterfly();
  private readonly wakingMist = new WakingMist();
  /** 0 clear, 1 thickest. Only matters before the first breath. */
  private mist: number = PLAYER.wakingMistBase;

  private phase: Phase = 'start';
  private scene: SceneId = 1;
  private settings: SettingsData;
  private save = loadSave();
  /** This chapter's own slot in the save file. */
  private readonly chapterId = 1 as const;
  /** The router sets this so a chapter can hand over to another one. */
  onLeaveToChapter: ((id: ChapterId) => void) | null = null;
  private wakeBreaths = 0;
  /** 0 to 1, how much of their stride the player has. */
  private stride: number = PLAYER.wakingWalkFactor;
  private hasBreathed = false;
  /** Automatic calm breathing for the browser tests. */
  private autoClock = 0;
  private autoHeld = false;
  /** Counters the browser tests read. They are never shown to the player. */
  private breathsTotal = 0;
  private breathsCalm = 0;
  private lastDt = 0;
  private readonly tmp = new Vector3();

  constructor(private readonly game: Game) {
    this.bus = game.bus;
    this.settings = loadSettings();

    this.breath = new BreathSystem(this.bus);
    this.breath.setPreset(this.settings.rhythm);
    this.calm = new CalmSystem(this.bus);
    this.light = new LightSystem(this.bus);
    this.receive = new ReceiveSystem(this.bus, [
      { id: 'spring1', ...LAYOUT.spring1 },
      { id: 'spring2', ...LAYOUT.spring2 },
      { id: 'spring3', ...LAYOUT.spring3 },
    ]);
    this.transform = new TransformSystem(this.bus, LAYOUT.fog);
    this.manifest = new ManifestSystem(this.bus, LAYOUT.seedSpot);
    this.thanks = new ThanksSystem(this.bus, LAYOUT.bridge);
    this.hints = new HintSystem(this.bus);
    this.guide = new GuideSystem(this.bus);
    this.audio = new AudioEngine(this.bus);

    this.hud = new Hud(
      this.game.input,
      () => this.openPause(),
      () => this.onPush(),
      () => this.onInteract(),
    );
    this.hud.breathCircle.reducedMotion = this.settings.reducedMotion;
    this.debug = game.flags.debug ? new DebugPanel(() => this.checks.toJson()) : null;

    this.motes = new MoteFlow(24);
    this.fogVolume = new FogVolume(LAYOUT.fog.radius);
    this.buildSceneObjects();
    this.mountUi();
    this.wireEvents();
    this.applySettings(this.settings, false);
  }

  // ---------- setup ----------

  private buildSceneObjects(): void {
    // Everything built here already stands in the scene. The mist is the one
    // thing that belongs to the player rather than to the valley.
    this.wakingMist.group.parent = this.game.world.player.group;

    this.fogVolume.group.position.set(
      LAYOUT.fog.x,
      groundHeight(LAYOUT.fog.x, LAYOUT.fog.z),
      LAYOUT.fog.z,
    );
    this.sprout.group.position.set(
      LAYOUT.seedSpot.x,
      groundHeight(LAYOUT.seedSpot.x, LAYOUT.seedSpot.z),
      LAYOUT.seedSpot.z,
    );
    this.bird.position.set(
      LAYOUT.bird.x,
      groundHeight(LAYOUT.bird.x, LAYOUT.bird.z) + 0.17,
      LAYOUT.bird.z,
    );

    for (const spring of this.receive.springs) {
      const glow = new SpringGlow();
      const anchor = this.game.world.anchors.get(spring.config.id);
      if (anchor) {
        anchor.visible = spring.revealed;
        glow.mesh.position.set(anchor.position.x, anchor.position.y + 1, anchor.position.z);
      }
      this.springGlows.set(spring.config.id, glow);
    }
  }

  private mountUi(): void {
    this.game.root.append(this.hud.root, this.guidePanel.root, this.panels.root);
    this.guidePanel.onDismiss = (): void => this.guide.dismiss();
    if (this.debug) this.game.root.append(this.debug.root);
    this.game.input.attach(this.game.canvas, this.hud.joystickZone);
    // A panel is always a pause. The player can stop at any point.
    this.panels.onOpenChanged = (open): void => {
      this.game.setPaused(open);
      this.game.worldInputBlocked = open;
      this.hud.setVisible(!open && this.phase === 'playing');
      // The debug read-out would sit on top of a panel on a narrow screen.
      if (this.debug) this.debug.root.style.display = open ? 'none' : '';
    };
    this.panels.onSelect = (): void => {
      void this.audio.start();
      this.bus.emit('cue', { id: 'uiSelect' });
    };
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.phase === 'playing' && !this.panels.isOpen) this.openPause();
    });

    // Leaving the page must not lose progress, and coming back must not leave
    // the game silent. Browsers suspend audio while a page is hidden.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveNow();
      else this.audio.resume();
    });
    window.addEventListener('pagehide', () => this.saveNow());
  }

  private wireEvents(): void {
    this.bus.on('breathCompleted', ({ calm }) => {
      this.hasBreathed = true;
      this.breathsTotal++;
      if (calm) this.breathsCalm++;
      this.onBreathCompleted(calm);
    });
    this.bus.on('zoneAdded', ({ x, z, radius }) => this.game.world.color.addZone(x, z, radius));
    this.bus.on('lightCollected', ({ from, amount }) => this.onLightCollected(from, amount));
    this.bus.on('springRevealed', ({ id }) => {
      const anchor = this.game.world.anchors.get(id);
      if (anchor) anchor.visible = true;
      this.bus.emit('cue', { id: 'spring' });
    });
    this.bus.on('fogPushed', () => this.checks.set('pushCount', this.transform.pushCount));
    this.bus.on('fogFled', () => this.checks.set('leftFogCount', this.transform.fleeCount));
    this.bus.on('bridgeComplete', () => this.game.world.setBridgeRise(0.001));
    this.bus.on('thanksComplete', () => {
      this.game.world.color.setGlobalTarget(1, THANKS.colorSeconds);
    });
    this.bus.on('hintShown', ({ id }) => {
      if (id === 'bird') this.bird.visible = true;
      if (id === 'butterfly') {
        this.butterfly.fly(
          LAYOUT.butterflyPath.map((p) => new Vector3(p.x, groundHeight(p.x, p.z) + 1.3, p.z)),
        );
      }
    });

    // What the guide speaks to. Every one of these fires *after* the player
    // has met the thing it is about, which is the whole rule she works to.
    this.bus.on('breathCompleted', ({ calm }) => {
      if (calm) this.guide.progressed();
      this.guide.say('firstBreath', { text: 'firstBreath' });
    });
    this.bus.on('springRevealed', () => {
      this.guide.progressed();
      this.guide.say('springFound', { text: 'springFound' });
    });
    this.bus.on('springEmptied', () => {
      this.guide.progressed();
      this.guide.say('springDry', { text: 'springDry' });
    });
    this.bus.on('fogStepChanged', ({ step }) => {
      if (step >= 1) {
        this.guide.progressed();
        // A blockage is where a teaching belongs: it waits to be read, and
        // later it is where Dr. Rulin's own words will sit.
        this.guide.say('fogMet', { text: 'fogMet' }, { holds: false });
      }
    });
    this.bus.on('fogDissolved', () => {
      this.guide.progressed();
      this.guide.say('fogGone', { text: 'fogGone' });
    });
    this.bus.on('seedPlanted', () => {
      this.guide.progressed();
      this.guide.say('seedPlanted', { text: 'seedPlanted' });
    });
    this.bus.on('bridgeComplete', () => {
      this.guide.progressed();
      this.guide.say('bridgeStands', { text: 'bridgeStands' });
    });
    this.bus.on('sceneChanged', () => this.guide.progressed());
  }

  /** Writes everything that is only in memory. Safe to call at any time. */
  private saveNow(): void {
    this.checks.flushScene();
    setChapterProgress(this.save, this.chapterId, { light: this.light.get() });
    saveSave(this.save);
  }

  // ---------- flow ----------

  /** Opens the start screen. */
  begin(): void {
    this.phase = 'start';
    this.hud.setVisible(false);
    this.game.setPaused(true);
    if (this.game.flags.startScene !== null) {
      this.jumpToScene(this.game.flags.startScene);
      return;
    }
    this.showStart();
  }

  private showStart(): void {
    const progress = chapterProgress(this.save, this.chapterId);
    const canResume = progress.scene > 1 && !isChapterComplete(this.save, this.chapterId);
    this.panels.startScreen({
      unlocked: unlockedChapters(this.save, this.chapterId),
      resumeChapter: canResume ? this.chapterId : null,
      onChapter: (id) => {
        if (id === this.chapterId) this.startFresh();
        else this.onLeaveToChapter?.(id);
      },
      onResume: () => this.resumeSave(),
      onSettings: () => this.openSettings(() => this.showStart()),
    });
  }

  private startFresh(): void {
    // Only this chapter starts over. A player walking chapter 1 again must not
    // lose the chapters they have already finished.
    setChapterProgress(this.save, this.chapterId, { scene: 1, light: 0, completed: false });
    saveSave(this.save);
    this.checks.reset();
    this.phase = 'startQuestions';
    this.panels.questions(this.save.startAnswers, (a) => {
      this.save.startAnswers = a;
      saveSave(this.save);
      this.enterScene(1, true);
    });
  }

  private resumeSave(): void {
    const progress = chapterProgress(this.save, this.chapterId);
    this.light.set(progress.light);
    this.enterScene(progress.scene as SceneId, true);
  }

  /** `?scene=N` starts directly at a scene with the right amount of light. */
  private jumpToScene(scene: SceneId): void {
    const start = SCENE_STARTS[scene];
    this.light.set(start.light);
    // Everything before this scene counts as already done.
    for (const spring of this.receive.springs) {
      const order = spring.config.id === 'spring1' ? 2 : spring.config.id === 'spring2' ? 3 : 5;
      if (order < scene) {
        spring.remaining = 0;
        spring.revealed = true;
        this.game.world.color.addZone(spring.config.x, spring.config.z, RECEIVE.zoneRadius);
      }
    }
    if (scene > 4) {
      this.transform.step = 4;
      this.transform.dissolveTime = TRANSFORM.dissolveSeconds;
      this.game.world.color.addZone(LAYOUT.fog.x, LAYOUT.fog.z, TRANSFORM.zoneRadius);
    }
    if (scene > 5) {
      this.manifest.plant(true, 1);
      this.manifest.state = 'complete';
      this.manifest.riseTime = MANIFEST.bridgeRiseSeconds;
      // The bridgeComplete handler starts the rise from zero, so raise the
      // bridge after it, not before.
      this.bus.emit('bridgeComplete');
      this.game.world.setBridgeRise(1);
    }
    if (scene >= 3) this.calm.set(CALM.heartThreshold + 0.05);
    // A player who starts past the opening has already taken their first
    // breath, so they do not start inside the waking mist.
    if (scene >= 2) {
      this.hasBreathed = true;
      this.mist = 0;
      this.stride = 1;
      this.wakingMist.setStrength(0, PLAYER.wakingMistRadius);
    }
    this.enterScene(scene, true);
  }

  private enterScene(scene: SceneId, place: boolean): void {
    this.scene = scene;
    setChapterProgress(this.save, this.chapterId, { scene, light: this.light.get() });
    saveSave(this.save);
    this.checks.enterScene(scene);
    this.phase = 'playing';
    this.panels.close();
    this.hud.setVisible(true);
    this.game.setPaused(false);

    if (scene === 1) this.wakeBreaths = 0;
    if (place) {
      const start = SCENE_STARTS[scene];
      this.game.world.placePlayer(start.x, start.z);
      this.game.camera.snapTo(this.game.world.playerPosition);
    }
    this.bus.emit('sceneChanged', { scene });
    void this.audio.start();
  }

  private advanceTo(scene: SceneId): void {
    if (scene <= this.scene) return;
    this.enterScene(scene, false);
  }

  private finishChapter(): void {
    this.checks.flushScene();
    setChapterProgress(this.save, this.chapterId, { completed: true });
    saveSave(this.save);
    this.phase = 'reflect';
    this.hud.setVisible(false);
    this.game.autoWalk = null;
    this.panels.reflect(() => {
      this.phase = 'understand';
      this.panels.card(t().understand.card, () => {
        this.phase = 'apply';
        this.panels.card(t().apply.card, () => {
          this.phase = 'endQuestions';
          if (isLastChapter(this.chapterId)) {
            this.phase = 'endQuestions';
            this.panels.questions(
              this.save.endAnswers,
              (a) => {
                this.save.endAnswers = a;
                saveSave(this.save);
                this.showEnd();
              },
              true,
            );
          } else {
            this.showEnd();
          }
        });
      });
    });
  }

  private showEnd(): void {
    this.phase = 'end';
    this.panels.chapterEnd({
      heading: t().end.heading,
      current: this.chapterId,
      next: nextChapter(this.chapterId),
      onAgain: () => window.location.reload(),
      onStart: () => {
        window.location.search = '';
      },
      onNext: () => {
        const next = nextChapter(this.chapterId);
        if (next) this.onLeaveToChapter?.(next);
      },
    });
  }

  private openPause(): void {
    if (this.phase !== 'playing') return;
    this.game.setPaused(true);
    this.panels.pause(
      () => {
        this.panels.close();
        this.game.setPaused(false);
        this.hud.setVisible(true);
      },
      () => this.openSettings(() => this.openPause()),
      () => {
        saveSave(this.save);
        window.location.reload();
      },
    );
  }

  private openSettings(back: () => void): void {
    this.panels.settings(
      this.settings,
      (next) => this.applySettings(next, true),
      () => back(),
    );
  }

  private applySettings(next: SettingsData, persist: boolean): void {
    this.settings = next;
    if (persist) saveSettings(next);
    this.breath.setPreset(next.rhythm);
    this.audio.setVolume(next.volume);
    this.audio.setMuted(next.muted);
    this.game.setReducedMotion(next.reducedMotion);
    this.hud.breathCircle.reducedMotion = next.reducedMotion;
    this.game.setAutoQuality(next.quality === 'auto');
    if (next.quality !== 'auto') this.game.setQuality(next.quality);
  }

  // ---------- actions ----------

  private onPush(): void {
    // Never gated on the scene number: the push belongs to the fog, and the
    // fog is wherever the player finds it.
    if (!this.transform.pushAvailable) return;
    this.transform.push();
    this.game.camera.addShake(0.5);
  }

  private onInteract(): void {
    if (this.manifest.state !== 'none') return;
    const p = this.game.world.playerPosition;
    if (dist2d(p.x, p.z, LAYOUT.seedSpot.x, LAYOUT.seedSpot.z) > 4) return;
    this.panels.seedChoice(
      this.light.canAfford(MANIFEST.cost),
      () => {
        const paid = this.light.spend(MANIFEST.cost);
        this.manifest.plant(paid, this.calm.get());
        this.panels.close();
        this.game.setPaused(false);
        this.hud.setVisible(true);
      },
      () => {
        this.panels.close();
        this.game.setPaused(false);
        this.hud.setVisible(true);
      },
    );
  }

  private onBreathCompleted(calm: boolean): void {
    const p = this.game.world.playerPosition;
    if (calm) {
      this.bus.emit('cue', { id: 'calmBreath' });
      this.hud.breathCircle.pulse();
    }

    if (this.scene === 1 && calm) {
      this.wakeBreaths++;
      if (this.wakeBreaths >= WAKE_BREATHS) this.advanceTo(2);
    }

    const spring = this.receive.onBreath(calm, p.x, p.z);
    if (spring) {
      const anchor = this.game.world.anchors.get(spring.config.id);
      if (anchor) {
        // One mote per light drawn, so the player sees what they received.
        for (let i = 0; i < spring.lastGiven; i++) {
          this.motes.send(
            this.tmp.set(anchor.position.x, anchor.position.y + 0.8, anchor.position.z).clone(),
            RECEIVE.moteFlightSeconds + i * 0.35,
            () => this.light.add(1),
          );
        }
      }
    }

    this.transform.onBreath(calm, p.x, p.z);
    this.thanks.onBreath(calm, p.x, p.z);
  }

  private onLightCollected(from: 'spring' | 'fog', amount: number): void {
    if (from !== 'fog') return;
    // The fog dissolves into motes that flow into the player.
    for (let i = 0; i < amount * 6; i++) {
      const start = this.fogVolume.randomPoint(new Vector3());
      this.motes.send(
        start,
        TRANSFORM.dissolveSeconds * (0.5 + Math.random() * 0.5),
        i < amount ? () => this.light.add(1) : null,
      );
    }
  }

  // ---------- per frame ----------

  update(dt: number): void {
    this.lastDt = dt;
    const p = this.game.world.playerPosition;
    const walking = this.game.speed > 0.25;

    // Automatic calm breathing for the browser tests.
    let inHeld = this.game.input.breathInHeld;
    let outHeld = this.game.input.breathOutHeld;
    if (this.game.flags.autobreathe && this.phase === 'playing') {
      const auto = this.autoBreathe(dt);
      inHeld = auto.inHeld;
      outHeld = auto.outHeld;
    }

    if (this.phase === 'playing' && !this.panels.isOpen) {
      this.game.worldInputBlocked = false;
      // Desktop keys: E pushes, Enter plants. The on-screen buttons do the same.
      if (this.game.input.pushPressed) this.onPush();
      if (this.game.input.interactPressed) this.onInteract();
      this.breath.update(dt, inHeld, outHeld, this.game.speed);
      this.updateStride(dt, walking);
      this.calm.update(dt, walking);
      this.checks.update(dt);
      this.runScene(dt, p.x, p.z);
    }

    this.updateGuide(dt, walking);

    // Visuals that always run so a paused screen still looks alive.
    this.motes.update(dt, this.game.world.player.chestWorld(this.tmp));
    this.fogVolume.update(dt);
    this.sprout.update(dt);
    this.wakingMist.update(dt);
    this.butterfly.update(dt);
    for (const glow of this.springGlows.values()) glow.update(dt);

    this.updateHud(dt, p.x, p.z);
    this.updateAudio();
    this.debug?.update({
      calm: this.calm.get(),
      light: this.light.get(),
      scene: this.scene,
      fps: this.game.fps.value,
      diagnostics: this.game.diagnostics ?? undefined,
      tier:
        this.game.qualityDrops > 0
          ? `${this.game.quality.tier} (-${String(this.game.qualityDrops)})`
          : this.game.quality.tier,
      fogStep: this.transform.step,
      seed: this.manifest.state,
      checks: this.checks.data,
    });

    // The world needs the calm value and the light count to draw them.
    this.game.calm = this.calm.get();
    this.game.light = this.light.get();
  }

  private autoBreathe(dt: number): { inHeld: boolean; outHeld: boolean } {
    const preset = this.breath.getPreset();
    const cycle = preset.inhale + preset.exhale;
    this.autoClock = (this.autoClock + dt) % cycle;
    const inHeld = this.autoClock < preset.inhale;
    this.autoHeld = inHeld;
    return { inHeld, outHeld: !inHeld };
  }

  /**
   * The player's stride. They can set off at once, but heavily, as if not yet
   * awake. The first finished breath opens the stride up, and it stays open.
   */
  /**
   * The waking mist and the short stride that goes with it.
   *
   * The player may walk from the first second. Until their first finished
   * breath they do it inside their own mist, with a short stride, and pushing
   * on without stopping thickens it. One breath clears it for good.
   */
  private updateStride(dt: number, walking: boolean): void {
    if (this.hasBreathed) {
      this.mist = Math.max(0, this.mist - dt / PLAYER.wakingEaseSeconds);
    } else if (walking) {
      this.mist = Math.min(PLAYER.wakingMistMax, this.mist + PLAYER.wakingMistGainPerSecond * dt);
    } else {
      // Standing still lets it settle, so stopping already feels like relief.
      this.mist = Math.max(PLAYER.wakingMistBase, this.mist - dt * 0.12);
    }

    // The thicker the mist, the shorter the stride. Never below the floor.
    const target = this.hasBreathed
      ? 1
      : PLAYER.wakingWalkFactor + (1 - PLAYER.wakingWalkFactor) * (1 - this.mist) * 0.4;
    const step = dt / PLAYER.wakingEaseSeconds;
    this.stride =
      this.stride < target
        ? Math.min(target, this.stride + step)
        : Math.max(target, this.stride - step);
    this.game.strideFactor = this.stride;
    this.wakingMist.setStrength(this.mist, PLAYER.wakingMistRadius);
  }

  /**
   * Runs every mechanic, every frame, wherever the player is standing.
   *
   * The scene number only records how far the player has come. It must never
   * gate a system: the valley is one open place, and the only real barrier in
   * it is the gap in the ground. Gating the fog behind "scene 4" meant a player
   * who walked past the hidden second spring found a fog that did nothing at
   * all, and with it no transform, no seed and no bridge.
   */
  private runScene(dt: number, px: number, pz: number): void {
    this.transform.update(dt, px, pz);
    this.manifest.update(dt, px, pz);
    this.thanks.update(dt);

    const spring2 = this.receive.get('spring2');
    this.hints.updateScene3(dt, spring2?.revealed ?? false);
    if (spring2?.revealed && !this.hints.birdShown) {
      this.checks.set('stoppedWithoutHint', true);
    }

    this.hints.updateScene5(dt, px, pz, LAYOUT.seedSpot.x, LAYOUT.seedSpot.z);
    if (this.manifest.hasBeenAway && !this.hints.butterflyShown) {
      this.checks.set('walkedAwayFromSeed', true);
    }

    if (this.manifest.state === 'complete') {
      this.game.world.setBridgeRise(clamp01(this.manifest.riseTime / MANIFEST.bridgeRiseSeconds));
    }

    this.updateProgress();

    if (this.thanks.complete && this.game.world.color.globalColor >= 0.999) {
      this.finishChapter();
    }
  }

  /**
   * Works out how far the player has come and records it. The player may do
   * the parts out of order, so this only ever moves forward.
   */
  private updateProgress(): void {
    let reached: SceneId = 1;
    if (this.wakeBreaths >= WAKE_BREATHS) reached = 2;
    if (this.receive.get('spring1')?.empty) reached = 3;
    if (this.receive.get('spring2')?.empty) reached = 4;
    if (this.transform.done && this.transform.dissolveTime >= TRANSFORM.dissolveSeconds) {
      reached = 5;
    }
    if (
      this.manifest.state === 'complete' &&
      this.manifest.riseTime >= MANIFEST.bridgeRiseSeconds
    ) {
      reached = 6;
    }
    if (reached > this.scene) this.advanceTo(reached);
  }

  /**
   * The guide, each step.
   *
   * She is fed three things: whether the player is mid-breath, whether they
   * are walking, and what she is currently saying. Everything else she works
   * out herself. The panel only mirrors her.
   */
  private updateGuide(dt: number, walking: boolean): void {
    const breathing = this.breath.phase !== 'idle';
    this.guide.setBreathing(breathing);
    this.guide.update(dt, walking);

    const message = this.guide.current;
    const world = this.game.world;

    // When she has offered the way on, she goes and stands on it. That is
    // the whole of the directions this game gives: no line on the ground,
    // no arrow, just a light waiting somewhere the player has not been.
    if (message?.id === 'lost') {
      const goal = SCENE_GOALS[this.scene];
      world.guide.lead(goal ? new Vector3(goal.x, groundHeight(goal.x, goal.z), goal.z) : null);
    } else if (!message) {
      world.guide.lead(null);
    }

    if (message) {
      if (!this.guidePanel.isShowing) {
        const line = (t().guide as Record<string, string>)[message.teaching.text] ?? '';
        this.guidePanel.show(line, message.teaching.video, message.holds);
      }
      world.guide.setSpeaking(true);
      this.guidePanel.follow(world.guide.position, this.game.scene);
      // The figure glances at her while she talks, and only then.
      world.player.lookTowards(world.guide.position);
    } else {
      this.guidePanel.hide();
      world.guide.setSpeaking(false);
      world.player.lookTowards(null);
    }
    // The chest follows the breath, so standing still is never standing dead.
    world.player.setBreath(this.breath.playerRing);
  }

  private updateHud(dt: number, px: number, pz: number): void {
    const fogDistance = this.transform.distanceTo(px, pz);
    const inFog = !this.transform.done && fogDistance <= this.transform.radius;

    // Step 1: the thought appears inside the fog and cannot be skipped.
    this.hud.setFogText(
      t().fog.thought,
      this.transform.step >= 1 && !this.transform.done ? this.transform.seeProgress : 0,
    );

    // Step 2: the breath circle trembles a little and the wind bends the grass.
    const feeling = this.transform.step >= 2 && !this.transform.done;
    this.hud.breathCircle.setTremble(feeling ? clamp01(1 - fogDistance / TRANSFORM.feelRadius) : 0);
    this.game.wind.x = this.transform.x;
    this.game.wind.z = this.transform.z;
    this.game.wind.radius = this.transform.radius * 2.4;
    this.game.wind.strength = feeling ? 0.5 + Math.sin(this.game.time * 1.3) * 0.22 : 0;

    // Step 3: the screen darkens softly while the player stands in the middle.
    const darkTarget = inFog && this.transform.step >= 3 ? 0.72 : 0;
    this.game.setDarken(darkTarget, dt);

    this.fogVolume.setDensity(
      this.transform.done
        ? Math.max(0, 1 - this.transform.dissolveTime / TRANSFORM.dissolveSeconds)
        : 1 + this.transform.pushExtra * 0.35,
      this.transform.radius / LAYOUT.fog.radius,
    );
    this.fogVolume.group.position.x = this.transform.x;
    this.fogVolume.group.position.z = this.transform.z;

    this.hud.setPushVisible(this.transform.pushAvailable && !this.transform.done);
    this.hud.setInteractVisible(
      this.manifest.state === 'none' && dist2d(px, pz, LAYOUT.seedSpot.x, LAYOUT.seedSpot.z) <= 4,
    );

    // Spring glows: bright while they still hold light, gentle once empty.
    for (const spring of this.receive.springs) {
      const glow = this.springGlows.get(spring.config.id);
      if (!glow) continue;
      if (!spring.revealed) {
        glow.setStrength(0, 1);
        continue;
      }
      const d = spring.distanceTo(px, pz);
      const near = d <= RECEIVE.drawRadius;
      // A spring that still holds light shimmers a little when the player is
      // close. An empty one keeps only a gentle glow.
      const strength = spring.empty ? 0.5 : near ? 1.1 : 0.55;
      // The halo fades with distance, so it never reads as a marker from afar.
      const fade = clamp01(1 - (d - RECEIVE.drawRadius) / 26);
      glow.setStrength(
        strength * (0.35 + 0.65 * fade),
        spring.empty ? 2.2 : 1.9 + (near ? 0.4 : 0),
      );
    }

    this.sprout.setState(
      this.manifest.state === 'growing',
      this.manifest.progress,
      this.manifest.paused,
    );

    // The bridge turns golden when the player gives thanks on it.
    this.game.world.setBridgeGold(this.thanks.golden);

    this.hud.breathCircle.update(
      this.breath.targetRing,
      this.breath.playerRing,
      // The label follows what the player should do next, not the demo rhythm.
      this.breath.playerPhase() === 'inhale',
      this.game.time,
    );
    this.hud.breathCircle.setVisible(this.phase === 'playing');
    this.hud.showHint(this.currentHint(px, pz));
  }

  /** Short control hints only. They never explain what anything means. */
  private currentHint(px: number, pz: number): string | null {
    if (this.phase !== 'playing') return null;
    if (
      this.manifest.state === 'none' &&
      dist2d(px, pz, LAYOUT.seedSpot.x, LAYOUT.seedSpot.z) <= 4
    ) {
      return t().seed.plant;
    }
    return null;
  }

  private updateAudio(): void {
    const p = this.game.world.playerPosition;
    const fogDistance = this.transform.distanceTo(p.x, p.z);
    const drone = this.transform.done
      ? 0
      : clamp01(1 - smoothstep(this.transform.radius, TRANSFORM.seeRadius * 1.6, fogDistance));
    const muffle =
      !this.transform.done && fogDistance <= this.transform.radius && this.transform.step >= 3
        ? 0.75
        : 0;
    const warmth = Math.max(
      this.game.world.color.globalColor,
      clamp01(this.game.world.color.zones.length / 4),
    );
    this.audio.update(
      this.breath.playerRing,
      this.breath.phase === 'inhale',
      warmth,
      drone,
      muffle,
    );
  }

  /** Used by the browser tests to read the state without a debug panel. */
  snapshot(): Record<string, unknown> {
    return {
      phase: this.phase,
      scene: this.scene,
      breathPhase: this.breath.phase,
      breathsTotal: this.breathsTotal,
      breathsCalm: this.breathsCalm,
      wakeBreaths: this.wakeBreaths,
      speed: Number(this.game.speed.toFixed(3)),
      stride: Number(this.stride.toFixed(3)),
      mist: Number(this.mist.toFixed(3)),
      px: Number(this.game.world.playerPosition.x.toFixed(3)),
      pz: Number(this.game.world.playerPosition.z.toFixed(3)),
      yaw: Number(this.game.camera.yaw.toFixed(4)),
      autoHeld: this.autoHeld,
      autoClock: Number(this.autoClock.toFixed(2)),
      preset: this.breath.getPreset().id,
      fps: this.game.fps.value,
      lastDt: Number(this.lastDt.toFixed(4)),
      worstMs: Math.round(this.game.fps.worstMs),
      paused: this.game.paused,
      calm: Number(this.calm.get().toFixed(3)),
      light: this.light.get(),
      fogStep: this.transform.step,
      pushCount: this.transform.pushCount,
      fleeCount: this.transform.fleeCount,
      seed: this.manifest.state,
      seedRemaining: Number(this.manifest.remaining.toFixed(1)),
      thanks: this.thanks.breaths,
      globalColor: Number(this.game.world.color.globalColor.toFixed(3)),
      zones: this.game.world.color.zones.length,
      springs: this.receive.springs.map((s) => ({
        id: s.config.id,
        left: s.remaining,
        revealed: s.revealed,
      })),
      birdShown: this.hints.birdShown,
      butterflyShown: this.hints.butterflyShown,
      maxZones: COLOR.maxZones,
      hintSeconds: HINTS.birdAfterSeconds,
    };
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  /** Test helpers, only reachable through `window.__lw` behind a debug flag. */
  testApi(): Record<string, (...args: any[]) => unknown> {
    return {
      walkTo: ((x: number, z: number) => {
        this.game.autoWalk = { x, z };
      }) as (...args: any[]) => unknown,
      walking: (() => this.game.autoWalk !== null) as (...args: any[]) => unknown,
      stopWalking: (() => {
        this.game.autoWalk = null;
      }) as (...args: any[]) => unknown,
      teleport: ((x: number, z: number) => {
        this.game.world.placePlayer(x, z);
        this.game.camera.snapTo(this.game.world.playerPosition);
      }) as (...args: any[]) => unknown,
      push: (() => this.onPush()) as (...args: any[]) => unknown,
      interact: (() => this.onInteract()) as (...args: any[]) => unknown,
      plantNow: (() => {
        const paid = this.light.spend(MANIFEST.cost);
        return this.manifest.plant(paid, this.calm.get());
      }) as (...args: any[]) => unknown,
      setCalm: ((v: number) => this.calm.set(v)) as (...args: any[]) => unknown,
      /** Clears the waking mist, so a test can measure the world behind it. */
      clearMist: (() => {
        this.hasBreathed = true;
        this.mist = 0;
        this.stride = 1;
        this.game.strideFactor = 1;
        this.wakingMist.setStrength(0, PLAYER.wakingMistRadius);
      }) as (...args: any[]) => unknown,
      setGlobalColor: ((v: number) => {
        this.game.world.color.setGlobalTarget(v, 0.001);
      }) as (...args: any[]) => unknown,
      revealSpring: ((id: string) => {
        const spring = this.receive.get(id);
        if (!spring) return false;
        spring.revealed = true;
        const anchor = this.game.world.anchors.get(id);
        if (anchor) anchor.visible = true;
        return true;
      }) as (...args: any[]) => unknown,
      lookAt: ((yaw: number, pitch: number) => {
        this.game.camera.yaw = yaw;
        this.game.camera.pitch = pitch;
        this.game.camera.snapTo(this.game.world.playerPosition);
      }) as (...args: any[]) => unknown,
      addLight: ((v: number) => this.light.add(v)) as (...args: any[]) => unknown,
      snapshot: (() => this.snapshot()) as (...args: any[]) => unknown,
      answers: (() => ({ start: this.save.startAnswers, end: this.save.endAnswers })) as (
        ...args: any[]
      ) => unknown,
    };
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
