import { Constants } from '@babylonjs/core/Engines/constants';
import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { FeelingType } from '../content/chapter2';
import { PALETTE } from '../content/palette';
import { clamp01, makeRng } from '../core/math';
import { ringGeo, rotateXGeo, sphereGeo } from '../render/geometry';
import type { Group } from '../render/scene3d';
import { group, linearColor, mesh as makeMesh, mixColor, stage } from '../render/scene3d';

const FEELING_COLOR: Record<FeelingType, string> = {
  sadness: PALETTE.sadness,
  anger: PALETTE.anger,
  worry: PALETTE.worry,
};

const WEATHER = 'lwWeather';
const RAIN = 'lwRain';
const RAINBOW = 'lwRainbow';
const TONE = 'lwToneRing';

Effect.ShadersStore[`${WEATHER}VertexShader`] = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec3 normal;
  uniform mat4 world;
  uniform mat4 view;
  uniform mat4 projection;
  uniform vec3 cameraPosition;
  varying vec3 vN; varying vec3 vV; varying vec3 vL; varying float vDepth;
  void main() {
    vec4 w = world * vec4(position, 1.0);
    vN = normalize(mat3(world[0].xyz, world[1].xyz, world[2].xyz) * normal);
    vV = normalize(cameraPosition - w.xyz);
    vL = position;
    vec4 mv = view * w;
    vDepth = -mv.z;
    gl_Position = projection * mv;
  }
`;

Effect.ShadersStore[`${WEATHER}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec3 vN; varying vec3 vV; varying vec3 vL; varying float vDepth;
  uniform vec3 uColor;
  uniform float uDensity;
  uniform float uTime;
  uniform float uPulse;
  uniform float uFlicker;
  uniform float uLift;
  uniform float uTone;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float soft = pow(1.0 - facing, 0.6);
    float drift = 0.85 + 0.15 * sin(uTime * 0.5 + vL.y * 1.6 + vL.x);
    // Anger pulses slowly in colour, never in brightness and never
    // faster than twice a second, so it can never read as a flash.
    float pulse = 1.0 + uPulse * 0.22 * sin(uTime * 1.6);
    // Worry shimmers at a rate that stays under three a second.
    float flick = 1.0 + uFlicker * 0.14 * sin(uTime * 8.0 + vL.x * 3.0);
    float a = (1.0 - soft) * mix(0.4, 0.52, 1.0 - uTone) * uDensity * drift;
    vec3 col = mix(uColor, vec3(0.62, 0.66, 0.78), uLift) * (0.8 + 0.3 * facing);
    col *= pulse * flick * uTone;
    // The same aerial perspective the rest of the world has. Without it
    // a storm eighty metres off keeps its full colour while every hill
    // around it has hazed away, and it reads as a painted block.
    float haze = 1.0 - smoothstep(38.0, 185.0, vDepth);
    col = mix(vec3(0.72, 0.74, 0.78), col, haze);
    // A cloud that follows the player settles above them, which puts it
    // between them and the camera. Rather than move it somewhere it has
    // no business being, it thins out as it passes the lens, the way
    // real weather does when you walk into it.
    float near = smoothstep(0.6, 4.5, vDepth);
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.62) * (0.25 + 0.75 * haze) * near);
  }
