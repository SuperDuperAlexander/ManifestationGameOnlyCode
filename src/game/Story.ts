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
  private readonly beacon: Beacon;
  private hintT = 0;

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
    // Before the bump both trees are healthy and the root is not burned (reveal rule).
    deps.outer.setOldTreeBranchHealth(1);
    deps.inner.setBranchHealth(1);
    this.lookWithinOpen = this.state.beat >= 1;
    if (this.state.restored) this.restore();
    deps.outer.onBreathDone(() => this.onBreath('outer'));
    deps.inner.onBreathDone(() => this.onBreath('inner'));
    deps.anger.on((e) => this.onAnger(e));
  }

  get beat(): number {
    return this.state.beat;
  }

  /** Q (Look Within) is locked until the beat-2 invitation. */
  canLookWithin(): boolean {
    return this.lookWithinOpen;
  }

  /** True until the first full breath is done (the breath guide stays on). */
  needsBreathHelp(): boolean {
    return this.begun && !this.lookWithinOpen;
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
    if (id === 'inner') {
      if (!this.innerVisited) {
        this.innerVisited = true;
        if (!this.state.flags.bumped) this.say('innerFirst', true);
      }
    } else if (this.innerVisited && this.state.beat === 1) {
      this.state.reach(2);
    }
  }

  // --- Hooks for the test scenarios ---

  bumpTrigger(): { x: number; z: number } {
    return { x: 0, z: TOWN.bump.triggerZ + 1 };
  }

  alleyApplePositions(): { x: number; z: number }[] {
    return TOWN.alleyStory.apples.map((a) => ({ x: a[0], z: a[1] }));
  }

  /** A standing spot next to the niche (the niche itself is inside the trunk collider). */
  oldTreeNiche(): { x: number; z: number } {
    const n = this.d.outer.treeNiche();
    return { x: n.x, z: n.z - 1.6 };
  }

  impPos(): { x: number; z: number } {
    const p = this.d.inner.imp.root.position;
    return { x: p.x, z: p.z };
  }

  // --- Per frame ---

  update(dt: number, shown: WorldId, busy: boolean): void {
    this.shownId = shown;
    const d = this.d;
    const f = this.state.flags;

    // Gold guide light on Main Street: dim before beat 2, warm from beat 2 on, gone after the bump.
    this.beacon.setLit(this.state.beat >= 2);
    if (f.bumped) this.beacon.hide();
    this.beacon.update(dt);

    // Gentle repeat of the current hint until the step is done.
    const needBreath = this.needsBreathHelp();
    const needLook = this.lookWithinOpen && !this.innerVisited && !f.bumped && this.state.beat <= 1;
    if (shown === 'outer' && !busy && (needBreath || needLook)) {
      this.hintT += dt;
      if (this.hintT >= TUNING.story.hintRepeatS && !d.dialogue.busy) {
        this.hintT = 0;
        this.hint(needBreath ? 'hintBreathe' : 'hintLookWithin');
      }
    } else this.hintT = 0;

    // Beat 3: the bump, once the player crosses the line on Main Street.
    if (shown === 'outer' && !busy && this.lookWithinOpen && !f.bumped && d.outer.bump.bumpTriggerReached(d.outer.playerPosition())) {
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

    this.updateImp(dt);
    this.updateTransform(dt);

    d.outerLantern.update(dt);
    d.innerLantern.update(dt);
    d.dialogue.update(dt);
    const w = shown === 'outer' ? d.outer : null;
    this.bubble.update(dt, w ? w.scene : null, w ? w.camera : null);
  }

  // --- Player actions ---

  /** E / tap. Returns true if an object took the press (then it is not a push). */
  interact(): boolean {
    if (this.shownId !== 'outer') return false;
    const d = this.d;
    const f = this.state.flags;
    const p = d.outer.playerPosition();
    if (f.bumped && !f.helped) {
      const i = d.outer.alley.nearestPickable(p);
      if (i !== null) {
        d.outer.alley.pickApple(i);
        if (d.outer.alley.applesLeft() === 0) this.onHelped();
        return true;
      }
    }
    if (!f.delivered && f.bumped) {
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
    if (id === 'outer' && !this.lookWithinOpen) {
      this.lookWithinOpen = true;
      this.state.reach(1);
      this.say('firstBreath', true);
      this.hint('hintLookWithin');
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
    d.anger.set(TUNING.anger.onBump);
    d.outerLantern.setLight(0.15);
    d.innerLantern.setLight(0.15);
    // Mirror (outer -> inner): imp, burned root, dry branch appear in both worlds.
    d.inner.reveal();
    d.outer.setOldTreeBranchHealth(0);
    d.inner.setBranchHealth(0);
    this.sound.impGrowl();
    this.say('bumpAfter', true);
  }

  /** All 5 apples are back: the outer step is done. */
  private onHelped(): void {
    const d = this.d;
    this.state.set('helped');
    this.state.reach(7);
    d.outer.alley.standUpAndWave();
    this.bubble.show(d.dialogue.line('strangerSorry'), () => d.outer.alley.strangerSpeechAnchor(), TUNING.story.bubbleS);
    this.say('insight');
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
    d.outerLantern.detach(d.outer.treeNiche());
    d.outerLantern.root.scaling.setAll(TUNING.player.visualScale);
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
