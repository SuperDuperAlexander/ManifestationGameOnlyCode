import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Constants } from '@babylonjs/core/Engines/constants';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE, SHADES } from '../config/palette';
import { createToonMaterial, type ToonMaterial } from '../shaders/toonShader';
import { createPaperMaterial, setPaperColor, type PaperMaterial } from '../shaders/paperShader';
import { procTexture } from '../world/ProceduralTextures';
import { damp } from '../core/Random';
import { TUNING } from '../config/tuning';

export interface PlayerVisualState {
  /** Ground speed, m/s. */
  speed: number;
  /** 0..1 share of the walk speed. */
  speedRatio: number;
  /** Facing angle around Y. 0 = north (+z). */
  heading: number;
  /** 0..1, how full the breath is. */
  breathLevel: number;
  /** 0..1 extra glow while inhaling. */
  glow: number;
  /** 0 = lying on the meadow, 1 = standing. */
  awake: number;
}

/**
 * The player's look. Kept behind this small interface so it can be swapped
 * for a GLB model later without touching the controller.
 */
export interface IPlayerVisual {
  readonly root: TransformNode;
  update(dt: number, state: PlayerVisualState): void;
  dispose(): void;
}

/**
 * A small figure in a red hooded cloak, built from primitives.
 * Animation is all code: walk bob, cloak sway, stepping feet, idle breathing, glow.
 */
export class PlayerVisual implements IPlayerVisual {
  readonly root: TransformNode;
  private readonly body: TransformNode;
  private readonly cloak: Mesh;
  private readonly hoodGroup: TransformNode;
  private readonly scarfTail: Mesh;
  private readonly feet: Mesh[] = [];
  private readonly shadow: Mesh;
  private readonly halo: Mesh;
  private readonly toonMats: ToonMaterial[] = [];
  private readonly haloMat: PaperMaterial;
  private phase = 0;
  private sway = 0;
  private time = 0;
  private lastHeading = 0;
  private turnRate = 0;

  constructor(scene: Scene) {
    this.root = new TransformNode('player', scene);
    this.body = new TransformNode('player.body', scene);
    this.body.parent = this.root;
    this.root.scaling.setAll(TUNING.player.visualScale);

    // One toon material for the whole figure. Colours are painted into the vertices,
    // so parts that move together are one mesh and one draw call.
    const mat = this.toon('figure');

    // Body: cloak (a lathe, wide at the hem), scarf wrap and the gold diamond on the back.
    const profile = [
      new Vector3(0.0, 0.03, 0),
      new Vector3(0.4, 0.03, 0),
      new Vector3(0.41, 0.08, 0),
      new Vector3(0.36, 0.2, 0),
      new Vector3(0.28, 0.42, 0),
      new Vector3(0.21, 0.6, 0),
      new Vector3(0.17, 0.7, 0),
      new Vector3(0.1, 0.76, 0),
      new Vector3(0.0, 0.78, 0),
    ];
    const cloak = paint(MeshBuilder.CreateLathe('player.cloakPart', { shape: profile, tessellation: 22, cap: 0 }, scene), PALETTE.cloak);
    const collar = paint(
      MeshBuilder.CreateTorus('player.collar', { diameter: 0.4, thickness: 0.12, tessellation: 20 }, scene),
      SHADES.scarf,
    );
    collar.position.set(0, 0.7, 0.01);
    collar.scaling.y = 0.75;
    const emblem = paint(MeshBuilder.CreatePolyhedron('player.emblem', { type: 1, size: 0.055 }, scene), PALETTE.gold);
    emblem.scaling.set(0.7, 1.1, 0.25);
    emblem.position.set(0, 0.44, -0.3);
    this.cloak = merge('player.cloak', [cloak, collar, emblem]);
    this.cloak.material = mat;
    this.cloak.parent = this.body;

    // Hood: big and round with a soft point that leans back, like the reference art.
    // Face: a deep shadow in the hood opening, seen when walking toward the camera.
    this.hoodGroup = new TransformNode('player.hoodGroup', scene);
    this.hoodGroup.parent = this.body;
    this.hoodGroup.position.set(0, 0.9, 0);
    const hood = paint(MeshBuilder.CreateSphere('player.hoodPart', { diameter: 0.5, segments: 16 }, scene), '#C24A34');
    hood.scaling.set(1, 0.98, 1.04);
    const tip = paint(
      MeshBuilder.CreateCylinder('player.hoodTip', { diameterTop: 0, diameterBottom: 0.3, height: 0.3, tessellation: 14 }, scene),
      '#C24A34',
    );
    tip.position.set(0, 0.21, -0.07);
    tip.rotation.x = -0.5;
    const face = paint(MeshBuilder.CreateSphere('player.face', { diameter: 0.34, segments: 12 }, scene), SHADES.umber);
    face.scaling.set(0.95, 0.9, 0.4);
    face.position.set(0, -0.04, 0.2);
    const hoodMesh = merge('player.hood', [hood, tip, face]);
    hoodMesh.material = mat;
    hoodMesh.parent = this.hoodGroup;

    // Scarf tail: trails behind and sways.
    this.scarfTail = paint(MeshBuilder.CreateBox('player.scarfTail', { width: 0.13, height: 0.5, depth: 0.035 }, scene), SHADES.scarf);
    this.scarfTail.bakeTransformIntoVertices(Matrix.Translation(0, -0.25, 0));
    this.scarfTail.position.set(0.12, 0.72, -0.2);
    this.scarfTail.material = mat;
    this.scarfTail.parent = this.body;

    // Feet.
    for (const side of [-1, 1]) {
      const foot = paint(MeshBuilder.CreateSphere(`player.foot${side}`, { diameter: 0.2, segments: 8 }, scene), SHADES.umber);
      foot.scaling.set(0.62, 0.42, 0.9);
      foot.position.set(0.11 * side, 0.04, 0.05);
      foot.material = mat;
      foot.parent = this.root;
      this.feet.push(foot);
    }

    // Soft blob shadow on the ground.
    this.shadow = MeshBuilder.CreateGround('player.shadow', { width: 1.1, height: 0.9 }, scene);
    this.shadow.position.y = 0.03;
    this.shadow.material = createPaperMaterial('player.shadowMat', scene, {
      texture: procTexture(scene, 'shadow'),
      alphaBlend: true,
    });
    this.shadow.parent = this.root;

    // Warm halo around the figure. Visible while inhaling.
    this.haloMat = createPaperMaterial('player.haloMat', scene, {
      texture: procTexture(scene, 'aura'),
      additive: true,
      haze: false,
    });
    // Light is not hidden by the ground it stands on.
    this.haloMat.depthFunction = Constants.ALWAYS;
    this.halo = MeshBuilder.CreatePlane('player.halo', { size: 2.6 }, scene);
    this.halo.position.set(0, 0.6, 0);
    this.halo.billboardMode = TransformNode.BILLBOARDMODE_ALL;
    this.halo.material = this.haloMat;
    this.halo.parent = this.root;
    this.halo.isVisible = false;

    for (const m of this.root.getChildMeshes()) {
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true;
    }
  }