`;

/**
 * A feeling weather, drawn.
 *
 * Each of the three has its own shape, movement and colour, so a player can
 * tell them apart from across the meadow and the naming panel is a question
 * they can actually answer:
 *
 * - sadness sits low and heavy and rains straight down,
 * - anger is a dark bank that gusts and pulses slowly,
 * - worry is many small wisps that circle fast.
 *
 * None of them is drawn as a threat. They are weather.
 */
export class WeatherView {
  readonly group: Group;
  private readonly material: ShaderMaterial;
  private readonly puffs: { mesh: Mesh; base: Vector3; phase: number }[] = [];
  private readonly rainMaterial: ShaderMaterial | null = null;
  private time = 0;
  private intensity = 1;
  /** Reduced motion replaces every pulse with a steady colour. */
  reducedMotion = false;

  constructor(
    readonly type: FeelingType,
    radius: number,
  ) {
    const color = linearColor(FEELING_COLOR[type]);
    this.group = group(`weather-${type}`);

    this.material = new ShaderMaterial(
      `weather-${type}`,
      stage(),
      { vertex: WEATHER, fragment: WEATHER },
      {
        attributes: ['position', 'normal'],
        uniforms: [
          'world',
          'view',
          'projection',
          'cameraPosition',
          'uColor',
          'uDensity',
          'uTime',
          'uPulse',
          'uFlicker',
          'uLift',
          'uTone',
        ],
        needAlphaBlending: true,
      },
    );
    this.material.setColor3('uColor', color);
    this.material.setFloat('uDensity', 1);
    this.material.setFloat('uTime', 0);
    /** 0 no pulse, 1 the full slow pulse of anger. */
    this.material.setFloat('uPulse', type === 'anger' ? 1 : 0);
    /** 0 no flicker, 1 the quick flicker of worry. */
    this.material.setFloat('uFlicker', type === 'worry' ? 1 : 0);
    /**
     * How far toward pale grey the colour is lifted, and how bright it is.
     *
     * Sadness is a pale, heavy rain cloud, so it lifts. Anger is a dark
     * bank: lifting it turns the deep red-violet of the brief into pink,
     * which reads as a sunset rather than as anger. Worry sits between.
     */
    this.material.setFloat('uLift', type === 'sadness' ? 0.34 : type === 'anger' ? 0.0 : 0.18);
    this.material.setFloat('uTone', type === 'anger' ? 0.52 : type === 'worry' ? 0.86 : 1.0);
    this.material.alphaMode = Constants.ALPHA_COMBINE;
    this.material.disableDepthWrite = true;
    this.material.backFaceCulling = false;
    this.material.fogEnabled = false;

    const rng = makeRng(type === 'sadness' ? 4001 : type === 'anger' ? 4002 : 4003);
    const geo = sphereGeo(1, 14, 10);

    // Sadness is one low bank, anger a taller one, worry many small wisps.
    const count = type === 'worry' ? 26 : type === 'anger' ? 20 : 12;
    const spread = type === 'worry' ? 0.95 : 0.6;
    const flat = type === 'sadness' ? 0.52 : type === 'anger' ? 0.78 : 0.9;

    const first = makeMesh('weatherPuff', geo);
    first.material = this.material;
    for (let i = 0; i < count; i++) {
      const mesh = i === 0 ? first : first.clone(`weatherPuff-${String(i)}`);
      const a = rng() * Math.PI * 2;
      const r = rng() * radius * spread;
      const lift = type === 'sadness' ? 0.4 + rng() * 0.7 : 0.9 + rng() * 1.9;
      const base = new Vector3(Math.cos(a) * r, lift, Math.sin(a) * r);
      mesh.position.copyFrom(base);
      const s = radius * (type === 'worry' ? 0.1 + rng() * 0.12 : 0.28 + rng() * 0.3);
      mesh.scaling.set(s, s * flat, s);
      mesh.parent = this.group;
      mesh.isPickable = false;
      this.puffs.push({ mesh, base, phase: rng() * Math.PI * 2 });
    }

    if (type === 'sadness') {
      const built = buildRain(radius, color);
      this.rainMaterial = built.material;
      built.points.parent = this.group;
    }
  }

  /** 0 gone, 1 full. The size follows it, so a softened weather is smaller. */
  setIntensity(value: number): void {
    this.intensity = clamp01(value);
    this.material.setFloat('uDensity', this.intensity);
    this.rainMaterial?.setFloat('uDensity', this.intensity);
    this.group.visible = this.intensity > 0.01;
  }

  /** The scale, kept apart from the intensity so a wrong name can grow it. */
  setSize(scale: number): void {
    this.group.scaling.setAll(scale);
  }

  update(dt: number, motion = 1): void {
    this.time += dt;
    const move = this.reducedMotion ? motion * 0.35 : motion;
    this.material.setFloat('uTime', this.reducedMotion ? 0 : this.time);

    for (const p of this.puffs) {
      if (this.type === 'worry') {
        // Worry circles fast and close, which is exactly what worry does.
        const a = this.time * 1.5 * move + p.phase;
        const r = Math.hypot(p.base.x, p.base.z);
        p.mesh.position.set(
          Math.cos(a) * r,
          p.base.y + Math.sin(this.time * 2.1 + p.phase) * 0.35 * move,
          Math.sin(a) * r,
        );
      } else if (this.type === 'anger') {
        // Anger gusts: short, hard pushes rather than a drift.
        const gust = Math.pow(Math.max(0, Math.sin(this.time * 0.9 + p.phase)), 4);
        p.mesh.position.set(
          p.base.x + gust * 1.4 * move,
          p.base.y + Math.sin(this.time * 0.4 + p.phase) * 0.22 * move,
          p.base.z + Math.cos(this.time * 0.33 + p.phase) * 0.4 * move,
        );
      } else {
        p.mesh.position.set(
          p.base.x + Math.sin(this.time * 0.2 + p.phase) * 0.45 * move,
          p.base.y + Math.sin(this.time * 0.27 + p.phase * 1.7) * 0.22 * move,
          p.base.z + Math.cos(this.time * 0.17 + p.phase) * 0.45 * move,
        );
      }
    }

    this.rainMaterial?.setFloat('uTime', this.time);
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

Effect.ShadersStore[`${RAIN}VertexShader`] = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute float aPhase;
  uniform mat4 world;
  uniform mat4 view;
  uniform mat4 projection;
  uniform float uTime;
  uniform float uFall;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    // Each drop falls at its own offset and wraps round, so the rain is
    // continuous without a single particle ever being created.
    float t = fract(aPhase + uTime * 0.28);
    p.y = uFall - t * uFall;
    vAlpha = smoothstep(0.0, 0.12, t) * smoothstep(1.0, 0.82, t);
    vec4 mv = view * world * vec4(p, 1.0);
    gl_PointSize = 2.4 * (26.0 / -mv.z);
    gl_Position = projection * mv;
  }
`;

