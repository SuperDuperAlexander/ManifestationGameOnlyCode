import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import { createPaperMaterial, setPaperColor, type PaperMaterial } from '../shaders/paperShader';

export interface TextCardStyle {
  color: string;
  /** Soft halo behind the letters, for reading on any background. */
  glow: string;
  weight?: 400 | 700;
  /** Letter spacing in em. */
  tracking?: number;
}

/** Words floating in the world, drawn once into a texture. Faces the camera like the paper cards. */
export class TextCard {
  readonly mesh: Mesh;
  private readonly mat: PaperMaterial;
  private readonly tex: DynamicTexture;
  private alpha = 1;

  constructor(scene: Scene, name: string, text: string, widthMetres: number, style: TextCardStyle) {
    const w = 1024;
    const h = 256;
    this.tex = new DynamicTexture(`text:${name}`, { width: w, height: h }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    this.tex.hasAlpha = true;
    const ctx = this.tex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, w, h);
    let size = 108;
    const font = (): string => `${style.weight ?? 400} ${size}px "Work Sans", system-ui, sans-serif`;
    ctx.font = font();
    const tracking = style.tracking ?? 0.02;
    const measure = (): number => ctx.measureText(text).width + tracking * size * text.length;
    while (measure() > w - 80 && size > 40) {
      size -= 4;
      ctx.font = font();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) (ctx as { letterSpacing: string }).letterSpacing = `${tracking}em`;
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = 28;
    ctx.fillStyle = style.glow;
    ctx.fillText(text, w / 2, h / 2);
    ctx.shadowBlur = 10;
    ctx.fillText(text, w / 2, h / 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = style.color;
    ctx.fillText(text, w / 2, h / 2);
    this.tex.update();

    this.mat = createPaperMaterial(`textMat:${name}`, scene, { texture: this.tex, alphaBlend: true, haze: false });
    this.mesh = MeshBuilder.CreatePlane(`text:${name}`, { width: widthMetres, height: (widthMetres * h) / w }, scene);
    this.mesh.material = this.mat;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.rotation.x = (TUNING.cards.leanBackDeg * Math.PI) / 180;
    // Text is drawn after the fog around it.
    this.mesh.alphaIndex = 20;
  }

  setAlpha(a: number): void {
    this.alpha = a;
    this.mesh.isVisible = a > 0.005;
    setPaperColor(this.mat, new Color4(1, 1, 1, a));
  }

  get opacity(): number {
    return this.alpha;
  }

  dispose(): void {
    this.mesh.dispose();
    this.mat.dispose(false, false);
    this.tex.dispose();
  }
}
