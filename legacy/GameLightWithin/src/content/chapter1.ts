/**
 * Every tunable number for chapter 1 "Receive".
 * Systems must not contain magic numbers; they read from here.
 */

export type SceneId = 1 | 2 | 3 | 4 | 5 | 6;

export interface RhythmPreset {
  readonly id: 'normal' | 'slow' | 'easy';
  /** Target in-breath in seconds. */
  readonly inhale: number;
  /** Target out-breath in seconds. */
  readonly exhale: number;
  /** Allowed relative deviation, 0.3 = plus or minus 30 percent. */
  readonly tolerance: number;
}

/**
 * The rhythms.
 *
 * These are shorter than a breathing practice would use on purpose. A four
 * second in-breath and a six second out-breath is a fine thing to sit with,
 * but in a game it is ten seconds of holding a key before anything happens,
 * and the player feels the wait rather than the breath. `slow` keeps the
 * longer rhythm for anyone who wants it.
 */
export const RHYTHM_PRESETS: Record<RhythmPreset['id'], RhythmPreset> = {
  normal: { id: 'normal', inhale: 3, exhale: 4, tolerance: 0.35 },
  slow: { id: 'slow', inhale: 4, exhale: 6, tolerance: 0.3 },
  easy: { id: 'easy', inhale: 2, exhale: 3, tolerance: 0.45 },
};

export const BREATH = {
  /** Movement faster than this counts as walking and resets the breath. */
  walkResetSpeed: 0.25,
  /**
   * Calm breaths needed to wake the glow in scene 1. One is enough: the point
   * is to feel the first breath land, not to drill a count.
   */
  wakeBreaths: 1,
  /**
   * Seconds the game waits between the in-breath ending and the out-breath
   * starting before it gives up on the breath.
   */
  holdGraceFactor: 2,
  /** Outline strength of the breath circle. 1.0 in chapter 1, lower in later chapters. */
  circleStrength: 1.0,
  /** A breath shorter than this is treated as a mis-tap, not a breath. */
  minBreathSeconds: 0.35,
} as const;

export const CALM = {
  /** Calm value gained per calm breath. */
  gainPerCalmBreath: 0.18,
  /** Calm value lost per non-calm breath. */
  lossPerNonCalmBreath: 0.08,
  /** Calm value lost per second while walking. */
  lossPerSecondWalking: 0.02,
  /** Calm value lost per second while standing but not breathing calmly. */
  lossPerSecondIdle: 0.004,
  min: 0,
  max: 1,
  /** At or above this value a planted seed becomes a heart seed. */
  heartThreshold: 0.6,
} as const;

export const LIGHT = {
  max: 12,
  seedCost: 5,
  /** Motes orbiting the player, one per light carried. */
  moteOrbitRadius: 0.85,
  moteOrbitSpeed: 0.55,
} as const;

export const RECEIVE = {
  /** The player must stand this close to draw light from a spring. */
  drawRadius: 3,
  /** A hidden spring reveals itself after calm breaths taken inside this radius. */
  revealRadius: 6,
  /** Calm breaths needed inside `revealRadius` to reveal a hidden spring. */
  revealBreaths: 1,
  /**
   * Light a spring gives per calm breath. A spring holds three, so one calm
   * breath empties it. Standing still for a whole breath is the moment that
   * matters; repeating it three times only adds waiting.
   */
  lightPerBreath: 3,
  /** Seconds a light mote takes to travel from spring to player. */
  moteFlightSeconds: 1,
  /** Radius of the colour zone a spent spring leaves behind. */
  zoneRadius: 16,
} as const;

