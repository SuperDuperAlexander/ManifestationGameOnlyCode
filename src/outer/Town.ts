import type { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { PALETTE, SHADES, color3 } from '../config/palette';
import { TUNING } from '../config/tuning';
import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { FollowCamera } from '../inner/FollowCamera';
import { WORLD_UNIFORMS } from '../shaders/paperShader';
import { InputManager } from '../core/InputManager';
import { BreathSystem } from '../player/BreathSystem';
import { PlayerController } from '../player/PlayerController';
import { PlayerVisual } from '../player/PlayerVisual';
import { createToonMaterial, type ToonMaterial } from '../shaders/toonShader';
import { Joystick } from '../ui/Joystick';
import type { World } from '../game/World';
import { TownColliders } from './Colliders';
import { TOWN, type HouseDef } from './townLayout';
import { buildTree, type TreeHandle } from '../world/TreeBuilder';
import { OLD_TREE } from '../world/TreeShape';
import { Citizen } from '../npc/Citizen';
import { SteamPool } from '../npc/Steam';
import { BumpSequence } from './BumpSequence';
import { Alley } from './Alley';

type Quad = { x0: number; z0: number; y0: number; x1: number; z1: number; y1: number };

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
  private readonly mats = new Map<string, ToonMaterial>();
  private readonly zones: HTMLElement[] = [];
  private active = true;
  private readonly breath = new BreathSystem();
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
    this.scene.clearColor = Color4.FromColor3(color3(PALETTE.powder), 1);
    this.scene.skipPointerMovePicking = true;

    this.buildGround();
    this.buildBoundary();
    this.buildHouses();
    this.buildSquare();

    for (const a of Object.values(TOWN.areas)) this.colliders.addArea(a);

    this.controller = new PlayerController(this.rotated as unknown as InputManager, this.colliders);
    this.visual = new PlayerVisual(this.scene);
    this.controller.teleport(TOWN.start.x, TOWN.start.z);
    this.placeVisual(0);

    // Touch controls (left half walks). Keyboard works through the InputManager.
    let right: HTMLElement | null = null;
    if (matchMedia('(pointer: coarse)').matches) {
      right = document.createElement('div');
      right.className = 'touch-zone touch-right';
      ui.appendChild(right);
      this.zones.push(right);
      const left = document.createElement('div');
      left.className = 'touch-zone touch-left';
      ui.appendChild(left);
      this.zones.push(left);
      new Joystick(ui, this.input, left);
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

    this.cam = new FollowCamera(this.scene, { height: (x, z) => this.camGround(x, z) }, canvas, right);
    this.cam.snapTo(this.visual.root.position, 0);
    engine.onResizeObservable.add(() => this.cam.onResize());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private oldTree: TreeHandle | null = null;
  private jet: Mesh | null = null;
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
    this.input.update();
    const yaw = this.cam.yaw;
    const mx = this.input.moveX;
    const my = this.input.moveY;
    this.rotated.moveX = mx * Math.cos(yaw) + my * Math.sin(yaw);
    this.rotated.moveY = -mx * Math.sin(yaw) + my * Math.cos(yaw);
    this.breath.update(dt, { inhale: this.input.inhaleHeld, exhale: this.input.exhaleHeld, releaseExhales: matchMedia('(pointer: coarse)').matches });
    this.slowTime = Math.max(0, this.slowTime - dt);
    const slow = this.slowTime > 0 ? this.slowFactor : 1;
    this.controller.speedFactor = (this.breath.state === 'idle' ? 1 : 0.6) * slow;
    this.controller.update(dt);
    this.applyShove(dt);
    this.placeVisual(dt);
    const pp = this.controller.position;
    for (const c of this.citizens) {
      c.update(dt, {
        townAnger: this.townAnger,
        playerX: pp.x,
        playerZ: pp.z,
        colliders: this.colliders,
        steam: this.steam,
        others: this.citizens,
        groundY: (z) => this.groundY(z),
      });
    }
    this.steam.update(dt);
    this.bump.update(dt);
    this.alley.update(dt, pp.x, pp.z);
    const al = TOWN.areas.alley;
    if (pp.x > al.minX && pp.x < al.maxX && pp.z > al.minZ && pp.z < al.maxZ) this.cam.easeYaw(-Math.PI / 2, 3, dt);
    this.cam.update(dt, this.visual.root.position, this.controller.heading, this.controller.speedRatio);
    WORLD_UNIFORMS.time += dt;
    WORLD_UNIFORMS.pivotZ = 1e6;
    this.input.endFrame();
  }

  private updateJet(dt: number): void {
    if (!this.jet) return;
    this.fountainLevel += (this.fountainTarget - this.fountainLevel) * Math.min(1, dt * 1.5);
    const h = 1.5 * this.fountainLevel * (1 + 0.05 * Math.sin(this.time * 5));
    this.jet.scaling.y = Math.max(0.05, h);
    this.jet.position.y = TOWN.fountain.height * 0.6 + h / 2;
  }

  teleport(x: number, z: number): void {
    this.controller.teleport(x, z);
  }

  /** Town anger 0..1. Game calls this every frame (or on change). Citizens mirror it. */
  setAnger(v: number): void {
    this.townAnger = Math.min(1, Math.max(0, v));
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
    let y = this.groundY(z);
    for (const h of TOWN.houses) {
      if (Math.abs(x - h.x) < h.w / 2 + 0.3 && Math.abs(z - h.z) < h.d / 2 + 0.3) y = Math.max(y, h.h + TUNING.outer.roofRise);
    }
    return y;
  }

  private groundY(z: number): number {
    const s = TOWN.slope;
    if (z >= s.endZ) return 0;
    const t = Math.max(0, (z - s.startZ) / (s.endZ - s.startZ));
    return -TUNING.outer.slopeRise * (1 - t);
  }

  private placeVisual(dt: number): void {
    const c = this.controller;
    this.visual.root.position.set(c.position.x, this.groundY(c.position.z), c.position.z);
    this.visual.update(dt, {
      speed: c.speed,
      speedRatio: c.speedRatio,
      heading: c.heading,
      breathLevel: this.breath.breathLevel,
      glow: 0,
      awake: 1,
    });
  }

  // --- Materials ---

  private mat(hex: string, twoSided = false): ToonMaterial {
    const key = hex + (twoSided ? '2' : '1');
    let m = this.mats.get(key);
    if (!m) {
      const c = color3(hex);
      const mat = createToonMaterial('town.' + key, this.scene, c, c.scale(0.74));
      // The town is flat and seen from far: switch the world curve off for it.
      mat.onBindObservable.add(() => mat.getEffect()?.setFloat4('uCurve', 0, 0, 0, 0));
      mat.backFaceCulling = !twoSided;
      this.mats.set(key, mat);
      m = mat;
    }
    return m;
  }

  private static mix(a: string, b: string, t: number): string {
    return Color3.Lerp(color3(a), color3(b), t).toHexString();
  }

  /** Merge parts into one frozen mesh with one shared material. */
  private finish(name: string, parts: Mesh[], mat: ToonMaterial): Mesh | null {
    if (parts.length === 0) return null;
    const m = parts.length === 1 ? parts[0] : Mesh.MergeMeshes(parts, true, true);
    if (!m) return null;
    m.name = name;
    m.material = mat;
    m.isPickable = false;
    m.freezeWorldMatrix();
    m.doNotSyncBoundingInfo = true;
    return m;
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number): Mesh {
    const b = MeshBuilder.CreateBox('b', { width: w, height: h, depth: d }, this.scene);
    b.position.set(x, y, z);
    return b;
  }

  /** Flat-shaded (optionally sloped) quads in one mesh. */
  private quads(name: string, list: Quad[], mat: ToonMaterial): Mesh {
    const pos: number[] = [];
    const nrm: number[] = [];
    const idx: number[] = [];
    for (const q of list) {
      const n = new Vector3(0, q.z1 - q.z0, -(q.y1 - q.y0)).normalize();
      const b = pos.length / 3;
      pos.push(q.x0, q.y0, q.z0, q.x1, q.y0, q.z0, q.x1, q.y1, q.z1, q.x0, q.y1, q.z1);
      for (let i = 0; i < 4; i++) nrm.push(n.x, n.y, n.z);
      idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
    const m = new Mesh(name, this.scene);
    const vd = new VertexData();
    vd.positions = pos;
    vd.normals = nrm;
    vd.indices = idx;
    vd.applyToMesh(m);
    m.material = mat;
    m.isPickable = false;
    m.freezeWorldMatrix();
    return m;
  }

  // --- Building ---

  private buildGround(): void {
    const a = TOWN.areas;
    const s = TOWN.slope;
    const low = this.groundY(s.startZ);
    // Outside ground sits a little lower so the town reads as closed.
    this.quads('town.outside', [{ x0: -90, z0: -60, y0: -1.2, x1: 90, z1: 110, y1: -1.2 }], this.mat(PALETTE.olive, true));
    const e = a.edge;
    this.quads(
      'town.meadow',
      [
        { x0: e.minX, z0: s.startZ, y0: low, x1: e.maxX, z1: s.endZ, y1: 0 },
        { x0: e.minX, z0: s.endZ, y0: 0, x1: e.maxX, z1: e.maxZ, y1: 0 },
      ],
      this.mat(PALETTE.sage, true),
    );
    const paved = [a.street, a.square, a.alley].map((r) => ({ x0: r.minX, z0: r.minZ, y0: 0.02, x1: r.maxX, z1: r.maxZ, y1: 0.02 }));
    this.quads('town.paved', paved, this.mat(Town.mix(PALETTE.ivory, PALETTE.sandstone, 0.3), true));
  }

  private buildBoundary(): void {
    const parts: Mesh[] = [];
    const e = TOWN.areas.edge;
    const t = TOWN.meadowWall.thickness;
    const wh = TUNING.outer.wallHeight;
    const yMid = (wh - 1.2) / 2;
    const hh = wh + 1.2;
    const lenZ = e.maxZ - e.minZ + t;
    const midZ = (e.maxZ + e.minZ) / 2;
    parts.push(this.box(t, hh, lenZ, e.minX - t / 2, yMid, midZ));
    parts.push(this.box(t, hh, lenZ, e.maxX + t / 2, yMid, midZ));
    parts.push(this.box(e.maxX - e.minX + 2 * t, hh, t, 0, yMid, e.minZ - t / 2));
    // North wall with the arch opening.
    const ar = TOWN.arch;
    const pw = 0.9;
    const wallStart = ar.halfOpening + pw;
    const wallLen = e.maxX - wallStart + t;
    for (const sgn of [-1, 1]) {
      parts.push(this.box(wallLen, hh, t, sgn * (wallStart + wallLen / 2), yMid, ar.z + t / 2));
      const px = sgn * (ar.halfOpening + pw / 2);
      parts.push(this.box(pw, ar.height, 1.0, px, ar.height / 2, ar.z + t / 2));
      this.colliders.addBox(px, ar.z + t / 2, pw, 1.0);
    }
    parts.push(this.box(ar.halfOpening * 2 + pw * 2, 0.7, 1.0, 0, ar.height + 0.35, ar.z + t / 2));
    this.finish('town.stone', parts, this.mat(PALETTE.stone));
  }

  /** Roof prism. Ridge runs along the longer side. Flat normals, two-sided material. */
  private roof(h: HouseDef): Mesh {
    const o = TUNING.outer.roofOverhang;
    const rise = TUNING.outer.roofRise;
    const alongX = h.w >= h.d;
    // Local frame: u = along the ridge, v = across. Half sizes include the overhang.
    const hu = (alongX ? h.w : h.d) / 2 + o;
    const hv = (alongX ? h.d : h.w) / 2 + o;
    const y0 = h.h;
    const y1 = h.h + rise;
    const P = (u: number, v: number, y: number): [number, number, number] => (alongX ? [h.x + u, y, h.z + v] : [h.x + v, y, h.z + u]);
    const faces: [number, number, number][][] = [
      [P(-hu, -hv, y0), P(hu, -hv, y0), P(hu, 0, y1), P(-hu, 0, y1)],
      [P(-hu, hv, y0), P(-hu, 0, y1), P(hu, 0, y1), P(hu, hv, y0)],
      [P(-hu, -hv, y0), P(-hu, 0, y1), P(-hu, hv, y0)],
      [P(hu, -hv, y0), P(hu, hv, y0), P(hu, 0, y1)],
    ];
    const cy = (y0 + y1) / 2;
    const pos: number[] = [];
    const nrm: number[] = [];
    const idx: number[] = [];
    for (const f of faces) {
      const a = new Vector3(...f[0]);
      const b = new Vector3(...f[1]);
      const c = new Vector3(...f[2]);
      let n = Vector3.Cross(b.subtract(a), c.subtract(a)).normalize();
      const mid = a.add(c).scale(0.5);
      const out = new Vector3(mid.x - h.x, mid.y - cy, mid.z - h.z);
      if (Vector3.Dot(n, out) < 0) n = n.scale(-1);
      const base = pos.length / 3;
      for (const p of f) {
        pos.push(p[0], p[1], p[2]);
        nrm.push(n.x, n.y, n.z);
      }
      for (let i = 1; i < f.length - 1; i++) idx.push(base, base + i, base + i + 1);
    }
    const m = new Mesh('roof', this.scene);
    const vd = new VertexData();
    vd.positions = pos;
    vd.normals = nrm;
    vd.indices = idx;
    vd.applyToMesh(m);
    return m;
  }

  private buildHouses(): void {
    const groups: Record<string, Mesh[]> = { sandstone: [], ivory: [], roof: [], olive: [], powder: [] };
    for (const h of TOWN.houses) {
      groups[h.wall].push(this.box(h.w, h.h, h.d, h.x, h.h / 2, h.z));
      groups.roof.push(this.roof(h));
      // Shutters: pairs on the street side.
      const alongX = h.face === 'south';
      const len = alongX ? h.w : h.d;
      const sx = h.face === 'east' ? h.x + h.w / 2 + 0.05 : h.x - h.w / 2 - 0.05;
      const sz = h.z - h.d / 2 - 0.05;
      const n = Math.max(2, Math.floor(len / 3));
      const wy = Math.min(2.4, h.h * 0.55);
      for (let i = 0; i < n; i++) {
        const off = (i + 0.5) * (len / n) - len / 2;
        for (const side of [-0.5, 0.5]) {
          const o = off + side;
          if (alongX) groups[h.shutter].push(this.box(0.35, 1.0, 0.1, h.x + o, wy, sz));
          else groups[h.shutter].push(this.box(0.1, 1.0, 0.35, sx, wy, h.z + o));
        }
      }
    }
    this.finish('town.sandstone', groups.sandstone, this.mat(PALETTE.sandstone));
    this.finish('town.ivory', groups.ivory, this.mat(PALETTE.ivory));
    this.finish('town.roofs', groups.roof, this.mat(Town.mix(PALETTE.sandstone, SHADES.umber, 0.38), true));
    this.finish('town.shutterOlive', groups.olive, this.mat(PALETTE.olive));
    this.finish('town.shutterPowder', groups.powder, this.mat(PALETTE.powder));
  }

  private buildSquare(): void {
    const stone: Mesh[] = [];
    const wood: Mesh[] = [];
    const canopyIvory: Mesh[] = [];
    const canopyOlive: Mesh[] = [];

    // Fountain: a ring of boxes, a pillar and a water disc.
    const f = TOWN.fountain;
    const ringR = (f.outerRadius + f.innerRadius) / 2;
    const thick = f.outerRadius - f.innerRadius;
    const segs = 14;
    const segLen = (2 * Math.PI * ringR) / segs + 0.12;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const b = this.box(thick, f.height, segLen, 0, 0, 0);
      b.rotation.y = a;
      b.position.set(f.x + Math.sin(a) * ringR, f.height / 2, f.z + Math.cos(a) * ringR);
      stone.push(b);
    }
    const pillar = MeshBuilder.CreateCylinder('pillar', { diameterTop: 0.4, diameterBottom: 0.7, height: 1.8, tessellation: 10 }, this.scene);
    pillar.position.set(f.x, 0.9, f.z);
    stone.push(pillar);
    this.colliders.addCircle(f.x, f.z, f.outerRadius);

    const water = MeshBuilder.CreateDisc('town.water', { radius: f.innerRadius + 0.05, tessellation: 24 }, this.scene);
    water.rotation.x = Math.PI / 2;
    water.position.set(f.x, f.height * 0.6, f.z);
    water.material = this.mat(PALETTE.powder, true);
    water.isPickable = false;
    water.freezeWorldMatrix();

    // Fountain jet: one thin cone of water, one extra draw call. Height mirrors the inner root.
    const jet = MeshBuilder.CreateCylinder('town.jet', { diameterTop: 0.1, diameterBottom: 0.3, height: 1, tessellation: 8 }, this.scene);
    jet.position.set(f.x, f.height * 0.6 + 0.5, f.z);
    jet.material = this.mat(Town.mix(PALETTE.powder, PALETTE.ivory, 0.6));
    jet.isPickable = false;
    this.jet = jet;

    // Stalls.
    for (const s of TOWN.stalls) {
      wood.push(this.box(s.w, 0.9, s.d, s.x, 0.45, s.z));
      for (const px of [-1, 1]) {
        for (const pz of [-1, 1]) wood.push(this.box(0.12, 2.3, 0.12, s.x + px * (s.w / 2 - 0.06), 1.15, s.z + pz * (s.d / 2 - 0.06)));
      }
      (s.canopy === 'ivory' ? canopyIvory : canopyOlive).push(this.box(s.w + 0.5, 0.12, s.d + 0.5, s.x, 2.35, s.z));
      this.colliders.addBox(s.x, s.z, s.w, s.d);
    }

    // Old Tree: shared silhouette (same as the Inner Tree). Dry branch starts dry.
    const t = TOWN.oldTree;
    this.oldTree = buildTree(this.scene, OLD_TREE, TUNING.outer.treeHeight, {
      position: new Vector3(t.x, 0, t.z),
      dynamicBranches: [OLD_TREE.dryBranch],
      branchHealth: 0,
    });
    this.colliders.addCircle(t.x, t.z, t.colliderRadius);
    // Lantern niche: a dark recess in the trunk, south side.
    const n = TOWN.niche;
    const niche = this.box(n.w, n.h, n.d, t.x, n.y, t.z - n.trunkFaceDz + n.d / 2 - 0.05);
    this.finish('town.niche', [niche], this.mat(SHADES.legs));

    this.finish('town.fountain', stone, this.mat(PALETTE.stone));
    this.finish('town.stallWood', wood, this.mat(SHADES.umber));
    this.finish('town.canopyIvory', canopyIvory, this.mat(PALETTE.ivory));
    this.finish('town.canopyOlive', canopyOlive, this.mat(PALETTE.olive));
  }
}
