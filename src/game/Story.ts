import type { Engine } from '@babylonjs/core/Engines/engine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { SHADES, color3 } from '../config/palette';
import { TUNING } from '../config/tuning';
import type { DialogueSystem } from '../companion/DialogueSystem';
import type { InnerValley } from '../inner/InnerValley';
import type { Town } from '../outer/Town';
import { TOWN } from '../outer/townLayout';
import { EndCard } from '../ui/EndCard';
import { Beacon } from './Beacon';
import { NextStepHint } from '../ui/NextStepHint';
import { SpeechBubble } from '../ui/SpeechBubble';
import type { Anger } from './Anger';
import type { Lantern } from './Lantern';
import { SoundCues } from './SoundCues';
import { StoryState } from './StoryState';
import type { WorldId } from './World';

export interface StoryDeps {
  engine: Engine;
  ui: HTMLElement;
  outer: Town;
  inner: InnerValley;
  anger: Anger;
  dialogue: DialogueSystem;
  outerLantern: Lantern;
  innerLantern: Lantern;
  touch: boolean;
}

const dist2 = (ax: number, az: number, bx: number, bz: number): number => Math.hypot(ax - bx, az - bz);

/**
 * The director (GAME_DESIGN.md sections 7-9): listens to events, drives both worlds.
 * Beats 4-7 can happen in any order. All text comes from dialogue keys.
 */
export class Story {
  readonly state = new StoryState();
  readonly endCard: EndCard;
  private readonly bubble: SpeechBubble;
  private readonly d: StoryDeps;
  private shownId: WorldId = 'outer';
  private lookWithinOpen = false;
  private innerVisited = false;
  private begun = false;
  private breathed = false;
  private angryInnerVisited = false;
  private angryT = 0;
  private readonly beacon: Beacon;
  private readonly innerBeacon: Beacon;
  private readonly nextStep: NextStepHint;
  private hintT = 0;
  /** Idle reminder: current step signature and seconds spent in it. */
  private stepSig = '';
  private stepIdleT = 0;
  private reminderKey = '';
  /** Seconds since the bump hit (Infinity = no ramp running). */
  private sinceBump = Infinity;
  private movedSinceBegin = false;

  // Imp
  private impBreaths = 0;
  private flareBack = 0;
  private calmingIdle = 0;

  // Transform
  private fading = false;
  private fadeFrom = 0;
  private fadeT = 0;
  private rootT = -1;
  private flame: Mesh | null = null;
  private flameT = -1;
  private flameFrom = new Vector3();
  private branchT = -1;
  private endCardT = -1;
  private lastLineKey = '';
  private readonly sound: SoundCues;

  constructor(deps: StoryDeps) {
    this.d = deps;
    this.sound = new SoundCues(deps.anger);
    this.endCard = new EndCard(deps.ui);
    this.bubble = new SpeechBubble(deps.ui, deps.engine);
    this.beacon = new Beacon(deps.outer.scene, TOWN.beacon.x, TOWN.beacon.z, deps.outer.groundY(TOWN.beacon.x, TOWN.beacon.z));
    this.innerBeacon = new Beacon(deps.inner.scene, 0, 0, 0);
    this.innerBeacon.hide();
    this.nextStep = new NextStepHint(deps.ui);
    // Before the bump both trees are healthy and the root is not burned (reveal rule).
    deps.outer.setOldTreeBranchHealth(1);
    deps.inner.setBranchHealth(1);
    this.lookWithinOpen = this.state.beat >= 1;
    this.innerVisited = this.state.beat >= 2;
    this.breathed = this.state.beat >= 1;
    this.angryInnerVisited = this.state.flags.sawImp || this.state.flags.helped;
    if (this.state.restored) this.restore();
    deps.outer.onBreathDone(() => this.onBreath('outer'));
    deps.inner.onBreathDone(() => this.onBreath('inner'));
    deps.anger.on((e) => this.onAnger(e));
  }

  get beat(): number {
    return this.state.beat;
  }

