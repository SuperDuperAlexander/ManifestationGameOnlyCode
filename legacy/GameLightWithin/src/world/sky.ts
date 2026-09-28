import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { LIGHTING } from '../content/chapter1';
import { PALETTE } from '../content/palette';
import { colorState } from '../render/colorRestore';
import { circleGeo, sphereGeo } from '../render/geometry';
import { linearColor, mesh as makeMesh, stage } from '../render/scene3d';

const SKY = 'lwSky';

/**
 * A large sky dome with a painted gradient and soft cloud strokes from noise.
 * It warms up as the valley returns to colour.
 */
Effect.ShadersStore[`${SKY}VertexShader`] = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  uniform mat4 worldViewProjection;
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = worldViewProjection * vec4(position, 1.0);
  }
`;

Effect.ShadersStore[`${SKY}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform float uGlobalColor;
  uniform float uTime;
  uniform vec3 uGreySky;
  uniform vec3 uWarmSky;
  uniform vec3 uViolet;
  uniform vec3 uSun;
  uniform float uStrokes;
  uniform float uNight;
  uniform float uDay;
  uniform vec3 uNightSky;
  uniform vec3 uStars;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += noise(p) * a; p *= 2.03; a *= 0.5; }
    return s;
  }
  // A cheaper one for the high thin cloud, which has no fine detail anyway.
  float fbm3(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { s += noise(p) * a; p *= 2.11; a *= 0.5; }
    return s;
  }

  void main() {
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
    // Painted gradient: darker at the top, pale at the horizon.
    vec3 grey = mix(uGreySky * 0.82, uGreySky * 1.04, pow(h, 0.7));
    vec3 warm = mix(uWarmSky, uViolet * 1.05, pow(h, 1.3));
    vec3 sky = mix(grey, warm, uGlobalColor);
    // The day runs from morning to evening: the horizon warms and the
    // dome above it deepens, without the whole sky changing hue at once.
    sky = mix(sky, mix(uWarmSky * 1.06, uViolet * 0.86, pow(h, 0.9)), uDay * 0.55);

    // Where the sky meets the ground it takes the colour of the distance
    // haze. Without this the two are near misses of each other and the join
    // reads as a line across the picture rather than as air.
    sky = mix(sky, uHorizon, (1.0 - smoothstep(0.0, 0.16, abs(h - 0.5))) * 0.55);

    // Where the sun is. Worked out before the clouds, because the clouds
    // near it catch it. One source of truth: the same direction the sun
    // disc stands at, so the paint and the thing agree.
    float d = max(dot(vDir, uSunDir), 0.0);

    // Soft cloud strokes. Strokes are stretched sideways like brush marks.
    vec2 p = vec2(atan(vDir.z, vDir.x) * 1.6, vDir.y * 3.4);
    // Three layers: broad banks that drift, finer strokes on top of them,
    // and a high thin veil that barely moves. The veil only shows on the
    // tiers that ask for it; on the cheapest one the sky keeps two layers.
    float bank = fbm(p * vec2(0.55, 1.5) + vec2(uTime * 0.004, 0.0));
    float detail = fbm(p * vec2(1.6, 3.2) + vec2(uTime * 0.011, 0.0));
    float clouds = bank * 0.65 + detail * 0.35;
    if (uStrokes > 6.0) {
      float veil = fbm3(p * vec2(0.26, 0.8) + vec2(uTime * 0.0016, 0.0));
      clouds = mix(clouds, max(clouds, veil * 0.86), 0.45);
    }
    // A wider, softer edge than before, with a brighter core inside it, so a
    // cloud has a lit middle and a rim that dissolves instead of a cut line.
    float body = smoothstep(0.40, 0.82, clouds);
    float core = smoothstep(0.58, 0.88, clouds);
    clouds = (body * 0.72 + core * 0.28) * smoothstep(0.0, 0.35, h) * (uStrokes / 12.0 * 0.6 + 0.5);
    vec3 cloudCol = mix(vec3(0.84), mix(vec3(1.0), uSun, 0.28), uGlobalColor);
    // Cloud near the sun is lit from behind and goes warm and bright.
    cloudCol = mix(cloudCol, cloudCol + uSun * 0.9, pow(d, 3.0) * (0.25 + uGlobalColor * 0.55) * (1.0 - uNight));
    sky = mix(sky, cloudCol, clouds * 0.66);

    // One soft sun. It sinks toward the horizon as the day runs on.
    sky += uSun * pow(d, 40.0) * (0.12 + uGlobalColor * 0.4) * (1.0 - uNight);
    sky += uSun * pow(d, 6.0) * 0.035 * (0.3 + uGlobalColor) * (1.0 - uNight);

    if (uNight > 0.001) {
      // Night: one deep blue, darkest overhead, with stars above the haze.
      vec3 night = mix(uNightSky * 1.35, uNightSky * 0.7, pow(h, 0.8));
      // Stars are points of a coarse hash, so they hold still while the
      // clouds drift. They fade out near the horizon, where the haze is.
      vec2 sp = vDir.xz / max(abs(vDir.y) + 0.15, 0.15) * 5.0;
      vec2 cell = floor(sp * 2.2);
      // Only about one cell in eight holds a star, and the star sits
      // somewhere inside it, so the sky is not a regular grid of dots.
      float pick = hash(cell);
      float star = 0.0;
      if (pick > 0.86) {
        vec2 at = vec2(hash(cell + 3.1), hash(cell + 7.7));
        // Not named d: the sun's d is still in scope, and a shadowed
        // variable is the kind of thing a stricter driver refuses.
        float inCell = length(fract(sp * 2.2) - at);
        star = smoothstep(0.09, 0.0, inCell) * (0.5 + hash(cell + 11.3));
      }
      star *= smoothstep(0.05, 0.4, h);
      night += uStars * star * 1.5;
      // A moon, opposite where the sun went down.
      vec3 moonDir = normalize(vec3(-0.35, 0.5, 0.82));
      // The moon is a disc measured by angle, not a power falloff. A
      // pow() with an exponent in the hundreds is at the mercy of the
      // driver: some clamp it, some return inf, and an inf here turns the
      // whole sky black. An angle and two smoothsteps cannot do that.
      float ang = acos(clamp(dot(vDir, moonDir), -1.0, 1.0));
      night += uStars * (1.0 - smoothstep(0.030, 0.038, ang)) * 1.4;
      night += uStars * (1.0 - smoothstep(0.0, 0.45, ang)) * 0.05;
      sky = mix(sky, night, uNight);
    }

    gl_FragColor = vec4(sky, 1.0);
  }
