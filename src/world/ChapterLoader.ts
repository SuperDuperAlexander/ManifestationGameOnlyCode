import { TUNING } from '../config/tuning';
import { Random, hashString } from '../core/Random';
import {
  validateChapter,
  xz,
  type AssetMeta,
  type ChapterSpec,
  type GroundSpec,
  type HiddenPathSpec,
  type Vec2,
  type ZoneSpec,
} from '../types/chapter';
import { resample } from './Ground';
import { segDist, type Segment, type Walkability } from './Walkability';
import type { CardInstance } from './PaperCard';

/** One prop instance, placed in world metres. */
export interface PlacedProp extends CardInstance {
  asset: string;
  /** false when the data says this prop has no collider. */
  collide: boolean;
}

/** A zone with everything already placed in world metres. */
export interface ResolvedZone {
  spec: ZoneSpec;
  ox: number;
  oz: number;
  /** World rectangle around the whole zone (areas and props), for streaming and culling. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  props: PlacedProp[];
  ground: GroundSpec[];
  blockades: { id: string; x: number; z: number; text: string; release: string; points: number }[];
  hints: { id: string; x: number; z: number; line: string; radius?: number }[];
  hiddenPaths: [number, number][][];
  fogWalls: { id: string; x: number; z: number; size: number; stretch: number }[];
}

export interface ResolvedChapter {
  spec: ChapterSpec;
  zones: Map<string, ResolvedZone>;
  start: { zone: string; x: number; z: number };
}

const DEFAULT_META: AssetMeta = { height: 2, collider: 0, shadow: 1.2, mirror: false };

export async function loadChapter(url: string): Promise<ChapterSpec> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not load ${url}: ${res.status}`);
  const { chapter, errors, warnings } = validateChapter(await res.json());
  for (const w of warnings) console.warn(`[chapter] ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`[chapter] ${e}`);
    throw new Error(`chapter ${chapter.id} has ${errors.length} error(s)`);
  }
  return chapter;
}

/** Places every prop, fog and hint in world space. Deterministic: same file, same world. */
export function resolveChapter(spec: ChapterSpec): ResolvedChapter {
  const zones = new Map<string, ResolvedZone>();
  // Lines that scattered props must keep clear of (paths, rivers), in world metres.
  const keepClear: Segment[] = [];
  for (const p of spec.terrain.paths) addPolyline(keepClear, p.points, 0, 0, p.width / 2 + 0.3);
  for (const w of spec.terrain.water) addPolyline(keepClear, w.points, 0, 0, w.width / 2 + 0.2);

  for (const z of spec.zones) {
    const [ox, oz] = z.origin;
    const zoneClear = [...keepClear];
    for (const g of z.ground) {
      if (g.type === 'path' || g.type === 'water') addPolyline(zoneClear, g.points, ox, oz, g.width / 2 + 0.3);
    }
    const fogCircles = z.blockades.map((b) => {
      const [bx, bz] = xz(b.pos);
      return { x: ox + bx, z: oz + bz, r: TUNING.fog.colliderRadius + 1.4 };
    });

    const props: PlacedProp[] = [];
    z.props.forEach((p, index) => {
      const meta = spec.assets[p.asset] ?? DEFAULT_META;
      const rnd = new Random(spec.seed ^ hashString(`${z.id}:${index}:${p.asset}`));
      const make = (x: number, zz: number): PlacedProp => {
        const c = TUNING.cards;
        const base = p.scale ?? meta.height;
        const height = base * (1 + rnd.jitter(c.scaleJitter));
        const bright = 1 + rnd.jitter(c.brightnessJitter);
        const warm = rnd.jitter(c.warmthJitter);
        const mirror = p.mirror ?? (meta.mirror ? rnd.next() < 0.5 : false);
        const rotY = p.rotY !== undefined ? (p.rotY * Math.PI) / 180 : (rnd.jitter(c.rotationJitterDeg) * Math.PI) / 180;
        const k = height / meta.height;
        return {
          asset: p.asset,
          collide: p.collide !== false,
          x,
          z: zz,
          height,
          rotY,
          mirror,
          tint: [bright * (1 + warm), bright, bright * (1 - warm)],
          shadow: (meta.shadow ?? 0) * k,
        };
      };
      const [px, pz] = xz(p.pos);
      if (p.line) {
        const count = Math.max(1, p.count ?? 2);
        const [a, b] = p.line;
        for (let i = 0; i < count; i++) {
          const t = count === 1 ? 0.5 : i / (count - 1);
          const j = p.jitter ?? 0.4;
          props.push(make(ox + a[0] + (b[0] - a[0]) * t + rnd.jitter(j), oz + a[1] + (b[1] - a[1]) * t + rnd.jitter(j)));
        }
      } else if (p.scatter) {
        const radius = p.radius ?? 5;
        let placed = 0;
        for (let tries = 0; tries < p.scatter * 12 && placed < p.scatter; tries++) {
          const a = rnd.range(0, Math.PI * 2);
          const r = Math.sqrt(rnd.next()) * radius;
          const x = ox + px + Math.cos(a) * r;
          const zz = oz + pz + Math.sin(a) * r;
          if (zoneClear.some((s) => segDist(x, zz, s) < s.halfWidth)) continue;
          if (fogCircles.some((c) => Math.hypot(x - c.x, zz - c.z) < c.r)) continue;
          if (props.some((q) => q.asset === p.asset && Math.hypot(q.x - x, q.z - zz) < radius * 0.18)) continue;
          props.push(make(x, zz));
          placed++;
        }
      } else {
        props.push(make(ox + px, oz + pz));
      }
    });

    const blockades = z.blockades.map((b) => {
      const [bx, bz] = xz(b.pos);
      return { id: b.id, x: ox + bx, z: oz + bz, text: b.text, release: b.release, points: b.points };
    });
    const hints = z.hints.map((h) => {
      const [hx, hz] = xz(h.pos);
      return { id: h.id, x: ox + hx, z: oz + hz, line: h.line ?? 'hint', radius: h.radius };
    });
    const hiddenPaths = z.hiddenPaths.map((hp: HiddenPathSpec) => {
      const pts = resample(
        hp.points.map((q) => [ox + q[0], oz + q[1]] as [number, number]),
        hp.spacing ?? 1.3,
      );
      return pts;
    });
    const fogWalls = z.fogWalls.map((f) => {
      const [fx, fz] = xz(f.pos);
      return { id: f.id, x: ox + fx, z: oz + fz, size: f.size ?? 2, stretch: f.stretch ?? 1.5 };
    });

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const grow = (x: number, zz: number, pad = 0): void => {
      minX = Math.min(minX, x - pad);
      maxX = Math.max(maxX, x + pad);
      minZ = Math.min(minZ, zz - pad);
      maxZ = Math.max(maxZ, zz + pad);
    };
    for (const a of z.areas) {
      grow(ox + a[0], oz + a[1]);
      grow(ox + a[2], oz + a[3]);
    }
    for (const p of props) grow(p.x, p.z, p.height * 0.6);
    for (const b of blockades) grow(b.x, b.z, 4);
    for (const f of fogWalls) grow(f.x, f.z, 4 * f.size);

    zones.set(z.id, {
      spec: z,
      ox,
      oz,
      bounds: { minX, maxX, minZ, maxZ },
      props,
      ground: z.ground,
      blockades,
      hints,
      hiddenPaths,
      fogWalls,
    });
  }

  const startZone = zones.get(spec.playerStart.zone)!;
  const [sx, sz] = xz(spec.playerStart.pos);
  return { spec, zones, start: { zone: startZone.spec.id, x: startZone.ox + sx, z: startZone.oz + sz } };
}

/** Fills the walk map from the chapter: areas, paths, rivers, fords and prop colliders. */
export function buildWalkability(ch: ResolvedChapter, walk: Walkability): void {
  const spec = ch.spec;
  for (const z of ch.zones.values()) {
    for (const a of z.spec.areas) {
      walk.areas.push({ minX: z.ox + a[0], minZ: z.oz + a[1], maxX: z.ox + a[2], maxZ: z.oz + a[3] });
    }
    for (const g of z.ground) {
      if (g.type === 'path' && g.walkable) addPolyline(walk.corridors, g.points, z.ox, z.oz, g.width / 2);
      if (g.type === 'water' && g.blocks !== false) addPolyline(walk.blockers, g.points, z.ox, z.oz, g.width / 2 - 0.4);
    }
    for (const [px, pz, r] of z.spec.passages) walk.passages.push({ x: z.ox + px, z: z.oz + pz, r });
    for (const p of z.props) {
      const meta = spec.assets[p.asset] ?? DEFAULT_META;
      const k = p.height / meta.height;
      if (!p.collide) continue;
      if (meta.colliders) {
        for (const [dx, dz, r] of meta.colliders) {
          walk.colliders.push({ x: p.x + dx * k * (p.mirror ? -1 : 1), z: p.z + dz * k, r: r * k });
        }
      } else if (meta.collider) {
        walk.colliders.push({ x: p.x, z: p.z, r: meta.collider * k });
      }
    }
  }
  for (const p of spec.terrain.paths) {
    if (p.walkable !== false) addPolyline(walk.corridors, p.points, 0, 0, p.width / 2);
  }
  for (const w of spec.terrain.water) addPolyline(walk.blockers, w.points, 0, 0, w.width / 2 - 0.4);
  for (const [x, z, r] of spec.terrain.passages) walk.passages.push({ x, z, r });
  if (spec.gate) {
    const meta = spec.assets[spec.gate.asset] ?? DEFAULT_META;
    const k = spec.gate.height / meta.height;
    for (const [dx, dz, r] of meta.colliders ?? []) {
      walk.colliders.push({ x: spec.gate.pos[0] + dx * k, z: spec.gate.pos[1] + dz * k, r: r * k });
    }
  }
}

function addPolyline(out: Segment[], points: Vec2[], ox: number, oz: number, halfWidth: number): void {
  const pts = resample(
    points.map((p) => [ox + p[0], oz + p[1]] as [number, number]),
    2,
  );
  for (let i = 0; i < pts.length - 1; i++) {
    out.push({ ax: pts[i]![0], az: pts[i]![1], bx: pts[i + 1]![0], bz: pts[i + 1]![1], halfWidth });
  }
}