export const TRANSFORM = {
  /** Step 1 "see it" starts inside this radius. */
  seeRadius: 8,
  /** Seconds the thought text needs to appear fully. Cannot be skipped. */
  seeSeconds: 2.5,
  /** Step 2 "feel it" starts inside this radius. */
  feelRadius: 5,
  /** Calm breaths needed for step 2. */
  feelBreaths: 1,
  /** Step 3 "become one" starts inside this radius of the fog centre. */
  centerRadius: 2,
  /**
   * Calm breaths needed for step 3. One, like every other gate: the fog
   * already asks the player to see it, stand in the wind, and walk into the
   * middle. Asking for a second breath on top only adds waiting.
   */
  centerBreaths: 1,
  /** Leaving `seeRadius` before step 3 ends grows the fog by this factor. */
  fleeGrowth: 0.1,
  /** The fog never grows by more than this in total. */
  fleeGrowthMax: 0.3,
  /** Metres the fog drifts toward the player each time they run away. */
  fleeDriftMetres: 1,
  /** Each push adds this many calm breaths to step 3. */
  pushExtraBreaths: 1,
  /** Pushing never adds more than this many breaths. Push never works. */
  pushExtraBreathsMax: 1,
  /** Seconds the fog takes to dissolve into motes. */
  dissolveSeconds: 2.5,
  /** Light released when the fog dissolves. */
  lightReward: 2,
  zoneRadius: 18,
} as const;

export const MANIFEST = {
  cost: LIGHT.seedCost,
  /** The seed only grows while the player is further away than this. */
  awayRadius: 15,
  /** Total away time needed for the seed to finish growing. */
  growSeconds: 25,
  /** Coming back within `awayRadius` before growth ends adds this much time. */
  returnPenaltySeconds: 3,
  /** The return penalty never adds more than this in total. */
  returnPenaltyMax: 9,
  /** Seconds the bridge takes to rise and form. */
  bridgeRiseSeconds: 3,
  /** A mind seed grows this many times faster (kept for chapter 2). */
  mindSeedSpeedFactor: 2,
  /** A mind seed fades after this many seconds (kept for chapter 2). */
  mindSeedFadeSeconds: 60,
  /** A faded mind seed returns this share of its light (kept for chapter 2). */
  mindSeedRefundShare: 0.5,
} as const;

export const THANKS = {
  /** Calm breaths needed on the finished bridge. */
  breaths: 1,
  /** Seconds the global colour takes to reach 1. */
  colorSeconds: 6,
  /** The player counts as standing on the bridge inside this radius. */
  radius: 4,
} as const;

export const HINTS = {
  /** Scene 3: seconds without a calm breath before the bird lands. */
  birdAfterSeconds: 120,
  /** Scene 5: seconds spent near the seed before the butterfly appears. */
  butterflyAfterSeconds: 30,
  /** Scene 5: the butterfly counts the player as near inside this radius. */
  butterflyRadius: MANIFEST.awayRadius,
} as const;

export const COLOR = {
  /** Seconds a new colour zone needs to reach full size. */
  zoneGrowSecondsMin: 2,
  zoneGrowSecondsMax: 4,
  /** Hard limit of the zone uniform array in the shader. */
  maxZones: 8,
  /** Reduced motion stretches colour transitions by this factor. */
  reducedMotionFactor: 1.8,
} as const;

export const PLAYER = {
  walkSpeed: 4.2,
  /**
   * How fast the player walks before their first breath. They are never held
   * still: they can set off at once, just heavily, as if not yet awake. The
   * first finished breath gives them their full stride, and keeps it.
   */
  wakingWalkFactor: 0.4,
  /** Seconds the stride takes to open up after that first breath. */
  wakingEaseSeconds: 2.5,
  /** Radius of the mist the player wakes inside, in metres. */
  wakingMistRadius: 9,
  /**
   * Pushing on without stopping thickens the mist by this much per second,
   * up to the cap. Stopping lets it settle back. It is a nudge, never a wall.
   */
  wakingMistGainPerSecond: 0.05,
  wakingMistMax: 1,
  wakingMistBase: 0.34,
  /** How fast the player turns toward the movement direction, radians per second. */
  turnSpeed: 7,
  /** Slopes steeper than this cosine are not walkable. */
  maxSlopeCos: 0.55,
  radius: 0.45,
  height: 1.7,
  /** The soft glow radius at calm 1. */
  glowRadiusMax: 2.1,
  glowRadiusMin: 0.55,
} as const;

