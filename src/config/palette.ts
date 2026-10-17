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
  /** Inner world (violet twilight, Alexander 2026-10-17): sky top, a deep soft blue-violet. */
  innerSkyTop: '#8668D0',
  /** Inner world: soft pink-magenta glow at the horizon and around the light. */
  innerSkyGlow: '#E8A0CC',
  /** Inner world: lavender haze (distance fog and clear colour). */
  innerHaze: '#D6B4EC',
  /** Inner world: blue-violet tree crowns and bushes (shade side / lit side). */
  innerSpark: '#FFD878',
  innerFoliage: '#6670C0',
  innerFoliageLit: '#B0BCF4',
  /** Inner world: grass, blue-green tinted violet (base / tip). */
  innerGrass: '#123E58',
  innerGrassTip: '#6CB4D0',
  /** Inner world: glowing crystal flowers, pale violet and pale blue. */
  innerCrystal: '#A868FF',
  innerCrystalBlue: '#38C4F0',
  /** Inner world: pink crystals. */
  innerCrystalPink: '#F068C0',
  /** Inner world: pond and stream glow, cyan-blue. */
  innerWater: '#5FD0EA',
  /** Inner world: floating light motes. */
  innerMote: '#F3E6FF',
  /** Inner world: far mountains, violet (near / far). */
  innerFarNear: '#9C84C8',
  innerFarFar: '#C4B0E4',
  /** Outer town (original sunny look): sky top, haze, far mesas (near / mid / far, with tops), foliage, cypress, bush, grass, rock. */
  outerSkyTop: '#9DB9DA',
  outerHaze: '#EAE3D5',
  outerFarNear: '#B7A99F',
  outerFarNearTop: '#C6B6A6',
  outerFarMid: '#B6BBCB',
  outerFarMidTop: '#C3C6D2',
  outerFarFar: '#C9D2DE',
  outerFarFarTop: '#D3DAE3',
  outerFoliage: '#6D7B52',
  outerFoliageLit: '#B3B67A',
  outerCypress: '#55623E',
  outerCypressLit: '#8F9C62',
  outerBush: '#66744C',
  outerBushLit: '#A5AD72',
  outerRock: '#8E8A90',
  outerRockLit: '#D0C7BC',
  outerGrass: '#6F8447',
  outerGrassTip: '#B6C173',
  outerStem: '#7F8A55',
  outerPetal: '#FBF6EA',
  /** Soft ink for text: a deep, warm grey-blue. Never pure black. */
  ink: '#4E5566',
  /** Thought Bubble: cloud edge shade (warm cream), rim outline (sandy brown) and text ink (deep blue-grey). */
  bubbleEdge: '#E6CBA2',
  bubbleRim: '#C98F5E',
  bubbleInk: '#2E3444',
  /** The cloak's shadow side. */
  cloakShadow: '#7A2519',
  /** Scarf on the cloak, from the reference design. */
  scarf: '#DA7A4A',
  /** Warm dark brown for feet and the face shadow. */
  umber: '#4A3428',
  /** The figure's legs, a touch darker than the boots. */
  legs: '#3E2C23',
  /** Light the fairy gives: brighter than gold. */
  fairyLight: '#FFF1C9',
  /** Anger as heat: the warm orange of the haze and the shimmer. */
  heatOrange: '#E0793A',
  /** Anger as heat: the red of the screen edge when a wave hits. */
  emberRed: '#D2402A',
  /** Anger as heat: warm, slightly grey ivory for smoke and steam. */
  smokeIvory: '#EFE6D6',
  /** Anger Imp: body, between sandstone and cloak. */
  impBody: '#D8683F',
  /** Anger Imp: cream belly. */
  impBelly: '#F2D9B0',
  /** Anger Imp: horns, hands and feet, dark umber. */
  impHorn: '#5A4136',
  /** Anger Imp: the warm pale-gold flame. */
  impFlame: '#FFE3A0',
  /** Torch flame: the pale, hot core. */
  flameCore: '#FFE9B8',
  /** Lantern: full light, white-gold. */
  lanternWhite: '#FFF6DC',
  /** Lantern: weak ember. */
  lanternEmber: '#C9663A',
  /** Lantern: relit, warm gold-orange. */
  lanternWarm: '#F2A24A',
  /** Steam lightning: small gold-orange zig-zag bolts. */
  boltOrange: '#F2A23A',
  /** Town houses: terracotta roof tile, dark and light. */
  roofTile: '#B85F44',
  roofTileLight: '#CC8260',
  /** Town houses: warm wood (beams, shutters, balconies) and its dark side. */
  timber: '#8A5E42',
  timberDark: '#5E4030',
  /** Town houses: dusky window glass. */
  glass: '#6F86A6',
  /** Town houses: soft leaf green for flower boxes. */
  leaf: '#7F9460',
  /** Citizen tunic: soft blue-grey for a calm town variation. */
  citizenBlue: '#71839A',
  /** Citizen cloth: muted clay for warm clothing variations. */
  citizenClay: '#A85F4A',
  /** Citizen cloth: dusty green for natural clothing variations. */
  citizenMoss: '#657354',
  /** Citizen trousers: warm grey-brown. */
  citizenTrouser: '#665449',
  /** Citizen hair: soft brown, never pure black. */
  citizenHair: '#6B5142',
  /** Citizen hair: muted grey-brown. */
  citizenGreyHair: '#898276',
  /** Citizen skin: light warm peach. */
  citizenSkinLight: '#E6B891',
  /** Citizen skin: medium warm brown. */
  citizenSkinMedium: '#B97A55',
  /** Citizen skin: deep warm brown. */
  citizenSkinDeep: '#80533F',
  /** Citizen belt: dark leather brown. */
  citizenBelt: '#79543C',
  /** Deep green used by the quiet menu controls. */
  uiDeep: '#344a3b',
  /** Warm paper used by the menu card. */
  uiPaper: '#fbf7e9',
  /** Muted text used by menu help. */
  uiMuted: '#687261',
  /** Soft green mist behind the menu light. */
  uiMist: '#bdc6a4',
  /** Sage green used by the menu light. */
  uiSage: '#718879',
  /** Pale veil used by the start screen. */
  uiVeil: '#f5f0e5',
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
