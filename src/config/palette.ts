import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';

export const PALETTE = {
  sandstone: '#E8A77C',
  olive: '#7D7F5A',
  sage: '#A8B58A',
  powder: '#9FB8D6',
  ivory: '#F4EEDF',
  gold: '#EBC57A',
  cloak: '#B8432F',
  stone: '#A39E94',
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** A few extra shades derived from the palette. Used for code-made things only. */
export const SHADES = {
  /** Soft ink for text: a deep, warm grey-blue. Never pure black. */
  ink: '#4E5566',
  /** The cloak's shadow side. */
  cloakShadow: '#7A2519',
  /** Scarf on the cloak, from the reference design. */
  scarf: '#DA7A4A',
  /** Warm dark brown for feet and the face shadow. */
  umber: '#4A3428',
  /** Light the fairy gives: brighter than gold. */
  fairyLight: '#FFF1C9',
} as const;

export function color3(hex: string): Color3 {
  return Color3.FromHexString(hex);
}

export function color4(hex: string, alpha = 1): Color4 {
  const c = Color3.FromHexString(hex);
  return new Color4(c.r, c.g, c.b, alpha);
}

/** CSS rgba() string from a palette hex. */
export function rgba(hex: string, alpha: number): string {
  const c = Color3.FromHexString(hex);
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alpha})`;
}
