import { Constants } from '@babylonjs/core/Engines/constants';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Material } from '@babylonjs/core/Materials/material';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { PALETTE } from '../content/palette';
import { clamp01, makeRng } from '../core/math';
import { worldMaterial } from '../render/materials';
import { circleGeo, coneGeo, sphereGeo } from '../render/geometry';
import type { Group } from '../render/scene3d';
import {
  FRONT_FACE,
  group,
  linearColor,
  mesh as makeMesh,
  mixColor,
  stage,
} from '../render/scene3d';
import { buildTree } from './props';

const GOLD = linearColor(PALETTE.receiveGold);
const HALO = 'lwHalo';

/** A small additive point of light. Used for every mote in the game. */
export function makeMoteMaterial(color: Color3): StandardMaterial {
  const material = new StandardMaterial('mote', stage());
  material.emissiveColor = color;
  material.diffuseColor = new Color3(0, 0, 0);
  material.specularColor = new Color3(0, 0, 0);
  material.disableLighting = true;
  material.alphaMode = Constants.ALPHA_ADD;
  material.alpha = 1;
  material.disableDepthWrite = true;
  material.fogEnabled = false;
  material.sideOrientation = FRONT_FACE;
  // A mote is fully opaque light: its alpha is 1 and it is added to what is
  // behind it. The engine works out on its own whether a surface needs
  // blending, and a surface at full alpha does not, so it is told.
  material.needAlphaBlending = (): boolean => true;
  return material;
}

/**
 * A halo: a sphere seen from the inside, brightest at its silhouette.
 *
 * Only the far side of the sphere is drawn, so the glow reads as light
 * gathered behind whatever it surrounds rather than as a bubble over it.
 */
Effect.ShadersStore[`${HALO}VertexShader`] = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec3 normal;
  uniform mat4 world;
  uniform mat4 viewProjection;
  uniform vec3 cameraPosition;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 w = world * vec4(position, 1.0);
    vN = normalize(mat3(world[0].xyz, world[1].xyz, world[2].xyz) * normal);
    vV = normalize(cameraPosition - w.xyz);
    gl_Position = viewProjection * w;
  }
`;

Effect.ShadersStore[`${HALO}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec3 vN;
  varying vec3 vV;
  uniform vec3 uColor;
  uniform float uStrength;
  uniform float uPower;
  uniform float uScale;
  void main() {
    float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    // A tight rim keeps the glow a halo and never a solid dome.
    gl_FragColor = vec4(uColor, pow(rim, uPower) * uStrength * uScale);
  }
