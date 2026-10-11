import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { PALETTE, SHADES } from '../config/palette';
import { TUNING } from '../config/tuning';
import { isTouchDevice } from '../core/Performance';
import { Random } from '../core/Random';
import { noise2 } from '../inner/noise';
import { paintFlat, type Rgb } from '../inner/colors';
import { createValleyMaterial, VALLEY_UNIFORMS } from '../inner/valleyShader';
import { bush, cypress, flower, grassTuft, placeThin, rock, roundTree, type Placement } from '../inner/ValleyProps';
import { TOWN } from './townLayout';
import { LANE_SEGMENTS, houseRoofAt, laneDist, streamDist, walkDist } from './townTerrain';
import { TOWN_PROPS, type PropSpot } from './townPropsLayout';

interface Frame {
  x: number;
  /** Ground height here (m). */
  y?: number;
  z: number;
  /** Yaw: local +z (outward / facing) points to (sin rot, cos rot) in the world. */
  rot: number;
}

function mix(a: string, b: string, t: number): string {
  return Color3.Lerp(Color3.FromHexString(a), Color3.FromHexString(b), t).toHexString();
}

/** Collects small hand-made parts (all painted flat) and merges them into one mesh. */
class Kit {
  readonly parts: Mesh[] = [];
  /** Ground height added to every part that has no frame. */
  dy = 0;
  constructor(private readonly scene: Scene) {}

  private put(m: Mesh, hex: string, lx: number, ly: number, lz: number, f?: Frame, roll = 0): Mesh {
    const rot = f?.rot ?? 0;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    m.position.set((f?.x ?? 0) + lx * c + lz * s, ly + (f?.y ?? this.dy), (f?.z ?? 0) - lx * s + lz * c);
    m.rotation.set(0, rot, roll);
    m.bakeCurrentTransformIntoVertices();
    paintFlat(m, hex, 0);
    this.parts.push(m);
    return m;
  }

  box(w: number, h: number, d: number, hex: string, lx: number, ly: number, lz: number, f?: Frame, roll = 0): void {
    this.put(MeshBuilder.CreateBox('tp.box', { width: w, height: h, depth: d }, this.scene), hex, lx, ly, lz, f, roll);
  }

  cyl(dTop: number, dBottom: number, h: number, hex: string, lx: number, ly: number, lz: number, f?: Frame): void {
    this.put(MeshBuilder.CreateCylinder('tp.cyl', { diameterTop: dTop, diameterBottom: dBottom, height: h, tessellation: 9 }, this.scene), hex, lx, ly, lz, f);
  }

  /** A soft squashed ball. */
  blob(dx: number, dy: number, dz: number, hex: string, lx: number, ly: number, lz: number, f?: Frame, roll = 0): void {
    const m = MeshBuilder.CreateSphere('tp.blob', { diameter: 1, segments: 4 }, this.scene);
    m.scaling.set(dx, dy, dz);
    this.put(m, hex, lx, ly, lz, f, roll);
  }

  merged(name: string): Mesh | null {
    if (this.parts.length === 0) return null;
    const m = Mesh.MergeMeshes(this.parts, true, true);
    if (m) m.name = name;
    return m;
  }
}

/**
 * Small charming details for the town (copied from the valley's look): grass, flowers, bushes,
 * cypresses, round trees, stones, and hand-made things like pots, flower boxes, benches, crates,
 * barrels, stall cloth and one vine. No colliders. Everything frozen.
 * Draw calls: tufts, flowers, bushes, cypresses, trees, stones, details = 7.
 */
export class TownProps {
  private readonly rnd = new Random('light-within-town-props-1');
  private readonly p = TUNING.townProps;
  private readonly plants: ShaderMaterial;
  private readonly grass: ShaderMaterial;
  private readonly solid: ShaderMaterial;

