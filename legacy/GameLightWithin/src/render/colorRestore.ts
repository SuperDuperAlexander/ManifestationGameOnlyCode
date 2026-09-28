import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import type { Material } from '@babylonjs/core/Materials/material';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer';
import type { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { COLOR } from '../content/chapter1';
import { PALETTE } from '../content/palette';
import { linearColor } from './scene3d';

/**
 * The grey-to-colour system.
 *
 * Every world material shares one piece of shader code and one set of values.
 * An array holds the restored zones as (centre x, centre z, radius, strength).
 * Inside a zone the material shows full colour. Outside it shows a
 * desaturated, slightly blue-grey version, held below the restored side in
 * brightness so the change reads without colour perception. The global value
 * lifts the whole valley into colour at the end of the chapter.
 *
 * On the lit materials this is a material plugin: the engine's own shader is
 * still the one doing the lighting, and this adds two small pieces to it.
 * The raw shaders — sky, grass, pollen, mountains — read the same values
 * through `bindColorState`, so there is one source of truth for all of them.
 */

export interface ColorZone {
  x: number;
  z: number;
  /** Target radius in metres. */
  radius: number;
  /** Current radius, grown over 2 to 4 seconds. */
  current: number;
  strength: number;
  growSeconds: number;
}

/**
 * The live values. One object, read by every material in the world.
 *
 * `revision` counts changes. A material that has already written the current
 * revision into its uniform buffer has nothing to do, which is what keeps
 * thirty materials from each re-uploading the same numbers every frame.
 */
export const colorState = {
  /** Flat x, z, radius, strength for each zone. */
  zones: new Float32Array(COLOR.maxZones * 4),
  zoneCount: 0,
  globalColor: 0,
  greyTint: linearColor(PALETTE.startGrey),
  /** How much darker the grey side is than the restored one. */
  greyDim: 0.8,
  /** The colour of the rim light. It warms as the valley returns to colour. */
  rimColor: linearColor(PALETTE.skyGrey),
  /**
   * 0 day, 1 night. Chapter 2's last scene turns this up.
   *
   * Moonlight is not darkness. Night here keeps the colours the meadows have
   * won and cools them toward the night blue, so a restored meadow still
   * reads as restored under the moon.
   */
  night: 0,
  nightTint: linearColor(PALETTE.night),
  /** The colour distant ground fades into, and where the fade runs. */
  hazeColor: linearColor(PALETTE.skyGrey),
  hazeStart: 38,
  hazeEnd: 185,
  revision: 1,
};

/** Marks the shared values as changed, so the materials pick them up. */
export function touchColorState(): void {
  colorState.revision++;
}

const FRAG_DEFINITIONS = /* glsl */ `
/** How much colour this world point has, 0 grey to 1 full. */
float lwColorAmount(vec3 worldPos) {
  float amount = uGlobalColor;
  for (int i = 0; i < ${String(COLOR.maxZones)}; i++) {
    if (float(i) >= uZoneCount) break;
    vec4 zone = uZones[i];
    if (zone.z <= 0.001) continue;
    float d = distance(worldPos.xz, zone.xy);
    // Full colour in the middle, soft falloff at the rim.
    float inside = 1.0 - smoothstep(zone.z * 0.55, zone.z, d);
    amount = max(amount, inside * zone.w);
  }
  return clamp(amount, 0.0, 1.0);
}

/** The grey side of a colour: desaturated, blue-grey, and never brighter. */
vec3 lwGrey(vec3 base) {
  float lum = dot(base, vec3(0.299, 0.587, 0.114));
  vec3 greyed = mix(vec3(lum), uGreyTint * (0.6 + lum * 0.8), 0.4);
  // Colour alone is not a safe cue, so a restored area must also read as
  // brighter to someone who cannot see the colour change. The blue-grey tint
  // lifts dark colours, which would put the grey side *above* the restored
  // one, so the grey side is held to a fixed fraction of the original
  // brightness. It is only ever pulled down, never up, so pale areas keep
  // their soft look.
  float greyLum = dot(greyed, vec3(0.299, 0.587, 0.114));
  return greyed * min(1.0, (lum * uGreyDim) / max(greyLum, 1e-4));
}
`;

const FRAG_ALBEDO = /* glsl */ `
{
  float lwAmount = lwColorAmount(vPositionW);
  surfaceAlbedo = mix(lwGrey(surfaceAlbedo), surfaceAlbedo, lwAmount);
  // Night: cooler and dimmer, but never flat. The colour that is there stays
  // there, so a moonlit meadow is a moonlit meadow and not a grey one.
  if (uNight > 0.001) {
    vec3 lwMoonlit = mix(surfaceAlbedo, uNightTint * 2.2, 0.38) * 0.92;
    surfaceAlbedo = mix(surfaceAlbedo, lwMoonlit, uNight);
  }
}
`;

/**
 * The rim light, and then the distance haze.
 *
 * The rim is what separates a shape from what is behind it. Without it an
 * untextured world reads as flat blocks; with it every hill, tree and rock
 * keeps a clear edge against the sky. It goes on before the haze, so a
 * far-off hill cannot rim-light its way back out of the mist.
 *
 * The haze is aerial perspective: distant ground fades into the sky, which
 * is what gives an open valley its depth. It is worked out here rather than
 * left to the engine's own fog, for two reasons. It eases in and out instead
 * of ramping straight, so a hill does not start hazing at a hard line. And
 * it measures depth into the screen rather than distance from the eye, so
 * the amount of haze on a hill does not change when the player turns to look
 * at it side on.
 */
const FRAG_RIM_AND_HAZE = /* glsl */ `
{
  vec4 lwView = view * vec4(vPositionW, 1.0);
  // The normal and the eye direction in view space, which is where the
  // "facing up" term below is measured: up the screen, not up the world.
  vec3 lwN = normalize((view * vec4(normalW, 0.0)).xyz);
  vec3 lwV = normalize((view * vec4(vEyePosition.xyz - vPositionW, 0.0)).xyz);
  float lwRim = 1.0 - clamp(dot(lwN, lwV), 0.0, 1.0);
  lwRim = pow(lwRim, 2.6) * uRimStrength;
  // Brighter where the surface also faces up, so the light reads as coming
  // from the sky rather than from the camera.
  lwRim *= 0.45 + 0.55 * clamp(lwN.y * 0.5 + 0.5, 0.0, 1.0);
  finalColor.rgb += uRimColor * lwRim;

  float lwHaze = smoothstep(uHaze.x, uHaze.y, -lwView.z);
  finalColor.rgb = mix(finalColor.rgb, uHazeColor, lwHaze);
}
`;

/** Makes one lit material take part in the grey-to-colour system. */
export class ColorRestorePlugin extends MaterialPluginBase {
  /** How strong the rim light is on this surface, 0 to about 1.5. */
  rim: number;
  private written = 0;

  constructor(material: Material, rim: number) {
    super(material, 'LightWithinColor', 200, {});
    this.rim = rim;
    this._enable(true);
  }

  override getClassName(): string {
    return 'ColorRestorePlugin';
  }

  override getUniforms(): {
    ubo: { name: string; size: number; type: string; arraySize?: number }[];
  } {
    return {
      ubo: [
        { name: 'uZones', size: 4, type: 'vec4', arraySize: COLOR.maxZones },
        { name: 'uZoneCount', size: 1, type: 'float' },
        { name: 'uGlobalColor', size: 1, type: 'float' },
        { name: 'uGreyDim', size: 1, type: 'float' },
        { name: 'uRimStrength', size: 1, type: 'float' },
        { name: 'uNight', size: 1, type: 'float' },
        { name: 'uGreyTint', size: 3, type: 'vec3' },
        { name: 'uRimColor', size: 3, type: 'vec3' },
        { name: 'uNightTint', size: 3, type: 'vec3' },
        { name: 'uHazeColor', size: 3, type: 'vec3' },
        { name: 'uHaze', size: 2, type: 'vec2' },
      ],
    };
  }

  override getCustomCode(shaderType: string): Record<string, string> | null {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: FRAG_DEFINITIONS,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: FRAG_ALBEDO,
      CUSTOM_FRAGMENT_BEFORE_FOG: FRAG_RIM_AND_HAZE,
    };
  }

  override bindForSubMesh(uniformBuffer: UniformBuffer): void {
    // The rim strength belongs to this material; everything else is shared,
    // so it is only written when something has actually changed it.
    uniformBuffer.updateFloat('uRimStrength', this.rim);
    if (this.written === colorState.revision) return;
    this.written = colorState.revision;
    uniformBuffer.updateFloatArray('uZones', colorState.zones);
    uniformBuffer.updateFloat('uZoneCount', colorState.zoneCount);
    uniformBuffer.updateFloat('uGlobalColor', colorState.globalColor);
    uniformBuffer.updateFloat('uGreyDim', colorState.greyDim);
    uniformBuffer.updateFloat('uNight', colorState.night);
    uniformBuffer.updateColor3('uGreyTint', colorState.greyTint);
    uniformBuffer.updateColor3('uRimColor', colorState.rimColor);
    uniformBuffer.updateColor3('uNightTint', colorState.nightTint);
    uniformBuffer.updateColor3('uHazeColor', colorState.hazeColor);
    uniformBuffer.updateFloat2('uHaze', colorState.hazeStart, colorState.hazeEnd);
  }
}

