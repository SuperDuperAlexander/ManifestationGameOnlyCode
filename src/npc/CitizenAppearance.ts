import { PALETTE, SHADES } from '../config/palette';
import type { CitizenColors } from '../outer/townLayout';

export interface CitizenAppearance {
  tunic: string;
  sleeve: string;
  scarf: string;
  boots: string;
  trousers: string;
  hair: string;
  skin: string;
  belt: string;
}

/** Small, related colour groups for the approved town style. */
export const CITIZEN_PALETTES = {
  earthy: {
    tunic: PALETTE.olive,
    sleeve: PALETTE.ivory,
    scarf: SHADES.scarf,
    boots: SHADES.umber,
    trousers: SHADES.legs,
    hair: SHADES.citizenHair,
    skin: SHADES.citizenSkinLight,
    belt: SHADES.citizenBelt,
  },
  muted: {
    tunic: PALETTE.stone,
    sleeve: PALETTE.ivory,
    scarf: PALETTE.powder,
    boots: SHADES.citizenTrouser,
    trousers: SHADES.legs,
    hair: SHADES.citizenGreyHair,
    skin: SHADES.citizenSkinMedium,
    belt: SHADES.umber,
  },
  deep: {
    tunic: SHADES.cloakShadow,
    sleeve: PALETTE.sandstone,
    scarf: SHADES.citizenClay,
    boots: SHADES.umber,
    trousers: SHADES.citizenTrouser,
    hair: SHADES.citizenHair,
    skin: SHADES.citizenSkinDeep,
    belt: SHADES.citizenBelt,
  },
  market: {
    tunic: SHADES.citizenMoss,
    sleeve: PALETTE.ivory,
    scarf: PALETTE.gold,
    boots: SHADES.citizenTrouser,
    trousers: SHADES.legs,
    hair: SHADES.umber,
    skin: SHADES.citizenSkinMedium,
    belt: SHADES.timber,
  },
  dusk: {
    tunic: SHADES.citizenBlue,
    sleeve: PALETTE.ivory,
    scarf: PALETTE.sandstone,
    boots: SHADES.umber,
    trousers: SHADES.citizenTrouser,
    hair: SHADES.citizenGreyHair,
    skin: SHADES.citizenSkinLight,
    belt: SHADES.timberDark,
  },
  clay: {
    tunic: SHADES.citizenClay,
    sleeve: PALETTE.ivory,
    scarf: SHADES.citizenMoss,
    boots: SHADES.umber,
    trousers: SHADES.legs,
    hair: SHADES.citizenHair,
    skin: SHADES.citizenSkinDeep,
    belt: SHADES.timber,
  },
} satisfies Record<string, Partial<CitizenAppearance>>;

const VARIANTS: Record<CitizenColors, readonly (keyof typeof CITIZEN_PALETTES)[]> = {
  earthy: ['earthy', 'market'],
  muted: ['muted', 'dusk'],
  deep: ['deep', 'clay'],
};

function seededIndex(seed: number, length: number): number {
  const n = Math.sin((Number.isFinite(seed) ? seed : 0) * 127.1 + 311.7) * 43758.5453;
  return Math.floor((n - Math.floor(n)) * length);
}

/** Make a stable appearance from the citizen's colour family and seed. */
export function citizenAppearance(
  colors: CitizenColors,
  seed: number,
  overrides: Partial<CitizenAppearance> = {},
): CitizenAppearance {
  const variant = VARIANTS[colors][seededIndex(seed, VARIANTS[colors].length)]!;
  const base = CITIZEN_PALETTES[variant];
  return {
    tunic: base.tunic ?? PALETTE.olive,
    sleeve: base.sleeve ?? PALETTE.ivory,
    scarf: base.scarf ?? SHADES.scarf,
    boots: base.boots ?? SHADES.umber,
    trousers: base.trousers ?? SHADES.legs,
    hair: base.hair ?? SHADES.citizenHair,
    skin: base.skin ?? SHADES.citizenSkinLight,
    belt: base.belt ?? SHADES.citizenBelt,
    ...overrides,
  };
}
