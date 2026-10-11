import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { PALETTE, color4 } from '../config/palette';
import type { AssetLoader } from '../core/AssetLoader';
import type { TerrainSpec } from '../types/chapter';
import { createPaperMaterial, setPaperUv, type PaperMaterial } from '../shaders/paperShader';
import { createGroundRect, createRibbon, createWall, curveSafeBounds } from './Ground';
import { procTexture } from './ProceduralTextures';

/** Draw order for flat things lying on the ground: after the backdrop, before fog. */
export const GROUND_OVERLAY_ALPHA_INDEX = 5;

/**
 * Region-wide ground that never streams: the base grass, the paths between zones,
 * the river and the chasm. Few meshes, few draw calls.
 */
export class Terrain {
  private readonly meshes: Mesh[] = [];
  private readonly flowing: { mat: PaperMaterial; tile: number; speed: [number, number]; scale: [number, number] }[] = [];
  private time = 0;

  constructor(
    private readonly scene: Scene,
    private readonly assets: AssetLoader,
  ) {}

  async build(spec: TerrainSpec): Promise<void> {
    const scene = this.scene;
    // Base ground: all rectangles with the same texture become one mesh.
    const byTexture = new Map<string, { rect: [number, number, number, number]; tile?: number }[]>();
    for (const g of spec.ground) {
      const list = byTexture.get(g.texture) ?? [];
      list.push(g);
      byTexture.set(g.texture, list);
    }
    for (const [texture, rects] of byTexture) {
      const img = await this.assets.acquire(texture, { wrap: true, anisotropy: 4 });
      const parts = rects.map((g, i) => {
        const [x0, z0, x1, z1] = g.rect;
        return createGroundRect(`ground:${texture}:${i}`, scene, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0, 3);
      });
      const merged = Mesh.MergeMeshes(parts, true, true) ?? parts[0]!;
      merged.name = `ground:${texture}`;
      merged.material = createPaperMaterial(`groundMat:${texture}`, scene, {
        texture: img.texture,
        worldTile: rects[0]?.tile ?? TUNING.ground.grassTile,
      });
      this.meshes.push(merged);
    }

    for (const [i, p] of spec.paths.entries()) {
      const img = await this.assets.acquire(p.texture, { wrap: true, anisotropy: 4 });
      const { mesh, length } = createRibbon(`path:${i}`, scene, p.points, p.width, 0.02);
      mesh.material = createPaperMaterial(`pathMat:${i}`, scene, {
        texture: img.texture,
        worldTile: p.tile ?? TUNING.ground.pathTile,
        alphaBlend: true,
        ribbonEdge: { across: TUNING.ground.edgeSoftness / p.width, ends: 1.5, length },
      });
      mesh.alphaIndex = GROUND_OVERLAY_ALPHA_INDEX;
      this.meshes.push(mesh);
    }

    for (const [i, w] of spec.water.entries()) {
      const img = await this.assets.acquire(w.texture, { wrap: true });
      const { mesh, length } = createRibbon(`water:${i}`, scene, w.points, w.width, 0.03);
      const tile = w.tile ?? TUNING.ground.waterTile;
      const mat = createPaperMaterial(`waterMat:${i}`, scene, {
        texture: img.texture,
        worldTile: tile,
        water: true,
        alphaBlend: true,
        ribbonEdge: { across: 0.9 / w.width, ends: 0.8, length },
      });
      mesh.material = mat;
      mesh.alphaIndex = GROUND_OVERLAY_ALPHA_INDEX + 1;
      this.meshes.push(mesh);
      // The river runs toward its last point.
      const a = w.points[0]!;
      const b = w.points[w.points.length - 1]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      this.flowing.push({
        mat,
        tile,
        speed: [((b[0] - a[0]) / len) * -TUNING.ground.waterFlowSpeed, ((b[1] - a[1]) / len) * -TUNING.ground.waterFlowSpeed],
        scale: [1 / tile, 1 / tile],
      });
    }

    for (const [i, c] of spec.chasms.entries()) await this.buildChasm(i, c);
    this.finish();
  }

  private async buildChasm(index: number, c: TerrainSpec['chasms'][number]): Promise<void> {
    const scene = this.scene;
    const [x0, z0, x1, z1] = c.rect;
    const depth = c.depth;
    const cliffTex = procTexture(scene, 'cliff');
    const cliffMat = createPaperMaterial(`cliffMat:${index}`, scene, { texture: cliffTex });
    setPaperUv(cliffMat, 1, 1, 0, 0);
    // Far wall faces the camera; the two ends close the chasm. One mesh.
    const far = createWall(`chasm:${index}:far`, scene, x0, z1, x1, z1, 0.02, -depth, 3);
    const west = createWall(`chasm:${index}:west`, scene, x0, z0, x0, z1, 0.02, -depth, 3);
    const east = createWall(`chasm:${index}:east`, scene, x1, z1, x1, z0, 0.02, -depth, 3);
    const walls = Mesh.MergeMeshes([far, west, east], true, true)!;
    walls.name = `chasm:${index}:walls`;
    walls.material = cliffMat;
    this.meshes.push(walls);

    // Deep floor in soft powder blue, and a veil of mist across the middle.
    const floor = createGroundRect(`chasm:${index}:floor`, scene, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, -depth, 4);
    floor.material = createPaperMaterial(`chasmFloorMat:${index}`, scene, { color: color4(PALETTE.powder) });
    this.meshes.push(floor);
    const mistMat = createPaperMaterial(`chasmMistMat:${index}`, scene, {
      texture: procTexture(scene, 'mist'),
      alphaBlend: true,
    });
    const veils = [0.3, 0.72].map((t, k) => {
      const z = z0 + (z1 - z0) * t;
      return createWall(`chasm:${index}:mist${k}`, scene, x0, z, x1, z, -depth * 0.25, -depth, 4);
    });
    const veil = Mesh.MergeMeshes(veils, true, true)!;
    veil.name = `chasm:${index}:mist`;
    veil.material = mistMat;
    veil.alphaIndex = GROUND_OVERLAY_ALPHA_INDEX;
    this.meshes.push(veil);
    setPaperUv(mistMat, 0, 1, 0, 0);

    for (const [k, f] of (c.waterfalls ?? []).entries()) {
      const img = await this.assets.acquire('textures/ground_water', { wrap: true });
      const fall = MeshBuilder.CreatePlane(`chasm:${index}:fall${k}`, { width: f.width, height: depth + 0.4 }, scene);
      fall.position.set(f.x, -depth / 2 + 0.2, z1 - 0.08);
      const mat = createPaperMaterial(`fallMat:${index}:${k}`, scene, {
        texture: img.texture,
        water: true,
        alphaBlend: true,
        ribbonEdge: { across: 0.22, ends: 0.05, length: 1 },
        color: new Color4(1.08, 1.1, 1.12, 0.92),
      });
      fall.material = mat;
      fall.alphaIndex = GROUND_OVERLAY_ALPHA_INDEX + 1;
      fall.isPickable = false;
      fall.alwaysSelectAsActiveMesh = true;
      this.meshes.push(fall);
      this.flowing.push({ mat, tile: 1, speed: [0, 0.9], scale: [f.width / 5, (depth + 0.4) / 5] });
    }
  }

  /** After building: let the camera skip pieces that are off screen. */
  finish(): void {
    for (const m of this.meshes) {
      m.isPickable = false;
      curveSafeBounds(m);
      m.freezeWorldMatrix();
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (const f of this.flowing) {
      setPaperUv(f.mat, f.scale[0], f.scale[1], f.speed[0] * this.time, f.speed[1] * this.time);
    }
  }
}