export const CAMERA = {
  distance: 8,
  height: 2.9,
  /** Higher is snappier. The camera must never move suddenly. */
  followLambda: 2.4,
  minPitch: -0.15,
  maxPitch: 0.95,
  startPitch: 0.12,
  fov: 55,
  near: 0.1,
  far: 400,
  dragSensitivity: 0.0055,
} as const;

export const SHADOW = {
  /** Side of the shadow box that follows the player, in metres. */
  boxSize: 56,
  near: 1,
  far: 180,
  /** How far up the light sits along its own direction. */
  distance: 70,
  /** Depth offsets that stop a surface shadowing itself. */
  bias: 0.0012,
  normalBias: 0.02,
  /**
   * The map size at which the shadow starts hardening at the contact point.
   * Below it the edge is a plain filtered one, which is cheaper.
   */
  contactHardeningFrom: 2048,
  /** How wide the sun is, as a share of the shadow map. Wider is softer. */
  sunSize: 0.06,
} as const;

export const WORLD = {
  /** Half size of the playable valley in metres. */
  halfWidth: 60,
  /** The valley runs along negative z. */
  lengthStart: 12,
  lengthEnd: -110,
  /** Mist turns the player back inside this distance from the border. */
  borderSoftness: 10,
  terrainSegments: 168,
} as const;

/** Points of interest. All positions are x and z on the valley floor. */
export const LAYOUT = {
  playerStart: { x: 0, z: 4 },
  /** Scene 2: the dry spring with the carved sign stone. */
  spring1: { x: 3.5, z: -20, light: 3, hidden: false },
  /** Scene 3: the hidden spring in the wide field. */
  spring2: { x: -16, z: -45, light: 3, hidden: true },
  /** Scene 5: the hidden spring at the end of the side path. */
  spring3: { x: 26, z: -80, light: 3, hidden: true },
  signStone: { x: 6.2, z: -18.4 },
  /** Scene 4: the fog on the narrow path. */
  fog: { x: 2, z: -64, radius: 5.5 },
  /** Scene 5: the seed spot at the edge of the gap. */
  seedSpot: { x: 0, z: -84 },
  /** The gap the bridge spans. */
  gap: { z0: -94, z1: -86, x0: -22, x1: 12 },
  bridge: { x: 0, z: -90 },
  bird: { x: -19, z: -41 },
  butterflyPath: [
    { x: 4, z: -82 },
    { x: 14, z: -80 },
    { x: 22, z: -79 },
  ],
} as const;

/**
 * Where each scene is going.
 *
 * The guide leads to these, and only when the player has been getting
 * nowhere for a long time. They are the thing the scene is about, not a
 * waypoint on a route: she flies to it and waits there. There is no line on
 * the ground and no arrow.
 */
export const SCENE_GOALS: Record<SceneId, { x: number; z: number } | null> = {
  1: null,
  2: { x: LAYOUT.spring1.x, z: LAYOUT.spring1.z },
  3: { x: LAYOUT.spring2.x, z: LAYOUT.spring2.z },
  4: { x: LAYOUT.fog.x, z: LAYOUT.fog.z },
  5: { x: LAYOUT.seedSpot.x, z: LAYOUT.seedSpot.z },
  6: { x: LAYOUT.bridge.x, z: LAYOUT.bridge.z },
};

/** Where each scene starts the player, and how much light they should already carry. */
export const SCENE_STARTS: Record<SceneId, { x: number; z: number; light: number }> = {
  1: { x: LAYOUT.playerStart.x, z: LAYOUT.playerStart.z, light: 0 },
  2: { x: 1, z: -12, light: 0 },
  3: { x: -6, z: -38, light: 3 },
  4: { x: 2, z: -55, light: 6 },
  5: { x: 0, z: -78, light: 8 },
  6: { x: LAYOUT.bridge.x, z: LAYOUT.bridge.z + 4, light: 3 },
};

export const SAVE_KEY = 'lightwithin.save.v1';
export const CHECKS_KEY = 'lightwithin.checks.v1';
export const SETTINGS_KEY = 'lightwithin.settings.v1';

