/**
 * Every number and colour of the figure lives here.
 * Units: metres, seconds, radians. Lengths are at figure scale 1.
 */
export const FIGURE = {
  /** Size of the figure. 1 = about 1.15 m tall. */
  scale: 1.2,

  colors: {
    cloak: '#B8432F',
    /** Inside of the cloak. */
    cloakShadow: '#7A2519',
    scarf: '#DA7A4A',
    /** Boots and the face shadow. */
    umber: '#4A3428',
    legs: '#3E2C23',
    /** The diamond on the back. */
    gold: '#EBC57A',
    /** Blob shadow on the ground: warm dark olive, never black. */
    shadow: '#3E3A24',
    /** Glow around the figure while breathing in. */
    halo: '#FFE9B8',
  },

  motion: {
    /** Step cycle speed per m/s of walking. */
    stepRate: 4.2,
    /** How far a foot swings forward and back. */
    stride: 0.17,
    stepLift: 0.07,
    bob: 0.04,
    /** Squash & stretch on each step: 0.06 = 6 % flatter when a foot lands. */
    squash: 0.06,
    /** Forward lean at full walk speed. */
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
    /** Gentle breeze, m/s². It blows from the right (+x). */
    wind: 1.4,
    /** Flutter waves along the scarf while the figure walks. */
    flutter: 2.4,
    /** Seconds standing still before the figure looks around. */
    lookAroundAfter: 5,
  },
} as const;