Effect.ShadersStore[`${RAIN}FragmentShader`] = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uDensity;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    // A short streak rather than a round dot.
    float a = smoothstep(0.5, 0.0, length(d * vec2(2.6, 1.0)));
    gl_FragColor = vec4(uColor, a * vAlpha * 0.5 * uDensity);
  }
`;

/** Soft, slow rain: short streaks that fall and start again at the top. */
function buildRain(radius: number, color: Color3): { points: Mesh; material: ShaderMaterial } {
  const count = 240;
  const rng = makeRng(4444);
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = rng() * 4;
    positions[i * 3 + 2] = Math.sin(a) * r;
    phases[i] = rng();
    indices.push(i);
  }

  const scene = stage();
  const points = new Mesh('rain', scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.applyToMesh(points, false);
  points.setVerticesData('aPhase', phases, false, 1);

  const material = new ShaderMaterial(
    RAIN,
    scene,
    { vertex: RAIN, fragment: RAIN },
    {
      attributes: [VertexBuffer.PositionKind, 'aPhase'],
      uniforms: ['world', 'view', 'projection', 'uColor', 'uTime', 'uDensity', 'uFall'],
      needAlphaBlending: true,
    },
  );
  material.setColor3('uColor', mixColor(color, new Color3(1, 1, 1), 0.35));
  material.setFloat('uTime', 0);
  material.setFloat('uDensity', 1);
  material.setFloat('uFall', 4);
  material.alphaMode = Constants.ALPHA_COMBINE;
  material.disableDepthWrite = true;
  material.backFaceCulling = false;
  material.fogEnabled = false;
  material.pointsCloud = true;

  points.material = material;
  points.alwaysSelectAsActiveMesh = true;
  points.doNotSyncBoundingInfo = true;
  points.isPickable = false;
  return { points, material };
}

Effect.ShadersStore[`${RAINBOW}VertexShader`] = /* glsl */ `
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