export const QUALITY = {
  /** Seconds of frame timing measured at start before a tier is picked. */
  probeSeconds: 1.2,
  /** Average frame time above this in ms picks the low tier. */
  lowThresholdMs: 26,
  /** Average frame time above this in ms picks the medium tier. */
  mediumThresholdMs: 19,
  /** Device pixel ratio cap on touch devices. */
  mobilePixelRatioCap: 1.5,
  desktopPixelRatioCap: 2,
  /**
   * The watchdog. The start probe only measures the first second, before the
   * player has walked anywhere, so a device can still turn out slower than it
   * looked. These settle it during play.
   */
  /** Seconds of frames the watchdog averages before it judges. */
  watchdogWindowSeconds: 5,
  /** Seconds to wait after a tier change before judging again. */
  watchdogCooldownSeconds: 6,
  /** Below this many frames per second the tier steps down, on a touch device. */
  mobileFloorFps: 24,
  /** Below this many frames per second the tier steps down, elsewhere. */
  desktopFloorFps: 45,
} as const;

/**
 * `grassCards` and `grassFade` change at run time: the grass is built once at
 * the highest count and the tier only decides how many of those instances are
 * drawn and how close they fade out. `skyStrokes` and `treeBlobs` are baked
 * into the geometry when the world is built, so they follow the tier the game
 * starts with.
 */
export const TIERS = {
  low: {
    paintScale: 0.5,
    grassCards: 16000,
    grassFade: 28,
    particles: 40,
    skyStrokes: 5,
    treeBlobs: 5,
    /** Shadow map size in pixels. 0 turns real shadows off. */
    shadowMap: 0,
    /** Whether bright things get a glow around them. */
    bloom: false,
  },
  medium: {
    paintScale: 0.75,
    grassCards: 34000,
    grassFade: 42,
    particles: 120,
    skyStrokes: 8,
    treeBlobs: 7,
    shadowMap: 1024,
    bloom: true,
  },
  high: {
    paintScale: 1.0,
    grassCards: 60000,
    grassFade: 58,
    particles: 240,
    skyStrokes: 12,
    treeBlobs: 9,
    shadowMap: 2048,
    bloom: true,
  },
} as const;

/** Every tier from the cheapest to the most expensive. */
export const TIER_ORDER = ['low', 'medium', 'high'] as const;

export type QualityTier = keyof typeof TIERS;

/**
 * The light in the valley.
 *
 * One directional sun and the sky itself. There is no ambient fill: the sky
 * light is the fill, and a flat one on top of it washes out the contrast the
 * rim light and the shadows are there to give.
 */
export const LIGHTING = {
  /** The sun's strength in daylight. */
  sunIntensity: 2.1,
  sunColor: 0xfff6e6,
  /** The sun turns cool and low once night has fallen. */
  moonColor: 0xc9d6f2,
  /** How much of the surroundings the sky light fills in, by day. */
  skyLight: 0.35,
  /** How much more of it there is at night. Moonlight is not darkness. */
  skyLightNight: 0.75,
  /**
   * The side of the cube the sky is filtered into, in pixels.
   *
   * Small on purpose. What is taken from it is the light arriving from every
   * direction at once, which is a very smooth thing, and working it out means
   * reading the cube back off the graphics card. A bigger cube would buy
   * nothing and would be felt as a stutter each time the sky changes.
   */
  skyProbeSize: 64,
  /** Where the distance haze starts and ends, in metres. */
  hazeStart: 38,
  hazeEnd: 185,
  /**
   * Where the sun stands, as a direction. The height runs from morning to
   * evening.
   *
   * It is low on purpose. The camera cannot be tilted far up — it is a
   * following camera and it is meant to look at the valley, not at the sky
   * — so a sun any higher than this sits above the top of the frame at all
   * times, and the light through the trees would be an expensive effect
   * nobody ever saw.
   */
  sunEast: 0.45,
  sunNorth: -0.79,
  sunHeightMorning: 0.34,
  sunHeightEvening: 0.06,
} as const;

