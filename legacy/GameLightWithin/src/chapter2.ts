import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Group } from './render/scene3d';
import { CALM, RECEIVE } from './content/chapter1';
import {
  BODY,
  CHAPTER2,
  LAYOUT2,
  NIGHT,
  RAIN,
  SCENE2_STARTS,
  SEEDS2,
  SINGING_STONE,
  SOUND_BREATH,
  SPRING2,
  STORM,
  THUNDER,
  WEATHER,
  WORLD2,
} from './content/chapter2';
import { HINTS2 } from './content/chapter2';
import type { BodyPoint, FeelingType, Scene2Id } from './content/chapter2';
import { CHAPTERS, isLastChapter, nextChapter } from './content/chapters';
import type { ChapterId } from './content/chapters';
import { t } from './content/strings.en';
import { AudioEngine } from './audio/audio';
import type { Game } from './game';
import { clamp01, dist2d, makeRng } from './core/math';
import type { SettingsData } from './core/save';
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
import type { ChapterRunner } from './core/chapterRunner';

import { BreathSystem } from './systems/breath';
import { BodySystem } from './systems/body';
import { CalmSystem } from './systems/calm';
import { ChecksSystem } from './systems/checks';
import { HintSystem } from './systems/hints';
import { LightSystem } from './systems/light';
import { ReceiveSystem } from './systems/receive';
import { LightWell, SeedSpot } from './systems/seeds2';
import { SoundBreathSystem } from './systems/soundBreath';
import { StormSystem } from './systems/storm';
import { ThanksSystem } from './systems/thanks';
import { FeelingWeather, shuffledFeelings } from './systems/weather';
import { GrownTree, MoteFlow, Sprout, SpringGlow, buildBird } from './world/effects';
import { height as groundHeight } from './world/place';
import { setStoneGlow } from './world/props2';
import { Rainbow, ToneRings, WeatherView } from './world/weatherView';
import { DebugPanel } from './ui/debug';
import { DreamView } from './ui/dream';
import { Hud } from './ui/hud';
import { Panels } from './ui/panels';

type Phase =
  | 'start'
  | 'playing'
  | 'naming'
  | 'dream'
  | 'reflect'
  | 'understand'
  | 'apply'
  | 'endQuestions'
  | 'end';

/**
 * Chapter 2 "Be aware". The player goes inside, feels what is there, and
 * gives it a name.
 *
 * Like chapter 1, every mechanic runs every frame wherever the player is
 * standing. The scene number only records how far they have come. The
 * meadows are one open place and the player may meet the rain cloud before
 * the body stones if that is where their feet took them.
 */
export class Chapter2 implements ChapterRunner {
  private readonly bus;
  private readonly breath: BreathSystem;
  private readonly calm: CalmSystem;
  private readonly light: LightSystem;
  private readonly receive: ReceiveSystem;
  private readonly body: BodySystem;
  private readonly sound: SoundBreathSystem;
  private readonly storm: StormSystem;
  private readonly seedA: SeedSpot;
  private readonly seedB: SeedSpot;
  private readonly well: LightWell;
  private readonly thanks: ThanksSystem;
  private readonly hints: HintSystem;
  private readonly checks = new ChecksSystem(2);
  private readonly audio: AudioEngine;
  private readonly hud: Hud;
  private readonly panels = new Panels();
  private readonly dream = new DreamView();
  private readonly debug: DebugPanel | null;

  private readonly motes: MoteFlow;
  private readonly springGlow = new SpringGlow();
  private readonly wellGlow = new SpringGlow();
  private readonly rainbow = new Rainbow();
  private readonly toneRings = new ToneRings(SOUND_BREATH.ringRadius);
  private readonly bird = buildBird();
  private readonly sproutA = new Sprout();
  private readonly sproutB = new Sprout();
  private readonly treeA: GrownTree;
  private readonly treeB: GrownTree;
  /** The rain cloud of scene 3, and its view. */
  private readonly cloud: FeelingWeather;
  private readonly cloudView: WeatherView;
  private readonly stormView: WeatherView;

  private phase: Phase = 'start';
  private scene: Scene2Id = 1;
  private settings: SettingsData;
  private save = loadSave();
  private readonly chapterId = 2 as const;
  onLeaveToChapter: ((id: ChapterId) => void) | null = null;

  /** The weather the naming panel is open for. */
  private naming: FeelingWeather | null = null;
  private readonly rng = makeRng(20260917);
  /** Scene 3 runs to its own step: 0 waiting, 1 named, 2 felt, 3 let go. */
  private rainStep: 0 | 1 | 2 | 3 = 0;
  private rainBreaths = 0;
  private rainbowTime = 0;
  /** Seconds since the chapter began, for the slow day. */
  private clock = 0;
  /** 0 day, 1 night. Scene 6 turns it up. */
  private night = 0;
  private dreamTime = 0;
  /** 0 standing, 1 lying in the grass. */
  private lyingDown = 0;
  /** Seconds the singing stone has been standing with the player. */
  private stoneNear = 0;
  private autoClock = 0;
  /** Seconds until the next roll of thunder. */
  private thunderClock: number = THUNDER.minSeconds;
  private breathsTotal = 0;
  private breathsCalm = 0;
  private hasBreathed = false;
  private readonly tmp = new Vector3();
  /** The body stones, looked up once instead of searched for every frame. */
  private readonly stoneAnchors = new Map<BodyPoint, Group>();
  /** Which stone is lit, so the others are only dimmed when it changes. */
  private litStone: BodyPoint | null = null;