Effect.ShadersStore[`${RAINBOW}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uAmount;
  void main() {
    // Bands across the ring, softest at both edges.
    float t = vUv.y;
    vec3 col = mix(vec3(0.95, 0.72, 0.45), vec3(0.55, 0.78, 0.86), t);
    col = mix(col, vec3(0.74, 0.63, 0.86), smoothstep(0.55, 1.0, t));
    float edge = smoothstep(0.0, 0.18, t) * smoothstep(1.0, 0.82, t);
    // Fade out at both ends of the arc, so it has no cut edge.
    float ends = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
    gl_FragColor = vec4(col, edge * ends * 0.42 * uAmount);
  }
`;

/**
 * The rainbow that appears when the rain lets go.
 *
 * It is a half ring of soft bands, drawn without depth so it always sits
 * behind whatever the player is looking at, the way a real one does.
 */
export class Rainbow {
  readonly group: Group;
  private readonly material: ShaderMaterial;
  private amount = 0;

  constructor() {
    this.group = group('rainbow');
    this.material = new ShaderMaterial(
      RAINBOW,
      stage(),
      { vertex: RAINBOW, fragment: RAINBOW },
      {
        attributes: ['position', 'uv'],
        uniforms: ['worldViewProjection', 'uAmount'],
        needAlphaBlending: true,
      },
    );
    this.material.setFloat('uAmount', 0);
    this.material.alphaMode = Constants.ALPHA_COMBINE;
    this.material.disableDepthWrite = true;
    this.material.backFaceCulling = false;
    this.material.fogEnabled = false;
    const arc = makeMesh('rainbowArc', ringGeo(9, 12, 48, 1, Math.PI * 0.1, Math.PI * 0.8));
    arc.material = this.material;
    arc.rotation.x = -0.25;
    arc.isPickable = false;
    arc.parent = this.group;
    this.group.visible = false;
  }

  /** 0 gone, 1 fully there. */
  setAmount(value: number): void {
    this.amount = clamp01(value);
    this.material.setFloat('uAmount', this.amount);
    this.group.visible = this.amount > 0.01;
  }
}

Effect.ShadersStore[`${TONE}VertexShader`] = Effect.ShadersStore[`${RAINBOW}VertexShader`] ?? '';
Effect.ShadersStore[`${TONE}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uFade;
  void main() {
    float band = smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
    gl_FragColor = vec4(uColor, band * 0.5 * uFade);
  }
`;

/**
 * The ring of light a sound breath sends out.
 *
 * It is the only thing in the chapter the player makes rather than finds, so
 * it leaves from them and travels outward at a steady speed.
 */
export class ToneRings {
  readonly group: Group;
  private readonly rings: { mesh: Mesh; material: ShaderMaterial; life: number }[] = [];

  constructor(private readonly maxRadius: number) {
    this.group = group('toneRings');
  }

  /** Sends one ring out from a point. */
  send(x: number, y: number, z: number): void {
    // Each ring fades on its own, so each one carries its own material.
    const material = new ShaderMaterial(
      TONE,
      stage(),
      { vertex: TONE, fragment: TONE },
      {
        attributes: ['position', 'uv'],
        uniforms: ['worldViewProjection', 'uColor', 'uFade'],
        needAlphaBlending: true,
      },
    );
    material.setColor3('uColor', linearColor(PALETTE.receiveGold));
    material.setFloat('uFade', 1);
    material.alphaMode = Constants.ALPHA_COMBINE;
    material.disableDepthWrite = true;
    material.backFaceCulling = false;
    material.fogEnabled = false;

    const mesh = makeMesh('toneRing', rotateXGeo(ringGeo(0.9, 1, 40), -Math.PI / 2));
    mesh.material = material;
    mesh.position.set(x, y + 0.7, z);
    mesh.isPickable = false;
    mesh.parent = this.group;
    this.rings.push({ mesh, material, life: 0 });
  }

  update(dt: number, seconds: number): void {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      if (!ring) continue;
      ring.life += dt;
      const t = clamp01(ring.life / seconds);
      ring.mesh.scaling.setAll(1 + t * this.maxRadius);
      ring.material.setFloat('uFade', 1 - t);
      if (t >= 1) {
        ring.mesh.dispose();
        ring.material.dispose();
        this.rings.splice(i, 1);
      }
    }
  }
}
