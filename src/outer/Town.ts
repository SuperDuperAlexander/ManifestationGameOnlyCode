import type { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { PALETTE } from '../config/palette';
import { TUNING } from '../config/tuning';
import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { FollowCamera } from '../inner/FollowCamera';
import { WORLD_UNIFORMS } from '../shaders/paperShader';
import { InputManager } from '../core/InputManager';
import { BreathSystem } from '../player/BreathSystem';
import { BreathVisuals } from '../player/BreathVisuals';
import { PlayerController } from '../player/PlayerController';
import { PlayerVisual } from '../player/PlayerVisual';
import { VALLEY_UNIFORMS, createValleyMaterial } from '../inner/valleyShader';
import { ValleySky, buildFarMountains } from '../inner/ValleySky';
import { FOUNTAIN_JET_OFFSET, buildTownSolid, gateBoxes } from './TownLook';
import { buildHouses, type HouseSpec } from './HouseBuilder';
import { HOUSE_PADS, LANE_SEGMENTS, STREAM_START_X, buildTownTerrain, houseRoofAt, streamRibbonPoints, streamZ, townHeight, walkHeight } from './townTerrain';
import { buildStream, buildWaterfall } from '../inner/ValleyWater';
import type { ValleyTerrain } from '../inner/ValleyTerrain';
import { Joystick } from '../ui/Joystick';
import { TouchRouter } from '../ui/TouchRouter';
import { BreathButton } from '../ui/BreathButton';
import { isTouchDevice } from '../core/Performance';
import type { World } from '../game/World';
import { TownColliders } from './Colliders';
import { TOWN } from './townLayout';
import { TownProps } from './TownProps';
import { TOWN_PROPS } from './townPropsLayout';
import { buildTree, type TreeHandle } from '../world/TreeBuilder';
import { OLD_TREE } from '../world/TreeShape';
import { Citizen } from '../npc/Citizen';
import { SteamPool } from '../npc/Steam';
import { BumpSequence } from './BumpSequence';
import { Alley } from './Alley';

/**
 * The outer world: a small closed town (GAME_DESIGN.md 5.1). Greybox, all made in code.
 * Own Scene on the shared Engine. The Game calls update() only while this world is active.
 */
export class Town implements World {
  readonly id = 'outer' as const;
  readonly scene: Scene;

  private readonly input = new InputManager();
  private readonly colliders = new TownColliders();
  private readonly controller: PlayerController;
  readonly visual: PlayerVisual;
  private readonly cam: FollowCamera;
  /** Input rotated by the camera yaw, so "up" is always away from the camera. */
  private readonly rotated = { moveX: 0, moveY: 0 };
  get camera(): FreeCamera {
    return this.cam.camera;
  }
  private readonly zones: HTMLElement[] = [];
  private active = true;
  private readonly breath = new BreathSystem();
  private breathVisuals!: BreathVisuals;
  private shoveLeft = { x: 0, z: 0 };
  private slowFactor = 1;
  private slowTime = 0;
  private readonly citizens: Citizen[] = [];
  private readonly steam: SteamPool;
  private townAnger = 0;

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    ui: HTMLElement,
  ) {
    this.scene = new Scene(engine);
    this.scene.skipPointerMovePicking = true;

    this.applyMood();
    this.scene.clearColor = Color4.FromColor3(VALLEY_UNIFORMS.fogColor, 1);
    this.scene.autoClear = false;
    this.buildLook();
    this.buildColliders();
    this.props = new TownProps(this.scene, (x, z) => townHeight(x, z));


    this.controller = new PlayerController(this.rotated as unknown as InputManager, this.colliders);
    this.visual = new PlayerVisual(this.scene);
    this.breathVisuals = new BreathVisuals(this.scene);
    this.controller.teleport(TOWN.start.x, TOWN.start.z);
    this.placeVisual(0);

    // Touch controls (one zone: first finger walks, second turns the camera).
    let touchZone: HTMLElement | null = null;
    let stick: Joystick | null = null;
    if (this.touch) {
      touchZone = document.createElement('div');
      touchZone.className = 'touch-zone';
      ui.appendChild(touchZone);
      this.zones.push(touchZone);
      stick = new Joystick(ui, this.input);
      new BreathButton(ui, this.input);
    }
    this.input.attach();
    // Citizens mirror the anger (GAME_DESIGN 6.1).
    this.steam = new SteamPool(this.scene, 24);
    TOWN.citizens.forEach((def, i) => this.citizens.push(new Citizen(this.scene, def, i, TOWN.loops)));
    TOWN.citizens.forEach((def, i) => {
      if (def.partner !== undefined) this.citizens[i]!.partner = this.citizens[def.partner]!;
    });

    this.bump = new BumpSequence(this.scene, () => this.controller.position);
    this.alley = new Alley(this.scene, this.bump.stranger);

    this.cam = new FollowCamera(this.scene, { height: (x, z) => this.camGround(x, z) }, canvas, this.touch);
    if (touchZone && stick) new TouchRouter(touchZone, stick, this.cam);
    this.cam.snapTo(this.visual.root.position, 0);
    engine.onResizeObservable.add(() => this.cam.onResize());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private readonly touch = isTouchDevice() || new URLSearchParams(location.search).has('touch');
  private props!: TownProps;
  private oldTree: TreeHandle | null = null;
  private jet: Mesh | null = null;
  private jetBaseY = 0;
  private fountainLevel: number = TUNING.story.fountainLow;
  private fountainTarget: number = TUNING.story.fountainLow;
  private time = 0;
  readonly bump: BumpSequence;
  readonly alley: Alley;

  /** Starts the bump; the player is shoved a little at the hit (no harm). */
  startBump(onImpact: () => void, onDone: () => void): void {
    this.bump.start(() => {
      const d = this.bump.impactDir;
      this.shove(d.x * TUNING.story.bumpShove, d.z * TUNING.story.bumpShove);
      onImpact();
    }, onDone);
  }

  /** World position of the lantern niche in the Old Tree trunk. */
  treeNiche(): Vector3 {
    const t = TOWN.oldTree;
    return new Vector3(t.x, TOWN.niche.y, t.z - TOWN.niche.trunkFaceDz);
  }

  /** High branch point where the recovered lantern hangs after delivery. */
  treeLanternAnchor(): Vector3 {
    const t = TOWN.oldTree;
    const b = OLD_TREE.branches[OLD_TREE.dryBranch]!;
    const f = b.start;
    const q = TOWN.oldTree.lanternBranchFraction;
    const along = Math.sin(b.tilt) * b.length * q;
    const scale = TUNING.outer.treeHeight;
    const ground = townHeight(t.x, t.z);
    const hangingOffset = (TUNING.lantern.cageHeight * 0.5 + 0.05 + TUNING.lantern.hangingCordLength) * TUNING.lantern.deliveredScale;
    return new Vector3(
      t.x + (OLD_TREE.lean[0] * f * f + Math.cos(b.angle) * along) * scale,
      ground + (OLD_TREE.trunkHeight * f + Math.cos(b.tilt) * b.length * q) * scale - hangingOffset,
      t.z + (OLD_TREE.lean[1] * f * f + Math.sin(b.angle) * along) * scale,
    );
  }

  /** Health of the Old Tree's dry branch (0 dry, 1 healed). */
  setOldTreeBranchHealth(v: number): void {
    this.oldTree?.setBranchHealth(OLD_TREE.dryBranch, v);
  }

  /** Mirror: the fountain runs clearer and higher when the inner root heals (0 weak .. 1 full). */
  setFountain(v: number): void {
    const S = TUNING.story;
    this.fountainTarget = S.fountainLow + (S.fountainHigh - S.fountainLow) * Math.min(1, Math.max(0, v));
  }

  update(dt: number): void {
    if (!this.active) return;
    dt = Math.min(0.05, dt);
    this.time += dt;
    this.updateJet(dt);
    this.props.update(dt);
    this.input.update();
    const yaw = this.cam.yaw;
    const mx = this.input.moveX;
    const my = this.input.moveY;
    this.rotated.moveX = mx * Math.cos(yaw) + my * Math.sin(yaw);
    this.rotated.moveY = -mx * Math.sin(yaw) + my * Math.cos(yaw);
    this.breath.update(dt, { inhale: this.input.inhaleHeld, exhale: this.input.exhaleHeld, releaseExhales: this.touch });
    this.slowTime = Math.max(0, this.slowTime - dt);
    const slow = this.slowTime > 0 ? this.slowFactor : 1;
    this.controller.speedFactor = (this.breath.state === 'idle' ? 1 : TUNING.breath.walkFactor) * slow;
    this.controller.update(dt);
    this.applyShove(dt);
    this.placeVisual(dt);
    if (this.wobble > 0) {
      this.wobble = Math.max(0, this.wobble - dt / TUNING.bubbles.wobbleTime);
      this.visual.root.rotation.z = Math.sin(this.time * 16) * TUNING.bubbles.wobbleAmount * this.wobble;
    } else if (this.visual.root.rotation.z !== 0) {
      this.visual.root.rotation.z = 0;
    }
    const pp = this.controller.position;
    for (const c of this.citizens) {
      c.update(dt, {
        townAnger: this.townAnger,
        playerX: pp.x,
        playerZ: pp.z,
        colliders: this.colliders,
        steam: this.steam,
        others: this.citizens,
        groundY: (x, z) => this.groundY(x, z),
      });
    }
    this.steam.update(dt);
    this.bump.update(dt);
    this.alley.update(dt, pp.x, pp.z);
    const al = TOWN.areas.alley;
    if (pp.x > al.minX && pp.x < al.maxX && pp.z > al.minZ && pp.z < al.maxZ) this.cam.easeYaw(-Math.PI / 2, 3, dt);
    this.cam.update(dt, this.visual.root.position, this.controller.heading, this.controller.speedRatio);
    VALLEY_UNIFORMS.time += dt;
    VALLEY_UNIFORMS.camPos.copyFrom(this.cam.camera.position);
    WORLD_UNIFORMS.time = VALLEY_UNIFORMS.time;
    WORLD_UNIFORMS.pivotZ = 1e6;
    this.input.endFrame();
  }

  private updateJet(dt: number): void {
    if (!this.jet) return;
    this.fountainLevel += (this.fountainTarget - this.fountainLevel) * Math.min(1, dt * 1.5);
    const h = 1.1 * this.fountainLevel * (1 + 0.05 * Math.sin(this.time * 5));
    this.jet.scaling.y = Math.max(0.05, h);
    this.jet.position.y = this.jetBaseY + h / 2;
  }

  teleport(x: number, z: number): void {
    this.controller.teleport(x, z);
  }

  /** Positions of citizens who are agitated enough to send Thought Waves (WaveField reads this). */
  waveSpots(minAgitation: number): { x: number; z: number }[] {
    const out: { x: number; z: number }[] = [];
    for (const c of this.citizens) if (c.agitation > minAgitation) out.push({ x: c.x, z: c.z });
    return out;
  }

  /** After a pushed Thought Bubble: the nearest citizen walks into the player (soft bump, wobble, no harm). */
  citizenBump(): boolean {
    const B = TUNING.bubbles;
    const p = this.controller.position;
    let best: Citizen | null = null;
    let bd = Infinity;
    for (const c of this.citizens) {
      if (c.onErrand) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d > 2.5 && d < bd) {
        bd = d;
        best = c;
      }
    }
    if (!best) return false;
    const speed = Math.min(B.bumpSpeedMax, Math.max(B.bumpSpeedMin, bd / B.bumpArrive));
    best.startErrand(speed, (dx, dz) => {
      this.shove(dx * B.bumpShove, dz * B.bumpShove);
      this.slow(B.bumpSlowFactor, B.bumpSlowTime);
      this.wobble = 1;
      this.bumps++;
    });
    return true;
  }

  /** Mean citizen agitation 0..1 (test hook). */
  meanAgitation(): number {
    let s = 0;
    for (const c of this.citizens) s += c.agitation;
    return s / Math.max(1, this.citizens.length);
  }

  /** Number of citizen bumps so far (test hook). */
  bumps = 0;
  private wobble = 0;

  /** Town anger 0..1. Game calls this every frame (or on change). Citizens mirror it. */
  setAnger(v: number): void {
    this.townAnger = Math.min(1, Math.max(0, v));
  }

  breathSystem(): BreathSystem {
    return this.breath;
  }

  onBreathDone(cb: () => void): void {
    this.breath.onBreathDone(() => cb());
  }

  simulateBreath(): void {
    this.breath.simulate();
  }

  breathState(): string {
    return this.breath.state;
  }

  hasMovementInput(): boolean {
    return this.input.moveX !== 0 || this.input.moveY !== 0;
  }

  shove(dx: number, dz: number): void {
    this.shoveLeft.x += dx;
    this.shoveLeft.z += dz;
  }

  slow(factor: number, seconds: number): void {
    this.slowFactor = factor;
    this.slowTime = seconds;
  }

  /** Spends the pending shove over about 0.4 s. The colliders keep the player inside the town. */
  private applyShove(dt: number): void {
    const s = this.shoveLeft;
    if (Math.abs(s.x) + Math.abs(s.z) < 1e-4) return;
    const k = Math.min(1, dt / 0.4);
    const sx = s.x * k;
    const sz = s.z * k;
    const p = this.controller.position;
    const [rx, rz] = this.colliders.resolve(p.x, p.z, p.x + sx, p.z + sz, TUNING.player.radius);
    p.x = rx;
    p.z = rz;
    s.x -= sx;
    s.z -= sz;
  }

  playerPosition(): Vector3 {
    return this.visual.root.position.clone();
  }

  diamondPosition(): Vector3 {
    const s = TUNING.player.visualScale;
    const h = this.controller.heading;
    const p = this.visual.root.position;
    return new Vector3(p.x - Math.sin(h) * 0.22 * s, p.y + 0.52 * s, p.z - Math.cos(h) * 0.22 * s);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.input.enabled = active;
    this.controller.canMove = active;
    if (active) {
      // The town is flat: switch the shared world bend off. Sky colour comes from the scene.
      WORLD_UNIFORMS.pivotZ = 1e6;
      this.applyMood();
      this.cam.onResize();
    } else {
      this.input.touchMoveX = 0;
      this.input.touchMoveY = 0;
      this.input.update();
      this.controller.velocity.set(0, 0, 0);
    }
    for (const z of this.zones) z.style.display = active ? '' : 'none';
  }

  debugInfo(): Record<string, string | number> {
    const p = this.controller.position;
    return {
      world: 'outer',
      x: +p.x.toFixed(1),
      z: +p.z.toFixed(1),
      meshes: this.scene.meshes.length,
      breath: this.breath.state,
    };
  }

  // --- Ground height ---

  /** Ground for the camera: house roofs count, so the camera never sits inside a house. */
  private camGround(x: number, z: number): number {
    const y = walkHeight(x, z);
    const roof = houseRoofAt(x, z, 0.4);
    return roof === null ? y : Math.max(y, roof);
  }

  /** Where people stand: the ground, or the bridge deck. */
  groundY(x: number, z: number): number {
    return walkHeight(x, z);
  }

  private placeVisual(dt: number): void {
    const c = this.controller;
    this.visual.root.position.set(c.position.x, this.groundY(c.position.x, c.position.z), c.position.z);
    this.breathVisuals.update(dt, this.breath, this.visual.root.position);
    this.visual.update(dt, {
      speed: c.speed,
      speedRatio: c.speedRatio,
      heading: c.heading,
      breathLevel: this.breath.breathLevel,
      glow: this.breathVisuals.glow,
      awake: 1,
    });
  }

  // --- Building ---

  private buildColliders(): void {
    for (const seg of LANE_SEGMENTS) this.colliders.corridors.push(seg);
    for (const [cx, cz, w, d] of gateBoxes()) this.colliders.addBox(cx, cz, w, d);
    for (const s of TOWN.stalls) this.colliders.addBox(s.x, s.z, s.w, s.d);
    const f = TOWN.fountain;
    this.colliders.addCircle(f.x, f.z, f.outerRadius);
    // The stream blocks the way, except over the bridge.
    for (let x = -10; x <= 10; x += 0.8) {
      if (Math.abs(x - TOWN.bridge.x) < 1.9) continue;
      this.colliders.addCircle(x, streamZ(x), TOWN.stream.halfWidth - 0.1);
    }
    for (const b of TOWN_PROPS.benches) this.colliders.addCircle(b.x, b.z, 0.6);
    for (const c of TOWN_PROPS.crates) this.colliders.addCircle(c.x, c.z, c.s * 0.6);
    for (const b of TOWN_PROPS.barrels) this.colliders.addCircle(b.x, b.z, b.s * 0.5);
    for (const p of TOWN_PROPS.alleyPots) this.colliders.addCircle(p.x, p.z, 0.35);
    const o = TOWN.oldTree;
    this.colliders.addCircle(o.x, o.z, o.colliderRadius);
  }

  /** The look of the whole town: valley sky, mesas, shader materials, valley-like ground, one merged solid mesh. */
  private buildLook(): void {
    const sc = this.scene;
    const solid = createValleyMaterial('town.solid', sc, { look: 'outer', backFaceCulling: false });
    const ground = createValleyMaterial('town.groundMat', sc, { look: 'outer', ground: true });
    const plants = createValleyMaterial('town.plants', sc, { look: 'outer', wind: true, painted: true });
    const far = createValleyMaterial('town.far', sc, { look: 'outer', unlit: true, fog: 0, backFaceCulling: false });
    const water = createValleyMaterial('town.water', sc, { look: 'outer', water: true, backFaceCulling: false });
    const falls = createValleyMaterial('town.falls', sc, { look: 'outer', falls: true, backFaceCulling: false });

    new ValleySky(sc, 'outer');
    const mesas = buildFarMountains(sc, 'outer');
    mesas.material = far;
    mesas.unfreezeWorldMatrix();
    mesas.position.set(TUNING.outer.look.mesaCentre.x, 0, TUNING.outer.look.mesaCentre.z);
    mesas.freezeWorldMatrix();

    buildTownTerrain(sc, ground);
    buildTownSolid(sc, solid);
    const specs: HouseSpec[] = HOUSE_PADS.map((p) => ({
      x: p.def.x,
      z: p.def.z,
      rot: p.rot + Math.PI,
      w: p.def.w,
      d: p.def.d,
      floors: p.def.floors,
      style: p.def.style,
      roof: p.def.roof,
      colour: p.def.wall === 'sandstone' ? [0, 5, 3][p.def.seed % 3]! : [1, 2, 4][p.def.seed % 3]!,
      seed: p.def.seed,
      groundY: p.y,
    }));
    buildHouses(sc, specs, solid);

    // The stream from the cliff waterfall in the east.
    buildStream(sc, streamRibbonPoints(), TOWN.stream.halfWidth, water).freezeWorldMatrix();
    const sx = STREAM_START_X;
    buildWaterfall(sc, { height: townHeight } as unknown as ValleyTerrain, falls, { x: sx, z: streamZ(sx), dirX: 1, dirZ: 0.04, width: 0.9, top: 11 });

    // Fountain water: valley water look, and a small gentle jet.
    const f = TOWN.fountain;
    const baseY = townHeight(f.x, f.z);
    const disc = MeshBuilder.CreateDisc('town.water', { radius: f.innerRadius + 0.05, tessellation: 28 }, sc);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(f.x, baseY + f.height * 0.6, f.z);
    disc.material = water;
    disc.isPickable = false;
    disc.freezeWorldMatrix();
    this.jetBaseY = baseY + FOUNTAIN_JET_OFFSET;
    const jet = MeshBuilder.CreateCylinder('town.jet', { diameterTop: 0.06, diameterBottom: 0.2, height: 1, tessellation: 10 }, sc);
    jet.position.set(f.x, this.jetBaseY + 0.5, f.z);
    jet.material = water;
    jet.isPickable = false;
    this.jet = jet;

    // Old Tree: same shape and materials as the valley trees.
    const t = TOWN.oldTree;
    this.oldTree = buildTree(sc, OLD_TREE, TUNING.outer.treeHeight, {
      position: new Vector3(t.x, townHeight(t.x, t.z), t.z),
      woodMaterial: solid,
      leafMaterial: plants,
      dynamicBranches: [OLD_TREE.dryBranch],
      branchHealth: 0,
    });
  }

  private applyMood(): void {
    const m = TUNING.outer.look.mood;
    VALLEY_UNIFORMS.mood = m;
    Color3.LerpToRef(Color3.FromHexString(PALETTE.ivory), Color3.FromHexString(PALETTE.gold), Math.max(0, m), VALLEY_UNIFORMS.fogColor);
  }
}