  constructor(
    private readonly scene: Scene,
    private readonly groundAt: (x: number, z: number) => number,
  ) {
    const opts = {};
    this.plants = createValleyMaterial('town.props.plants', scene, { ...opts, wind: true, painted: true });
    this.grass = createValleyMaterial('town.props.grass', scene, { ...opts, wind: true, backFaceCulling: false });
    this.solid = createValleyMaterial('town.props.solid', scene, opts);
    this.syncUniforms();

    const phone = isTouchDevice() || new URLSearchParams(location.search).has('touch');
    const grassShare = phone ? TUNING.performance.mobileGrassShare : 1;
    const flowerShare = phone ? TUNING.performance.mobileFlowerShare : 1;

    const tufts = [
      ...this.meadowTufts(Math.round(this.p.meadowTufts * grassShare)),
      ...this.wallTufts(Math.round(this.p.wallTufts * grassShare)),
      ...this.spotTufts(),
    ];
    placeThin(grassTuft(scene, this.rnd), tufts, this.grass);
    placeThin(flower(scene), this.flowers(Math.round(this.p.flowers * flowerShare)), this.grass);
    placeThin(bush(scene), this.spots(TOWN_PROPS.bushes, 0.1, 0.0), this.plants);
    placeThin(cypress(scene), this.spots(TOWN_PROPS.cypresses, 0.1, 0.12), this.plants);
    placeThin(roundTree(scene), this.spots(TOWN_PROPS.trees, 0.15, 0.0), this.plants);
    placeThin(rock(scene, 7), this.stones(this.p.stones), this.solid);

    const details = this.buildDetails();
    if (details) {
      details.material = this.solid;
      details.isPickable = false;
      details.freezeWorldMatrix();
    }
  }

  /** Wind clock and the camera position the valley shader uses (the plants fade right in front of the camera). */
  update(dt: number): void {
    // Wind clock and camera position are set once per frame by Town (shared valley uniforms).
    void dt;
  }

  private syncUniforms(): void {
    const cam = this.scene.activeCamera;
    if (cam) VALLEY_UNIFORMS.camPos.copyFrom(cam.position);
  }

  // --- Helpers ---

  private tint(bright: number, warm: number): Rgb {
    const b = 1 + this.rnd.jitter(bright);
    const w = this.rnd.jitter(warm);
    return [b * (1 + w), b, b * (1 - w)];
  }

  private y(x: number, z: number, out: boolean | undefined, lift: number): number {
    void out;
    return this.groundAt(x, z) - lift;
  }

  /** True where nothing should grow: on the lanes (with a margin), in the stream, or on a house. */
  private blocked(x: number, z: number, margin = 0): boolean {
    return walkDist(x, z) < margin || streamDist(x, z) < TOWN.stream.halfWidth + 0.3 || houseRoofAt(x, z, 0.8) !== null;
  }

  // --- Thin-instance placements ---

  private spots(list: PropSpot[], lift: number, stretchY: number): Placement[] {
    return list.map((s) => ({
      x: s.x,
      y: this.y(s.x, s.z, s.out, lift),
      z: s.z,
      scale: s.scale,
      stretch: stretchY > 0 ? [1, 1 + this.rnd.next() * stretchY, 1] : undefined,
      rotY: this.rnd.range(0, 6.28),
      tint: this.tint(0.07, 0.04),
    }));
  }

  /** A few tufts around each bush, cypress and tree, so none of them stands on bare ground. */
  private spotTufts(): Placement[] {
    const out: Placement[] = [];
    for (const s of [...TOWN_PROPS.bushes, ...TOWN_PROPS.cypresses, ...TOWN_PROPS.trees]) {
      for (let i = 0; i < 4; i++) {
        const a = this.rnd.range(0, 6.28);
        const r = this.rnd.range(0.5, 1.0) * s.scale;
        const x = s.x + Math.cos(a) * r;
        const z = s.z + Math.sin(a) * r;
        if (this.blocked(x, z, 0.3)) continue;
        out.push(this.tuft(x, z));
      }
    }
    return out;
  }

  private tuft(x: number, z: number, out?: boolean): Placement {
    return {
      x,
      y: this.y(x, z, out, 0.03),
      z,
      scale: this.rnd.range(0.7, 1.3),
      rotY: this.rnd.range(0, 6.28),
      tint: this.tint(0.1, 0.05),
    };
  }

  private meadowTufts(count: number): Placement[] {
    const e = TOWN.areas.edge;
    const out: Placement[] = [];
    for (let i = 0; i < count * 6 && out.length < count; i++) {
      const x = this.rnd.range(e.minX - 1, e.maxX + 1);
      const z = this.rnd.range(e.minZ - 1, e.maxZ + 1);
      if (laneDist('meadow', x, z) > 1.2 || this.blocked(x, z)) continue;
      if (noise2(x * 0.18 + 7, z * 0.18) < 0.3 + this.rnd.next() * 0.3) continue;
      out.push(this.tuft(x, z));
    }
    return out;
  }