/**
 * The glow around anything brighter than daylight: the guide, a spring
 * holding light, the sun, the gold at the end of a chapter.
 *
 * It runs at a quarter of the width and height, which is why it can afford
 * to reach as far as it does. It is off on the cheapest tier.
 */
export const BLOOM = {
  /** Brightness at which a surface starts to glow. 1 is white daylight. */
  threshold: 1.15,
  /**
   * How much of the glow is added back.
   *
   * Low on purpose. Bloom should be felt and not seen: turned up, it lays a
   * veil over the whole picture and the painting filter's brush edges go
   * soft, which is the opposite of what both are for.
   */
  strength: 0.35,
  /** How far the smear reaches, in quarter-resolution pixels. */
  radius: 2.2,
  /** The share of the screen the glow is worked out at. */
  scale: 0.25,
} as const;

/**
 * The figure's proportions, in metres.
 *
 * It is 1.7 m tall and built like a person: hips at a third of that, a cloak
 * that stops above the knee so the legs read, and arms that reach the thigh.
 * Nothing here is a skeleton — these are the points the walk is worked out
 * around.
 */
export const BODY_SHAPE = {
  hipHeight: 0.8,
  hipWidth: 0.125,
  thigh: 0.41,
  shin: 0.39,
  torso: 0.42,
  shoulderHeight: 1.06,
  /** Wide enough that the arms hang outside the cloak, not inside it. */
  shoulderWidth: 0.33,
  upperArm: 0.3,
  forearm: 0.28,
} as const;

/**
 * The walk, worked out from the distance covered rather than from a clip.
 *
 * Every number here is an angle in radians or a distance in metres. Turning
 * one of them up is the whole of "the walk has more swagger"; there is no
 * animation file to re-export.
 */
export const WALK = {
  /** Radians of stride phase per metre walked. */
  phasePerMetre: 2.6,
  /** Ground speed at which the stride is at full size. */
  fullStrideSpeed: 3,
  /** How fast the stride opens up and settles again. */
  gaitEase: 8,
  /** How far the body rises and falls, twice per stride. */
  bob: 0.055,
  /** How far it rolls from side to side, once per stride. */
  roll: 0.07,
  /** How far it leans into the direction of travel. */
  lean: 0.1,
  /** Standing still: how far the weight shifts, and how slowly. */
  sway: 0.022,
  swaySpeed: 0.45,
  /** Standing still: how far the chest rises on a full breath. */
  breathRise: 0.035,
  /** How far the legs swing from the hip. */
  legSwing: 0.62,
  /** How far the knee folds. It only ever folds backwards. */
  kneeBend: 0.85,
  /** How far the arms swing, and how the elbow sits. */
  armSwing: 0.45,
  elbowRest: 0.18,
  elbowBend: 0.35,
  /** How far the head will turn to look at something, and how fast. */
  headTurnMax: 0.7,
  headEase: 4,
} as const;

/**
 * The guide: the light that travels with the player.
 *
 * She leads and she carries the teachings. What keeps her from becoming the
 * thing everyone remembers her predecessors for is here: a gap between
 * anything she says, silence while the player is breathing, and a long wait
 * before she offers help to somebody who has not asked for it.
 */
export const GUIDE = {
  /** Seconds an ordinary message stays on screen. */
  messageSeconds: 6,
  /** Seconds she stays quiet after finishing one. */
  quietAfterSeconds: 4,
  /** Seconds of getting nowhere before she offers the way on. */
  lostSeconds: 75,
  /** How far she floats from the player, and how high. */
  orbitRadius: 1.5,
  orbitHeight: 1.45,
  /** How fast she circles, in radians per second. */
  orbitSpeed: 0.5,
  /** How close she comes when the player stands still. */
  restRadius: 0.95,
  /** How quickly she catches up. Low is lazier and more alive. */
  followLambda: 2.6,
  /** Her size when the player carries no light, and at full light. */
  sizeMin: 0.1,
  sizeMax: 0.17,
  /** How many specks trail behind her. */
  trail: 14,
  /** Seconds a speck in the trail lasts. */
  trailSeconds: 0.9,
} as const;