`;

/** The sky dome. Radius 320: well inside the camera's far plane of 400. */
export function buildSky(strokes: number): Mesh {
  const scene = stage();
  const material = new ShaderMaterial(
    SKY,
    scene,
    { vertex: SKY, fragment: SKY },
    {
      attributes: ['position'],
      uniforms: [
        'worldViewProjection',
        'uGlobalColor',
        'uTime',
        'uGreySky',
        'uWarmSky',
        'uViolet',
        'uSun',
        'uStrokes',
        'uNight',
        'uDay',
        'uNightSky',
        'uStars',
      ],
    },
  );
  // Colours arrive in linear light like the rest of the scene. The final
  // pass converts the whole picture to sRGB.
  material.setColor3('uGreySky', linearColor(PALETTE.skyGrey));
  material.setColor3('uWarmSky', linearColor(PALETTE.warmSky));
  material.setColor3('uViolet', linearColor(PALETTE.farHillsViolet));
  material.setColor3('uSun', linearColor(PALETTE.sun));
  material.setColor3('uNightSky', linearColor(PALETTE.night));
  material.setColor3('uStars', linearColor(PALETTE.stars));
  material.setColor3('uHorizon', linearColor(PALETTE.skyGrey));
  material.setVector3('uSunDir', sunDirection(0, new Vector3()));
  material.setFloat('uStrokes', strokes);
  material.setFloat('uNight', 0);
  material.setFloat('uDay', 0);
  material.setFloat('uTime', 0);
  material.setFloat('uGlobalColor', 0);
  // The camera stands inside the dome, so both faces are drawn and the
  // depth test picks the one in front.
  material.backFaceCulling = false;
  material.fogEnabled = false;

  const sky = makeMesh('sky', sphereGeo(320, 32, 20));
  sky.material = material;
  sky.alwaysSelectAsActiveMesh = true;
  sky.isPickable = false;
  sky.receiveShadows = false;
  return sky;
}

const SUN = 'lwSunDisc';

Effect.ShadersStore[`${SUN}VertexShader`] = /* glsl */ `
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