`;

/** A halo material. `power` sets how tight the rim is, `scale` how strong. */
function haloMaterial(name: string, color: Color3, power: number, scale: number): ShaderMaterial {
  const material = new ShaderMaterial(
    name,
    stage(),
    { vertex: HALO, fragment: HALO },
    {
      attributes: ['position', 'normal'],
      uniforms: [
        'world',
        'viewProjection',
        'cameraPosition',
        'uColor',
        'uStrength',
        'uPower',
        'uScale',
      ],
      needAlphaBlending: true,
    },
  );
  material.setColor3('uColor', color);
  material.setFloat('uStrength', 0);
  material.setFloat('uPower', power);
  material.setFloat('uScale', scale);
  material.alphaMode = Constants.ALPHA_ADD;
  material.disableDepthWrite = true;
  material.fogEnabled = false;
  // The far side of the sphere only.
  material.sideOrientation = Material.ClockWiseSideOrientation;
  return material;
}

/** One pooled mote, plus where it came from and where it is going. */
interface LiveMote {
  mesh: Mesh;
  from: Vector3;
  rise: Vector3;
  time: number;
  duration: number;
  onArrive: (() => void) | null;
}

/**
 * Light motes that rise from a source and flow into the player.
 * One pool serves every spring and the fog.
 */
export class MoteFlow {
  readonly group: Group;
  private readonly pool: Mesh[] = [];
  private readonly live: LiveMote[] = [];
  private readonly a = new Vector3();
  private readonly b = new Vector3();

  constructor(size: number) {
    this.group = group('motes');
    const geo = sphereGeo(0.11, 8, 6);
    const material = makeMoteMaterial(GOLD);
    const first = makeMesh('mote', geo);
    first.material = material;
    first.setEnabled(false);
    first.parent = this.group;
    this.pool.push(first);
    for (let i = 1; i < size; i++) {
      const copy = first.clone(`mote-${String(i)}`);
      copy.setEnabled(false);
      copy.parent = this.group;
      this.pool.push(copy);
    }
  }

  /** Sends one mote from a point to the player. */
  send(from: Vector3, duration: number, onArrive: (() => void) | null): void {
    const mesh = this.pool.find((m) => !m.isEnabled(false));
    if (!mesh) {
      onArrive?.();
      return;
    }
    mesh.setEnabled(true);
    mesh.position.copyFrom(from);
    this.live.push({
      mesh,
      from: from.clone(),
      // It rises first, then curves toward the player.
      rise: new Vector3(
        from.x + (Math.random() - 0.5) * 1.4,
        from.y + 1.9 + Math.random(),
        from.z + (Math.random() - 0.5) * 1.4,
      ),
      time: 0,
      duration,
      onArrive,
    });
  }

  update(dt: number, target: Vector3): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const m = this.live[i];
      if (!m) continue;
      m.time += dt;
      const t = Math.min(1, m.time / m.duration);
      // A simple curve: source, a point above it, then the player.
      Vector3.LerpToRef(m.from, m.rise, t, this.a);
      Vector3.LerpToRef(m.rise, target, t, this.b);
      Vector3.LerpToRef(this.a, this.b, t, m.mesh.position);
      m.mesh.scaling.setAll(0.7 + Math.sin(t * Math.PI) * 0.8);
      if (t >= 1) {
        m.mesh.setEnabled(false);
        m.onArrive?.();
        this.live.splice(i, 1);
      }
    }
  }

  get busy(): number {
    return this.live.length;
  }
}

/** The glow a spring shows. It stays gentle once the spring is empty. */
export class SpringGlow {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private time = 0;

  constructor() {
    this.mesh = makeMesh('springGlow', sphereGeo(1, 16, 12));
    this.material = haloMaterial('springGlow', GOLD, 3.4, 0.22);
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    this.mesh.setEnabled(false);
  }

  setStrength(value: number, radius: number): void {
    this.mesh.setEnabled(value > 0.01);
    this.mesh.scaling.setAll(radius);
    this.material.setFloat('uStrength', value);
  }

  update(dt: number): void {
    this.time += dt;
    if (!this.mesh.isEnabled(false)) return;
    // A slow breath of its own, so it never looks like a hard marker.
    this.mesh.scaling.scaleInPlace(1 + Math.sin(this.time * 0.9) * 0.0016);
  }
}

/** One puff of a drifting cloud, and where it wants to sit. */
interface Puff {
  mesh: Mesh;
  base: Vector3;
  phase: number;
}

/** Builds a bank of puffs sharing one material. */
function buildPuffs(
  parent: Group,
  material: Material,
  count: number,
  segments: [number, number],
  make: (rng: () => number, i: number) => { base: Vector3; scale: Vector3; phase: number },
  seed: number,
): Puff[] {
  const rng = makeRng(seed);
  const geo = sphereGeo(1, segments[0], segments[1]);
  const puffs: Puff[] = [];
  const first = makeMesh('puff', geo);
  first.material = material;
  first.isPickable = false;
  for (let i = 0; i < count; i++) {
    const mesh = i === 0 ? first : first.clone(`puff-${String(i)}`);
    const spec = make(rng, i);
    mesh.position.copyFrom(spec.base);
    mesh.scaling.copyFrom(spec.scale);
    mesh.parent = parent;
    mesh.isPickable = false;
    puffs.push({ mesh, base: spec.base, phase: spec.phase });
  }
  return puffs;
}

/**
 * Soft drifting cloud: the fog, the waking mist and the feeling weathers all
 * share it. Softest at the silhouette, so a bank of these reads as cloud
 * instead of a row of bubbles.
 */
const FOG = 'lwFog';

Effect.ShadersStore[`${FOG}VertexShader`] = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec3 normal;
  uniform mat4 world;
  uniform mat4 viewProjection;
  uniform vec3 cameraPosition;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vL;
  void main() {
    vec4 w = world * vec4(position, 1.0);
    vN = normalize(mat3(world[0].xyz, world[1].xyz, world[2].xyz) * normal);
    vV = normalize(cameraPosition - w.xyz);
    vL = position;
    gl_Position = viewProjection * w;
  }
`;
Effect.ShadersStore[`${FOG}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vL;
  uniform vec3 uColor;
  uniform float uDensity;
  uniform float uTime;
  uniform vec3 uLift;
  uniform float uAlpha;
  uniform float uCap;
  uniform vec2 uCurve;
  uniform vec2 uDrift;
  uniform float uTint;
  void main() {
    // Soft at the rim, denser toward the middle. Nothing hard-edged.
    // The two clouds fall off differently and both are worth keeping: the
    // fog thins away from its middle, the mist the player wakes in holds
    // together further out. uCurve.y picks which, uCurve.x how sharply.
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float dense = mix(pow(facing, uCurve.x), 1.0 - pow(1.0 - facing, uCurve.x), uCurve.y);
    float drift = uDrift.x + uDrift.y * sin(uTime * 0.5 + vL.y * 1.6 + vL.x);
    float a = dense * uAlpha * uDensity * drift;
    vec3 col = mix(uColor, uLift * (0.8 + 0.3 * facing), uTint);
    gl_FragColor = vec4(col, clamp(a, 0.0, uCap));
  }
`;

interface HazeOptions {
  /** How sharply the cloud thins toward its silhouette. */
  power: number;
  /** 1 thins away from the middle, 0 holds together further out. */
  invert: number;
  /** The slow roll: a base and how far it moves. */
  drift: [number, number];
  /** Peak alpha of one puff, and the cap on it. */
  alpha: number;
  cap: number;
  /** A paler colour the cloud is lifted toward, if it has one. */
  lift?: Color3;
}

/** A soft cloud material: the fog and the waking mist. */
function hazeMaterial(name: string, color: Color3, options: HazeOptions): ShaderMaterial {
  const material = new ShaderMaterial(
    name,
    stage(),
    { vertex: FOG, fragment: FOG },
    {
      attributes: ['position', 'normal'],
      uniforms: [
        'world',
        'viewProjection',
        'cameraPosition',
        'uColor',
        'uDensity',
        'uTime',
        'uLift',
        'uAlpha',
        'uCap',
        'uCurve',
        'uDrift',
        'uTint',
      ],
      needAlphaBlending: true,
    },
  );
  material.setColor3('uColor', color);
  material.setColor3('uLift', options.lift ?? color);
  material.setFloat('uTint', options.lift ? 1 : 0);
  material.setFloat('uDensity', 1);
  material.setFloat('uTime', 0);
  material.setFloat('uAlpha', options.alpha);
  material.setFloat('uCap', options.cap);
  material.setVector2('uCurve', new Vector2(options.power, options.invert));
  material.setVector2('uDrift', new Vector2(options.drift[0], options.drift[1]));
  material.alphaMode = Constants.ALPHA_COMBINE;
  material.disableDepthWrite = true;
  material.backFaceCulling = false;
  material.fogEnabled = false;
  return material;
}

/**
 * The fog on the narrow path. It is soft and melancholic: a slow drifting
 * cloud in the blockage blue, never sharp and never frightening.
 */
export class FogVolume {
  readonly group: Group;
  private readonly material: ShaderMaterial;
  private readonly puffs: Puff[];
  private time = 0;

  constructor(radius: number) {
    this.group = group('fog');
    this.material = hazeMaterial('fog', linearColor(PALETTE.blockage), {
      power: 0.6,
      invert: 1,
      drift: [0.85, 0.15],
      alpha: 0.28,
      cap: 0.5,
      // Lift the blockage blue toward a pale, melancholic haze.
      lift: mixColor(linearColor(PALETTE.blockage), new Color3(0.52, 0.56, 0.72), 0.32),
    });
    this.puffs = buildPuffs(
      this.group,
      this.material,
      16,
      [14, 10],
      (rng) => {
        const a = rng() * Math.PI * 2;
        const r = rng() * radius * 0.62;
        const s = radius * (0.3 + rng() * 0.3);
        return {
          base: new Vector3(Math.cos(a) * r, 0.9 + rng() * 1.5, Math.sin(a) * r),
          scale: new Vector3(s, s * 0.72, s),
          phase: rng() * Math.PI * 2,
        };
      },
      9091,
    );
  }

  /** 0 gone, 1 the starting fog, above 1 after the player has run away. */
  setDensity(value: number, scale: number): void {
    this.material.setFloat('uDensity', value);
    this.group.scaling.setAll(scale);
    this.group.visible = value > 0.01;
  }

  update(dt: number): void {
    this.time += dt;
    this.material.setFloat('uTime', this.time);
    for (const p of this.puffs) {
      p.mesh.position.set(
        p.base.x + Math.sin(this.time * 0.22 + p.phase) * 0.55,
        p.base.y + Math.sin(this.time * 0.31 + p.phase * 1.7) * 0.32,
        p.base.z + Math.cos(this.time * 0.19 + p.phase) * 0.55,
      );
    }
  }

  /** Where a dissolve mote should start from. */
  randomPoint(out: Vector3): Vector3 {
    const p = this.puffs[Math.floor(Math.random() * this.puffs.length)];
    if (!p) return out.copyFrom(this.group.position);
    out.copyFrom(p.mesh.position);
    out.scaleInPlace(this.group.scaling.x);
    out.addInPlace(this.group.position);
    return out;
  }
}

/**
 * The mist the player wakes inside.
 *
 * The player is never stopped from walking. Instead they set off inside their
 * own weather: the valley is close and dim, their stride is short, and the
 * longer they push on without stopping the thicker it gets. One finished
 * breath clears it for good. The penalty is something you can see, which is
 * the only kind worth having in a game with no score and no failure.
 */
export class WakingMist {
  readonly group: Group;
  private readonly material: ShaderMaterial;
  private readonly puffs: Puff[];
  private time = 0;

  constructor() {
    this.group = group('wakingMist');
    this.material = hazeMaterial('wakingMist', linearColor(PALETTE.skyGrey), {
      // Softest at the silhouette, so a bank of these reads as mist instead
      // of a row of bubbles.
      power: 0.7,
      invert: 0,
      drift: [0.84, 0.16],
      alpha: 0.3,
      cap: 0.5,
    });
    // A ring of low puffs around the player, thickest at knee height, so the
    // sky stays open and the world ahead just goes soft.
    this.puffs = buildPuffs(
      this.group,
      this.material,
      12,
      [12, 9],
      (rng, i) => {
        const a = (i / 12) * Math.PI * 2 + rng() * 0.5;
        const r = 0.45 + rng() * 0.4;
        const size = 0.34 + rng() * 0.26;
        return {
          base: new Vector3(Math.cos(a) * r, 0.1 + rng() * 0.28, Math.sin(a) * r),
          scale: new Vector3(size, size * 0.6, size),
          phase: rng() * Math.PI * 2,
        };
      },
      31337,
    );
  }

  /** @param value 0 clear, 1 thickest. */
  setStrength(value: number, radius: number): void {
    const strength = clamp01(value);
    this.group.visible = strength > 0.01;
    this.group.scaling.setAll(radius);
    this.material.setFloat('uDensity', strength);
  }

  update(dt: number): void {
    this.time += dt;
    this.material.setFloat('uTime', this.time);
    for (const p of this.puffs) {
      p.mesh.position.set(
        p.base.x + Math.sin(this.time * 0.2 + p.phase) * 0.07,
        p.base.y + Math.sin(this.time * 0.29 + p.phase * 1.4) * 0.03,
        p.base.z + Math.cos(this.time * 0.17 + p.phase) * 0.07,
      );
    }
  }
}

/** The seed: a small glowing sprout that grows into the bridge. */
export class Sprout {
  readonly group: Group;
  private readonly glow: Mesh;
  private readonly glowMaterial: StandardMaterial;
  private time = 0;

  constructor() {
    this.group = group('sprout');
    const stem = makeMesh('sproutStem', coneGeo(0.2, 1.05, 6));
    stem.material = worldMaterial({ color: PALETTE.growthGreen, rim: 0.3 });
    stem.position.y = 0.52;
    stem.parent = this.group;
    this.glow = makeMesh('sproutGlow', sphereGeo(0.42, 12, 10));
    this.glowMaterial = makeMoteMaterial(GOLD);
    this.glow.material = this.glowMaterial;
    this.glow.position.y = 1.0;
    this.glow.parent = this.group;
    this.group.visible = false;
  }

  /** A heart seed keeps a quiet warm glow. It dims a little while it pauses. */
  setState(visible: boolean, progress: number, paused: boolean): void {
    this.group.visible = visible;
    if (!visible) return;
    this.group.scaling.setAll(0.7 + progress * 0.9);
    this.glowMaterial.alpha = paused ? 0.34 : 0.85;
  }

  update(dt: number): void {
    this.time += dt;
    this.glow.scaling.setAll(1 + Math.sin(this.time * 1.7) * 0.12);
  }
}

/** The bird hint in scene 3. It lands near the hidden spring and sits still. */
export function buildBird(): Group {
  const bird = group('bird');
  const material = worldMaterial({ color: 0xbfb3a4, rim: 0.3 });
  const body = makeMesh('birdBody', sphereGeo(0.16, 10, 8));
  body.material = material;
  body.scaling.set(1, 0.9, 1.35);
  const head = makeMesh('birdHead', sphereGeo(0.095, 8, 6));
  head.material = material;
  head.position.set(0, 0.15, 0.16);
  const tail = makeMesh('birdTail', coneGeo(0.07, 0.24, 5));
  tail.material = material;
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0.02, -0.24);
  bird.add(body, head, tail);
  bird.position.y = 0.17;
  bird.visible = false;
  return bird;
}

