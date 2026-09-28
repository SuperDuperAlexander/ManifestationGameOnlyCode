import { Constants } from '@babylonjs/core/Engines/constants';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Material } from '@babylonjs/core/Materials/material';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { BODY_SHAPE, LIGHT, PLAYER, WALK } from '../content/chapter1';
import { BODY, BODY_POINTS } from '../content/chapter2';
import type { BodyPoint } from '../content/chapter2';
import { PALETTE } from '../content/palette';
import { clamp, clamp01, damp, wrapAngle } from '../core/math';
import { worldMaterial } from '../render/materials';
import { circleGeo, coneGeo, cylinderGeo, rotateXGeo, sphereGeo } from '../render/geometry';
import type { Group } from '../render/scene3d';
import { FRONT_FACE, group, linearColor, mesh as makeMesh, stage } from '../render/scene3d';
import { makeMoteMaterial } from './effects';

const GLOW = 'lwPlayerGlow';
const BLOB = 'lwBlobShadow';

/** The soft glow that shows calm. It is additive so it never darkens anything. */
Effect.ShadersStore[`${GLOW}VertexShader`] = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec3 normal;
  uniform mat4 world;
  uniform mat4 viewProjection;
  uniform vec3 cameraPosition;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vec4 w = world * vec4(position, 1.0);
    vNormalW = normalize(mat3(world[0].xyz, world[1].xyz, world[2].xyz) * normal);
    vViewDir = normalize(cameraPosition - w.xyz);
    gl_Position = viewProjection * w;
  }
`;

Effect.ShadersStore[`${GLOW}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  uniform vec3 uColor;
  uniform float uStrength;
  void main() {
    float rim = 1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir)));
    // A tight rim keeps the glow a halo around the figure.
    float a = pow(rim, 3.2) * uStrength;
    gl_FragColor = vec4(uColor, a * 0.16);
  }
`;

/** A simple blob shadow, used instead of a real one on the cheapest tier. */
Effect.ShadersStore[`${BLOB}VertexShader`] = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 worldViewProjection;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = worldViewProjection * vec4(position, 1.0);
  }
`;