  /** 0..1 factor on the anger the town and the imp show: 0 right after the bump, 1 after the ramp. */
  get townGate(): number {
    const A = TUNING.anger;
    const k = Math.min(1, Math.max(0, (this.sinceBump - A.townDelayS) / A.townRampS));
    return k * k * (3 - 2 * k);
  }

  /** Q (Look Within) is locked until the beat-2 invitation. */
  canLookWithin(): boolean {
    return this.lookWithinOpen;
  }

  /** True until the first full breath is done (the breath guide stays on). */
  needsBreathHelp(): boolean {
    return this.begun && !this.breathed && !this.lookWithinOpen;
  }

  /** Call once the dialogue table is loaded. Starts beat 0. */
  begin(): void {
    if (this.begun) return;
    this.begun = true;
    if (this.state.restored) return;
    this.say('taskLantern');
    this.hint('hintMove');
    this.hint('hintBreathe');
  }

  lastLine(): string {
    return this.lastLineKey ? this.d.dialogue.line(this.lastLineKey) : '';
  }

  /** The world that is shown changed (middle of the Look Within transition). */
  onWorldShown(id: WorldId): void {
    this.shownId = id;
    this.cancelOpeningHints();
    if (id === 'inner') {
      if (!this.innerVisited) {
        this.innerVisited = true;
        if (!this.state.flags.bumped) this.say('innerFirst', true);
      }
      if (this.state.flags.helped && !this.state.flags.impCalm && !this.d.dialogue.hasSaid('impReturn')) this.say('impReturn', true);
      if (this.state.flags.bumped) {
        this.angryInnerVisited = true;
        // The imp is revealed the moment the player looks within after the bump.
        if (!this.state.flags.sawImp) {
          this.state.set('sawImp');
          this.state.reach(6);
          this.say('impFirst', true);
        }
      }
    } else {
      if (this.state.flags.lanternRelit && !this.state.flags.delivered && !this.d.dialogue.hasSaid('treeReturn')) this.say('treeReturn', true);
      if (this.innerVisited && this.state.beat < 2) this.state.reach(2);
      if (this.state.flags.bumped && this.angryInnerVisited && !this.d.dialogue.hasSaid('outerAngry')) this.say('outerAngry', true);
    }
  }

  // --- Hooks for the test scenarios ---

  bumpTrigger(): { x: number; z: number } {
    return { x: 0, z: TOWN.squareCentre.z };
  }

  alleyApplePositions(): { x: number; z: number }[] {
    return TOWN.alleyStory.apples.map((a) => ({ x: a[0], z: a[1] }));
  }

  /** A standing spot next to the niche (the niche itself is inside the trunk collider). */
  oldTreeNiche(): { x: number; z: number } {
    const n = this.d.outer.treeNiche();
    return { x: n.x, z: n.z - 1.6 };
  }

  /** The current E action, using the same range and priority rules as interact(). */
  interactionContext(): 'push' | 'collectApple' | 'interact' {
    if (this.shownId !== 'outer') return 'push';
    const f = this.state.flags;
    const p = this.d.outer.playerPosition();
    if (f.bumped && (f.sawImp || f.helped) && !f.helped && this.d.outer.alley.nearestPickable(p) !== null) return 'collectApple';
    if (f.bumped && !f.delivered) {
      const n = this.d.outer.treeNiche();
      if (dist2(p.x, p.z, n.x, n.z) < TUNING.story.nicheRadius) return 'interact';
    }
    return 'push';
  }

  impPos(): { x: number; z: number } {
    const p = this.d.inner.imp.root.position;
    return { x: p.x, z: p.z };
  }

  impBreathProgress(): { visible: boolean; count: number; near: boolean; complete: boolean } {
    const f = this.state.flags;
    const p = this.d.inner.playerPosition();
    const i = this.d.inner.imp.root.position;
    const near = dist2(p.x, p.z, i.x, i.z) <= TUNING.story.impBreathRadius;
    const complete = f.impCalm;
    return {
      visible: this.shownId === 'inner' && f.helped && !f.lanternRelit && (near || complete),
      count: f.impCalm ? TUNING.imp.breathsToCalm : Math.min(this.impBreaths, TUNING.imp.breathsToCalm),
      near,
      complete,
    };
  }

