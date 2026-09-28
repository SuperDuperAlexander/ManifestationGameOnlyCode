import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Constants } from '@babylonjs/core/Engines/constants';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { Random, clamp01, damp, smoothstep } from '../core/Random';
import { createPaperMaterial, setPaperColor, type PaperMaterial } from '../shaders/paperShader';
import { procTexture } from '../world/ProceduralTextures';
import { TextCard } from '../world/TextCard';
import type { FogSpec } from './valleyLayout';
import type { Collider } from './ValleyProps';
import { VALLEY_UNIFORMS } from './valleyShader';

/**
 * A fog blockade for the free 3D camera: a dense, slowly churning cloud of soft puffs
 * that always face the camera, with the blockade sentence floating inside.
 * - Push (force): it shakes, grows bigger, denser and darker.
 * - Breath (light): it thins out and shrinks. At zero it turns into golden light:
 *   a beam from the sky, rising sparks, a ring on the ground and the release sentence.
 */

const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
#include<instancesDeclaration>
uniform mat4 viewProjection;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamPos;
uniform vec3 uCenter;
uniform vec4 uFog; // x: time, y: grow, z: shake, w: churn
varying vec2 vUv;
varying float vPhase;
varying float vNear;
#ifdef INSTANCESCOLOR
varying vec4 vTint;
#endif
void main(void) {
#include<instancesVertex>
  vec3 origin = finalWorld[3].xyz;
  float size = length(finalWorld[0].xyz);
  float phase = fract(sin(dot(origin.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
  vPhase = phase;
  float t = uFog.x;
  // Churning: every puff circles the centre at its own speed and direction, and bobs.
  vec3 rel = origin - uCenter;
  float dir = sin(phase * 3.0) > 0.0 ? 1.0 : -1.0;
  float ang = t * (0.12 + 0.12 * fract(phase)) * dir * uFog.w;
  float cs = cos(ang);
  float sn = sin(ang);
  rel.xz = vec2(cs * rel.x - sn * rel.z, sn * rel.x + cs * rel.z);
  rel.y += sin(t * 0.7 + phase) * 0.25;
  rel *= uFog.y;
  rel.x += sin(t * 19.0 + phase * 3.0) * uFog.z * 0.4;
  rel.z += cos(t * 15.0 + phase) * uFog.z * 0.3;
  vec3 c = uCenter + rel;
  float s = size * uFog.y * (1.0 + 0.1 * sin(t * 0.9 + phase));
  vec3 wp = c + (uCamRight * position.x + uCamUp * position.y) * s;
  vUv = uv;
  vNear = smoothstep(0.8, 3.2, distance(c, uCamPos));
#ifdef INSTANCESCOLOR
  vTint = instanceColor;
#endif
  gl_Position = viewProjection * vec4(wp, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec4 uFade; // x: density 0..1+, y: global alpha, z: gold 0..1, w: darkness 0..1
uniform vec4 uMood;
varying vec2 vUv;
varying float vPhase;
varying float vNear;
#ifdef INSTANCESCOLOR
varying vec4 vTint;
#endif
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main(void) {
  vec4 c = texture2D(uTex, vUv);
#ifdef INSTANCESCOLOR
  c.rgb *= vTint.rgb;
  c.a *= vTint.a;
#endif
  // Heavy grey-lilac fog; pushing makes it dark and stormy.
  c.rgb *= vec3(0.9, 0.9, 0.95);
  c.rgb = mix(c.rgb, vec3(0.3, 0.31, 0.4) * (0.8 + 0.4 * c.r), uFade.w);
  c.a = min(1.0, c.a * (1.25 + uFade.w * 0.5));
  // Dissolve: noise threshold. Lower density = more of the cloud is gone.
  float n = noise(vUv * 5.0 + vPhase) * 0.6 + noise(vUv * 11.0 - vPhase) * 0.4;
  float edge = length(vUv - 0.5) * 1.1;
  float keep = clamp(uFade.x, 0.0, 1.2);
  float cut = n * 0.7 + (1.0 - edge) * 0.3;
  float vis = smoothstep(1.0 - keep - 0.12, 1.0 - keep + 0.12, cut);
  c.a *= vis * uFade.y * vNear;
  // Turning into light: warm gold at the dissolving edges.
  float rim = smoothstep(0.0, 0.25, vis) * (1.0 - smoothstep(0.25, 0.9, vis));
  c.rgb = mix(c.rgb, vec3(1.0, 0.86, 0.55), clamp(rim * 0.9 + uFade.z * 0.7, 0.0, 1.0) * (1.0 - smoothstep(0.95, 1.15, keep)));
  // The world's mood darkens the fog too.
  c.rgb *= 1.0 + min(uMood.x, 0.0) * 0.35;
  gl_FragColor = c;
}
`;

Effect.ShadersStore['valleyFogVertexShader'] = VERTEX;
Effect.ShadersStore['valleyFogFragmentShader'] = FRAGMENT;

export type FogState = 'solid' | 'dissolving' | 'released';

export class ValleyFog {
  state: FogState = 'solid';
  /** 1 = full. Pushing raises it; breathing lowers it. */
  density = 1;
  /** Size: 1 = normal, bigger after pushes. */
  grow = 1;
  pushes = 0;
  readonly collider: Collider;
  readonly center: Vector3;
  private readonly puffs: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly text: TextCard;
  private readonly releaseText: TextCard;
  private readonly beams: { mesh: Mesh; mat: PaperMaterial; width: number }[] = [];
  private readonly ring: Mesh;
  private readonly ringMat: PaperMaterial;
  private shownDensity = 1;
  private shownGrow = 1;
  private shake = 0;
  private darkness = 0;
  private flicker = 0;
  private time = 0;
  private dissolveTime = 0;
  private readonly camRight = new Vector3();
  private readonly camUp = new Vector3();

  constructor(
    private readonly scene: Scene,
    readonly spec: FogSpec,
    groundY: number,
  ) {
    this.center = new Vector3(spec.x, groundY, spec.z);
    this.collider = { x: spec.x, z: spec.z, radius: spec.radius, active: true };

    this.mat = new ShaderMaterial(
      `valley.fogMat:${spec.id}`,
      scene,
      { vertex: 'valleyFog', fragment: 'valleyFog' },
      {
        attributes: ['position', 'uv'],
        uniforms: ['world', 'viewProjection', 'uCamRight', 'uCamUp', 'uCamPos', 'uCenter', 'uFog', 'uFade', 'uMood'],
        samplers: ['uTex'],
        needAlphaBlending: true,
      },
    );
    this.mat.setTexture('uTex', procTexture(scene, 'puff'));
    this.mat.backFaceCulling = false;
    this.mat.disableDepthWrite = true;
    this.mat.alphaMode = Constants.ALPHA_COMBINE;
    this.mat.onBindObservable.add(() => {
      const e = this.mat.getEffect();
      if (!e) return;
      e.setVector3('uCamRight', this.camRight);
      e.setVector3('uCamUp', this.camUp);
      e.setVector3('uCamPos', VALLEY_UNIFORMS.camPos);
      e.setVector3('uCenter', this.center);
      e.setFloat4('uFog', this.time, this.shownGrow, this.shake, 1 + this.darkness * 1.5);
      const dissolving = this.state !== 'solid';
      const alpha = dissolving ? 1 - smoothstep(0.3, 1.8, this.dissolveTime) : 1;
      const gold = dissolving ? clamp01(this.dissolveTime * 2) : 0;
      e.setFloat4('uFade', dissolving ? 0 : this.shownDensity, alpha, gold, this.darkness);
      e.setFloat4('uMood', VALLEY_UNIFORMS.mood, 0, 0, 0);
    });

    this.puffs = MeshBuilder.CreatePlane(`valley.fog:${spec.id}`, { size: 1 }, scene);
    this.puffs.material = this.mat;
    this.puffs.isPickable = false;
    this.puffs.alwaysSelectAsActiveMesh = true;
    this.puffs.alphaIndex = 10;
    const rnd = new Random(`valley-fog:${spec.id}`);
    const R = spec.radius;
    const list: number[][] = [];
    for (let i = 0; i < 44; i++) {
      const a = rnd.range(0, Math.PI * 2);
      const r = Math.sqrt(rnd.next()) * R * 0.95;
      // Heavy fog: most puffs low, a dome above the words.
      const y = rnd.range(0.2, 3.3) * (1 - (r / R) * 0.45);
      const s = rnd.range(1.9, 3.2) * (1 - (r / R) * 0.2);
      const cool = rnd.range(0, 1);
      list.push([spec.x + Math.cos(a) * r, groundY + y, spec.z + Math.sin(a) * r, s, 1 - cool * 0.1, 1 - cool * 0.06, 1, rnd.range(0.75, 1)]);
    }
    // A few low wisps around the edge, so it does not look like a ball.
    for (let i = 0; i < 10; i++) {
      const a = rnd.range(0, Math.PI * 2);
      const r = R * rnd.range(0.95, 1.35);
      list.push([spec.x + Math.cos(a) * r, groundY + rnd.range(0.1, 0.8), spec.z + Math.sin(a) * r, rnd.range(1.2, 2), 1, 1, 1, rnd.range(0.4, 0.7)]);
    }
    const matrices = new Float32Array(list.length * 16);
    const colors = new Float32Array(list.length * 4);
    const m = new Matrix();
    list.forEach((p, i) => {
      Matrix.ComposeToRef(new Vector3(p[3], p[3], p[3]), new Vector3(0, 0, 0).toQuaternion(), new Vector3(p[0], p[1], p[2]), m);
      m.copyToArray(matrices, i * 16);
      colors.set([p[4]!, p[5]!, p[6]!, p[7]!], i * 4);
    });
    this.puffs.thinInstanceSetBuffer('matrix', matrices, 16, true);
    this.puffs.thinInstanceSetBuffer('color', colors, 4, true);

    this.text = new TextCard(scene, `valley.fog:${spec.id}`, spec.text, 4.6, {
      color: '#3E4454',
      glow: 'rgba(252,249,241,1)',
      weight: 700,
      tracking: 0.04,
    });
    this.faceCamera(this.text.mesh, 2.1);
    this.releaseText = new TextCard(scene, `valley.release:${spec.id}`, spec.release, 5, {
      color: '#B8862E',
      glow: 'rgba(255,248,226,0.98)',
      weight: 700,
      tracking: 0.04,
    });
    this.faceCamera(this.releaseText.mesh, 3.0);
    this.releaseText.mesh.alphaIndex = 21;
    this.releaseText.setAlpha(0);

    // The beam of light from the sky: a wide soft glow and a bright core.
    const beamTex = beamTexture(scene);
    for (const [width, strength] of [
      [5, 0.55],
      [1.6, 0.9],
    ] as const) {
      const mat = createPaperMaterial(`valley.beamMat:${spec.id}`, scene, { texture: beamTex, additive: true, haze: false, curve: false });
      const mesh = MeshBuilder.CreatePlane(`valley.beam:${spec.id}`, { width, height: 70 }, scene);
      mesh.position.set(spec.x, groundY + 35, spec.z);
      mesh.billboardMode = TransformNode.BILLBOARDMODE_Y;
      mesh.material = mat;
      mesh.isPickable = false;
      mesh.isVisible = false;
      // Drawn after the fog, before the words.
      mesh.alphaIndex = 15;
      this.beams.push({ mesh, mat, width: strength });
    }
    // A ring of light that spreads over the ground.
    this.ringMat = createPaperMaterial(`valley.ringMat:${spec.id}`, scene, {
      texture: procTexture(scene, 'ring'),
      additive: true,
      haze: false,
      curve: false,
    });
    this.ring = MeshBuilder.CreateGround(`valley.ring:${spec.id}`, { width: 2, height: 2 }, scene);
    this.ring.position.set(spec.x, groundY + 0.15, spec.z);
    this.ring.material = this.ringMat;
    this.ring.isPickable = false;
    this.ring.isVisible = false;
  }

  private faceCamera(mesh: Mesh, height: number): void {
    mesh.rotation.x = 0;
    mesh.billboardMode = TransformNode.BILLBOARDMODE_Y;
    mesh.position.set(this.spec.x, this.center.y + height, this.spec.z);
  }

  get id(): string {
    return this.spec.id;
  }

  get active(): boolean {
    return this.state === 'solid';
  }

  /** Distance from a point to the edge of the cloud (0 or less = inside). */
  edgeDistance(x: number, z: number): number {
    return Math.hypot(x - this.spec.x, z - this.spec.z) - this.collider.radius;
  }

  /** Force: it grows, gets denser and darker. */
  push(): void {
    if (this.state !== 'solid') return;
    const b = TUNING.valley.blockade;
    this.pushes++;
    this.shake = 1;
    this.flicker = 1;
    this.grow = Math.min(b.maxGrow, this.grow + b.pushGrow);
    this.density = Math.min(2.2, this.density + b.pushDensity);
  }

  /** Exhaled light reaching the fog. Returns true when this light dissolved it. */
  receiveLight(light: number): boolean {
    if (this.state !== 'solid') return false;
    const b = TUNING.valley.blockade;
    this.density -= light * b.densityPerLight;
    this.grow = Math.max(1, this.grow - light * b.shrinkPerLight * (this.grow - 1 + 0.2));
    if (this.density <= 0) {
      this.density = 0;
      this.state = 'dissolving';
      this.dissolveTime = 0;
      this.collider.active = false;
      this.spawnBurst();
      for (const b of this.beams) b.mesh.isVisible = true;
      this.ring.isVisible = true;
      return true;
    }
    return false;
  }

  /** How dark the fog looks (0..1), set by the game from the pushes and the mood. */
  setDarkness(d: number): void {
    this.darkness = d;
  }

  private spawnBurst(): void {
    const ps = new ParticleSystem(`valley.burst:${this.id}`, 320, this.scene);
    ps.particleTexture = procTexture(this.scene, 'dot');
    ps.emitter = this.center.add(new Vector3(0, 1.4, 0));
    const r = this.spec.radius;
    ps.minEmitBox = new Vector3(-r, -1, -r);
    ps.maxEmitBox = new Vector3(r, 1.5, r);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.color1 = new Color4(1, 0.95, 0.75, 1);
    ps.color2 = new Color4(0.95, 0.78, 0.45, 1);
    ps.colorDead = new Color4(0.92, 0.77, 0.48, 0);
    ps.minSize = 0.12;
    ps.maxSize = 0.36;
    ps.minLifeTime = 1.6;
    ps.maxLifeTime = 3.2;
    ps.direction1 = new Vector3(-0.5, 1.5, -0.5);
    ps.direction2 = new Vector3(0.5, 3.2, 0.5);
    ps.minEmitPower = 0.6;
    ps.maxEmitPower = 1.4;
    ps.gravity = new Vector3(0, 0.4, 0);
    ps.manualEmitCount = 260;
    ps.disposeOnStop = true;
    ps.targetStopDuration = 4;
    ps.start();
  }

  update(dt: number, camera: Camera): void {
    this.time += dt;
    const view = camera.getViewMatrix();
    const v = view.m;
    this.camRight.set(v[0]!, v[4]!, v[8]!);
    this.camUp.set(v[1]!, v[5]!, v[9]!);
    this.shake *= Math.exp(-3 * dt);
    this.flicker = Math.max(0, this.flicker - dt * 1.2);
    this.shownDensity += (this.density - this.shownDensity) * damp(4, dt);
    this.shownGrow += (this.grow - this.shownGrow) * damp(5, dt);
    // The fog blocks exactly as far as it reaches.
    this.collider.radius = this.spec.radius * this.shownGrow;

    if (this.state === 'solid') {
      const flick = this.flicker > 0 ? 1 - 0.6 * Math.abs(Math.sin(this.time * 26)) * this.flicker : 1;
      this.text.setAlpha((0.4 + 0.6 * smoothstep(0.0, 0.5, this.shownDensity)) * flick);
      this.text.mesh.position.y = this.center.y + 2.1 * Math.max(1, this.shownGrow * 0.9);
      this.text.mesh.position.x = this.spec.x + Math.sin(this.time * 19) * 0.08 * this.shake;
      return;
    }

    // Release: the fog turns gold and fades, the beam falls from the sky,
    // the ring spreads over the ground, the release sentence appears.
    this.dissolveTime += dt;
    const d = this.dissolveTime;
    this.text.setAlpha(1 - smoothstep(0, 0.7, d));
    const beam = smoothstep(0, 0.35, d) * (1 - smoothstep(1.8, 3.6, d));
    for (const b of this.beams) {
      setPaperColor(b.mat, new Color4(1, 1, 1, beam * b.width));
      const w = 0.4 + 0.6 * smoothstep(0, 0.6, d);
      b.mesh.scaling.x = w;
      b.mesh.isVisible = beam > 0.01;
    }
    const rs = 1 + smoothstep(0, 2.2, d) * 8;
    this.ring.scaling.set(rs, 1, rs);
    setPaperColor(this.ringMat, new Color4(1, 1, 1, (1 - smoothstep(0.6, 2.4, d)) * 0.9));
    this.ring.isVisible = d < 2.5;
    const hold = 2.6;
    this.releaseText.setAlpha(smoothstep(0.5, 1.0, d) * (1 - smoothstep(0.9 + hold, 1.8 + hold, d)));
    this.releaseText.mesh.position.y = this.center.y + 3.0 + d * 0.15;
    if (d > 2.2) this.puffs.isVisible = false;
    if (d > 5) this.state = 'released';
  }
}

/** A soft vertical beam: bright at the bottom, fading toward the sky, soft at the sides. */
function beamTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture('valley.beamTex', { width: 64, height: 256 }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  tex.hasAlpha = true;
  tex.wrapU = Texture.CLAMP_ADDRESSMODE;
  tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 64, 256);
  const h = ctx.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(255,236,190,0)');
  h.addColorStop(0.3, 'rgba(255,236,190,0.6)');
  h.addColorStop(0.5, 'rgba(255,250,232,1)');
  h.addColorStop(0.7, 'rgba(255,236,190,0.6)');
  h.addColorStop(1, 'rgba(255,236,190,0)');
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 64, 256);
  const v = ctx.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(0,0,0,1)');
  v.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  v.addColorStop(0.98, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 64, 256);
  tex.update();
  return tex;
}