/** The butterfly hint in scene 5. It flies slowly along the side path. */
export class Butterfly {
  readonly group: Group;
  private readonly wings: Mesh[] = [];
  private time = 0;
  private path: Vector3[] = [];
  private travel = 0;

  constructor() {
    this.group = group('butterfly');
    const material = new StandardMaterial('butterfly', stage());
    material.emissiveColor = linearColor(PALETTE.heartRose);
    material.diffuseColor = new Color3(0, 0, 0);
    material.specularColor = new Color3(0, 0, 0);
    material.disableLighting = true;
    material.alpha = 0.85;
    material.backFaceCulling = false;
    material.disableDepthWrite = true;
    material.fogEnabled = false;
    for (const side of [-1, 1]) {
      const wing = makeMesh('wing', circleGeo(0.17, 8));
      wing.material = material;
      wing.position.x = side * 0.11;
      wing.scaling.set(1, 0.72, 1);
      wing.parent = this.group;
      this.wings.push(wing);
    }
    this.group.visible = false;
  }

  /** Starts the flight along a path of ground points. */
  fly(points: Vector3[]): void {
    this.path = points;
    this.travel = 0;
    this.group.visible = points.length > 1;
    if (points[0]) this.group.position.copyFrom(points[0]);
  }

  update(dt: number): void {
    if (!this.group.visible || this.path.length < 2) return;
    this.time += dt;
    for (const [i, wing] of this.wings.entries()) {
      wing.rotation.y = Math.sin(this.time * 11) * 0.9 * (i === 0 ? 1 : -1);
    }
    // Slow, never hurried.
    this.travel = Math.min(this.path.length - 1.0001, this.travel + dt * 0.28);
    const i = Math.floor(this.travel);
    const a = this.path[i];
    const b = this.path[i + 1];
    if (!a || !b) return;
    Vector3.LerpToRef(a, b, this.travel - i, this.group.position);
    this.group.position.y += Math.sin(this.time * 1.6) * 0.22;
    this.group.lookAt(new Vector3(b.x, this.group.position.y, b.z));
  }
}

