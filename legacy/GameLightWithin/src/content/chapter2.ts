/**
 * Every tunable number for chapter 2 "Be aware".
 * Systems must not contain magic numbers; they read from here.
 *
 * Chapter 1 stays the owner of everything the two chapters share: the breath
 * rhythms, the calm rules, the camera and the shadow box. This file holds only
 * what chapter 2 adds or changes.
 */

import { LIGHT, MANIFEST } from './chapter1';

/** The six scenes of chapter 2. */
export type Scene2Id = 1 | 2 | 3 | 4 | 5 | 6;

/** The three feelings, shown as weather. */
export type FeelingType = 'sadness' | 'anger' | 'worry';

export const FEELINGS: FeelingType[] = ['sadness', 'anger', 'worry'];

/**
 * The player starts chapter 2 with light of their own. Light is not carried
 * over: a chapter opens on the same footing whichever way the player came.
 */
export const CHAPTER2 = {
  startLight: 3,
  /**
   * How much colour the meadows already hold at the start.
   *
   * Chapter 1 begins in full grey, because learning to receive is what brings
   * the colour back. A player who has walked that does not arrive somewhere
   * grey again: the meadows are already alive, and this chapter's moments lift
   * them the rest of the way.
   */
  startColor: 0.55,
  /** Chapter 2 helps less than chapter 1, so the breath circle is quieter. */
  circleStrength: 0.6,
};

export const WEATHER = {
  /** The weather chases at this share of the player's walking speed. */
  followSpeedFactor: 0.9,
  /**
   * How high above the ground a weather sits.
   *
   * Low enough that a cloud following the player is in the picture with them
   * and clearly raining on them, rather than a smudge above the top edge.
   */
  height: 3.2,
  /** How close the weather tries to stay when it follows. */
  followRadius: 1.2,
  /** Intensity can never leave this range. */
  minIntensity: 0,
  maxIntensity: 1,
  /** A correct name takes this share off the intensity. */
  namedDrop: 0.4,
  /** A wrong name makes the signature this much stronger instead. */
  wrongGrowth: 0.12,
  /** One sound breath tone takes this share off anger and worry. */
  toneDrop: 0.2,
  /** Below this the weather is spent and dissolves. */
  spentIntensity: 0.05,
  /** How long a weather takes to dissolve, in seconds. */
  dissolveSeconds: 2.5,
};

export const NAMING = {
  /** Standing still this long near a weather opens the panel. */
  stillSeconds: 3,
  /** Movement faster than this counts as walking. */
  stillSpeed: 0.25,
  /** How close the player must be. */
  radius: 8,
  /** One calm breath must be done before the panel can open. */
  breathsNeeded: 1,
  /** A wrong answer closes the panel for this long. */
  lockSeconds: 4,
};

export const SOUND_BREATH = {
  /**
   * An out-breath must be at least this share of the target to make a tone.
   *
   * A tone is a reward for a full breath out, not for letting go early. It is
   * a hair under one rather than exactly one because nobody lets go of a key
   * on the exact frame, and a breath that misses by a twentieth of a second
   * should sing.
   */
  minExhaleFactor: 0.95,
  /** How far a tone reaches. */
  radius: 12,
  /** A pentatonic scale, in semitones above the base note. */
  scale: [0, 2, 4, 7, 9],
  /** The base note in hertz. */
  baseHz: 196,
  /** How long one tone rings. */
  toneSeconds: 2.4,
  /** How far the ring of light travels. */
  ringRadius: 6,
  ringSeconds: 1.6,
};

/** The four body points, in the order the stones stand. */
export const BODY_POINTS = ['feet', 'belly', 'heart', 'head'] as const;
export type BodyPoint = (typeof BODY_POINTS)[number];

export const BODY = {
  /** Calm breaths at each stone. */
  breathsPerStone: 3,
  /** How close the player must stand. */
  radius: 4,
  /** Light for each stone. */
  lightPerStone: 1,
  /** The silhouette after the fourth stone, in seconds. */
  silhouetteSeconds: 3,
  /** Height of each glow point above the player's feet, in metres. */
  heights: { feet: 0.15, belly: 0.95, heart: 1.25, head: 1.62 },
};

export const RAIN = {
  /** Calm breaths under the rain. */
  feelBreaths: 2,
  /** How close the player must stay while feeling it. */
  feelRadius: 6,
  /** Light when the cloud lets go. */
  lightReward: 2,
  zoneRadius: 16,
  /** Where the cloud first appears, relative to the player. */
  spawnAhead: 10,
  startIntensity: 0.8,
  /**
   * How wide the cloud is.
   *
   * It follows the player and settles above them, so its size is how much of
   * their view it takes. Big enough to be unmistakably over them and raining
   * on them; not so big that they cannot see where they are walking.
   */
  cloudSize: 3.4,
  /** How long the rainbow stays. */
  rainbowSeconds: 6,
};

