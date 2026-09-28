import type { Engine } from '@babylonjs/core/Engines/engine';

/**
 * What this device's graphics actually are.
 *
 * The game looked right on every machine I could test it on and rendered a
 * black sky on a real phone. The difference is never visible from here: a
 * desktop driver and a software renderer both treat `mediump` as full
 * precision and support every buffer format going, so a shader that a mobile
 * GPU cannot run compiles and looks fine. This reads the truth off the device
 * and puts it on the screen, so a screenshot from the phone says what is
 * wrong instead of leaving it to be guessed at.
 */
export interface Diagnostics {
  /** 1 or 2. The game needs 2; a device with 1 cannot run it at all. */
  webgl: number;
  /** The GPU as the driver names it, when the browser will say. */
  gpu: string;
  /** Whether a fragment shader on this device really has high precision. */
  highpFragment: boolean;
  /** Whether half-float buffers can be rendered into and filtered. */
  halfFloat: boolean;
  halfFloatLinear: boolean;
  /** The CSS size of the canvas against the pixels actually drawn. */
  cssSize: string;
  bufferSize: string;
  pixelRatio: number;
  devicePixelRatio: number;
  /** The viewport as the page sees it, which on a phone is not the window. */
  viewport: string;
  /** Anything the driver complained about while compiling a shader. */
  shaderErrors: string[];
}

const shaderErrors: string[] = [];

/**
 * Catches driver complaints about shaders.
 *
 * The engine writes these to the console, where nobody on a phone will ever
 * see them. This keeps them so the debug panel can show them.
 */
export function watchShaderErrors(): void {
  const original = console.error.bind(console);
  console.error = (...args: unknown[]): void => {
    const text = args.map((a) => String(a)).join(' ');
    if (/shader|glsl|program|webgl/i.test(text) && shaderErrors.length < 6) {
      shaderErrors.push(text.slice(0, 300));
    }
    original(...args);
  };
}

function gpuName(gl: WebGL2RenderingContext | WebGLRenderingContext): string {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
    return String(gl.getParameter(gl.RENDERER));
  } catch {
    return 'unknown';
  }
}

export function readDiagnostics(engine: Engine): Diagnostics {
  const gl = engine._gl;
  const canvas = engine.getRenderingCanvas();
  let highp: boolean;
  try {
    const format = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    highp = (format?.precision ?? 0) > 0;
  } catch {
    highp = false;
  }
  const isGl2 = engine.webGLVersion >= 2;
  const caps = engine.getCaps();
  const scaling = engine.getHardwareScalingLevel();
  return {
    webgl: isGl2 ? 2 : 1,
    gpu: gpuName(gl),
    highpFragment: highp,
    // WebGL 2 has half-float colour buffers in core; only filtering is an
    // extension, and a renderer that cannot filter them shows banding, not
    // black.
    halfFloat: caps.textureHalfFloatRender,
    halfFloatLinear: caps.textureHalfFloatLinearFiltering,
    cssSize: `${String(Math.round(canvas?.clientWidth ?? 0))}x${String(Math.round(canvas?.clientHeight ?? 0))}`,
    bufferSize: `${String(engine.getRenderWidth())}x${String(engine.getRenderHeight())}`,
    pixelRatio: Number((1 / (scaling || 1)).toFixed(2)),
    devicePixelRatio: globalThis.devicePixelRatio ?? 1,
    viewport: `${String(Math.round(window.innerWidth))}x${String(Math.round(window.innerHeight))}`,
    shaderErrors: [...shaderErrors],
  };
}
