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
    inhaleTarget: 2,
    exhaleTarget: 2,
    /** Breath level change per second while inhaling / exhaling (1 = full in 1 s). */
    inhaleRate: 1 / 2,
    exhaleRate: 1 / 2,
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
    /** Soft light flecks drift toward the chest in both phases (BreathVisuals). */
    rays: {
      /** Flecks per breath phase. */
      count: 10,
      /** Inhale: start distance from the figure (min, max) and height (min, max), metres. */
      inStart: [3, 4.2], inHeight: [0.2, 2.4],
      /** Exhale starts a little closer and curls gently as it reaches the chest. */
      exhaleStart: [2.6, 3.8], exhaleCurl: 0.12,
      chestHeight: 0.9,
      /** Short fleck length and width, in metres. */
      fleckLength: 0.28, width: 0.12,
      /** Visual travel time per fleck. Exhale is slower and softer than inhale. */
      inhaleTravelS: 1.45, exhaleTravelS: 1.9,
      /** Overall brightness 0..1 and how fast the in/out mix fades (per second). */
      brightness: 1.6, mixRate: 5,
    },
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

  /** Look Within transition (GAME_DESIGN 4.2): camera dolly to the diamond, gold bloom, world switch. */
  lookWithin: {
    transitionTime: 1.6,
    /** How far the camera moves toward the diamond (0..1). */
    dolly: 0.8,
  },

  /** Citizens of the outer town (GAME_DESIGN 6.1). Spawns and waypoints: src/outer/townLayout.ts. */
  citizens: {
    visual: {
      scale: 1.1,
      headSize: 0.34,
      /** Women keep the same joints, sleeves and boots, with a longer work tunic. */
      female: { headWidth: 0.94, headHeight: 1.02, hemDrop: 0.065, hemWidth: 0.258 },
      bodyHeight: 0.5,
      stepRate: 4.5,
      calmSway: 0.012,
      angryLean: 0.16,
      armLength: 0.32,
      shoulderY: 0.8,
      hipY: 0.34,
      /** Torch size relative to the hand mount. Keeps a raised flame in frame. */
      torchScale: 0.65,
      /** Carry pose in radians: relaxed shoulder, bent elbow and a slight wrist bow. */
      torchUpperPitch: -0.85,
      torchUpperRoll: 0.10,
      torchElbowPitch: -1.35,
      torchElbowRoll: 0.4,
      torchWristPitch: 0.45,
      /** The shaft crosses the fist and visibly exits below the fingers. */
      torchGripPitch: Math.PI / 2,
      torchHandleBelowGrip: 0.11,
      torchSway: 0.012,
      torchSwayRate: 1.5,
    },
    count: 8,
    /** agitation = personalBase + townAnger * agitationWeight */
    agitationWeight: 1.0,
    /** Scales each citizen's personalBase so a calm town stays calm (max ~0.12). */
    personalBaseScale: 0.4,
    /** Torch is only carried/lit above this agitation (none before the bump). */
    torchShowAbove: 0.3,
    /** Below this agitation: calm walks and chats. Above 'medium': stomping, fists, steam now and then. */
    mediumAbove: 0.3,
    /** Above this: steam often, torch flares. */
    highAbove: 0.6,
    /** Two agitated citizens bump into each other above this agitation. */
    bumpAbove: 0.65,
    bumpDistance: 0.75,
    bumpCooldown: 9,
    bumpShove: 2.6,
    radius: 0.3,
    walkSpeedLow: 0.9,
    walkSpeedHigh: 1.9,
    /** Wait at a waypoint: seconds when calm and when furious. */
    waitCalm: 4.5,
    waitAngry: 0.7,
    steamIntervalMedium: 3.4,
    steamIntervalHigh: 0.9,
    /** Citizens further than this from the player drop arms, shadow and detail. */
    lodDistance: 22,
    /** Citizens step around the player inside this distance. */
    playerAvoid: 1.1,
    visualScale: 1.1,
    smooth: 2.2,
  },

  /** Outer world: the little town (src/outer/). Positions live in townLayout.ts. */
  outer: {
    /** Fog-free greybox sky colour is taken from the palette; these are sizes. */
    houseHeightMin: 3.6,
    houseHeightMax: 5.6,
    roofRise: 1.6,
    roofOverhang: 0.35,
    treeHeight: 15,
    treeCrownRadius: 5.2,
    wallHeight: 0.7,
    /** Slope at the Town Edge: ground rises this many metres over the slope length. */
    slopeRise: 0.9,
    /** Camera height above ground stays as in TUNING.camera. Spawn point is in townLayout.ts. */
    maxDrawCalls: 60,
    /** Look: same painted valley style as the inner world. */
    look: {
      /** World mood (0 normal .. 1 golden). */
      mood: 0.25,
      /** Centre of the ring of far mesas. */
      mesaCentre: { x: -7, z: 28 },
    },
  },

  /** Inner World (GAME_DESIGN 5.2): the small valley inside. Layout positions: src/inner/innerLayout.ts. */
  inner: {
    /** Half size of the valley floor, east-west and north-south. */
    floorRadiusX: 24,
    floorRadiusZ: 28,
    rimHeight: 14,
    terraceStep: 3.6,
    terrainCell: 1.0,
    maxSlope: 0.85,
    walkLimit: 1.1,
    walkSpeed: 3.6,
    camera: {
      distance: 8.5,
      distancePortrait: 10.5,
      minDistance: 5,
      maxDistance: 14,
      pitch: 0.3,
      minPitch: 0.08,
      maxPitch: 0.8,
      lookHeight: 1.4,
      fov: 0.9,
      fovPortrait: 1.1,
      dragSpeed: 0.0055,
      recenterDelay: 1.2,
      recenterSpeed: 1.6,
      followSharpness: 10,
      groundClearance: 0.7,
      maxZ: 600,
      /** Near the Anger Imp: look at this share of the imp's height, blend this much toward it, pull back this many imp-heights. */
      impFocusHeight: 0.58,
      impTargetBlend: 0.85,
      impPullBack: 0.9,
    },
    counts: {
      roundTrees: 18,
      cypresses: 14,
      bushes: 18,
      rocks: 30,
      grassTufts: 1600,
      flowers: 260,
    },
    /** World mood: bright and calm (-1 dark .. +1 golden). */
    mood: 0.35,
    /** Entrance light column (gold, soft). */
    entrance: { radius: 1.1, height: 9, alpha: 0.28, triggerRadius: 1.6 },
    /** Marker disc where the Inner Tree will grow. */
    treeMarker: { radius: 2.2, alpha: 0.22 },
  },

  heat: {
    /** At anger 1: share of smoke ivory in the valley haze. */
    smokeMix: 0.25,
    /** At anger 1: share of heat orange in the valley haze. */
    heatMix: 0.3,
    /** Seconds until the red screen-edge tint is gone. */
    hitFadeS: 2,
    /** Opacity of the red screen-edge tint right after a hit. */
    hitPeak: 0.9,
  },

  /** Citizen torch (src/npc/Torch.ts). Intensity 0 = small calm flame, 1 = tall flare. */
  torch: {
    stickLength: 0.9,
    stickTopDiameter: 0.09,
    stickBottomDiameter: 0.12,
    flameBaseHeight: 0.4,
    flameExtraHeight: 0.35,
    flameBaseWidth: 0.2,
    flameExtraWidth: 0.08,
    /** Flicker speed (per second) and strength (share of the flame size). */
    flickerSpeed: 9,
    flickerAmount: 0.12,
    /** How fast the flame follows a new intensity, per second. */
    intensityEase: 4,
  },
  /** Citizen steam puffs with lightning bolts (src/npc/Steam.ts). */
  steam: {
    riseHeight: 0.9,
    lifeS: 2.2,
    /** Puff radius at start, in metres. Grows by puffGrow over its life. */
    puffSize: 0.1,
    puffGrow: 0.12,
    /** Extra size per unit of strength (0..1). */
    strengthGrow: 0.5,
    /** Peak opacity of a puff (0..1). */
    peakAlpha: 0.38,
    /** Bolt size in metres, and how often a bolt flickers on and off (per second). */
    boltSize: 0.09,
    boltFlickerRate: 7,
    /** Sideways drift of a puff, metres over its life. */
    drift: 0.12,
  },
  tree: {
    /** Inner Tree height in metres (Old Tree = outer.treeHeight). */
    innerScale: 26,
    /** Walkable bump of a root: half width = radius * widthK, top = centre height + radius * topK. */
    walk: { widthK: 3.2, topK: 0.55, flatK: 0.5 },
    /** Trunk blocker radius, in tree units (x scale). */
    trunkCollider: 0.075,
    /** Embers on a burned root. size / rise are in tree units (x scale). */
    ember: { rate: 16, capacity: 40, size: 0.01, rise: 0.012 },
    /** Source water into the burned root. */
    water: { halfWidth: 0.32, lift: 0.14, dropRate: 30, dropCapacity: 80 },
  },

  imp: {
    /** Good breaths with the imp until it is calm. */
    breathsToCalm: 3,
    /** Imp base size compared to the player (5x the old 1.5). Mid anger is about this size. */
    scale: 7.5,
    /** Live size factor around the base: at anger 0 and at anger 1. Never zero (a warm presence). */
    sizeAtCalm: 0.7,
    sizeAtRage: 1.3,
    /** How fast the size follows anger (per second). */
    sizeRate: 2.5,
    /** Imp height in model units (feet to horn tips), for camera and collider. */
    modelHeight: 1.95,
    /** Radius the player cannot enter, in model units (x imp scale). */
    bodyRadius: 0.62,
    /** Converts the imp's model units (about 1.7 tall) to player-figure units. */
    modelUnit: 0.72,
    /** How fast the states blend (per second). */
    blendRate: 2.2,
    /** Stomp speed (radians per second; one stomp per half turn). */
    stompRate: 7,
    /** Steam clouds per second at full rage. */
    steamPerS: 3,
    /** Lightning bolts per second at full rage. */
    boltPerS: 2.5,
    /** Seconds between fire spits: [at rage 0, at rage 1]. */
    spitEveryS: [3.6, 2],
    /** Spit speed in model units per second. */
    spitSpeed: 3,
    /** Seconds the falling-figure clue stays visible. */
    clueLifeS: 1.7,
    /** Sparkles per second in the calm form. */
    sparklePerS: 6,
    /** Pool sizes (thin instances, one draw call each). */
    pool: { steam: 12, bolt: 4, rock: 6, fire: 14, spark: 16 },
    /** Roar when it sends a Thought Wave: seconds of the pose, when the burst fires, lean (rad), flame flare size. */
    roar: { durationS: 0.9, fireAtS: 0.4, lean: 0.3, headDip: 0.35, flare: 1.25, puffs: 5, sparks: 8, speed: 2.4, spawnForward: 0.9, chestY: 0.62 },
    /** Wandering inside the clearing around LAYOUT.impSpot. Distances in metres. */
    wander: {
      radius: 7,
      speed: 1.1,
      accel: 1.5,
      turnRate: 1.6,
      pauseS: [2.5, 6],
      /** Extra gap to the Inner Tree trunk and to the player (m, added to the body radii). */
      treeMargin: 1.5,
      playerMargin: 1.5,
      /** Waddle while walking: hop height and sway (model units / rad). */
      hop: 0.05,
      sway: 0.07,
      stepRate: 3.2,
    },
  },

  lantern: {
    /** Position in the figure's local space (right hand, in front). */
    offset: { x: 0.34, y: 0.42, z: 0.2 },
    coreSize: 0.1, cageHeight: 0.24, cageRadius: 0.08,
    /** Light units per second when fading. */
    fadeSpeed: 1.2,
    haloSize: 0.7, warmHaloScale: 1.35,
    /** Flicker strength at low light (0..1). */
    flicker: 0.5,
  },

  story: {
    /** Hint is shown again after this many seconds of silence until the step is done. */
    hintRepeatS: 12,
    /** Gold guide light on Main Street: brightness waiting (before beat 2) and lit. */
    beaconDim: 0.22,
    beaconLit: 0.85,
    beaconRadius: 3.2,
    beaconGroundOffset: 0.06,
    beaconWidth: 1.6,
    beaconHeight: 5,
    beaconFadeSpeed: 1.5,
    beaconPulse: 0.12,
    beaconPulseSpeed: 1.6,
    /** Arrival radius around the town-square centre that invites Look Within. */
    squareArrivalRadius: 7,
    beaconVisibleAlpha: 0.01,
    beaconAlpha: 0.7,
    guidanceNearRadius: 7,
    guidanceMarkerHeight: 3,
    guidanceMarkerPadding: 8,
    guidanceEdgeX: 0.12,
    guidanceEdgeTop: 0.27,
    guidanceEdgeBottom: 0.65,
    /** Stranger run speed (m/s) and the pause after the bump (s). */
    strangerRunSpeed: 8,
    strangerStaggerS: 0.25,
    /** Distance to the player that counts as the hit (m). */
    bumpImpactDist: 0.7,
    /** Shove on the player at the hit (m). Small, no harm. */
    bumpShove: 1.2,
    /** Walk-close distance to pick an apple (m). */
    applePickRadius: 1.6,
    /** Distance at which apples start to glow (m). */
    appleGlowRadius: 3.2,
    /** Child sobbing: bob period (s), tear fall time (s). */
    sobPeriodS: 1.6,
    tearFallS: 0.9,
    /** Child scale in the alley. */
    childScale: 0.6,
    /** Lantern light below this is too weak to light the Old Tree. */
    treeNeedsLight: 0.6,
    /** Walk-close distance to the lantern niche (m, from the niche). */
    nicheRadius: 3.2,
    /** Distance to the imp that counts as meeting it, and for breathing with it (m). */
    impSeeRadius: 22,
    impBreathRadius: 15,
    /** Calming without help falls back to raging after this long (s). */
    impFlareBackS: 3,
    /** A started calming (with help) is forgotten after this long without a breath (s). */
    impCalmingIdleS: 14,
    /** Seconds the root takes to heal, the flame to fly, the branch to heal. */
    rootHealS: 4,
    flameFlyS: 2,
    branchHealS: 3,
    /** Pause before the end card (s). */
    endCardDelayS: 2.5,
    /** Seconds a speech bubble stays. */
    bubbleS: 5,
    /** Fountain jet level before and after the root heals. */
    fountainLow: 0.3,
    fountainHigh: 1,
  },

  /** Soft synth cues (src/core/Sound.ts, src/game/SoundCues.ts). Keep all quiet. */
  sound: {
    /** Overall level of every cue (gain). */
    master: 0.3,
    /** Push: low soft thud. */
    pushGain: 0.1,
    /** A wave passes: soft falling tone. */
    passGain: 0.05,
    /** Wave whoosh (noise). */
    whooshGain: 0.035,
    /** Imp growl: low, short. Not more often than growlGapS. */
    growlGain: 0.08,
    growlGapS: 6,
    /** Calm chime when the imp is calm. */
    chimeGain: 0.1,
    /** Lantern relit: warm soft chord. */
    relightGain: 0.08,
    /** Minimum time between two push or pass cues (s). */
    minGapS: 0.25,
  },

  /** Small charming details in the town (TownProps). */
  townProps: {
    /** Height of the ground outside the town walls (same as the 'town.outside' quad in Town.ts). */
    outsideY: -1.2,
    /** Grass tufts spread over the meadow strip. */
    meadowTufts: 320,
    /** Grass tufts along wall bases (inside and outside). */
    wallTufts: 140,
    /** White flowers in small clusters. */
    flowers: 110,
    /** Soft stones. */
    stones: 18,
    /** Half width of the lane from the start to the arch that stays free of bushes and stones (m). */
    laneHalf: 2.4,
  },

  houses: {
    /** Height of the stone plinth (m). */
    plinthH: 0.34,
    /** Height of one floor (m). */
    floorH: 2.9,
    /** Walls lean this much at the top (m) and get this much narrower (fraction). */
    lean: 0.05, taper: 0.035,
    /** Size of the chamfer on the wall corners (m) and random wobble of wall points (m). */
    bevel: 0.17, wobble: 0.02,
    /** Roof: slope (rise per run), overhang at the eaves and at the gable ends (m), lift of each tile row (m). */
    roofPitch: 0.62, overhang: 0.55, gableOverhang: 0.24, tileLift: 0.055, tileRowLen: 0.42,
    /** Chances (0..1) for the extras. */
    chimney: 0.55, balcony: 0.45, stair: 0.25, awning: 0.32, archWindow: 0.35, flowers: 0.65, shutters: 0.75,
  },

  anger: {
    onBump: 0.7, floorBeforeHelp: 0.35,
    push: 0.08, hit: 0.02, pass: -0.05, afterHelp: -0.15,
    fadeOutTime: 4,
    /** After the bump the town stays calm for townDelayS, then its shown anger ramps up over townRampS. */
    townDelayS: 4, townRampS: 20,
  },
  waves: {
    rateAtFullAnger: 0.11,   // waves per second at anger 1
    speed: 2.2,              // m/s, slower than walking
    width: 6, height: 2.2,   // metres
    pushRelief: 4,           // seconds without waves after a push
    pushGrow: 0.25,          // +25 % size per pushLevel
    maxPushLevel: 4,
    resetAfterPasses: 3,
    hitSlowTime: 2, hitSlowFactor: 0.5,
    bigWaveShove: 2.5,       // metres at max pushLevel
    hitShoveMin: 0.3,        // metres, shove of a normal wave
    maxActive: 6,            // pooled waves per world
    spawnDistance: 20,       // metres from the player toward the wave source
    reachFactor: 0.3,        // contact distance = width * reachFactor * scale
    pushRange: 6,            // metres: E pushes the nearest wave inside this
    passTime: 1.6,           // seconds a passing wave takes to dissolve
    returnSpeedGain: 0.2,    // +20 % speed per pushLevel
    /** Waves come faster near the source (the alley): x1 far away, up to x(1+boost) within nearDist. */
    proximity: { nearDist: 8, farDist: 45, boost: 1.2 },
    /** Share of waves that start at an agitated citizen, and the agitation needed. */
    citizenShare: 0.4, citizenAbove: 0.45,
    maxAge: 60,              // seconds before a wave fades out on its own
    /** Inner world: a wave leaves the imp as a fiery ring, then turns into the normal look. */
    fromImp: {
      /** Seconds between the start of the roar and the wave appearing. */
      delayS: 0.45,
      /** Size share at the start, and seconds to reach full size. */
      startScale: 2.4, growS: 5,
      /** Seconds until the fire colours are gone. */
      fireS: 7,
      /** Seconds until the wave is fully visible. */
      fadeInS: 0.3,
      /** Faint glowing line from the imp to its fresh wave: width (m) and opacity. */
      trailWidth: 1.6, trailAlpha: 0.6,
    },
  },
  /** Comic Thought Bubbles of the outer town (GAME_DESIGN 7.3). pushLevel / anger rules stay in `waves` and `anger`. */
  bubbles: {
    /** Metres: bubble width at pushLevel 0 (grows by waves.pushGrow per pushLevel). */
    width: 1.55,
    /** Glass: opacity in the middle and at the edge (fresnel power), highlight streak 0..1, and of the thin warm rim (text stays at 1). */
    alpha: 0.38, edgeAlpha: 0.7, edgePower: 2.2, streak: 1, rimAlpha: 0.4, rimPower: 3,
    /** Share of the pushLevel growth (waves.pushGrow) that the bubble size follows. */
    growShare: 0.6,
    /** Head height above the feet where the small spheres start. */
    headY: 1.75,
    /** The bubble floats this far above the head (m, centre) and sideways (share of its width). */
    lift: 0.45, side: 0.3,
    /** Seconds: spheres rise, then the bubble puffs out. */
    formTime: 1.8,
    /** Sphere diameters (m) and their place on the way from head to bubble (0..1). */
    sphereSize: [0.12, 0.2, 0.3],
    spherePath: [0.15, 0.42, 0.72],
    /** The bubble can be pushed once this share of forming is done. */
    pushableAfter: 0.55,
    /** Seconds of breathing before the bubble starts to dissolve, and how long it takes. */
    breathHold: 0.6, dissolveTime: 2.2,
    /** Pushed bubble: seconds of flight, metres per second at the start. */
    pushedTime: 0.9, pushedSpeed: 7,
    /** Seconds without a new bubble after a push. */
    pushRelief: 1.2,
    /** Seconds between bubbles: calm (anger 0) and furious (anger 1). */
    gapCalm: 9.6, gapAngry: 3.6, firstGap: 2,
    /** Nothing done: after this many seconds the bubble sinks onto the head and bursts. */
    holdTime: 14, burstTime: 0.9, hitShoveMin: 0.3, bigShove: 2.5, hitSlowTime: 2, hitSlowFactor: 0.5,
    /** Anger level of the text: score = anger + pushLevel * pushScore. */
    level1Above: 0.5, level2Above: 0.9, pushScore: 0.2,
    /** Citizen bump after a push: arrival in about this many seconds, speed limits (m/s), shove (m), slow, wobble. */
    bumpArrive: 1.5, bumpSpeedMin: 1.4, bumpSpeedMax: 4.2, bumpReach: 0.95, bumpShove: 0.9,
    bumpSlowFactor: 0.45, bumpSlowTime: 0.9, wobbleTime: 1.1, wobbleAmount: 0.2,
    /** Seconds the citizen keeps walking on after the bump. */
    bumpWalkOn: 1.8, bumpGiveUp: 9,
  },
  performance: {
    /** Hardware scaling on phones: 1 = native pixels. Higher = fewer pixels. */
    mobileScalingMin: 1.25,
    mobileScalingMax: 2,
    /** Below this fps (averaged), scaling goes up one step. */
    lowFps: 38,
    highFps: 56,
    adaptInterval: 2.5,
    /** Phones: share of grass tufts / flowers in the Inner World (fewer instances = less fill + vertex work). */
    mobileGrassShare: 0.45,
    mobileFlowerShare: 0.6,
  },
} as const;