  /** A point just beside a lane edge (gap metres outside it, or inside if gap is negative). */
  private besideLane(gap: number): [number, number] {
    const segs = LANE_SEGMENTS;
    const s = segs[Math.floor(this.rnd.next() * segs.length)]!;
    const t = this.rnd.next();
    const cx = s.ax + (s.bx - s.ax) * t;
    const cz = s.az + (s.bz - s.az) * t;
    let nx = -(s.bz - s.az);
    let nz = s.bx - s.ax;
    const l = Math.hypot(nx, nz);
    if (l < 1e-6) {
      const a = this.rnd.range(0, 6.28);
      nx = Math.cos(a);
      nz = Math.sin(a);
    } else {
      nx /= l;
      nz /= l;
    }
    const side = this.rnd.next() < 0.5 ? -1 : 1;
    const d = s.halfWidth + gap;
    return [cx + nx * side * d, cz + nz * side * d];
  }

  private wallTufts(count: number): Placement[] {
    const out: Placement[] = [];
    for (let i = 0; i < count * 3 && out.length < count; i++) {
      const pt = this.besideLane(this.rnd.range(-0.1, 1.2));
      if (this.blocked(pt[0], pt[1], 0.1)) continue;
      if (noise2(pt[0] * 0.25 + 3, pt[1] * 0.25) < 0.25) continue;
      out.push(this.tuft(pt[0], pt[1]));
    }
    return out;
  }

  private flowers(count: number): Placement[] {
    const e = TOWN.areas.edge;
    const out: Placement[] = [];
    const add = (cx: number, cz: number): void => {
      const n = 3 + Math.floor(this.rnd.next() * 5);
      for (let k = 0; k < n && out.length < count; k++) {
        const x = cx + this.rnd.jitter(0.8);
        const z = cz + this.rnd.jitter(0.8);
        if (this.blocked(x, z, 0.1)) continue;
        out.push({
          x,
          y: this.y(x, z, false, 0.02),
          z,
          scale: this.rnd.range(0.7, 1.2),
          rotY: this.rnd.range(0, 6.28),
          tiltX: this.rnd.jitter(0.2),
          tiltZ: this.rnd.jitter(0.2),
          tint: this.tint(0.04, 0.02),
        });
      }
    };
    for (let i = 0; i < count * 8 && out.length < count; i++) {
      if (this.rnd.next() < 0.5) {
        const x = this.rnd.range(e.minX, e.maxX);
        const z = this.rnd.range(e.minZ, e.maxZ);
        if (noise2(x * 0.12 - 3, z * 0.12 + 8) < 0.5 || laneDist('meadow', x, z) > -0.5) continue;
        add(x, z);
      } else {
        const pt = this.besideLane(this.rnd.range(0.2, 1.4));
        add(pt[0], pt[1]);
      }
    }
    return out;
  }

  private stones(count: number): Placement[] {
    const out: Placement[] = [];
    for (let i = 0; i < count * 8 && out.length < count; i++) {
      const pt = this.besideLane(this.rnd.range(0.3, 2.2));
      if (this.blocked(pt[0], pt[1], 0.5)) continue;
      const scale = this.rnd.range(0.25, 0.7);
      out.push({
        x: pt[0],
        y: this.y(pt[0], pt[1], false, 0.12 * scale),
        z: pt[1],
        scale,
        stretch: [this.rnd.range(0.9, 1.35), this.rnd.range(0.6, 0.95), this.rnd.range(0.85, 1.2)],
        rotY: this.rnd.range(0, 6.28),
        tiltX: this.rnd.jitter(0.12),
        tiltZ: this.rnd.jitter(0.12),
        tint: this.tint(0.06, 0.05),
      });
    }
    return out;
  }

  // --- Hand-made details (one merged mesh) ---

