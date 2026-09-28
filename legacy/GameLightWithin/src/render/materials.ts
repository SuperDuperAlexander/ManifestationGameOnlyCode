import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { Color3 } from '@babylonjs/core/Maths/math.color';
import { ColorRestorePlugin } from './colorRestore';
import { FRONT_FACE, linearColor, stage } from './scene3d';

/**
 * The shading model for the whole world.
 *
 * Surfaces are lit properly: a directional sun with a real shadow, plus an
 * environment map generated from the game's own sky, which is what fills the
 * shadowed side of everything with sky light instead of a flat ambient guess.
 * On top of that every surface carries a rim light so its shape reads against
 * whatever is behind it.
 *
 * Nothing here is metal and everything is rough. This is a valley of grass,
 * bark and stone.
 */

export interface WorldMaterialOptions {
  /** A palette string, a hex number, or a colour already in linear light. */
  color?: string | number | Color3;
  /** How strong the rim light is on this surface, 0 to about 1.5. */
  rim?: number;
  roughness?: number;
  /** Draw both faces. Used by thin things like water discs seen edge on. */
  doubleSided?: boolean;
}

/** Every world material, so a quality change can reach all of them at once. */
const worldMaterials: PBRMaterial[] = [];

/**
 * A world material: physically based, rim lit, and taking part in the
 * grey-to-colour system.
 */
export function worldMaterial(options: WorldMaterialOptions = {}): PBRMaterial {
  const scene = stage();
  const material = new PBRMaterial(`world-${String(worldMaterials.length)}`, scene);
  const color = options.color ?? 0xffffff;
  material.albedoColor = typeof color === 'object' ? color : linearColor(color);
  material.metallic = 0;
  material.roughness = options.roughness ?? 0.94;
  // Nothing in the valley is polished, so the tight highlight a default
  // dielectric gives is turned right down. What reads as light on a surface
  // here is the sky filling it, not a lamp bouncing off it.
  material.metallicF0Factor = 0.12;
  material.backFaceCulling = !options.doubleSided;
  material.sideOrientation = FRONT_FACE;
  // A thin thing seen from behind is still lit, rather than going black.
  material.twoSidedLighting = options.doubleSided ?? false;
  // Tone mapping and the move into sRGB happen once, in the final pass, so
  // the lit surfaces must leave this shader in linear light like the raw
  // shaders do. Anything else and the two drift apart.
  material.useLogarithmicDepth = false;
  new ColorRestorePlugin(material, options.rim ?? 0.55);
  worldMaterials.push(material);
  return material;
}

/** Forgets the materials of a world that has been torn down. */
export function clearWorldMaterials(): void {
  worldMaterials.length = 0;
}