Effect.ShadersStore[`${BLOB}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  void main() {
    float d = distance(vUv, vec2(0.5)) * 2.0;
    gl_FragColor = vec4(0.13, 0.14, 0.17, (1.0 - smoothstep(0.25, 1.0, d)) * 0.42);
  }
`;

/**
 * The player: a simple, soft, faceless figure. A rounded body, a small head and
 * a light cloak shape. The glow around them follows the calm value.
 */
export class PlayerFigure {
  readonly group: Group;
  readonly motes: Group;
  private readonly glow: Mesh;
  private readonly glowMaterial: ShaderMaterial;
  private readonly shadow: Mesh;
  private readonly moteMeshes: Mesh[] = [];
  private moteTime = 0;
  private glowAmount = 0;
  /** Advances with distance walked, so the step never changes with frame rate. */
  private walkPhase = 0;
  /** 0 standing, 1 walking at full stride. */
  private gait = 0;
  private readonly body: Group;
  private readonly hem: Mesh;
  private readonly neck: Group;
  /** Hip and knee joints, one pair per leg. */
  private readonly legs: { hip: Group; knee: Group; side: number }[] = [];
  /** Shoulder and elbow joints, and where the arm hangs when still. */
  private readonly arms: { socket: Group; elbow: Group; side: number; rest: number }[] = [];
  /** 0 lungs empty, 1 lungs full. The chapter feeds it from the breath. */
  private breath = 0;
  /** Where the head is being drawn, in world space, or null for straight on. */
  private readonly lookAt = new Vector3();
  private looking = false;
  private clock = 0;

  constructor() {
    this.group = group('player');
    this.body = group('playerBody');
    this.body.parent = this.group;
    this.motes = group('playerMotes');
    this.motes.parent = this.group;

    // The player carries the strongest rim in the world, so the figure always
    // reads clearly against the meadow behind them.
    const skin = worldMaterial({ color: 0xe6e2dc, rim: 0.45 });
    const cloak = worldMaterial({ color: 0xcfd6dd, rim: 0.45 });

    const cloth = worldMaterial({ color: 0xa9b0b8, rim: 0.4 });
    const boot = worldMaterial({ color: 0x6f6a63, rim: 0.4 });

    // The legs hang from the hip and are built the way a leg bends: a thigh
    // that swings, a shin that only ever folds backwards, and a foot that
    // stays flat until the leg leaves the ground.
    for (const side of [-1, 1] as const) {
      const hip = group(side < 0 ? 'hipLeft' : 'hipRight');
      hip.position.set(side * BODY_SHAPE.hipWidth, BODY_SHAPE.hipHeight, 0);
      hip.parent = this.body;

      const thigh = makeMesh('thigh', cylinderGeo(0.085, 0.105, BODY_SHAPE.thigh, 7, 1));
      thigh.material = cloth;
      thigh.position.y = -BODY_SHAPE.thigh / 2;
      thigh.parent = hip;

      const knee = group(side < 0 ? 'kneeLeft' : 'kneeRight');
      knee.position.y = -BODY_SHAPE.thigh;
      knee.parent = hip;

      const shin = makeMesh('shin', cylinderGeo(0.07, 0.085, BODY_SHAPE.shin, 7, 1));
      shin.material = cloth;
      shin.position.y = -BODY_SHAPE.shin / 2;
      shin.parent = knee;

      const foot = makeMesh('foot', sphereGeo(0.1, 8, 6));
      foot.material = boot;
      foot.scaling.set(0.85, 0.6, 1.5);
      foot.position.set(0, -BODY_SHAPE.shin, 0.05);
      foot.parent = knee;

      this.legs.push({ hip, knee, side });
    }

    // Rounded body. It ends above the knee now, so the legs can be seen.
    const torso = makeMesh('torso', cylinderGeo(0.3, 0.4, BODY_SHAPE.torso, 12, 1));
    torso.material = cloak;
    torso.position.y = BODY_SHAPE.hipHeight + BODY_SHAPE.torso / 2 - 0.06;
    torso.parent = this.body;

    const shoulders = makeMesh('shoulders', sphereGeo(0.32, 14, 10));
    shoulders.material = cloak;
    shoulders.position.y = 1.12;
    shoulders.scaling.set(1, 0.72, 0.9);
    shoulders.parent = this.body;

    // The arms hang from the shoulder and swing against the legs, which is
    // what tells the eye that the figure is walking and not sliding.
    for (const side of [-1, 1] as const) {
      const socket = group(side < 0 ? 'armLeft' : 'armRight');
      socket.position.set(side * BODY_SHAPE.shoulderWidth, BODY_SHAPE.shoulderHeight, 0);
      socket.rotation.z = -side * 0.2;
      socket.parent = this.body;

      const upper = makeMesh('upperArm', cylinderGeo(0.07, 0.085, BODY_SHAPE.upperArm, 7, 1));
      upper.material = cloak;
      upper.position.y = -BODY_SHAPE.upperArm / 2;
      upper.parent = socket;

      const elbow = group(side < 0 ? 'elbowLeft' : 'elbowRight');
      elbow.position.y = -BODY_SHAPE.upperArm;
      elbow.parent = socket;

      const fore = makeMesh('forearm', cylinderGeo(0.055, 0.07, BODY_SHAPE.forearm, 7, 1));
      fore.material = skin;
      fore.position.y = -BODY_SHAPE.forearm / 2;
      fore.parent = elbow;

      const hand = makeMesh('hand', sphereGeo(0.062, 8, 6));
      hand.material = skin;
      hand.position.y = -BODY_SHAPE.forearm;
      hand.parent = elbow;

      this.arms.push({ socket, elbow, side, rest: -side * 0.2 });
    }

    // A small, faceless head, on a neck that can turn.
    this.neck = group('neck');
    this.neck.position.y = 1.47;
    this.neck.parent = this.body;
    const head = makeMesh('head', sphereGeo(0.21, 14, 12));
    head.material = skin;
    head.parent = this.neck;

    // The cloak stops above the knee. Any lower and the legs are boots only.
    this.hem = makeMesh('hem', coneGeo(0.42, 0.36, 12, 1, true));
    this.hem.material = cloak;
    this.hem.position.y = BODY_SHAPE.hipHeight + 0.02;
    this.hem.parent = this.body;

    this.glowMaterial = new ShaderMaterial(
      GLOW,
      stage(),
      { vertex: GLOW, fragment: GLOW },
      {
        attributes: ['position', 'normal'],
        uniforms: ['world', 'viewProjection', 'cameraPosition', 'uColor', 'uStrength'],
        needAlphaBlending: true,
      },
    );
    this.glowMaterial.setColor3('uColor', linearColor(PALETTE.receiveGold));
    this.glowMaterial.setFloat('uStrength', 0);
    this.glowMaterial.alphaMode = Constants.ALPHA_ADD;
    this.glowMaterial.disableDepthWrite = true;
    this.glowMaterial.fogEnabled = false;
    // The far side of the sphere only, so the glow sits behind the figure.
    this.glowMaterial.sideOrientation = Material.ClockWiseSideOrientation;
    this.glow = makeMesh('playerGlow', sphereGeo(1, 20, 14));
    this.glow.material = this.glowMaterial;
    this.glow.position.y = 0.9;
    this.glow.alphaIndex = 2;
    this.glow.isPickable = false;
    this.glow.parent = this.group;

    const blobMaterial = new ShaderMaterial(
      BLOB,
      stage(),
      { vertex: BLOB, fragment: BLOB },
      {
        attributes: ['position', 'uv'],
        uniforms: ['worldViewProjection'],
        needAlphaBlending: true,
      },
    );
    blobMaterial.alphaMode = Constants.ALPHA_COMBINE;
    blobMaterial.disableDepthWrite = true;
    blobMaterial.backFaceCulling = false;
    blobMaterial.fogEnabled = false;
    this.shadow = makeMesh('blobShadow', rotateXGeo(circleGeo(0.72, 18), -Math.PI / 2));
    this.shadow.material = blobMaterial;
    this.shadow.position.y = 0.03;
    this.shadow.isPickable = false;
    this.shadow.parent = this.group;

    // One mote per light carried. Never a number.
    const moteGeo = sphereGeo(0.075, 8, 6);
    const moteMat = makeMoteMaterial(linearColor(PALETTE.receiveGold));
    const first = makeMesh('lightMote', moteGeo);
    first.material = moteMat;
    for (let i = 0; i < LIGHT.max; i++) {
      const mote = i === 0 ? first : first.clone(`lightMote-${String(i)}`);
      mote.setEnabled(false);
      mote.isPickable = false;
      mote.parent = this.motes;
      this.moteMeshes.push(mote);
    }
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  /** The blob shadow is only used when the tier has no real shadows. */
  setBlobShadow(on: boolean): void {
    this.shadow.setEnabled(on);
  }

  setFacing(angle: number): void {
    this.group.rotation.y = angle;
  }

  /** The calm value drives the glow brightness and size. */
  setGlow(calm: number): void {
    this.glowAmount = clamp01(calm);
    const r =
      PLAYER.glowRadiusMin + (PLAYER.glowRadiusMax - PLAYER.glowRadiusMin) * this.glowAmount;
    this.glow.scaling.setAll(r);
    this.glowMaterial.setFloat('uStrength', 0.22 + this.glowAmount * 1.5);
  }

  /**
   * The four body points: feet, belly, heart, head.
   *
   * They are built once and left dark. Chapter 2 lights them one at a time as
   * the player breathes at each stone, and a point that is lit stays lit. No
   * other chapter touches them, so they cost one hidden group at the start.
   */
  private bodyGlows: Map<BodyPoint, { mesh: Mesh; material: StandardMaterial }> | null = null;

  /** Lights one body point, or dims it. `amount` is 0 to 1. */
  setBodyPoint(point: BodyPoint, amount: number): void {
    if (!this.bodyGlows) this.buildBodyGlows();
    const entry = this.bodyGlows?.get(point);
    if (!entry) return;
    const a = clamp01(amount);
    entry.mesh.setEnabled(a > 0.01);
    entry.material.alpha = a * 0.85;
    entry.mesh.scaling.setAll(0.1 + a * 0.075);
  }

  private buildBodyGlows(): void {
    this.bodyGlows = new Map();
    const geo = sphereGeo(1, 10, 8);
    for (const point of BODY_POINTS) {
      const material = new StandardMaterial(`bodyGlow-${point}`, stage());
      material.emissiveColor = linearColor(PALETTE.receiveGold);
      material.diffuseColor = new Color3(0, 0, 0);
      material.specularColor = new Color3(0, 0, 0);
      material.disableLighting = true;
      material.alpha = 0;
      material.disableDepthWrite = true;
      material.fogEnabled = false;
      material.sideOrientation = FRONT_FACE;
      const mesh = makeMesh(`bodyGlow-${point}`, geo);
      mesh.material = material;
      mesh.position.set(0, BODY.heights[point], 0.16);
      mesh.isPickable = false;
      mesh.setEnabled(false);
      mesh.parent = this.group;
      this.bodyGlows.set(point, { mesh, material });
    }
  }

  setLight(count: number): void {
    for (let i = 0; i < this.moteMeshes.length; i++) {
      this.moteMeshes[i]?.setEnabled(i < count);
    }
  }

  /**
   * @param speed the player's ground speed in metres per second
   */
  update(dt: number, groundY: number, speed = 0): void {
    this.clock += dt;
    this.animateWalk(dt, speed);
    this.moteTime += dt;
    const visible = this.moteMeshes.filter((m) => m.isEnabled(false)).length;
    for (let i = 0; i < visible; i++) {
      const mote = this.moteMeshes[i];
      if (!mote) continue;
      const a = this.moteTime * LIGHT.moteOrbitSpeed + (i / Math.max(1, visible)) * Math.PI * 2;
      const tilt = Math.sin(this.moteTime * 0.7 + i) * 0.35;
      mote.position.set(
        Math.cos(a) * LIGHT.moteOrbitRadius,
        1.0 + tilt + Math.sin(a * 2) * 0.12,
        Math.sin(a) * LIGHT.moteOrbitRadius,
      );
      mote.scaling.setAll(0.85 + Math.sin(this.moteTime * 2.4 + i) * 0.16);
    }
    this.shadow.position.y = groundY - this.group.position.y + 0.04;
  }

  /**
   * A walk, made from the movement itself rather than from a clip.
   *
   * There is no skeleton and no animation file. The body rises and falls
   * twice per stride, rolls, and leans into the direction of travel; the
   * legs swing from the hip and the knees fold only backwards; the arms
   * swing against the legs. All of it hangs off one number, the distance
   * walked, so the step matches the speed at any frame rate and a figure
   * that stops mid-stride settles rather than freezing.
   */
  private animateWalk(dt: number, speed: number): void {
    // The phase follows distance, not time, so the step matches the speed.
    this.walkPhase += speed * dt * WALK.phasePerMetre;
    const want = clamp01(speed / WALK.fullStrideSpeed);
    this.gait += (want - this.gait) * Math.min(1, dt * WALK.gaitEase);

    // Lying down overrides the walk: the figure tips back and settles.
    if (this.lying > 0.001) {
      const eased = this.lying * this.lying * (3 - 2 * this.lying);
      this.body.position.y = -0.55 * eased;
      this.body.rotation.z = 0;
      this.body.rotation.x = -1.35 * eased;
      this.hem.rotation.z = 0;
      this.hem.position.x = 0;
      this.restLimbs(eased);
      return;
    }

    const bob = Math.sin(this.walkPhase * 2) * WALK.bob * this.gait;
    const roll = Math.sin(this.walkPhase) * WALK.roll * this.gait;
    const lean = WALK.lean * this.gait;

    // Standing still, the figure is not a statue: the weight shifts slowly
    // from one foot to the other and the chest follows the breath.
    const sway = Math.sin(this.clock * WALK.swaySpeed) * WALK.sway * (1 - this.gait);
    const lift = (this.breath - 0.5) * WALK.breathRise * (1 - this.gait);

    this.body.position.y = bob + lift;
    this.body.rotation.z = roll + sway;
    this.body.rotation.x = lean - lift * 0.6;
    // The hem swings a beat behind the body, so the cloak has some weight.
    this.hem.rotation.z = -roll * 0.6;
    this.hem.position.x = Math.sin(this.walkPhase - 0.6) * 0.03 * this.gait;

    for (const leg of this.legs) {
      // One leg is half a stride behind the other.
      const p = this.walkPhase + (leg.side < 0 ? 0 : Math.PI);
      leg.hip.rotation.x = Math.sin(p) * WALK.legSwing * this.gait;
      // A knee only folds backwards, and most on the way through.
      leg.knee.rotation.x = -Math.max(0, -Math.sin(p - 0.7)) * WALK.kneeBend * this.gait;
    }

    for (const arm of this.arms) {
      // The arm swings against the leg on the same side.
      const p = this.walkPhase + (arm.side < 0 ? Math.PI : 0);
      arm.socket.rotation.x = Math.sin(p) * WALK.armSwing * this.gait;
      // Standing, the arms rest a little away from the body and breathe with it.
      arm.socket.rotation.z = arm.rest * (1 + (1 - this.gait) * this.breath * 0.3);
      arm.elbow.rotation.x =
        -(WALK.elbowRest + Math.max(0, Math.sin(p)) * WALK.elbowBend) * this.gait;
    }

    // The head turns toward whatever it is being drawn to, and no further
    // than a person can turn without turning their shoulders with them.
    let turn = 0;
    let tilt = 0;
    if (this.looking) {
      const dx = this.lookAt.x - this.group.position.x;
      const dz = this.lookAt.z - this.group.position.z;
      const want2 = Math.atan2(dx, dz) - this.group.rotation.y;
      turn = clamp(wrapAngle(want2), -WALK.headTurnMax, WALK.headTurnMax);
      tilt = clamp(
        (this.lookAt.y - this.group.position.y - 1.5) * 0.4,
        -WALK.headTurnMax,
        WALK.headTurnMax,
      );
    }
    this.neck.rotation.y = damp(this.neck.rotation.y, turn, WALK.headEase, dt);
    this.neck.rotation.x = damp(this.neck.rotation.x, -tilt, WALK.headEase, dt);
  }

  /** Straightens every limb, for lying down. */
  private restLimbs(amount: number): void {
    const keep = 1 - amount;
    for (const leg of this.legs) {
      leg.hip.rotation.x *= keep;
      leg.knee.rotation.x *= keep;
    }
    for (const arm of this.arms) {
      arm.socket.rotation.x *= keep;
      arm.elbow.rotation.x *= keep;
    }
    this.neck.rotation.set(0, 0, 0);
  }

  /** 0 lungs empty, 1 lungs full. The chapter feeds it from the breath. */
  setBreath(amount: number): void {
    this.breath = clamp01(amount);
  }

  /**
   * Draws the head toward a point, for example the guide.
   *
   * Pass nothing to let it face forward again. The turn is limited and eased,
   * so the figure glances rather than snapping round.
   */
  lookTowards(target: Vector3 | null): void {
    this.looking = target !== null;
    if (target) this.lookAt.copyFrom(target);
  }

  /** 0 standing, 1 lying down. Chapter 2 uses it before the dream. */
  private lying = 0;

  /**
   * Lies the player down, or stands them back up.
   *
   * `amount` is the whole state, not a step, so a chapter can ease it or set
   * it straight and the result is the same.
   */
  setLyingDown(amount: number): void {
    this.lying = clamp01(amount);
  }

  /** Where a light mote should fly to. */
  chestWorld(target: Vector3): Vector3 {
    return target.set(this.group.position.x, this.group.position.y + 1.05, this.group.position.z);
  }

  /** Every mesh the figure is made of, so shadows can be turned on for them. */
  castingMeshes(): Mesh[] {
    return this.body.getChildMeshes(false).filter((m): m is Mesh => m instanceof Mesh);
  }
}