  // --- Per frame ---

  update(dt: number, shown: WorldId, busy: boolean): void {
    this.shownId = shown;
    const d = this.d;
    const f = this.state.flags;

    const outerPosition = d.outer.playerPosition();
    if (shown === 'outer' && this.begun && !this.movedSinceBegin && d.outer.hasMovementInput()) {
      this.movedSinceBegin = true;
      d.dialogue.cancel('hintMove');
      d.dialogue.cancel('hintMoveTouch');
    }
    const breathing = shown === 'outer' && d.outer.breathState() !== 'idle';
    if (breathing) {
      d.dialogue.cancel('hintBreathe');
      d.dialogue.cancel('hintBreatheTouch');
    }

    // Invite as soon as the player reaches the visible beacon, whether or not they breathed first.
    if (shown === 'outer' && !busy && !this.lookWithinOpen && dist2(outerPosition.x, outerPosition.z, TOWN.squareCentre.x, TOWN.squareCentre.z) <= TUNING.story.squareArrivalRadius) {
      this.lookWithinOpen = true;
      this.state.reach(1);
      this.cancelOpeningHints();
      this.say(this.d.touch ? 'hintLookWithinTouch' : 'hintLookWithin', true);
      this.hintT = 0;
    }

    // Gentle repeat of the current hint until the step is done.
    const needBreath = this.needsBreathHelp();
    const needLook = this.lookWithinOpen && !this.innerVisited && !f.bumped && this.state.beat <= 1;
    const nearAlley = dist2(outerPosition.x, outerPosition.z, TOWN.alleyStory.basket.x, TOWN.alleyStory.basket.z) < TUNING.story.guidanceNearRadius;
    // Not while the player is already busy with the alley (that is the current step).
    const needAngry = f.bumped && !this.angryInnerVisited && !f.helped && !nearAlley;
    if (shown === 'outer' && !busy && needAngry) {
      this.angryT += dt;
      if (this.angryT >= TUNING.story.hintRepeatS * 0.5 && !d.dialogue.busy) {
        this.angryT = 0;
        this.say('angryLookWithin');
      }
    } else this.angryT = 0;
    if (shown === 'outer' && !busy && !breathing && (needBreath || needLook)) {
      this.hintT += dt;
      if (this.hintT >= TUNING.story.hintRepeatS && !d.dialogue.busy) {
        this.hintT = 0;
        this.hint(needBreath ? 'hintBreathe' : 'hintLookWithin');
      }
    } else this.hintT = 0;

    // Beat 3: the bump, once the player crosses the line on Main Street.
    if (shown === 'outer' && !busy && this.lookWithinOpen && this.innerVisited && this.state.beat >= 2 && !f.bumped && d.outer.bump.bumpTriggerReached(d.outer.playerPosition())) {
      this.startBump();
    }
    // Beat 6: meeting the imp.
    if (shown === 'inner' && !busy && f.bumped && !f.sawImp) {
      const p = d.inner.playerPosition();
      const i = d.inner.imp.root.position;
      if (dist2(p.x, p.z, i.x, i.z) < TUNING.story.impSeeRadius) {
        this.state.set('sawImp');
        this.state.reach(6);
        this.say('impFirst', true);
      }
    }
    // Arriving at the alley.
    if (shown === 'outer' && !busy && f.bumped && !f.helped && d.outer.bump.triggered && !d.outer.bump.running) {
      const p = d.outer.playerPosition();
      if (dist2(p.x, p.z, TOWN.waveSource.x, TOWN.waveSource.z) < 12 && !d.dialogue.hasSaid('alleyArrive')) this.say('alleyArrive');
    }

    if (this.sinceBump < Infinity) this.sinceBump += dt;
    this.updateImp(dt);
    this.updateTransform(dt);
    this.updateGuidance(dt, busy);

    d.outerLantern.update(dt);
    d.innerLantern.update(dt);
    d.dialogue.update(dt);
    const w = shown === 'outer' ? d.outer : null;
    this.bubble.update(dt, w ? w.scene : null, w ? w.camera : null);
  }