/**
 * Pushes the shared values into a raw shader material.
 *
 * The sky, the grass, the pollen and the mountains are their own shaders
 * rather than lit surfaces, so they cannot use the plugin. They read the same
 * numbers through this, which is what keeps a grass blade and the ground
 * under it turning colour together.
 */
export function bindColorState(material: ShaderMaterial): void {
  material.setArray4('uZones', Array.from(colorState.zones));
  material.setFloat('uZoneCount', colorState.zoneCount);
  material.setFloat('uGlobalColor', colorState.globalColor);
  material.setColor3('uGreyTint', colorState.greyTint);
  material.setFloat('uGreyDim', colorState.greyDim);
  material.setFloat('uNight', colorState.night);
  material.setColor3('uNightTint', colorState.nightTint);
}

/** The uniform names `bindColorState` writes, for a shader's uniform list. */
export const COLOR_STATE_UNIFORMS = [
  'uZones',
  'uZoneCount',
  'uGlobalColor',
  'uGreyTint',
  'uGreyDim',
  'uNight',
  'uNightTint',
];

/** The shader code the raw shaders share with the lit ones. */
export const COLOR_STATE_GLSL = /* glsl */ `
uniform vec4 uZones[${String(COLOR.maxZones)}];
uniform float uZoneCount;
uniform float uGlobalColor;
uniform vec3 uGreyTint;
uniform float uGreyDim;
uniform float uNight;
uniform vec3 uNightTint;
${FRAG_DEFINITIONS}
`;