/**
 * The tree a seed grows into.
 *
 * A heart tree rises over a couple of seconds and stays; the thanks given
 * under it turns it golden. A mind tree rises faster, stands brighter, and
 * then goes, which is the only place in the chapter where the two kinds of
 * seed are told apart — and it is told by what the player sees, not by text.
 */
export class GrownTree {
  readonly group: Group;
  private readonly tree: Group;
  private readonly glow: Mesh;
  private readonly glowMaterial: StandardMaterial;
  /** The tree's own colours, kept so the golden blend stays reversible. */
  private readonly colors: { material: PBRMaterial; base: Color3 }[] = [];
  private rise = 0;
  private fade = 1;
  private golden = -1;
  private time = 0;
  private kind: 'heart' | 'mind' = 'heart';

  constructor(seed: number, blobCount: number) {
    this.group = group('grownTree');
    this.tree = buildTree(seed, blobCount);
    this.tree.parent = this.group;
    this.tree.scaling.setAll(0.001);
    this.glow = makeMesh('treeGlow', sphereGeo(1.6, 14, 12));
    this.glowMaterial = makeMoteMaterial(GOLD);
    this.glow.material = this.glowMaterial;
    this.glow.position.y = 3.4;
    this.glow.parent = this.group;
    this.glow.setEnabled(false);
    this.group.visible = false;

    for (const part of this.tree.getChildMeshes(false)) {
      const material = part.material as PBRMaterial | null;
      if (material?.albedoColor && !this.colors.some((c) => c.material === material)) {
        this.colors.push({ material, base: material.albedoColor.clone() });
      }
    }
  }