  // --- Player actions ---

  private updateGuidance(dt: number, busy: boolean): void {
    const d = this.d;
    const f = this.state.flags;
    const inner = this.shownId === 'inner';
    const world = inner ? d.inner : d.outer;
    let key = '';
    let label = '';
    let target: Vector3 | null = null;
    if (f.delivered) key = inner ? 'stepExploreInner' : 'stepExplore';
    else if (inner) {
      if (!f.bumped) key = 'stepReturn';
      else if (f.lanternRelit) key = 'stepReturnTree';
      else if (f.impCalm) key = 'stepFlame';
      else if (!f.helped) key = 'stepReturnAlley';
      else {
        const p = d.inner.playerPosition();
        const i = d.inner.imp.root.position;
        key = !f.impCalm && dist2(p.x, p.z, i.x, i.z) > TUNING.story.impBreathRadius ? 'stepImpApproach' : 'stepImp';
        target = d.inner.imp.root.position.clone();
        label = 'targetImp';
      }
    } else if (f.lanternRelit) {
      key = 'stepTree';
      target = d.outer.treeNiche().clone();
      label = 'targetTree';
    } else if (f.helped) key = 'stepInside';
    else if (f.bumped) {
      // First inner visit comes first: look within and meet the imp, then go to the alley.
      key = f.sawImp ? 'stepAlley' : 'stepAngry';
      if (f.sawImp) {
        const p = d.outer.playerPosition();
        const a = TOWN.alleyStory.basket;
        if (dist2(p.x, p.z, a.x, a.z) < TUNING.story.guidanceNearRadius) key = 'stepApples';
        target = new Vector3(a.x, d.outer.groundY(a.x, a.z), a.z);
        label = 'targetAlley';
      }
    } else if (!this.lookWithinOpen) {
      key = 'stepSquare';
      target = new Vector3(TOWN.beacon.x, d.outer.groundY(TOWN.beacon.x, TOWN.beacon.z), TOWN.beacon.z);
      label = 'targetSquare';
    } else if (this.innerVisited) {
      key = 'stepSquareReturn';
      target = new Vector3(TOWN.squareCentre.x, d.outer.groundY(TOWN.squareCentre.x, TOWN.squareCentre.z), TOWN.squareCentre.z);
      label = 'targetSquare';
    } else key = 'stepFirstInside';

    // Presentation only: a gentle glow on the Look Within control while the objective is "press Q".
    const lookSteps = ['stepFirstInside', 'stepAngry', 'stepReturn', 'stepInside', 'stepReturnTree', 'stepReturnAlley'];
    document.body.classList.toggle('look-pulse', !busy && lookSteps.includes(key));

    this.beacon.hide();
    this.innerBeacon.hide();
    if (target && !busy) {
      const beacon = inner ? this.innerBeacon : this.beacon;
      beacon.setLit(true);
      beacon.showAt(target.x, target.z, target.y);
      target.y += TUNING.story.guidanceMarkerHeight;
    }
    this.beacon.update(dt);
    this.innerBeacon.update(dt);
    const touchKey = d.touch && d.dialogue.data(`${key}Touch`) ? `${key}Touch` : key;
    let uiKey = key;
    let line = d.dialogue.line(touchKey);
    let sig = key;
    let badge = '';
    if (key === 'stepApples') {
      const total = TOWN.alleyStory.apples.length;
      const left = d.outer.alley.applesLeft();
      badge = d.dialogue.line('applesProgress').replace('{count}', String(total - left)).replace('{total}', String(total));
      uiKey = `${key}${left}`;
      sig = uiKey;
    } else if (key === 'stepImp') sig = `${key}${this.impBreaths}`;
    this.updateReminder(dt, sig, key, busy);
    this.nextStep.update(uiKey, line, label ? d.dialogue.line(label) : '', d.dialogue.line('targetTurn'), busy ? null : target, world.scene, world.camera, badge);
  }