/** Holds the live zones and grows them smoothly. */
export class ColorRestoreState {
  readonly zones: ColorZone[] = [];
  globalColor = 0;
  private globalTarget = 0;
  private globalSeconds = 1;
  reducedMotion = false;

  private get motionFactor(): number {
    return this.reducedMotion ? COLOR.reducedMotionFactor : 1;
  }

  addZone(x: number, z: number, radius: number, strength = 1): void {
    if (this.zones.length >= COLOR.maxZones) {
      // Drop the oldest zone. The global value carries the valley at the end anyway.
      this.zones.shift();
    }
    const spread = COLOR.zoneGrowSecondsMax - COLOR.zoneGrowSecondsMin;
    const grow = COLOR.zoneGrowSecondsMin + Math.random() * spread;
    this.zones.push({ x, z, radius, current: 0, strength, growSeconds: grow * this.motionFactor });
  }

  /** Animates the whole valley to full colour. */
  setGlobalTarget(value: number, seconds: number): void {
    this.globalTarget = value;
    this.globalSeconds = Math.max(0.001, seconds * this.motionFactor);
  }

  update(dt: number): void {
    for (const zone of this.zones) {
      if (zone.current < zone.radius) {
        zone.current = Math.min(zone.radius, zone.current + (zone.radius / zone.growSeconds) * dt);
      }
    }
    if (this.globalColor !== this.globalTarget) {
      const step = dt / this.globalSeconds;
      this.globalColor =
        this.globalColor < this.globalTarget
          ? Math.min(this.globalTarget, this.globalColor + step)
          : Math.max(this.globalTarget, this.globalColor - step);
    }
    this.writeState();
  }

  private writeState(): void {
    const arr = colorState.zones;
    for (let i = 0; i < COLOR.maxZones; i++) {
      const zone = this.zones[i];
      arr[i * 4] = zone ? zone.x : 0;
      arr[i * 4 + 1] = zone ? zone.z : 0;
      arr[i * 4 + 2] = zone ? zone.current : 0;
      arr[i * 4 + 3] = zone ? zone.strength : 0;
    }
    colorState.zoneCount = Math.min(this.zones.length, COLOR.maxZones);
    colorState.globalColor = this.globalColor;
    touchColorState();
  }

  reset(): void {
    this.zones.length = 0;
    this.globalColor = 0;
    this.globalTarget = 0;
    this.writeState();
  }
}

export { Color3 };