  /**
   * @param standing whether a tree stands here at all
   * @param kind which kind of seed grew it
   * @param fade 1 fully there, 0 gone. Only a mind tree ever leaves.
   */
  setState(standing: boolean, kind: 'heart' | 'mind', fade: number): void {
    this.group.visible = standing;
    this.kind = kind;
    this.fade = Math.max(0, Math.min(1, fade));
    if (!standing) this.rise = 0;
    // A mind tree stands brighter than a heart tree, and only while it lasts.
    this.glow.setEnabled(standing && kind === 'mind');
  }

  /** Blends the tree toward gold, for the thanks at the end of the chapter. */
  setGold(t: number): void {
    const amount = Math.max(0, Math.min(1, t));
    if (amount === this.golden) return;
    this.golden = amount;
    for (const entry of this.colors) {
      entry.material.albedoColor = mixColor(entry.base, GOLD, amount * 0.75);
    }
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.time += dt;
    // A mind tree comes up fast, a heart tree takes its time.
    const speed = this.kind === 'mind' ? 1.6 : 0.5;
    this.rise = Math.min(1, this.rise + dt * speed);
    const eased = this.rise * this.rise * (3 - 2 * this.rise);
    this.tree.scaling.setAll(Math.max(0.001, eased * this.fade));
    this.glowMaterial.alpha = 0.5 * this.fade * (0.8 + Math.sin(this.time * 1.4) * 0.2);
  }
}
