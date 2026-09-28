import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Material } from '@babylonjs/core/Materials/material';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { Scene } from '@babylonjs/core/scene';
// The engine is loaded piece by piece, so the pieces the world uses have to
// be asked for. These two add methods to Mesh rather than exporting anything.
import '@babylonjs/core/Meshes/instancedMesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import type { Geo } from './geometry';

/**
 * The small layer between the world and the engine.
 *
 * Everything in `src/world` builds shapes and puts them somewhere. This is
 * all it needs to do that: a group, a mesh from generated geometry, a
 * palette colour in the light the shaders work in, and the scene they all
 * go into. Nothing else in the world folder talks to the engine directly.
 */

/**
 * A node that carries other nodes.
 *
 * `visible` turns the whole group off rather than making it transparent, so
 * a hidden group costs nothing to draw and nothing to update.
 */
export class Group extends TransformNode {
  constructor(name: string, scene: Scene) {
    super(name, scene);
  }

  get visible(): boolean {
    return this.isEnabled(false);
  }

  set visible(on: boolean) {
    this.setEnabled(on);
  }

  /** Puts a node inside this group. */
  add(...children: TransformNode[]): void {
    for (const child of children) child.parent = this;
  }
}

/**
 * Which way round a front face is wound.
 *
 * Every shape in `geometry.ts` winds its front faces counter-clockwise, the
 * way a right-handed world with y up expects. The engine assumes the other
 * way round unless it is told, and the result of getting this wrong is not a
 * subtle one: the ground disappears and everything closed is lit from the
 * inside. It is set on each mesh here and on each material that culls,
 * because a copy of a mesh carries the material's answer, not the mesh's.
 */
export const FRONT_FACE = Material.CounterClockWiseSideOrientation;

/** Builds a mesh from generated geometry. */
export function meshFrom(name: string, geo: Geo, scene: Scene): Mesh {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = geo.positions;
  data.normals = geo.normals;
  data.uvs = geo.uvs;
  data.indices =
    geo.indices.length > 0
      ? geo.indices
      : Array.from({ length: geo.positions.length / 3 }, (_, i) => i);
  data.applyToMesh(mesh, false);
  mesh.sideOrientation = FRONT_FACE;
  return mesh;
}

/** Adds per-vertex colours to a mesh. Alpha is always 1; nothing here is see-through. */
export function setVertexColors(mesh: Mesh, rgb: number[]): void {
  const count = rgb.length / 3;
  const rgba = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    rgba[i * 4] = rgb[i * 3] ?? 0;
    rgba[i * 4 + 1] = rgb[i * 3 + 1] ?? 0;
    rgba[i * 4 + 2] = rgb[i * 3 + 2] ?? 0;
    rgba[i * 4 + 3] = 1;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, rgba, false, 4);
  mesh.hasVertexAlpha = false;
}

/**
 * A palette colour, in the light the shaders work in.
 *
 * Every colour in the palette is written the way a designer reads it, which
 * is sRGB. Light does not add up in sRGB: two half-bright lamps there make
 * something brighter than one full one. So every colour is converted once,
 * here, and the final pass converts the whole picture back at the end.
 *
 * The curve is the real sRGB transfer function, not the 2.2 power that is
 * often used for it. The difference shows in the dark greys the valley
 * starts in, which is most of the first ten minutes of the game.
 */
function srgbToLinear(channel: number): number {
  return channel < 0.04045
    ? channel * 0.0773993808
    : Math.pow(channel * 0.9478672986 + 0.0521327014, 2.4);
}

/** A palette entry, as a linear colour. Accepts `#rrggbb` or a hex number. */
export function linearColor(value: string | number): Color3 {
  const hex = typeof value === 'number' ? value : parseInt(value.replace('#', ''), 16);
  return new Color3(
    srgbToLinear(((hex >> 16) & 255) / 255),
    srgbToLinear(((hex >> 8) & 255) / 255),
    srgbToLinear((hex & 255) / 255),
  );
}

/** Mixes two colours and returns a new one. */
export function mixColor(a: Color3, b: Color3, t: number): Color3 {
  return new Color3(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

/** Mixes into an existing colour, so no garbage is made in the game loop. */
export function mixColorTo(out: Color3, a: Color3, b: Color3, t: number): Color3 {
  out.r = a.r + (b.r - a.r) * t;
  out.g = a.g + (b.g - a.g) * t;
  out.b = a.b + (b.b - a.b) * t;
  return out;
}

/** Every mesh under a node, the node itself included. */
export function meshesIn(node: TransformNode): Mesh[] {
  const out: Mesh[] = [];
  if (node instanceof Mesh) out.push(node);
  for (const child of node.getChildMeshes(false)) {
    if (child instanceof Mesh) out.push(child);
  }
  return out;
}

export { Vector3, Color3 };

/**
 * The scene the world is being built into.
 *
 * One page load is one scene, the same way one page load is one place, so
 * this is set once before anything is built and never changes under anyone.
 * Holding it here keeps every builder in `src/world` free of engine plumbing:
 * they ask for a shape and get one.
 */
let activeScene: Scene | null = null;

export function setStage(scene: Scene): void {
  activeScene = scene;
}

export function stage(): Scene {
  if (!activeScene) throw new Error('no scene set');
  return activeScene;
}

/** A group in the active scene. */
export function group(name: string): Group {
  return new Group(name, stage());
}

/** A mesh in the active scene. */
export function mesh(name: string, geo: Geo): Mesh {
  return meshFrom(name, geo, stage());
}
