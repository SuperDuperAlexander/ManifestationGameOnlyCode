import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE, SHADES } from '../config/palette';

export interface LoadedImage {
  texture: Texture;
  width: number;
  height: number;
  /** True when the file was missing and a coloured placeholder stands in. */
  placeholder: boolean;
}

interface Entry {
  promise: Promise<LoadedImage>;
  refs: number;
  result: LoadedImage | null;
}

export interface TextureKindOptions {
  /** Ground textures repeat. Cards and backdrop layers clamp. */
  wrap?: boolean;
  /** Anisotropic filtering for ground seen at an angle. */
  anisotropy?: number;
}

/**
 * Loads WebP images for the game. Paths in data files have no extension.
 * Every texture is counted: when no zone uses it any more, it is disposed.
 * A missing file never breaks the game: a palette-coloured placeholder with the
 * file name takes its place.
 */
export class AssetLoader {
  private readonly entries = new Map<string, Entry>();
  readonly missing = new Set<string>();

  constructor(
    private readonly scene: Scene,
    private base: string,
  ) {}

  setBase(base: string): void {
    this.base = base.endsWith('/') ? base : base + '/';
  }

  url(image: string): string {
    return `${this.base}${image}.webp`;
  }

  /** Loads (or reuses) an image and adds one reference. */
  acquire(image: string, opts: TextureKindOptions = {}): Promise<LoadedImage> {
    const key = `${image}|${opts.wrap ? 'w' : 'c'}`;
    const existing = this.entries.get(key);
    if (existing) {
      existing.refs++;
      return existing.promise;
    }
    const entry: Entry = { refs: 1, result: null, promise: Promise.resolve(null as never) };
    entry.promise = this.load(image, opts).then((r) => {
      entry.result = r;
      return r;
    });
    this.entries.set(key, entry);
    return entry.promise;
  }

  /** Drops one reference. The texture is disposed when nobody uses it. */
  release(image: string, opts: TextureKindOptions = {}): void {
    const key = `${image}|${opts.wrap ? 'w' : 'c'}`;
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refs--;
    if (entry.refs <= 0) {
      this.entries.delete(key);
      void entry.promise.then((r) => r.texture.dispose());
    }
  }

  get loadedCount(): number {
    return this.entries.size;
  }

  private load(image: string, opts: TextureKindOptions): Promise<LoadedImage> {
    return new Promise((resolve) => {
      let settled = false;
      const tex: Texture = new Texture(this.url(image), this.scene, {
        noMipmap: false,
        invertY: true,
        samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
        onLoad: () => {
          if (settled) return;
          settled = true;
          const size = tex.getBaseSize();
          tex.hasAlpha = true;
          const mode = opts.wrap ? Texture.WRAP_ADDRESSMODE : Texture.CLAMP_ADDRESSMODE;
          tex.wrapU = mode;
          tex.wrapV = mode;
          if (opts.anisotropy) tex.anisotropicFilteringLevel = opts.anisotropy;
          resolve({ texture: tex, width: size.width, height: size.height, placeholder: false });
        },
        onError: () => {
          if (settled) return;
          settled = true;
          tex.dispose();
          this.missing.add(image);
          console.warn(`[assets] missing image "${this.url(image)}". Using a placeholder.`);
          resolve(this.placeholder(image));
        },
      });
    });
  }

  /** A plane in a palette colour with the file name written on it. */
  private placeholder(image: string): LoadedImage {
    const size = 256;
    const tex = new DynamicTexture(`placeholder:${image}`, { width: size, height: size }, this.scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const colours = [PALETTE.sage, PALETTE.sandstone, PALETTE.powder, PALETTE.stone, PALETTE.gold];
    let h = 0;
    for (let i = 0; i < image.length; i++) h = (h * 31 + image.charCodeAt(i)) >>> 0;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = colours[h % colours.length]!;
    ctx.beginPath();
    ctx.roundRect(8, 8, size - 16, size - 16, 28);
    ctx.fill();
    ctx.fillStyle = SHADES.ink;
    ctx.font = '600 20px sans-serif';
    ctx.textAlign = 'center';
    const name = image.split('/').pop() ?? image;
    ctx.fillText(name, size / 2, size / 2);
    tex.update();
    tex.hasAlpha = true;
    return { texture: tex, width: size, height: size, placeholder: true };
  }
}
