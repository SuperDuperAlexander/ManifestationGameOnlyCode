/**
 * Every tunable number of the game lives here: speeds, radii, timings.
 * Units: metres, seconds, radians unless the name says otherwise.
 */
export const TUNING = {
  camera: {
    /** Angle from above, in degrees. CLAUDE.md asks for 35–45. */
    pitchDeg: 36,
    /** Distance from the look-at point to the camera. */
    distance: 18,
    /** Vertical field of view on landscape screens. */
    fov: 0.72,
    /** Vertical field of view on portrait screens (phones held upright). */
    fovPortrait: 1.0,
    /** The camera looks at a point this far ahead of the player (north). */
    lookAhead: 2.5,
    /** Height of the look-at point above the ground. */
    lookHeight: 1.0,
    /** How fast the camera catches up. Higher = snappier. */
    followSharpness: 3.2,
    maxZ: 160,
    /** 0 = normal perspective, 1 = vertical lines stay fully vertical on screen. */
    verticalCorrection: 0,
  },

  /**
   * World curvature. The ground bends down beyond a distance ahead of the camera,
   * so the horizon and the painted backdrop become visible from a steep camera.
   */
  curve: {
    /** Flat zone in front of the look-at point. Nothing bends inside it. */
    flatDistance: 5.5,
    /** Drop = strength * (distance beyond the flat zone)^2. */
    strength: 0.028,
    /** Haze on the world near the horizon: 0 = none. */
    hazeAmount: 0.5,
    /** Haze starts this far beyond the flat zone ... */
    hazeStart: 3,
    /** ... and is full this far beyond it. */
    hazeEnd: 17,
  },

  backdrop: {
    /** Distance of the backdrop planes from the camera. Only affects nothing but depth range. */
    distance: 120,
    /**
     * Horizontal parallax: how many screen widths a layer shifts per metre the camera moves,
     * multiplied by (1 - layer parallax factor).
     */
    shiftPerMetre: 0.0025,
    /** Extra width of each layer, as a share of the screen width, so shifting never shows an edge. */
    overscan: 0.35,
    /** Mountain layers: how far their image bottom sits below the horizon line, in screen heights. */
    sinkBelowHorizon: 0.06,
  },

  player: {
    walkSpeed: 3.6,
    acceleration: 9,
    deceleration: 11,
    turnSharpness: 10,
    radius: 0.4,
    /** Size of the figure. 1 = about 1.15 m tall. */
    visualScale: 1.2,
    /** Animation of the red-cloak figure (src/player/PlayerVisual.ts). Lengths at scale 1. */
    figure: {
      /** Step cycle speed per m/s of walking. */
      stepRate: 4.2,
      /** How far a foot swings forward and back. */
      stride: 0.17,
      stepLift: 0.07,
      bob: 0.04,
      /** Squash & stretch on each step: 0.06 = 6 % flatter when a foot lands. */
      squash: 0.06,
      /** Forward lean at full walk speed, radians. */
      lean: 0.12,
      /** Cloak spring: stiffness and damping. Low damping = more swing when stopping. */
      cloakStiffness: 38,
      cloakDamping: 6.5,
      /** How far the cloak hem trails back at full walk speed. */
      cloakTrail: 0.15,
      /** Scarf tails: [length, width, segments]. */
      scarfTails: [
        [0.52, 0.12, 9],
        [0.3, 0.1, 5],
      ],
      /** Air drag on the scarf, 1/s. Higher = it flies further back when walking. */
      scarfDrag: 3.6,
      scarfGravity: 6,
      /** Gentle breeze, m/s². It blows from the right, like the light. */
      wind: 1.4,
      /** Flutter waves along the scarf while it moves through the air. */
      flutter: 2.4,
      /** Seconds standing still before the figure looks around. */
      lookAroundAfter: 5,
    },
  },

  cards: {
    /** Paper cards lean back by this angle so they face the camera a bit more. Degrees. */
    leanBackDeg: 32,
    alphaCutoff: 0.5,
    /** Free variation per prop instance. */
    scaleJitter: 0.15,
    brightnessJitter: 0.06,
    warmthJitter: 0.04,
    /** Y rotation jitter in degrees. */
    rotationJitterDeg: 6,
  },

  ground: {
    /** Metres covered by one repeat of a ground texture. */
    grassTile: 7,
    pathTile: 5,
    stoneTile: 5,
    waterTile: 6,
    /** Soft painted edge width of path and plaza overlays, in metres. */
    edgeSoftness: 1.2,
    waterFlowSpeed: 0.12,
  },

  breath: {
    /** Target rhythm: seconds in, seconds out. */
    inhaleTarget: 4,
    exhaleTarget: 4,
    /** Breath level change per second while inhaling / exhaling (1 = full in 1 s). */
    inhaleRate: 1 / 4,
    exhaleRate: 1 / 4,
    /** Breath level falls back to 0 this fast when idle. */
    idleDecay: 0.35,
    /** A phase shorter than this is ignored for scoring. */
    minScoredPhase: 0.8,
    /** Light an exhale gives = level spent * (base + rhythmBonus * rhythmScore). */
    lightBase: 0.6,
    rhythmBonus: 0.6,
    /** Player's light radius: base, plus this much at full breath. */
    lightRadiusBase: 1.6,
    lightRadiusGain: 3.6,
    /** Exhaled light reaches fog within this distance. */
    reach: 7.5,
  },

  fog: {
    /** How much density one full, perfect exhale removes. */
    densityPerLight: 0.42,
    /** Push: density rises this much for a moment ... */
    pushSurge: 0.35,
    pushSurgeTime: 1.0,
    /** ... and this much stays. Force makes it stronger. */
    pushPermanent: 0.04,
    maxDensity: 1.25,
    /** The fog is soft but you cannot walk through it. */
    colliderRadius: 1.9,
    /** Walking into it counts as a push when the body is closer than this to its edge. */
    pushDistance: 0.75,
    /** Pressing E counts as a push when closer than this. */
    strikeDistance: 4.5,
    pushCooldown: 1.2,
    releaseTextTime: 2.2,
    wobbleDecay: 3.0,
  },

  fairy: {
    orbitRadius: 1.5,
    orbitHeight: 1.7,
    orbitSpeed: 0.7,
    bobAmplitude: 0.12,
    flySpeed: 7,
    followSharpness: 4,
    /** Distance at which a hint or blockade calls her. */
    hintRange: 9,
    hintHold: 3.6,
    /** Seconds a line stays on screen, plus a little per character. */
    lineBase: 2.4,
    linePerChar: 0.05,
    /** Silence between two lines. */
    lineGap: 0.7,
    introDelay: 1.2,
  },

  bridge: {
    plankAppearTime: 1.1,
    plankWidth: 2.6,
    /** Delay between two planks when several appear together. */
    plankStagger: 0.5,
  },

  gate: {
    /** Seconds of the light-and-fog blend between chapters. */
    transitionTime: 2.6,
    triggerRadius: 1.8,
  },

  streaming: {
    /** Zones are checked this often, in seconds. */
    checkInterval: 0.4,
  },

  /** Test valley (valley.html): a closed 3D valley made in code, free camera. */
  valley: {
    /** Half size of the valley floor, east-west and north-south. */
    floorRadiusX: 30,
    floorRadiusZ: 66,
    /** Cliff height at the valley rim and the height of one terrace step. */
    rimHeight: 14,
    terraceStep: 3.6,
    /** Terrain mesh: one vertex every N metres. Lower = finer and more costly. */
    terrainCell: 1.0,
    /** Terrain steeper than this (rise per metre) cannot be walked up. */
    maxSlope: 0.85,
    /** The player stays inside the valley: 1 = the foot of the cliffs. */
    walkLimit: 1.1,
    walkSpeed: 4.0,
    camera: {
      distance: 8.5,
      distancePortrait: 10.5,
      minDistance: 5,
      maxDistance: 14,
      /** Angle from above, radians. The player can change it within min..max. */
      pitch: 0.3,
      minPitch: 0.08,
      maxPitch: 0.8,
      /** Point the camera looks at, above the player's feet. */
      lookHeight: 1.4,
      fov: 0.9,
      fovPortrait: 1.1,
      /** Radians per pixel of drag. */
      dragSpeed: 0.0055,
      /** After this many seconds without a drag, the camera turns back behind the player. */
      recenterDelay: 1.2,
      recenterSpeed: 1.6,
      followSharpness: 10,
      /** The camera stays this high above the ground. */
      groundClearance: 0.7,
      maxZ: 900,
    },
    /** Soft toon light: the light comes from the right, like the painted art. */
    lightDir: [0.62, 0.72, -0.3] as const,
    /** Haze: starts at this distance and is full (fogMax) at fogEnd. */
    fogStart: 18,
    fogEnd: 190,
    fogMax: 0.75,
    windStrength: 0.12,
    counts: {
      roundTrees: 44,
      cypresses: 36,
      bushes: 40,
      rocks: 70,
      grassTufts: 3200,
      flowers: 520,
    },
    /** World mood: -1 dark and grey, 0 normal, +1 bright and golden. */
    mood: {
      /** Mood away from any fog, with 0, 1 and 2 blockades released (and after the bridge). Bright from the start. */
      byProgress: [0.3, 0.36, 0.42, 0.5] as const,
      /**
       * Near a fog the world goes dark. It starts at `approachFar` metres from the fog edge
       * and is full (`approachDark`) at `approachNear` metres. Walking away makes it bright again.
       */
      approachDark: 0.75,
      approachFar: 14,
      approachNear: 3,
      /** How fast the approach darkness follows the player (high = at once). */
      approachFollow: 6,
      /** Each push adds this much darkness near the fog; breathing clears it. */
      pushDark: 0.2,
      maxPushDark: 0.7,
      /** Darkness cleared per unit of exhaled light near the fog. */
      clearPerLight: 0.35,
      /** A push also flashes the world dark for a moment. */
      flash: 0.55,
      flashTime: 1.3,
    },
    blockade: {
      /** Demo: every fog dissolves after this many breaths that reach it, pushed or not. */
      breathsToRelease: 2,
      /** A breath counts when it gives at least this much light to the fog (about 1 s breathing in). */
      minLightPerBreath: 0.15,
      /** How fast the fog thins while the light flows in (one breath never goes past its share). */
      densityPerLight: 0.8,
      /** Each push makes the fog bigger and denser. */
      pushGrow: 0.13,
      pushDensity: 0.22,
      maxGrow: 1.9,
      /** Breathing shrinks a grown fog back toward its normal size. */
      shrinkPerLight: 0.35,
      /** Push works within this distance of the fog edge. */
      pushRange: 5,
      /** The fairy calls the player to the fog from here. */
      noticeRange: 13,
    },
    /** The bridge of light starts only when all fogs are released and the player is this close to the chasm edge. */
    bridgeTriggerDistance: 4,
    /** How much the player figure glows per released blockade (0..1). */
    playerGlowPerRelease: 0.22,
  },

  performance: {
    /** Hardware scaling on phones: 1 = native pixels. Higher = fewer pixels. */
    mobileScalingMin: 1.25,
    mobileScalingMax: 2,
    /** Below this fps (averaged), scaling goes up one step. */
    lowFps: 38,
    highFps: 56,
    adaptInterval: 2.5,
  },
} as const;