  constructor(private readonly game: Game) {
    this.bus = game.bus;
    this.settings = loadSettings();

    this.breath = new BreathSystem(this.bus);
    this.breath.setPreset(this.settings.rhythm);
    this.calm = new CalmSystem(this.bus);
    this.light = new LightSystem(this.bus);
    this.receive = new ReceiveSystem(this.bus, [
      {
        id: 'spring',
        x: LAYOUT2.spring.x,
        z: LAYOUT2.spring.z,
        light: SPRING2.light,
        hidden: false,
      },
    ]);
    this.body = new BodySystem(this.bus, LAYOUT2.bodyStones);
    this.sound = new SoundBreathSystem(this.bus);
    this.storm = new StormSystem(this.bus, LAYOUT2.storm);
    this.seedA = new SeedSpot(
      this.bus,
      'A',
      LAYOUT2.seedA.x,
      LAYOUT2.seedA.z,
      SEEDS2.windyCalmDecayFactor,
    );
    this.seedB = new SeedSpot(this.bus, 'B', LAYOUT2.seedB.x, LAYOUT2.seedB.z);
    this.well = new LightWell(this.bus, LAYOUT2.lightWell.x, LAYOUT2.lightWell.z);
    this.thanks = new ThanksSystem(this.bus, { x: LAYOUT2.seedB.x, z: LAYOUT2.seedB.z });
    this.hints = new HintSystem(this.bus, HINTS2.birdAfterSeconds);
    this.audio = new AudioEngine(this.bus);

    this.cloud = new FeelingWeather({
      type: 'sadness',
      x: LAYOUT2.rain.x,
      z: LAYOUT2.rain.z,
      intensity: RAIN.startIntensity,
      size: RAIN.cloudSize,
      followsPlayer: true,
    });
    this.cloudView = new WeatherView('sadness', RAIN.cloudSize);
    this.stormView = new WeatherView('anger', LAYOUT2.storm.radius);

    this.hud = new Hud(
      this.game.input,
      () => this.openPause(),
      () => this.onPush(),
      () => this.onInteract(),
      CHAPTERS[this.chapterId].circleStrength,
    );
    this.hud.breathCircle.reducedMotion = this.settings.reducedMotion;
    this.debug = game.flags.debug ? new DebugPanel(() => this.checks.toJson()) : null;

    this.motes = new MoteFlow(24);
    this.treeA = new GrownTree(911, this.game.quality.treeBlobs);
    this.treeB = new GrownTree(912, this.game.quality.treeBlobs);
    // The meadows are already partly in colour when the player arrives.
    this.game.world.color.setGlobalTarget(CHAPTER2.startColor, 0);
    this.buildSceneObjects();
    this.mountUi();
    this.wireEvents();
    this.applySettings(this.settings, false);
  }

  // ---------- setup ----------

  private buildSceneObjects(): void {
    // Everything built here already stands in the scene.
    const spring = this.game.world.anchors.get('spring');
    if (spring) {
      this.springGlow.mesh.position.set(
        spring.position.x,
        spring.position.y + 1,
        spring.position.z,
      );
    }
    const well = this.game.world.anchors.get('lightWell');
    if (well) {
      this.wellGlow.mesh.position.set(well.position.x, well.position.y + 0.9, well.position.z);
    }

    for (const [sprout, tree, spot] of [
      [this.sproutA, this.treeA, LAYOUT2.seedA],
      [this.sproutB, this.treeB, LAYOUT2.seedB],
    ] as const) {
      const y = groundHeight(spot.x, spot.z);
      sprout.group.position.set(spot.x, y, spot.z);
      tree.group.position.set(spot.x, y, spot.z);
    }

    this.stormView.group.position.set(
      LAYOUT2.storm.x,
      groundHeight(LAYOUT2.storm.x, LAYOUT2.storm.z),
      LAYOUT2.storm.z,
    );
    this.bird.position.set(
      LAYOUT2.bird.x,
      groundHeight(LAYOUT2.bird.x, LAYOUT2.bird.z) + 0.17,
      LAYOUT2.bird.z,
    );
    this.bird.visible = false;

    for (const stone of LAYOUT2.bodyStones) {
      const anchor = this.game.world.anchors.get(`stone-${stone.point}`);
      if (anchor) this.stoneAnchors.set(stone.point as BodyPoint, anchor);
    }
  }

  private mountUi(): void {
    this.game.root.append(this.hud.root, this.dream.root, this.panels.root);
    if (this.debug) this.game.root.append(this.debug.root);
    this.panels.onOpenChanged = (open): void => {
      this.game.setPaused(open);
      this.game.worldInputBlocked = open;
      if (open) this.hud.setVisible(false);
    };
    this.panels.onSelect = (): void => this.bus.emit('cue', { id: 'uiSelect' });
  }