  private toon(name: string): ToonMaterial {
    // With vertex colours, the two colours are multipliers: lit side and shadow side.
    const mat = createToonMaterial(`player.${name}`, this.root.getScene(), new Color3(1, 1, 1), new Color3(0.66, 0.5, 0.5));
    this.toonMats.push(mat);
    return mat;
  }

  update(dt: number, s: PlayerVisualState): void {
    this.time += dt;
    const moving = s.speedRatio;

    // Heading, with a little lean into turns.
    const dh = Math.atan2(Math.sin(s.heading - this.lastHeading), Math.cos(s.heading - this.lastHeading));
    this.lastHeading = s.heading;
    this.turnRate += ((dt > 0 ? dh / dt : 0) - this.turnRate) * damp(6, dt);
    this.root.rotation.y = s.heading;

    // Step cycle follows the distance walked.
    this.phase += s.speed * dt * 4.2;
    const step = Math.sin(this.phase);
    const bob = Math.abs(Math.cos(this.phase)) * 0.045 * moving;

    // Idle breathing: a slow, small swell. Inhaling fills the figure a little.
    const idle = Math.sin(this.time * 1.7) * 0.012 * (1 - moving);
    const breathSwell = s.breathLevel * 0.045;

    // Waking up: lying curled on the grass, then rising.
    const awake = s.awake;
    const lie = 1 - awake;
    this.body.position.y = bob - lie * 0.32;
    this.body.rotation.x = lie * 1.2;
    this.body.scaling.set(1 + breathSwell * 0.6, 1 + idle + breathSwell, 1 + breathSwell * 0.6);

    // Cloak sways back with speed and swings with the steps.
    this.sway += (moving * 0.16 - this.sway) * damp(5, dt);
    this.cloak.rotation.x = -this.sway * 0.6;
    this.cloak.rotation.z = step * 0.05 * moving - this.turnRate * 0.02;
    this.hoodGroup.rotation.x = -this.sway * 0.25 + Math.sin(this.time * 1.1) * 0.015;
    this.hoodGroup.rotation.z = -step * 0.04 * moving;

    // Scarf tail flutters more when walking.
    this.scarfTail.rotation.x = 0.25 + this.sway * 4 + Math.sin(this.time * 7 + 1) * 0.12 * (0.3 + moving);
    this.scarfTail.rotation.z = Math.sin(this.time * 3.3) * 0.12 + this.turnRate * 0.05;

    // Feet step forward and back, lifting a little.
    for (let i = 0; i < this.feet.length; i++) {
      const foot = this.feet[i]!;
      const p = i === 0 ? step : -step;
      foot.position.z = 0.05 + p * 0.15 * moving;
      foot.position.y = 0.04 + Math.max(0, p) * 0.06 * moving;
      foot.isVisible = awake > 0.5;
    }

    // Glow while inhaling.
    const glow = Math.max(s.glow, 0);
    for (const m of this.toonMats) m.glow = glow * 0.45;
    this.halo.isVisible = glow > 0.02;
    setPaperColor(this.haloMat, new Color4(1, 1, 1, Math.min(0.6, glow * 0.8)));
    const hs = 0.9 + glow * 0.5;
    this.halo.scaling.set(hs, hs, hs);
  }

  dispose(): void {
    this.root.dispose(false, false);
  }
}

/** Paints a mesh in one colour (vertex colours). */
function paint(mesh: Mesh, hex: string): Mesh {
  const c = Color3.FromHexString(hex);
  const count = mesh.getTotalVertices();
  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b, 1], i * 4);
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  return mesh;
}

/** Bakes the parts' transforms and merges them into one mesh. */
function merge(name: string, parts: Mesh[]): Mesh {
  const merged = Mesh.MergeMeshes(parts, true, true)!;
  merged.name = name;
  return merged;
}