  /** Calm reminder when the player stays in one step for a while. Stale reminders are dropped on step change. */
  private updateReminder(dt: number, sig: string, key: string, busy: boolean): void {
    const dlg = this.d.dialogue;
    if (sig !== this.stepSig) {
      this.stepSig = sig;
      this.stepIdleT = 0;
      if (this.reminderKey) dlg.cancel(this.reminderKey);
      this.reminderKey = '';
      return;
    }
    if (busy || dlg.busy || this.state.flags.delivered) return;
    this.stepIdleT += dt;
    if (this.stepIdleT < TUNING.story.idleReminderS) return;
    this.stepIdleT = 0;
    const rk = `remind${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    if (dlg.data(rk) === undefined) return;
    this.reminderKey = rk;
    this.say(rk);
  }

  /** E / tap. Returns true if an object took the press (then it is not a push). */
  interact(): boolean {
    if (this.shownId !== 'outer') return false;
    const d = this.d;
    const f = this.state.flags;
    const p = d.outer.playerPosition();
    const context = this.interactionContext();
    if (context === 'collectApple') {
      const i = d.outer.alley.nearestPickable(p);
      if (i !== null) {
        d.outer.alley.pickApple(i);
        if (d.outer.alley.applesLeft() === 0) this.onHelped();
        return true;
      }
    }
    if (context === 'interact' && !f.delivered && f.bumped) {
      const n = d.outer.treeNiche();
      if (dist2(p.x, p.z, n.x, n.z) < TUNING.story.nicheRadius) {
        if (f.lanternRelit && d.outerLantern.light >= TUNING.story.treeNeedsLight) this.deliver();
        else {
          // Soft fail: nothing is lost.
          this.state.reach(5);
          this.say('treeTooWeak', true);
        }
        return true;
      }
    }
    return false;
  }

  // --- Events ---

  private onBreath(id: WorldId): void {
    const f = this.state.flags;
    if (id === 'outer' && !this.breathed) {
      this.breathed = true;
      this.d.dialogue.cancel('hintBreathe');
      this.d.dialogue.cancel('hintBreatheTouch');
      this.d.dialogue.cancel('hintMove');
      this.d.dialogue.cancel('hintMoveTouch');
      if (!this.lookWithinOpen) this.say('firstBreath', true);
      return;
    }
    if (id !== 'inner' || !f.bumped || f.impCalm) return;
    const p = this.d.inner.playerPosition();
    const i = this.d.inner.imp.root.position;
    if (dist2(p.x, p.z, i.x, i.z) > TUNING.story.impBreathRadius) return;
    if (!f.helped) {
      // Calms for a moment, then flares up again.
      this.d.inner.setImpState('calming');
      this.flareBack = TUNING.story.impFlareBackS;
      if (!this.d.dialogue.busy) this.say('impNotYet');
      return;
    }
    this.impBreaths++;
    this.calmingIdle = TUNING.story.impCalmingIdleS;
    if (this.impBreaths >= TUNING.imp.breathsToCalm) this.transform();
    else this.d.inner.setImpState('calming');
  }

  private onAnger(e: 'passed' | 'pushed' | 'hit'): void {
    if (!this.state.flags.bumped) return;
    const dlg = this.d.dialogue;
    if (e === 'pushed' && !dlg.hasSaid('wavePushed')) {
      this.say('wavePushed', true);
      this.say('waveBreathe');
    } else if (e === 'hit' && !dlg.hasSaid('waveBreathe')) {
      this.say('waveBreathe', true);
    } else if (e === 'passed') {
      this.state.reach(4);
      this.say('wavePassed', true);
    }
  }

  private startBump(): void {
    this.d.outer.startBump(
      () => this.applyBump(),
      () => this.d.outer.alley.showAfterBump(),
    );
  }

  /** The bump hit: anger starts, the lantern falls to an ember, the inner world shows its wound. */
  private applyBump(): void {
    const d = this.d;
    this.state.set('bumped');
    this.state.reach(3);
    this.sinceBump = 0;
    d.anger.set(TUNING.anger.onBump);
    d.outerLantern.setLight(0.15);
    d.innerLantern.setLight(0.15);
    // Mirror (outer -> inner): imp, burned root, dry branch appear in both worlds.
    d.inner.reveal();
    d.outer.setOldTreeBranchHealth(0);
    d.inner.setBranchHealth(0);
    this.sound.impGrowl();
    this.say('bumpAfter', true);
    this.say('angryLookWithin');
    this.angryT = 0;
  }

  /** All 5 apples are back: the outer step is done. */
  private onHelped(): void {
    const d = this.d;
    this.state.set('helped');
    this.state.reach(7);
    d.outer.alley.standUpAndWave();
    this.bubble.show(d.dialogue.line('strangerSorry'), () => d.outer.alley.strangerSpeechAnchor(), TUNING.story.bubbleS);
    this.say('insight');
    this.say('helpedNext');
    d.anger.floor = 0;
    d.anger.set(d.anger.value + TUNING.anger.afterHelp);
  }

  /** The imp is calm: root heals, flame flies to the lantern, anger fades for good. */
  private transform(): void {
    const d = this.d;
    if (this.state.flags.impCalm) return;
    this.state.set('impCalm');
    d.inner.setImpState('calm');
    this.sound.calmChime();
    this.say('impCalm', true);
    this.fading = true;
    this.fadeFrom = d.anger.value;
    this.fadeT = 0;
    d.anger.done = true;
    d.anger.floor = 0;
    this.rootT = 0;
    this.startFlame();
  }

  private deliver(instant = false): void {
    const d = this.d;
    this.state.set('delivered');
    this.state.reach(9);
    d.outerLantern.hangAt(d.outer.treeLanternAnchor(), instant);
    d.innerLantern.setVisible(false);
    if (instant) {
      d.outer.setOldTreeBranchHealth(1);
      d.inner.setBranchHealth(1);
      this.branchT = -1;
    } else {
      this.branchT = 0;
      this.endCardT = TUNING.story.endCardDelayS;
    }
  }

  // --- Update parts ---

  private updateImp(dt: number): void {
    const inner = this.d.inner;
    if (this.flareBack > 0) {
      this.flareBack -= dt;
      if (this.flareBack <= 0 && !this.state.flags.impCalm) {
        inner.setImpState('raging');
        this.sound.impGrowl();
      }
    }
    if (this.calmingIdle > 0 && !this.state.flags.impCalm) {
      this.calmingIdle -= dt;
      if (this.calmingIdle <= 0) {
        this.impBreaths = 0;
        inner.setImpState('raging');
        this.sound.impGrowl();
      }
    }
  }

  private updateTransform(dt: number): void {
    const d = this.d;
    const S = TUNING.story;
    if (this.fading) {
      this.fadeT += dt;
      const k = Math.min(1, this.fadeT / TUNING.anger.fadeOutTime);
      d.anger.set(this.fadeFrom * (1 - k));
      if (k >= 1) this.fading = false;
    }
    if (this.rootT >= 0) {
      this.rootT = Math.min(1, this.rootT + dt / S.rootHealS);
      d.inner.setRootHealth(this.rootT);
      d.outer.setFountain(this.rootT);
      if (this.rootT >= 1) this.rootT = -1;
    }
    if (this.flameT >= 0 && this.flame) {
      this.flameT = Math.min(1, this.flameT + dt / S.flameFlyS);
      d.innerLantern.root.computeWorldMatrix(true);
      const to = d.innerLantern.root.getAbsolutePosition();
      const t = this.flameT;
      const e = t * t * (3 - 2 * t);
      this.flame.position.copyFrom(Vector3.Lerp(this.flameFrom, to, e));
      this.flame.position.y += Math.sin(Math.PI * e) * 0.8;
      this.flame.scaling.setAll(1 - 0.4 * e);
      if (t >= 1) {
        this.flame.setEnabled(false);
        this.flameT = -1;
        this.relight();
      }
    }
    if (this.branchT >= 0) {
      this.branchT = Math.min(1, this.branchT + dt / S.branchHealS);
      d.outer.setOldTreeBranchHealth(this.branchT);
      d.inner.setBranchHealth(this.branchT);
      if (this.branchT >= 1) this.branchT = -1;
    }
    if (this.endCardT >= 0) {
      this.endCardT -= dt;
      if (this.endCardT < 0) this.showEnd();
    }
  }

  private startFlame(): void {
    const d = this.d;
    const scene = d.inner.scene;
    if (!this.flame) {
      const m = MeshBuilder.CreateSphere('story.flame', { diameter: 0.26, segments: 6 }, scene);
      const mat = new StandardMaterial('story.flameMat', scene);
      mat.disableLighting = true;
      mat.emissiveColor = color3(SHADES.lanternWarm);
      mat.diffuseColor = color3(SHADES.lanternWarm);
      mat.specularColor = color3('#000000');
      m.material = mat;
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
      this.flame = m;
    }
    this.flameFrom.copyFrom(d.inner.imp.flamePosition());
    this.flame.position.copyFrom(this.flameFrom);
    this.flame.scaling.setAll(1);
    this.flame.setEnabled(true);
    this.flameT = 0;
  }

  /** The flame arrived: both lanterns burn warm again. */
  private relight(): void {
    this.d.outerLantern.relightWarm();
    this.d.innerLantern.relightWarm();
    this.state.set('lanternRelit');
    this.state.reach(8);
    this.sound.lanternRelight();
    this.say('lanternRelit');
    this.say(this.shownId === 'inner' ? 'lanternGoOut' : 'lanternTree');
  }

  private showEnd(): void {
    const dlg = this.d.dialogue;
    this.endCard.show(dlg.line('endTitle'), dlg.line('endLine'));
  }

  // --- Dialogue helpers ---

  private say(key: string, interrupt = false): void {
    this.lastLineKey = key;
    void this.d.dialogue.say(key, { interrupt });
  }

  /** A control hint; touch devices get the `<key>Touch` variant. */
  private hint(key: string): void {
    this.say(this.d.touch ? `${key}Touch` : key);
  }

  private cancelOpeningHints(): void {
    for (const key of ['hintMove', 'hintMoveTouch', 'hintBreathe', 'hintBreatheTouch', 'hintLookWithin', 'hintLookWithinTouch']) {
      this.d.dialogue.cancel(key);
    }
  }

  // --- Restore from checkpoint ---

  private restore(): void {
    const d = this.d;
    const f = this.state.flags;
    if (f.bumped) {
      d.inner.reveal();
      d.outer.setOldTreeBranchHealth(0);
      d.inner.setBranchHealth(0);
      d.outerLantern.setLight(0.15, true);
      d.innerLantern.setLight(0.15, true);
      d.anger.set(f.helped ? 0.4 : TUNING.anger.onBump);
      d.outer.alley.showAfterBump();
    }
    if (f.helped) {
      for (let i = 0; i < 5; i++) d.outer.alley.pickApple(i);
      d.outer.alley.standUpAndWave();
      d.anger.floor = 0;
    }
    if (f.impCalm) {
      d.inner.setImpState('calm');
      d.inner.setRootHealth(1);
      d.outer.setFountain(1);
      d.anger.set(0);
      d.anger.done = true;
      d.anger.floor = 0;
    }
    if (f.lanternRelit) {
      for (const l of [d.outerLantern, d.innerLantern]) {
        l.setLight(1, true);
        l.relightWarm();
      }
    }
    if (f.delivered) this.deliver(true);
  }
}