export const STORM = {
  /** The player must stay this close while the message is shown. */
  seeRadius: 10,
  /** How long the message takes to show. */
  seeSeconds: 3,
  /** Calm breaths inside this radius. */
  feelRadius: 6,
  feelBreaths: 2,
  /** Sound breath tones that open the storm. */
  tonesNeeded: 5,
  /** The quiet middle. */
  centerRadius: 2.5,
  centerBreaths: 3,
  /** Running away makes it grow, with the same caps as the chapter 1 fog. */
  fleeGrowth: 0.1,
  fleeGrowthMax: 0.3,
  pushExtraBreaths: 1,
  pushExtraBreathsMax: 1,
  dissolveSeconds: 2.5,
  lightReward: 3,
  zoneRadius: 20,
  startIntensity: 1,
};

export const THUNDER = {
  /** The shortest and the longest wait between rolls of thunder, in seconds. */
  minSeconds: 7,
  spreadSeconds: 9,
  /** How close the player must be for the thunder to be about them. */
  nearAmount: 0.35,
};

export const SINGING_STONE = {
  /** How close the player must stand for the stone to answer. */
  radius: 5,
  /** The note the stone hums, in hertz. */
  hz: 98,
};

export const SEEDS2 = {
  cost: LIGHT.seedCost,
  /** Spot A sits in the storm's leftover wind, which costs calm faster. */
  windyCalmDecayFactor: 2,
  /** Everything else follows the chapter 1 rules. */
  awayRadius: MANIFEST.awayRadius,
  growSeconds: MANIFEST.growSeconds,
  mindSeedSpeedFactor: MANIFEST.mindSeedSpeedFactor,
  mindSeedFadeSeconds: MANIFEST.mindSeedFadeSeconds,
  /** A mind tree gives this much light back when it fades. */
  mindSeedReturn: 2,
};

export const LIGHT_WELL = {
  /** Light for each calm breath. */
  lightPerBreath: 1,
  /** It only gives while the player has less than this. */
  maxLight: 5,
  radius: 3.5,
};

export const NIGHT = {
  /** Calm breaths of thanks under the heart tree. */
  breaths: 3,
  radius: 4.5,
  /** How long the sky takes to turn. */
  fallSeconds: 8,
  /** How long the player takes to lie down before the dream, in seconds. */
  lieDownSeconds: 2,
  /** The dream, in seconds. */
  dreamSeconds: 13,
  colorSeconds: 6,
};

export const HINTS2 = {
  /** Scene 1: a bird lands on the spring after this long without receiving. */
  birdAfterSeconds: 180,
};

export const SPRING2 = {
  /** The one spring of scene 1 gives this much light. */
  light: 3,
  drawRadius: 3,
  zoneRadius: 16,
};

/** Where things stand in the meadows. Z runs away from the player's start. */
export const LAYOUT2 = {
  playerStart: { x: 0, z: 6 },
  spring: { x: 4.5, z: -12 },
  bodyStones: [
    { point: 'feet', x: -6, z: -26 },
    { point: 'belly', x: -3.5, z: -33 },
    { point: 'heart', x: -1, z: -40 },
    { point: 'head', x: 1.5, z: -47 },
  ],
  rain: { x: 0, z: -58 },
  singingStone: { x: -7, z: -68 },
  storm: { x: 0, z: -82, radius: 6.5 },
  // The two seed spots and the well between them.
  //
  // They are this far apart on purpose. A seed only grows while the player is
  // outside its away radius, so if the well sat within that radius of either
  // spot, standing at the well would stop the very seed the well is there to
  // pay for. Each spot is about 20 m from the well and 40 m from the other.
  seedA: { x: -20, z: -98 },
  seedB: { x: 20, z: -106 },
  lightWell: { x: 0, z: -102 },
  bird: { x: 7.5, z: -14 },
};

/** Where `?chapter=2&scene=N` drops the player, and with how much light. */
export const SCENE2_STARTS: Record<Scene2Id, { x: number; z: number; light: number }> = {
  1: { x: 0, z: 6, light: CHAPTER2.startLight },
  2: { x: -6, z: -20, light: 6 },
  3: { x: 0, z: -50, light: 10 },
  4: { x: 0, z: -72, light: 12 },
  5: { x: 0, z: -96, light: 12 },
  6: { x: 12, z: -104, light: 10 },
};

export const WORLD2 = {
  halfWidth: 60,
  lengthStart: 14,
  lengthEnd: -118,
  borderSoftness: 10,
  terrainSegments: 168,
  /** The sky runs one slow day in this many seconds of play. */
  daySeconds: 900,
  /**
   * How much grass the meadows want, against the tier's own count.
   *
   * The walkable floor here is about half again the area of the chapter 1
   * valley, so the same number of cards reads thinner on the ground. This
   * takes back most of the difference without taking all of it, and the
   * quality watchdog can still step the whole thing down on a slow device.
   */
  grassDensity: 1.3,
};
