import { Effect } from '@babylonjs/core/Materials/effect';
import { PostProcess } from '@babylonjs/core/PostProcesses/postProcess';
import { Constants } from '@babylonjs/core/Engines/constants';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import { BLOOM } from '../content/chapter1';
import type { QualitySettings } from '../core/quality';

/**
 * The painted look: a Kuwahara-style filter, then paper.
 *
 * Both run as full-screen passes after the world has been drawn. The scene
 * itself is rendered into the first pass's buffer, so a lower quality tier
 * drops the resolution of the whole picture and not only of the filter.
 */

const KUWAHARA = 'lwKuwahara';
const PAPER = 'lwPaper';
const BLOOM_CUT = 'lwBloomCut';
const BLOOM_BLUR = 'lwBloomBlur';

/**
 * A Kuwahara-style filter. It smooths areas into brush-like patches while it
 * keeps the edges, which gives the painted look.
 *
 * The kernel keeps a fixed tap count and widens its step instead, so a lower
 * quality tier runs the filter at a coarser resolution without costing more.
 */
Effect.ShadersStore[`${KUWAHARA}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec2 vUV;
  uniform sampler2D textureSampler;
  uniform vec2 uTexel;
  uniform float uStep;
  uniform float uAmount;

  // Four overlapping sectors of a 5 by 5 window. The sector with the lowest
  // variance wins, so flat areas smooth out and edges stay sharp. The window
  // is kept small and the step is widened instead, because the cost grows
  // with the square of the window but only the step sets the patch size.
  void sector(int sx, int sy, out vec3 mean, out float variance) {
    vec3 sum = vec3(0.0);
    vec3 sumSq = vec3(0.0);
    const int R = 2;
    for (int j = 0; j <= R; j++) {
      for (int i = 0; i <= R; i++) {
        vec2 off = vec2(float(i * sx), float(j * sy)) * uTexel * uStep;
        vec3 c = texture2D(textureSampler, vUV + off).rgb;
        sum += c;
        sumSq += c * c;
      }
    }
    float n = float((R + 1) * (R + 1));
    mean = sum / n;
    vec3 v = abs(sumSq / n - mean * mean);
    variance = v.r + v.g + v.b;
  }

  void main() {
    vec3 original = texture2D(textureSampler, vUV).rgb;

    vec3 m0, m1, m2, m3;
    float v0, v1, v2, v3;
    sector(-1, -1, m0, v0);
    sector( 1, -1, m1, v1);
    sector(-1,  1, m2, v2);
    sector( 1,  1, m3, v3);

    vec3 best = m0;
    float bestV = v0;
    if (v1 < bestV) { bestV = v1; best = m1; }
    if (v2 < bestV) { bestV = v2; best = m2; }
    if (v3 < bestV) { bestV = v3; best = m3; }

    gl_FragColor = vec4(mix(original, best, uAmount), 1.0);
  }
`;

/**
 * Bloom, in two steps at a quarter of the width and height.
 *
 * The first keeps only what is brighter than daylight — the guide, the
 * springs, the sun, the gold at the end of a chapter — and throws the rest
 * away. The second smears what is left sideways, and then downwards on a
 * second run, which is far cheaper than smearing in both directions at once
 * and looks the same.
 *
 * It runs after the painting filter and not before it. Before it, the filter
 * would break a soft halo into brush patches, which is the one thing a halo
 * must not do.
 */
Effect.ShadersStore[`${BLOOM_CUT}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec2 vUV;
  uniform sampler2D textureSampler;
  uniform float uThreshold;
  void main() {
    vec3 col = texture2D(textureSampler, vUV).rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    // A soft knee, so a surface drifting past the threshold brightens
    // gradually instead of switching a halo on.
    float keep = smoothstep(uThreshold, uThreshold * 2.0, lum);
    gl_FragColor = vec4(col * keep, 1.0);
  }
`;

Effect.ShadersStore[`${BLOOM_BLUR}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec2 vUV;
  uniform sampler2D textureSampler;
  uniform vec2 uStep;
  void main() {
    // Nine taps, weighted as a bell. At a quarter resolution this reaches
    // a long way across the finished picture.
    vec3 sum = texture2D(textureSampler, vUV).rgb * 0.2270270270;
    sum += texture2D(textureSampler, vUV + uStep * 1.3846153846).rgb * 0.3162162162;
    sum += texture2D(textureSampler, vUV - uStep * 1.3846153846).rgb * 0.3162162162;
    sum += texture2D(textureSampler, vUV + uStep * 3.2307692308).rgb * 0.0702702703;
    sum += texture2D(textureSampler, vUV - uStep * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

/**
 * The last pass: a subtle procedural paper grain, soft edge darkening
 * (a vignette) and the soft screen darkening used inside the fog.
 */
Effect.ShadersStore[`${PAPER}FragmentShader`] = /* glsl */ `
  precision highp float;
  varying vec2 vUV;
  uniform sampler2D textureSampler;
  #ifdef LW_BLOOM
  // The sharp picture. The blurred highlights arrive as textureSampler,
  // because this pass sits at the end of the chain the blur runs in.
  uniform sampler2D uSharp;
  uniform float uBloom;
  #endif
  uniform float uTime;
  uniform float uGrain;
  uniform float uVignette;
  uniform float uExposure;
  uniform float uDarken;
  uniform vec2 uResolution;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Tone mapping, then the linear to sRGB conversion. Both belong here
  // rather than in the materials: the sky, the grass and the pollen are raw
  // shaders that would otherwise be left out and drift away from everything
  // else. ACES keeps highlights from clipping to flat white.
  vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  vec3 toSRGB(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, step(c, vec3(0.0031308)));
  }

  void main() {
    #ifdef LW_BLOOM
    vec3 col = texture2D(uSharp, vUV).rgb + texture2D(textureSampler, vUV).rgb * uBloom;
    #else
    vec3 col = texture2D(textureSampler, vUV).rgb;
    #endif

    // Everything above this point is in linear light.
    col = toSRGB(aces(col * uExposure));

    // Paper grain: a fixed fibre pattern plus a very slow drift, so the
    // picture looks like paint on paper and never like video noise.
    vec2 p = vUV * uResolution;
    float fibre = hash(floor(p)) * 0.55 + hash(floor(p * 0.21) + 11.0) * 0.45;
    float drift = hash(floor(p * 0.5) + floor(uTime * 1.5)) * 0.2;
    col += (fibre + drift - 0.62) * uGrain;

    // Soft edge darkening.
    float d = distance(vUV, vec2(0.5));
    col *= 1.0 - smoothstep(0.32, 0.86, d) * uVignette;

    // Inside the fog the screen darkens softly. Never to black.
    vec3 dim = mix(col, col * 0.42 + vec3(0.03, 0.035, 0.055), uDarken);
    col = mix(col, dim, 1.0);
    col *= 1.0 - uDarken * 0.18;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export class PainterlyRenderer {
  private kuwahara: PostProcess | null = null;
  private bloomCut: PostProcess | null = null;
  private bloomH: PostProcess | null = null;
  private bloomV: PostProcess | null = null;
  private paper: PostProcess | null = null;
  /** Off on the cheapest tier. The halo is the first thing a slow device loses. */
  private bloom = false;
  /**
   * The buffer the world is drawn into before the filter runs.
   *
   * Everything up to the last pass is in linear light, and linear light does
   * not stay inside 0 to 1: a glow added on top of a lit surface goes past
   * it, and an eight-bit buffer cuts those off before the tone mapping has a
   * chance to roll them down. Half floats keep them, which is the difference
   * between a soft highlight and a flat white patch. A device that cannot
   * render into them falls back, and gets banding rather than a black screen.
   */
  private readonly bufferType: number;
  private renderScale = 1;
  private brushStep = 1.9;
  private darken = 0;
  private time = 0;
  private paintEnabled: boolean;

  /**
   * Safe mode: the scene straight to the canvas, with no post-processing at
   * all.
   *
   * It is a way out and a way to find out. A device that shows a black screen
   * through the passes and a correct one in safe mode has a problem with the
   * render targets; one that is black either way has a problem with the
   * world's own shaders. Either answer takes one tap on a phone, which is
   * worth more than any amount of guessing from here.
   */
  readonly safeMode: boolean;

  constructor(
    private readonly engine: Engine,
    private readonly scene: Scene,
    private camera: Camera,
    enabled: boolean,
    safeMode = false,
  ) {
    this.paintEnabled = enabled;
    this.safeMode = safeMode;
    this.bufferType = engine.getCaps().textureHalfFloatRender
      ? Constants.TEXTURETYPE_HALF_FLOAT
      : Constants.TEXTURETYPE_UNSIGNED_BYTE;
    if (safeMode) {
      // The paper pass is what normally does the tone mapping and the move
      // into sRGB. Without it the materials have to do both themselves, or
      // the picture comes out dark and flat rather than merely unpainted.
      const processing = scene.imageProcessingConfiguration;
      processing.applyByPostProcess = false;
      processing.toneMappingEnabled = true;
      processing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
      processing.exposure = 1;
    } else {
      // Everything leaves the materials in linear light and is converted once,
      // at the end, together with the raw shaders.
      scene.imageProcessingConfiguration.applyByPostProcess = true;
      this.build();
    }
  }

  private build(): void {
    this.dispose();
    if (this.safeMode) return;

    if (this.paintEnabled) {
      this.kuwahara = new PostProcess(
        KUWAHARA,
        KUWAHARA,
        ['uTexel', 'uStep', 'uAmount'],
        null,
        this.renderScale,
        this.camera,
        Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
        this.engine,
        false,
        null,
        this.bufferType,
      );
      const kuwahara = this.kuwahara;
      kuwahara.onApply = (effect): void => {
        effect.setFloat2(
          'uTexel',
          1 / Math.max(1, kuwahara.width),
          1 / Math.max(1, kuwahara.height),
        );
        effect.setFloat('uStep', this.brushStep);
        effect.setFloat('uAmount', 1);
      };
    }
    if (this.bloom) {
      this.bloomCut = new PostProcess(
        BLOOM_CUT,
        BLOOM_CUT,
        ['uThreshold'],
        null,
        BLOOM.scale,
        this.camera,
        Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
        this.engine,
        false,
        null,
        this.bufferType,
      );
      this.bloomCut.onApply = (effect): void => {
        effect.setFloat('uThreshold', BLOOM.threshold);
      };
      const blur = (name: string, across: boolean): PostProcess => {
        const pass = new PostProcess(
          name,
          BLOOM_BLUR,
          ['uStep'],
          null,
          BLOOM.scale,
          this.camera,
          Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
          this.engine,
          false,
          null,
          this.bufferType,
        );
        pass.onApply = (effect): void => {
          const w = Math.max(1, pass.width);
          const h = Math.max(1, pass.height);
          effect.setFloat2('uStep', across ? BLOOM.radius / w : 0, across ? 0 : BLOOM.radius / h);
        };
        return pass;
      };
      this.bloomH = blur(`${BLOOM_BLUR}H`, true);
      this.bloomV = blur(`${BLOOM_BLUR}V`, false);
    }

    this.paper = new PostProcess(
      PAPER,
      PAPER,
      ['uTime', 'uGrain', 'uVignette', 'uExposure', 'uDarken', 'uResolution', 'uBloom'],
      this.bloom ? ['uSharp'] : null,
      this.renderScale,
      this.camera,
      Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
      this.engine,
      false,
      this.bloom ? '#define LW_BLOOM\n' : null,
      this.bufferType,
    );
    const paper = this.paper;
    const cut = this.bloomCut;
    paper.onApply = (effect): void => {
      effect.setFloat('uTime', this.time);
      effect.setFloat('uGrain', 0.035);
      effect.setFloat('uVignette', 0.34);
      effect.setFloat('uExposure', 0.85);
      effect.setFloat('uDarken', this.darken);
      effect.setFloat2('uResolution', paper.width, paper.height);
      if (cut) {
        // What went into the highlight cut is the finished painted picture.
        effect.setTextureFromPostProcess('uSharp', cut);
        effect.setFloat('uBloom', BLOOM.strength);
      }
    };
  }

  setCamera(camera: Camera): void {
    this.camera = camera;
    this.build();
  }

  applyQuality(q: QualitySettings): void {
    // A lower tier widens the brush step and drops the post-processing
    // resolution, which is where most of the cost sits.
    this.brushStep = q.paintScale >= 1 ? 1.9 : q.paintScale >= 0.75 ? 2.8 : 3.6;
    const scale = q.paintScale >= 1 ? 1 : q.paintScale >= 0.75 ? 0.85 : 0.5;
    const bloom = q.bloom;
    if (scale === this.renderScale && bloom === this.bloom) return;
    this.renderScale = scale;
    this.bloom = bloom;
    this.build();
  }

  setPaintEnabled(on: boolean): void {
    if (on === this.paintEnabled) return;
    this.paintEnabled = on;
    this.build();
  }

  /** 0 normal, 1 the muffled look inside the fog. */
  setDarken(value: number): void {
    this.darken = value;
  }

  /** Called on resize. The passes size themselves from the engine. */
  setSize(): void {
    for (const pass of [this.kuwahara, this.bloomCut, this.bloomH, this.bloomV, this.paper]) {
      pass?.markTextureDirty();
    }
  }

  render(time: number): void {
    this.time = time;
    this.scene.render();
  }

  dispose(): void {
    for (const pass of [this.kuwahara, this.bloomCut, this.bloomH, this.bloomV, this.paper]) {
      pass?.dispose(this.camera);
    }
    this.kuwahara = null;
    this.bloomCut = null;
    this.bloomH = null;
    this.bloomV = null;
    this.paper = null;
  }
}