  private wireEvents(): void {
    // The calm value follows the breath on its own, inside CalmSystem.
    this.bus.on('breathCompleted', (e) => {
      this.hasBreathed = true;
      this.breathsTotal++;
      if (e.calm) {
        this.breathsCalm++;
        this.bus.emit('cue', { id: 'calmBreath' });
        this.hud.breathCircle.pulse();
      }
      this.onBreathCompleted(e.calm, e.exhale);
    });
    this.bus.on('zoneAdded', ({ x, z, radius }) => this.game.world.color.addZone(x, z, radius));
    this.bus.on('lightCollected', ({ from, amount }) => this.onLightCollected(from, amount));
    this.bus.on('bodyPointLit', ({ point }) => {
      this.game.world.player.setBodyPoint(point, 1);
      this.light.add(BODY.lightPerStone);
      this.bus.emit('cue', { id: 'stoneLit' });
    });
    this.bus.on('soundBreathTone', ({ hz }) => {
      this.audio.tone(hz, SOUND_BREATH.toneSeconds);
      const p = this.game.world.playerPosition;
      this.toneRings.send(p.x, p.y, p.z);
      this.checks.set('soundBreathCount', this.sound.count);
    });
    this.bus.on('fogFled', () => this.checks.set('leftStormCount', this.storm.fleeCount));
    this.bus.on('fogPushed', () => this.checks.set('pushCount', this.storm.pushCount));
    this.bus.on('seedPlanted', ({ kind }) => {
      const planted = [...this.checks.data.seedTypesPlanted, kind];
      this.checks.set('seedTypesPlanted', planted);
      if (planted.length === 1) this.checks.set('heartSeedFirstTry', kind === 'heart');
    });
    this.bus.on('thanksComplete', () => {
      this.game.world.color.setGlobalTarget(1, NIGHT.colorSeconds);
    });
    this.bus.on('hintShown', ({ id }) => {
      if (id === 'bird') this.bird.visible = true;
    });
  }

  // ---------- flow ----------