Effect.ShadersStore[`${SUN}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uStrength;
  void main() {
    // A bright core that falls away to nothing. A hard disc here would read
    // as a sticker on the sky, and the sky already paints its own sun.
    float r = length(vUv - vec2(0.5)) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.45, r);
    float glow = 1.0 - smoothstep(0.0, 1.0, r);
    gl_FragColor = vec4(uColor * (core + glow * 0.35) * uStrength, 1.0);
  }
`;

/**
 * The sun, as a thing rather than as paint.
 *
 * The sun in this game is a few lines in the sky shader, which is fine to
 * look at and no use at all to the rays through the trees: they need
 * somewhere to come from. This is that somewhere — a soft disc turned
 * toward the camera, standing at the same angle the shader paints, adding
 * its light to the painted one rather than covering it.
 *
 * It rides with the sky dome, so it stays put as the player walks, and it
 * goes out at night.
 */
export function buildSunDisc(sky: Mesh): Mesh {
  const disc = makeMesh('sunDisc', circleGeo(16, 20));
  const material = new ShaderMaterial(
    SUN,
    stage(),
    { vertex: SUN, fragment: SUN },
    {
      attributes: ['position', 'uv'],
      uniforms: ['worldViewProjection', 'uColor', 'uStrength'],
      // Light is added to the sky, never painted over it. Without this the
      // engine takes the disc for an opaque surface and the sun goes black.
      needAlphaBlending: true,
    },
  );
  material.setColor3('uColor', linearColor(PALETTE.sun));
  material.setFloat('uStrength', 1);
  material.alphaMode = Constants.ALPHA_ADD;
  material.disableDepthWrite = true;
  material.backFaceCulling = false;
  material.fogEnabled = false;
  disc.material = material;
  disc.isPickable = false;
  disc.billboardMode = Mesh.BILLBOARDMODE_ALL;
  disc.parent = sky;
  setSunHeight(disc, 0);
  return disc;
}

/** Which way the sun lies. 0 morning, 1 evening. */
export function sunDirection(day: number, out: Vector3): Vector3 {
  out.set(
    LIGHTING.sunEast,
    LIGHTING.sunHeightMorning + (LIGHTING.sunHeightEvening - LIGHTING.sunHeightMorning) * day,
    LIGHTING.sunNorth,
  );
  return out.normalize();
}

/** Puts the disc where the shader paints the sun. 0 morning, 1 evening. */
function setSunHeight(disc: Mesh, day: number): void {
  sunDirection(day, disc.position).scaleInPlace(300);
}

export function updateSky(sky: Mesh, time: number): void {
  const material = sky.material as ShaderMaterial;
  material.setFloat('uTime', time);
  material.setFloat('uGlobalColor', colorState.globalColor);
  // The horizon wears the same colour as the distance haze, so the ground
  // does not end at a line. It follows the haze as the valley warms.
  material.setColor3('uHorizon', colorState.hazeColor);
}

/** 0 day, 1 night. Everything else in the sky follows this one number. */
export function setSkyNight(sky: Mesh, night: number, sun: Mesh | null = null): void {
  const n = Math.max(0, Math.min(1, night));
  (sky.material as ShaderMaterial).setFloat('uNight', n);
  // The rays go out with the sun. There is no such thing as a moonbeam here.
  if (sun) {
    (sun.material as ShaderMaterial).setFloat('uStrength', 1 - n);
    sun.setEnabled(n < 0.99);
  }
}

/** 0 morning, 1 evening. */
export function setSkyDay(sky: Mesh, day: number, sun: Mesh | null = null): void {
  const d = Math.max(0, Math.min(1, day));
  const material = sky.material as ShaderMaterial;
  material.setFloat('uDay', d);
  material.setVector3('uSunDir', sunDirection(d, scratch));
  if (sun) setSunHeight(sun, d);
}

const scratch = new Vector3();