  private buildDetails(): Mesh | null {
    const kit = new Kit(this.scene);
    for (const p of TOWN_PROPS.alleyPots) this.pot(kit, { x: p.x, z: p.z, y: this.groundAt(p.x, p.z), rot: 0 });
    this.benches(kit);
    this.crates(kit);
    this.stalls(kit);
    return kit.merged('town.props.details');
  }

  private pot(kit: Kit, f: Frame): void {
    const clay = mix(PALETTE.sandstone, PALETTE.cloak, 0.3);
    const leaf = this.rnd.next() < 0.5 ? PALETTE.olive : PALETTE.sage;
    kit.cyl(0.34, 0.24, 0.32, clay, 0, 0.16, 0.22, f);
    kit.blob(0.4, 0.34, 0.4, leaf, 0, 0.5, 0.22, f);
    kit.blob(0.09, 0.09, 0.09, PALETTE.ivory, 0.08, 0.7, 0.26, f);
    kit.blob(0.08, 0.08, 0.08, PALETTE.gold, -0.09, 0.64, 0.18, f);
  }

  private benches(kit: Kit): void {
    const stone = mix(PALETTE.stone, PALETTE.ivory, 0.25);
    const dark = PALETTE.stone;
    for (const b of TOWN_PROPS.benches) {
      const f: Frame = { x: b.x, z: b.z, y: this.groundAt(b.x, b.z), rot: b.rot };
      kit.box(1.8, 0.12, 0.5, stone, 0, 0.44, 0, f);
      kit.box(0.14, 0.42, 0.44, dark, -0.7, 0.21, 0, f);
      kit.box(0.14, 0.42, 0.44, dark, 0.7, 0.21, 0, f);
      kit.box(1.8, 0.36, 0.1, dark, 0, 0.68, -0.2, f);
    }
  }

  private crates(kit: Kit): void {
    const wood = mix(SHADES.umber, PALETTE.sandstone, 0.45);
    const lid = mix(SHADES.umber, PALETTE.sandstone, 0.7);
    for (const c of TOWN_PROPS.crates) {
      const f: Frame = { x: c.x, z: c.z, y: this.groundAt(c.x, c.z), rot: c.rot };
      kit.box(c.s, c.s, c.s, wood, 0, c.s / 2, 0, f);
      kit.box(c.s * 1.05, 0.05, c.s * 1.05, lid, 0, c.s + 0.02, 0, f);
    }
    const body = mix(SHADES.umber, PALETTE.sandstone, 0.3);
    for (const b of TOWN_PROPS.barrels) {
      const s = b.s;
      kit.dy = this.groundAt(b.x, b.z);
      kit.cyl(0.5 * s, 0.5 * s, 0.8 * s, body, b.x, 0.4 * s, b.z);
      kit.cyl(0.62 * s, 0.62 * s, 0.5 * s, body, b.x, 0.4 * s, b.z);
      kit.cyl(0.64 * s, 0.64 * s, 0.05, SHADES.umber, b.x, 0.2 * s, b.z);
      kit.cyl(0.64 * s, 0.64 * s, 0.05, SHADES.umber, b.x, 0.62 * s, b.z);
    }
  }

  /** Cloth fringe on the canopy edges and a few fruit on each counter. */
  private stalls(kit: Kit): void {
    TOWN.stalls.forEach((s, si) => {
      kit.dy = this.groundAt(s.x, s.z);
      const pair = TOWN_PROPS.stallCloth[si % TOWN_PROPS.stallCloth.length]!;
      const cols = pair.map((k) => PALETTE[k as keyof typeof PALETTE]);
      const w = s.w + 0.5;
      const n = 8;
      for (const side of [-1, 1]) {
        const z = s.z + side * ((s.d + 0.5) / 2 + 0.02);
        for (let i = 0; i < n; i++) {
          const h = i % 2 === 0 ? 0.5 : 0.36;
          kit.box(w / n - 0.03, h, 0.03, cols[i % 2]!, s.x - w / 2 + (i + 0.5) * (w / n), 2.29 - h / 2, z);
        }
      }
      for (let i = 0; i < 6; i++) {
        const gold = i % 2 === 0;
        kit.blob(0.17, 0.17, 0.17, gold ? PALETTE.gold : PALETTE.cloak, s.x - 0.9 + i * 0.36, 0.98, s.z - 0.35 + (i % 3) * 0.1);
      }
    });
  }
}