  begin(): void {
    this.phase = 'start';
    this.hud.setVisible(false);
    this.game.setPaused(true);
    if (this.game.flags.startScene !== null) {
      this.jumpToScene(this.game.flags.startScene as Scene2Id);
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

  /**
   * A fresh walk through this chapter. The opening questions stay where they
   * are, at the start of chapter 1: they are asked once, about the player.
   */
  private startFresh(): void {
    setChapterProgress(this.save, this.chapterId, { scene: 1, light: 0, completed: false });
    saveSave(this.save);
    this.checks.reset();
    this.enterScene(1, true);
  }

  private resumeSave(): void {
    const progress = chapterProgress(this.save, this.chapterId);
    this.light.set(progress.light);
    this.enterScene(progress.scene as Scene2Id, true);
  }

  /** `?chapter=2&scene=N` starts directly at a scene, with everything before it done. */
  private jumpToScene(scene: Scene2Id): void {
    this.light.set(SCENE2_STARTS[scene].light);
    if (scene > 1) {
      const spring = this.receive.get('spring');
      if (spring) spring.remaining = 0;
      this.game.world.color.addZone(LAYOUT2.spring.x, LAYOUT2.spring.z, SPRING2.zoneRadius);
    }
    if (scene > 2) {
      for (const stone of this.body.stones) {
        stone.lit = true;
        stone.breaths = BODY.breathsPerStone;
        this.game.world.player.setBodyPoint(stone.point, 1);
      }
      this.body.silhouetteTime = BODY.silhouetteSeconds;
    }
    if (scene > 3) {
      this.rainStep = 3;
      this.cloud.named = true;
      this.cloud.dissolve();
      this.game.world.color.addZone(LAYOUT2.rain.x, LAYOUT2.rain.z, RAIN.zoneRadius);
    }
    if (scene >= 4) this.sound.unlock();
    if (scene > 4) {
      this.storm.step = 5;
      this.storm.done = true;
      this.storm.dissolveTime = STORM.dissolveSeconds;
      this.game.world.color.addZone(LAYOUT2.storm.x, LAYOUT2.storm.z, STORM.zoneRadius);
    }
    if (scene > 5) {
      this.seedB.plant(true, 1);
      this.seedB.state = 'grown';
    }
    if (scene >= 2) this.calm.set(CALM.heartThreshold + 0.05);
    if (this.game.flags.calm !== null) this.calm.set(this.game.flags.calm);
    if (scene >= 6) this.setNight(1);
    this.enterScene(scene, true);
  }

  private enterScene(scene: Scene2Id, place: boolean): void {
    this.scene = scene;
    // Light is not carried over from chapter 1: a chapter opens on the same
    // footing whichever way the player came to it.
    if (scene === 1 && this.light.get() === 0) this.light.set(CHAPTER2.startLight);
    setChapterProgress(this.save, this.chapterId, { scene, light: this.light.get() });
    saveSave(this.save);
    this.checks.enterScene(scene);
    this.phase = 'playing';
    this.panels.close();
    this.hud.setVisible(true);
    this.game.setPaused(false);

    if (place) {
      const start = SCENE2_STARTS[scene];
      this.game.world.placePlayer(start.x, start.z);
      this.game.camera.snapTo(this.game.world.playerPosition);
    }
    this.bus.emit('sceneChanged', { scene: Math.min(6, scene) as 1 | 2 | 3 | 4 | 5 | 6 });
    void this.audio.start();
  }

  private advanceTo(scene: Scene2Id): void {
    if (scene <= this.scene) return;
    this.enterScene(scene, false);
  }

  private finishChapter(): void {
    if (this.phase !== 'playing') return;
    this.checks.flushScene();
    setChapterProgress(this.save, this.chapterId, { completed: true });
    saveSave(this.save);
    // The dream comes first: a short look at a place the player has not been,
    // with no text on it at all.
    this.phase = 'dream';
    this.dreamTime = 0;
    this.hud.setVisible(false);
    this.game.setPaused(true);
    // Nobody is walking anywhere now. Leaving a walk half finished would mean
    // the player keeps travelling the moment anything unpauses the world.
    this.game.autoWalk = null;
    // The player lies down first. The dream fades in over the top of it, so
    // the last thing seen of the meadow is them settling into the grass.
    this.lyingDown = 0;
    window.setTimeout(() => this.dream.play(), NIGHT.lieDownSeconds * 1000);
  }

  private startLearningCycle(): void {
    this.phase = 'reflect';
    this.panels.reflect2(() => {
      this.phase = 'understand';
      this.panels.card(t().understand2.card, () => {
        this.phase = 'apply';
        this.panels.card(t().apply2.card, () => {
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
      heading: t().end.heading2,
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

  /** The pause screen. In this chapter it says the player may stop here. */
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
      t().pause2.heading,
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
    this.audio.setSoftStorm(next.softStorm);
    this.game.setReducedMotion(next.reducedMotion);
    this.hud.breathCircle.reducedMotion = next.reducedMotion;
    this.cloudView.reducedMotion = next.reducedMotion;
    this.dream.reducedMotion = next.reducedMotion;
    this.stormView.reducedMotion = next.reducedMotion;
    this.game.setAutoQuality(next.quality === 'auto');
    if (next.quality !== 'auto') this.game.setQuality(next.quality);
  }

  // ---------- actions ----------

  private onPush(): void {
    if (!this.storm.pushAvailable) return;
    this.storm.push();
    this.game.camera.addShake(0.5);
  }

  /**
   * Planting a seed. In the meadows the seed is a tree, and there are two
   * places to put one. The nearer spot wins.
   */
  private onInteract(): void {
    const spot = this.nearSeedSpot();
    if (!spot || spot.state !== 'none') return;
    this.panels.seedChoice(
      this.light.canAfford(SEEDS2.cost),
      () => {
        const paid = this.light.spend(SEEDS2.cost);
        spot.plant(paid, this.calm.get());
        this.closePanel();
      },
      () => this.closePanel(),
      'tree',
    );
  }

  private closePanel(): void {
    this.panels.close();
    this.game.setPaused(false);
    this.hud.setVisible(true);
  }

  private nearSeedSpot(): SeedSpot | null {
    const p = this.game.world.playerPosition;
    const dA = dist2d(p.x, p.z, this.seedA.x, this.seedA.z);
    const dB = dist2d(p.x, p.z, this.seedB.x, this.seedB.z);
    if (Math.min(dA, dB) > 4) return null;
    return dA <= dB ? this.seedA : this.seedB;
  }

  /** Opens the naming panel for a weather the player has stood with. */
  private openNaming(weather: FeelingWeather): void {
    this.naming = weather;
    this.phase = 'naming';
    const order = shuffledFeelings(this.rng);
    // `?autoname=1` answers correctly for the browser tests.
    if (this.game.flags.autoName) {
      window.setTimeout(() => this.answerNaming(weather.type), 0);
      return;
    }
    this.panels.naming(order, (choice) => this.answerNaming(choice));
  }

  private answerNaming(choice: FeelingType): void {
    const weather = this.naming;
    if (!weather) return;
    const right =
      weather === this.storm.weather ? this.storm.answer(choice) : weather.answer(choice);
    const attempts = { ...this.checks.data.namingAttempts };
    attempts[weather.type] = weather.attempts.length;
    this.checks.set('namingAttempts', attempts);
    this.bus.emit('weatherNamed', { type: weather.type, correct: right });

    if (right) {
      if (weather === this.cloud) this.rainStep = 1;
      this.naming = null;
      this.phase = 'playing';
      this.closePanel();
      return;
    }
    // Not a fit. The panel closes for four seconds and says only "Look again."
    this.panels.lookAgain();
    window.setTimeout(() => {
      this.naming = null;
      this.phase = 'playing';
      this.closePanel();
    }, 1400);
  }

  private onBreathCompleted(calm: boolean, exhale: number): void {
    const p = this.game.world.playerPosition;

    // The spring of scene 1.
    const spring = this.receive.onBreath(calm, p.x, p.z);
    if (spring) {
      const anchor = this.game.world.anchors.get(spring.config.id);
      if (anchor) {
        for (let i = 0; i < spring.lastGiven; i++) {
          this.motes.send(
            this.tmp.set(anchor.position.x, anchor.position.y + 0.8, anchor.position.z).clone(),
            RECEIVE.moteFlightSeconds + i * 0.35,
            () => this.light.add(1),
          );
        }
      }
      if (!this.hints.birdShown) this.checks.set('receivedWithoutSign', true);
      this.game.world.color.addZone(LAYOUT2.spring.x, LAYOUT2.spring.z, SPRING2.zoneRadius);
    }

    this.body.onBreath(calm, p.x, p.z);
    this.storm.onBreath(calm, p.x, p.z);
    this.thanks.onBreath(calm, p.x, p.z);
    // The light well: it gives only while the player is short, so it can never
    // become the whole game, and never leaves them stuck without a seed.
    const fromWell = this.well.onBreath(calm, p.x, p.z, this.light.get());
    if (fromWell > 0) this.light.add(fromWell);

    // Feeling the rain: two calm breaths under the cloud, once it is named.
    if (calm && this.rainStep === 1 && this.cloud.distanceTo(p.x, p.z) <= RAIN.feelRadius) {
      this.rainBreaths++;
      if (this.rainBreaths >= RAIN.feelBreaths) this.releaseRain();
    }

    // The singing stone answers the first long, calm out-breath beside it.
    const stoneDist = dist2d(p.x, p.z, LAYOUT2.singingStone.x, LAYOUT2.singingStone.z);
    if (calm && !this.sound.unlocked && stoneDist <= SINGING_STONE.radius) {
      const target = this.breath.getPreset().exhale;
      if (exhale >= target * SOUND_BREATH.minExhaleFactor) {
        this.sound.unlock();
        this.audio.tone(SOUND_BREATH.baseHz, SOUND_BREATH.toneSeconds);
        this.toneRings.send(p.x, p.y, p.z);
      }
    }

    // Every other calm, long breath from here on is a tone.
    const hz = this.sound.onBreath(calm, exhale, this.breath.getPreset().exhale);
    if (hz !== null) {
      if (this.storm.distanceTo(p.x, p.z) <= SOUND_BREATH.radius) this.storm.tone();
      if (this.cloud.distanceTo(p.x, p.z) <= SOUND_BREATH.radius) this.cloud.tone();
    }
  }

  /** The rain lets go: a rainbow, light, and colour returning to the meadow. */
  private releaseRain(): void {
    if (this.rainStep >= 3) return;
    this.rainStep = 3;
    this.cloud.dissolve();
    this.rainbowTime = 0;
    this.bus.emit('cue', { id: 'rainbow' });
    this.bus.emit('lightCollected', { from: 'fog', amount: RAIN.lightReward });
    this.bus.emit('zoneAdded', { x: this.cloud.x, z: this.cloud.z, radius: RAIN.zoneRadius });
  }

  private onLightCollected(from: 'spring' | 'fog', amount: number): void {
    if (from !== 'fog') {
      this.light.add(amount);
      return;
    }
    // A weather dissolves into motes that flow into the player.
    const source = this.cloud.dissolving ? this.cloudView : this.stormView;
    for (let i = 0; i < amount * 6; i++) {
      const start = source.randomPoint(new Vector3());
      this.motes.send(
        start,
        WEATHER.dissolveSeconds * (0.5 + Math.random() * 0.5),
        i < amount ? () => this.light.add(1) : null,
      );
    }
  }

  // ---------- per frame ----------

  update(dt: number): void {
    const p = this.game.world.playerPosition;
    const walking = this.game.speed > 0.25;
    this.clock += dt;

    let inHeld = this.game.input.breathInHeld;
    let outHeld = this.game.input.breathOutHeld;
    if (this.game.flags.autobreathe && this.phase === 'playing') {
      const auto = this.autoBreathe(dt);
      inHeld = auto.inHeld;
      outHeld = auto.outHeld;
    }

    if (this.phase === 'playing' && !this.panels.isOpen) {
      this.game.worldInputBlocked = false;
      if (this.game.input.pushPressed) this.onPush();
      if (this.game.input.interactPressed) this.onInteract();
      this.breath.update(dt, inHeld, outHeld, this.game.speed);
      this.updateCalm(dt, walking, p.x, p.z);
      this.checks.update(dt);
      this.runScene(dt, p.x, p.z);
    }

    if (this.phase === 'dream') this.updateDream(dt);

    // Visuals that always run, so a paused screen still looks alive.
    this.motes.update(dt, this.game.world.player.chestWorld(this.tmp));
    this.cloudView.update(dt);
    this.stormView.update(dt);
    this.toneRings.update(dt, SOUND_BREATH.ringSeconds);
    this.springGlow.update(dt);
    this.wellGlow.update(dt);
    this.sproutA.update(dt);
    this.sproutB.update(dt);
    this.treeA.update(dt);
    this.treeB.update(dt);

    this.updateHud(dt, p.x, p.z);
    this.updateSky();
    this.updateAudio(dt);
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
      fogStep: this.storm.step,
      seed: this.seedText(),
      checks: this.checks.data,
      extra: `${this.cloud.type} ${this.cloud.intensity.toFixed(2)} tones=${String(this.sound.count)}`,
    });

    this.game.calm = this.calm.get();
    this.game.light = this.light.get();
  }

  /**
   * The calm value, with the storm's leftover wind.
   *
   * Seed spot A sits where the storm stood. The wind there takes calm twice as
   * fast, so the same player planting in the same minute gets a mind seed at
   * one spot and a heart seed at the other. Nothing says so; the difference is
   * there to be felt.
   */
  private updateCalm(dt: number, walking: boolean, px: number, pz: number): void {
    const windy = dist2d(px, pz, this.seedA.x, this.seedA.z) <= SEEDS2.awayRadius * 0.6;
    const factor = windy ? SEEDS2.windyCalmDecayFactor : 1;
    for (let i = 0; i < factor; i++) this.calm.update(dt, walking);
    if (this.game.flags.calm !== null) this.calm.set(this.game.flags.calm);
  }

  /**
   * Every mechanic, every frame, wherever the player is standing. The scene
   * number only records how far they have come.
   */
  private runScene(dt: number, px: number, pz: number): void {
    const walkSpeed = 4.2;

    // Scene 1: the bird lands on the spring only after a long time.
    const spring = this.receive.get('spring');
    this.hints.updateScene3(dt, spring?.empty ?? false);

    this.body.update(dt);

    // Scene 3: the cloud. It follows once the player has come near it.
    if (!this.cloud.dissolving) {
      const met = this.cloud.distanceTo(px, pz) <= RAIN.spawnAhead;
      this.cloud.followsPlayer = this.cloud.followsPlayer || met;
      this.cloud.update(dt, px, pz, this.game.speed, walkSpeed);
      this.checks.set('ranFromCloudCount', this.cloud.fleeCount);
      if (this.phase === 'playing' && this.rainStep === 0 && this.cloud.canName(this.breathsCalm)) {
        this.openNaming(this.cloud);
      }
    } else if (this.rainbowTime < RAIN.rainbowSeconds) {
      this.rainbowTime += dt;
    }

    // Scene 4: the storm.
    this.storm.update(dt, px, pz);
    if (
      this.phase === 'playing' &&
      this.storm.step === 2 &&
      this.storm.weather.canName(this.breathsCalm)
    ) {
      this.openNaming(this.storm.weather);
    }
    this.storm.weather.update(dt, px, pz, this.game.speed, walkSpeed);

    // The singing stone hums when the player is near it.
    const stoneDist = dist2d(px, pz, LAYOUT2.singingStone.x, LAYOUT2.singingStone.z);
    if (stoneDist <= SINGING_STONE.radius) {
      this.stoneNear += dt;
      if (this.stoneNear > 4) {
        this.stoneNear = 0;
        this.bus.emit('cue', { id: 'stoneHum' });
      }
    } else {
      this.stoneNear = 0;
    }

    // Scene 5: the two seeds.
    this.seedA.update(dt, px, pz);
    this.seedB.update(dt, px, pz);

    // Scene 6: night falls once a heart tree stands.
    const heartTree = this.heartTree();
    if (heartTree && this.night < 1) {
      this.setNight(clamp01(this.night + dt / NIGHT.fallSeconds));
    }
    if (heartTree) {
      // The thanks is given under whichever heart tree the player grew.
      this.thanks.spot.x = heartTree.x;
      this.thanks.spot.z = heartTree.z;
      this.thanks.arm();
    }
    this.thanks.update(dt);

    this.updateProgress();

    if (this.thanks.complete && this.game.world.color.globalColor >= 0.999) {
      this.finishChapter();
    }
  }

  /** The heart tree the chapter ends under, or null while none stands. */
  private heartTree(): SeedSpot | null {
    if (this.seedB.heartTreeStanding) return this.seedB;
    if (this.seedA.heartTreeStanding) return this.seedA;
    return null;
  }

  private updateProgress(): void {
    let reached: Scene2Id = 1;
    if (this.receive.get('spring')?.empty) reached = 2;
    if (this.body.allLit) reached = 3;
    if (this.rainStep >= 3) reached = 4;
    if (this.storm.done) reached = 5;
    if (this.heartTree()) reached = 6;
    if (reached > this.scene) this.advanceTo(reached);
  }

  /** The short dream at the end: a village, and a bird crossing twice. */
  private updateDream(dt: number): void {
    this.dreamTime += dt;
    this.lyingDown = clamp01(this.lyingDown + dt / NIGHT.lieDownSeconds);
    this.game.world.player.setLyingDown(this.lyingDown);
    if (this.dreamTime >= NIGHT.dreamSeconds) {
      this.dream.stop();
      this.game.setDarken(0, dt);
      this.startLearningCycle();
    }
  }

  private setNight(value: number): void {
    const was = this.night;
    this.night = clamp01(value);
    this.game.world.setNight(this.night);
    if (was < 0.5 && this.night >= 0.5) {
      this.bus.emit('cue', { id: 'night' });
      this.bus.emit('nightFell');
    }
  }

  /** The slow day. It runs from morning to evening over one play of the chapter. */
  private updateSky(): void {
    if (this.night > 0) return;
    this.game.world.setDay(clamp01(this.clock / WORLD2.daySeconds));
  }

  private autoBreathe(dt: number): { inHeld: boolean; outHeld: boolean } {
    const preset = this.breath.getPreset();
    const cycle = preset.inhale + preset.exhale;
    this.autoClock = (this.autoClock + dt) % cycle;
    const inHeld = this.autoClock < preset.inhale;
    return { inHeld, outHeld: !inHeld };
  }

  private seedText(): string {
    const a = this.seedA.state === 'none' ? '' : `A:${this.seedA.kind}/${this.seedA.state} `;
    const b = this.seedB.state === 'none' ? '' : `B:${this.seedB.kind}/${this.seedB.state}`;
    return `${a}${b}` || 'none';
  }

  private updateHud(dt: number, px: number, pz: number): void {
    // The storm's thought, shown while the player stays close to it.
    this.hud.setFogText(
      t().storm.thought,
      this.storm.step >= 1 && !this.storm.done ? this.storm.seeProgress : 0,
    );

    // The wind bends the grass around whichever weather is nearest.
    const stormDist = this.storm.distanceTo(px, pz);
    const cloudDist = this.cloud.distanceTo(px, pz);
    const nearStorm = !this.storm.done && stormDist < cloudDist;
    const source = nearStorm ? this.storm : this.cloud;
    this.game.wind.x = source.x;
    this.game.wind.z = source.z;
    this.game.wind.radius = (nearStorm ? this.storm.radius : this.cloud.size) * 2.4;
    const feeling = nearStorm ? this.storm.step >= 2 && !this.storm.done : !this.cloud.dissolving;
    this.game.wind.strength = feeling
      ? (nearStorm ? 0.55 : 0.3) + Math.sin(this.game.time * 1.3) * 0.2
      : 0;

    // Step 3 of the storm: the middle is quiet and darker.
    const inCenter = !this.storm.done && stormDist <= STORM.centerRadius && this.storm.open;
    this.game.setDarken(inCenter ? 0.7 : 0, dt);

    this.hud.breathCircle.setTremble(
      !this.storm.done && this.storm.step >= 3
        ? clamp01(1 - stormDist / STORM.feelRadius)
        : !this.cloud.dissolving && this.rainStep >= 1
          ? clamp01(1 - cloudDist / RAIN.feelRadius) * 0.6
          : 0,
    );

    // The two weathers, drawn.
    this.updateWeatherViews();

    this.hud.setPushVisible(this.storm.pushAvailable && !this.storm.done);
    const spot = this.nearSeedSpot();
    this.hud.setInteractVisible(spot !== null && spot.state === 'none');

    // The spring and the well glow softly, brighter when they still have light.
    const spring = this.receive.get('spring');
    if (spring) {
      const d = spring.distanceTo(px, pz);
      const fade = clamp01(1 - (d - SPRING2.drawRadius) / 26);
      this.springGlow.setStrength(
        (spring.empty ? 0.5 : d <= SPRING2.drawRadius ? 1.1 : 0.55) * (0.35 + 0.65 * fade),
        spring.empty ? 2.2 : 1.9,
      );
    }
    const wellOn = this.well.wouldGive(px, pz, this.light.get());
    this.wellGlow.setStrength(wellOn ? 1.1 : 0.4, wellOn ? 2.3 : 1.8);

    // Only the stone the player is being led to glows, and it breathes a
    // little. It is the whole of the guidance in that scene.
    const next = this.body.next?.point ?? null;
    if (next !== this.litStone) {
      // The lit stone only changes four times in the chapter, so the halos are
      // switched when it does rather than looked up every frame.
      for (const [point, anchor] of this.stoneAnchors) {
        if (point !== next) setStoneGlow(anchor, 0);
      }
      this.litStone = next;
    }
    const anchor = next ? this.stoneAnchors.get(next) : undefined;
    if (anchor) {
      setStoneGlow(
        anchor,
        this.settings.reducedMotion ? 0.75 : 0.62 + Math.sin(this.game.time * 0.9) * 0.16,
      );
    }

    // The two seeds, and the rainbow over the meadow where the rain let go.
    this.sproutA.setState(this.seedA.state === 'growing', this.seedA.progress, this.seedA.paused);
    this.sproutB.setState(this.seedB.state === 'growing', this.seedB.progress, this.seedB.paused);
    // A grown seed is a tree standing in the meadow. A mind tree fades out
    // over its last ten seconds, so the player watches it go.
    for (const [seed, tree] of [
      [this.seedA, this.treeA],
      [this.seedB, this.treeB],
    ] as const) {
      const standing = seed.state === 'grown';
      const left = SEEDS2.mindSeedFadeSeconds - seed.fadeTime;
      const fade = seed.kind === 'mind' ? clamp01(left / 10) : 1;
      tree.setState(standing, seed.kind, fade);
      if (seed.heartTreeStanding) tree.setGold(this.thanks.golden);
    }
    this.rainbow.setAmount(
      this.rainStep >= 3 ? clamp01(this.rainbowTime / 1.5) * clamp01(3 - this.rainbowTime / 3) : 0,
    );

    this.hud.breathCircle.update(
      this.breath.targetRing,
      this.breath.playerRing,
      this.breath.playerPhase() === 'inhale',
      this.game.time,
    );
    this.hud.breathCircle.setVisible(this.phase === 'playing');
    this.hud.showHint(this.currentHint());
  }

  private updateWeatherViews(): void {
    const cloudY = groundHeight(this.cloud.x, this.cloud.z) + WEATHER.height;
    this.cloudView.group.position.set(this.cloud.x, cloudY, this.cloud.z);
    this.cloudView.setSize(this.cloud.size / RAIN.cloudSize);
    this.cloudView.setIntensity(
      this.cloud.dissolving
        ? Math.max(0, 1 - this.cloud.dissolveTime / WEATHER.dissolveSeconds) * this.cloud.intensity
        : this.cloud.intensity,
    );
    this.rainbow.group.position.set(this.cloud.x, cloudY - 2, this.cloud.z - 6);

    this.stormView.setSize(this.storm.radius / LAYOUT2.storm.radius);
    this.stormView.setIntensity(
      this.storm.done
        ? Math.max(0, 1 - this.storm.dissolveTime / STORM.dissolveSeconds)
        : this.storm.weather.intensity,
    );
  }

  /** Short control hints only. They never explain what anything means. */
  private currentHint(): string | null {
    if (this.phase !== 'playing') return null;
    const spot = this.nearSeedSpot();
    if (spot && spot.state === 'none') return t().seed.plant;
    return null;
  }

  private updateAudio(dt: number): void {
    const p = this.game.world.playerPosition;
    const stormDist = this.storm.distanceTo(p.x, p.z);
    const cloudDist = this.cloud.distanceTo(p.x, p.z);
    const nearStorm = !this.storm.done && stormDist <= this.storm.radius * 2;
    const nearCloud = !this.cloud.dissolving && cloudDist <= this.cloud.size * 2;
    const drone = nearStorm ? clamp01(1 - stormDist / (this.storm.radius * 2)) : 0;
    const muffle = nearStorm && stormDist <= this.storm.radius ? 0.6 : 0;
    this.audio.update(
      this.breath.playerRing,
      this.breath.playerPhase() === 'inhale',
      this.game.world.color.globalColor,
      drone + (nearCloud ? 0.15 : 0),
      muffle,
    );

    // The weather you are standing in is the one you hear. The storm wins when
    // both are in reach, because it is the louder thing in the world.
    const stormAmount = nearStorm
      ? clamp01(1 - stormDist / (this.storm.radius * 2)) * this.storm.weather.intensity
      : 0;
    const rainAmount = nearCloud
      ? clamp01(1 - cloudDist / (this.cloud.size * 2)) * this.cloud.intensity
      : 0;
    if (stormAmount > rainAmount) this.audio.setWeather('storm', stormAmount);
    else if (rainAmount > 0.01) this.audio.setWeather('rain', rainAmount);
    else this.audio.setWeather('none', 0);

    // Thunder: a rumble now and then while the storm still stands, and only
    // while the player is close enough for it to be about them.
    if (stormAmount > THUNDER.nearAmount) {
      this.thunderClock -= dt;
      if (this.thunderClock <= 0) {
        this.thunderClock = THUNDER.minSeconds + Math.random() * THUNDER.spreadSeconds;
        this.bus.emit('cue', { id: 'thunder' });
      }
    } else {
      this.thunderClock = THUNDER.minSeconds;
    }

    this.audio.setNightAmbience(this.night);
  }

  // ---------- tests ----------

  /** What the browser tests read. Only attached behind a debug flag. */
  testApi(): Record<string, (...args: never[]) => unknown> {
    const api = {
      snapshot: () => ({
        chapter: 2,
        scene: this.scene,
        phase: this.phase,
        calm: this.calm.get(),
        light: this.light.get(),
        fps: this.game.fps.value,
        px: this.game.world.playerPosition.x,
        pz: this.game.world.playerPosition.z,
        speed: this.game.speed,
        breathsTotal: this.breathsTotal,
        breathsCalm: this.breathsCalm,
        hasBreathed: this.hasBreathed,
        springLeft: this.receive.get('spring')?.remaining ?? 0,
        bodyLit: this.body.litPoints,
        cloudIntensity: this.cloud.intensity,
        cloudNamed: this.cloud.named,
        rainStep: this.rainStep,
        soundUnlocked: this.sound.unlocked,
        soundCount: this.sound.count,
        stormStep: this.storm.step,
        stormDone: this.storm.done,
        seedA: `${this.seedA.kind}/${this.seedA.state}`,
        seedB: `${this.seedB.kind}/${this.seedB.state}`,
        night: this.night,
        globalColor: this.game.world.color.globalColor,
        thanks: this.thanks.breaths,
        naming: this.naming !== null,
      }),
      walkTo: (x: number, z: number) => {
        this.game.autoWalk = { x, z };
      },
      walking: () => this.game.autoWalk !== null,
      answer: (choice: FeelingType) => this.answerNaming(choice),
      finish: () => this.finishChapter(),
    };
    return api as unknown as Record<string, (...args: never[]) => unknown>;
  }
}
