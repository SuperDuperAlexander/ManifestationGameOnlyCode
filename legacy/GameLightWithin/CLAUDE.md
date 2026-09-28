<<<<<<< HEAD
# CLAUDE.md — Light Within

You build **Light Within**, a calm spiritual browser game in **Babylon.js**.
Read this file fully before every task. It is the source of truth.

---

## 1. How to work with Alexander

- Alexander is the owner. He is not a developer.
- Report to him **in German**, in short simple sentences. Lead with a TL;DR.
- Per report: what you did, did it work, what he does now.
- If he must decide: max 2 options, short context, your recommendation.
- Work in small steps. One milestone at a time (see section 11).
- After each step: run the build, start the dev server, check the browser console for errors.
- Do not add a dependency without a clear reason. Say why in your report.
- The existing repo (`GameLightWithin`) contains an older full-3D version.
  Inspect it first. Reuse what fits. Move old code to `/legacy` instead of deleting it.

---

## 2. Vision

- A peaceful journey of self-discovery. No enemies. No death. No time pressure.
- The player walks freely through small open regions, meets a fairy companion,
  and dissolves **fog clouds** that carry inner blockades ("I'm not worthy").
- Force does not work on blockades. Only **breathing** dissolves them.
- The lesson lives in the mechanic: fighting makes a blockade stronger, breathing and acceptance release it.
- **All in-game text is English.**

---

## 3. Art direction — "Paper diorama"

- Look: layered cut-paper diorama, soft matte gradients, minimal clean shapes, no outlines.
- Palette: apricot sandstone, olive green, powder blue, ivory, pale gold.
- Light: soft warm morning light. Lighting and shading are **painted into textures**, not computed.
- Mood: calm, hopeful, sacred.
- Player character: small figure in a **red cloak** with hood (stands out against green and stone).

Palette tokens (use these everywhere in code):

```ts
export const PALETTE = {
  sandstone: '#E8A77C',
  olive:     '#7D7F5A',
  sage:      '#A8B58A',
  powder:    '#9FB8D6',
  ivory:     '#F4EEDF',
  gold:      '#EBC57A',
  cloak:     '#B8432F',
  stone:     '#A39E94',
};
```

---

## 4. Architecture — "Diorama hybrid"

The world is **simple real 3D** that looks like **paper layers**.

| Element | Technique |
|---|---|
| Ground, paths, cliffs | Low-poly 3D meshes with unlit tiled textures |
| Trees, rocks, flowers, ruins, well, gate | **Paper cards**: textured planes, alpha-tested, placed in 3D |
| Sky, far mountains, landmark, near hills | **Parallax layers**: large planes far behind the play area |
| Player | Procedural 3D figure built from primitives (section 7) |
| Fairy, fog, glow, light bridge | Code: particles, shaders, emissive meshes |

### Camera
- `ArcRotateCamera` or custom follow camera. **Fixed angle**: about 35–45° from above, three-quarter view.
- The camera follows the player smoothly. The player **cannot rotate** it.
- Reason: paper cards only look right from the front.
- Paper cards face the camera direction (fixed orientation, or Y-axis billboard). Never full billboard.

### Parallax layers
- 4 layers per region: `sky`, `mountains_far`, `landmark_far`, `mountains_near`.
- Each layer is a large plane at a different distance. Far layers move slower relative to the camera.
- Implement as child planes of a "backdrop" node that follows the camera with a per-layer factor
  (sky = 1.0 follows fully, near hills ≈ 0.6).

---

## 5. World structure

- **Chapter = one open region.** A region has 5–8 **zones**.
- Inside a region the player walks freely. No loading screens.
- **Streaming**: only the current zone and its neighbours are loaded.
  Zones load in the background before the player reaches them. Far zones are disposed.
  Use `AssetContainer` per zone.
- **Fog hides loading**: fog walls sit at zone borders where needed.
- **Between chapters**: a large fog gate. Transition = 2–3 s light-and-fog blend, no menu.
- The game is **data-driven**. New content = new JSON + new assets. The engine code does not change.

### Chapter 1 map
```
[Forest: 2 fog]   [Ruins: 2 fog]   [River: 2 fog]
        \               |               /
[Meadow (start)] — [Clearing (hub)] — - - [Chasm (goal, light bridge)]
```
- Meadow: start, fairy intro.
- Clearing: central hub with old oak and well.
- Forest, Ruins, River: 2 blockades each, any order.
- Chasm: exit. The big fog gate opens when enough light points are collected.

---

## 6. Data format

One file per chapter: `public/data/chapters/ch1.json`.

```json
{
  "id": "ch1",
  "title": "The Awakening",
  "assetBase": "/assets/ch1/",
  "backdrop": {
    "sky": "bg/sky.png",
    "mountains_far": "bg/mountains_far.png",
    "landmark_far": "bg/landmark_far.png",
    "mountains_near": "bg/mountains_near.png"
  },
  "playerStart": { "zone": "meadow", "pos": [0, 0, 0] },
  "bridge": { "zone": "chasm", "planksRequired": 5, "planksTotal": 6 },
  "zones": [
    {
      "id": "meadow",
      "neighbours": ["clearing"],
      "ground": [
        { "type": "plane", "texture": "textures/ground_grass.png", "size": [40, 40], "pos": [0, 0, 0] }
      ],
      "props": [
        { "asset": "props/tree_round.png", "pos": [-6, 0, 4], "scale": 4 },
        { "asset": "props/flowers_white.png", "pos": [2, 0, -3], "scale": 1, "scatter": 12, "radius": 10 }
      ],
      "blockades": [],
      "hints": [
        { "id": "hint_start", "pos": [3, 0, 2], "text": "Look, the path opens to the clearing." }
      ],
      "events": [ { "type": "fairyIntro", "trigger": "onEnter", "once": true } ]
    },
    {
      "id": "forest",
      "neighbours": ["clearing"],
      "blockades": [
        { "id": "b_worthy", "pos": [5, 0, 8], "text": "I'm not worthy", "release": "I am worthy", "points": 10 }
      ]
    }
  ]
}
```

- Validate chapter JSON at load time (TypeScript types + a small runtime check).
- Missing zone fields fall back to sensible defaults.

---

## 7. Game mechanics

### 7.1 Movement
- Desktop: WASD / arrow keys.
- Mobile: virtual joystick (left side of the screen).
- Smooth acceleration. Walk speed calm, not fast. No jumping in MVP.
- Collision: simple colliders on props (cylinder or box), ground via raycast or flat height.

### 7.2 Breathing (core mechanic)
- **Hold Space = inhale.** The player glows brighter. A light ring around the player grows.
- **Hold Shift = exhale.** Light flows outward from the player towards the nearest fog.
- **Mobile**: one large round button (right side). **Hold = inhale, release = exhale.**
- A rhythm guide circle shows the target: about 4 s in, 4 s out.
- Good rhythm = more light per breath. No penalty for bad rhythm.
- While walking, inhaling raises the player's light radius and can reveal hidden hint paths.
- Implement as a `BreathSystem` with states: `idle | inhale | exhale`, a `breathLevel` 0–1, and a `rhythmScore` 0–1.

### 7.3 Fog blockades
- A soft, semi-transparent fog cloud with the blockade text floating inside it.
- **Push or strike** (walk into it, or press E / tap near it): the fog wobbles, grows denser for 1 s, text flickers.
  The fairy says: "Force doesn't help here. Breathe."
- **Breathe near it** (within radius): each good exhale reduces fog density.
  At 0: text fades, fog turns into golden light particles, the release sentence appears for 2 s.
- Reward: light points. Each dissolved blockade = one bridge plank.
- Fog rendering: layered alpha planes or particle system + a **dissolve shader** (noise threshold).
- Fog walls at zone borders use the same system with larger size.

### 7.4 Light points and the bridge
- HUD shows light points softly (top corner, minimal).
- At the chasm: planks of light appear one by one, one per dissolved blockade.
- With `planksRequired` reached, the bridge is walkable. The far side leads through the chapter gate.

### 7.5 The Fairy (companion)
- A small glowing orb with two soft wing planes and a trail of tiny light particles. Pale gold.
- **Intro**: player wakes on the meadow. The fairy flies in from afar and says:
  "I'll walk this path with you." (plus 2–3 short lines).
- **Orbit**: gently circles the player at head height, slight bobbing.
- **Hints**: when a hint or blockade is in range, she flies to it, glows brighter, plays a soft chime,
  shows one short line, then returns.
- **Teaching**: at the first blockade she explains breathing.
- Dialogue: one sentence at a time. Then silence. Speech bubble in world space or a calm bottom text line.
- All fairy lines live in `public/data/dialogue/en.json`, not in code.

### 7.6 Player character (procedural, no model file)
- Built from primitives: cone or lathe body (cloak), hood, small face shadow, two small feet.
- Cloak color `PALETTE.cloak`, unlit or flat toon shading.
- Animation in code: walk bob, cloak sway, feet steps, idle breathing scale, glow when inhaling.
- Keep a clean interface (`PlayerVisual`) so it can later be swapped for a GLB model.

---

## 8. Performance rules (mobile first)

- Target: 60 fps desktop, stable 30+ fps on mid-range phones.
- **Materials**: unlit (`StandardMaterial` with `disableLighting = true` + emissive texture) or a shared custom shader.
  No PBR.
- **No real-time shadows.** Use a soft blob shadow decal under the player and fairy.
- Paper cards: alpha **test** (not alpha blend) where possible. Share materials per asset.
- Repeated props: **thin instances**.
- Freeze static meshes (`freezeWorldMatrix`, `material.freeze()`), `scene.skipPointerMovePicking = true`.
- `GlowLayer` only on fairy, portal, light bridge, and the breathing ring. Include list only.
- Mobile: `engine.setHardwareScalingLevel(1.5–2)` based on device pixel ratio and fps.
- Draw calls budget: < 100 on mobile.
- Texture size: max 2048 px. Later convert to KTX2 (compressed GPU texture format).
- Dispose zones that are out of range. Watch memory.
- Add a debug overlay (toggle with `F3`): fps, draw calls, active meshes, loaded zones.

---

## 9. Assets

Images arrive from Alexander step by step. **The game must run without them.**
If an asset is missing, use a colored placeholder (plane in palette color with the file name as label).

```
public/
  assets/
    ch1/
      bg/        sky.png, mountains_far.png, landmark_far.png, mountains_near.png
      textures/  ground_grass.png, ground_path.png, ground_stone.png, ground_water.png
      props/     tree_round.png, tree_cypress.png, tree_old_oak.png, bush.png,
                 rock_large.png, rocks_small.png, flowers_white.png, grass_tuft.png,
                 well.png, ruin_pillar.png, ruin_arch.png, monolith_rune.png, gate_portal.png
  data/
    chapters/ch1.json
    dialogue/en.json
```

- Sizes: backgrounds 1536×1024, textures 1024×1024 (seamless), props 1024×1024, gate 1024×1536.
- Props have transparent backgrounds. If an image still has a solid magenta background (#FF00FF),
  handle it in `scripts/prepare-assets` (e.g. with `sharp`): key out magenta, trim empty margins.
- Paper card size: read the image aspect ratio and keep it. The card pivot is the bottom center.
- Not from images (all code): player, fairy, fog, glow, light bridge, UI.

---

## 10. Content (English) — drafts, Alexander must approve

Blockades for chapter 1:

| Zone | Blockade | Release |
|---|---|---|
| Forest | I'm not worthy | I am worthy |
| Forest | I'm so angry | I choose peace |
| Ruins | I'm not enough | I am enough |
| Ruins | I'm afraid | I am safe |
| River | I'm alone | I am connected |
| River | I can't change | I can grow |

Fairy lines (drafts):
- Intro: "Hello, little light. I'll walk this path with you."
- Intro: "This valley is full of fog. Some of it lives inside us."
- First blockade: "Force doesn't help here. Breathe."
- Breathing tip: "Breathe in… let your light grow. Breathe out… let it flow."
- Hint: "Something is waiting over there."
- Bridge: "Every fog you released became light. Look."

---

## 11. Milestones

Build in this order. Finish and report after each one.

1. **Setup + greybox**: Vite + TypeScript + Babylon.js. Flat ground, placeholder props, procedural player, WASD, fixed follow camera, debug overlay.
2. **Breathing**: `BreathSystem`, Space/Shift, glow + light ring, rhythm guide.
3. **Fog blockades**: fog cloud with text, push/strike reaction, dissolve by breathing, light points, HUD.
4. **Fairy**: intro sequence, orbit, hints, dialogue from `en.json`.
5. **Data-driven chapter**: load `ch1.json`, zones, streaming, parallax backdrop, real assets with placeholder fallback.
6. **Bridge + chapter gate**: planks of light, fog-gate transition.
7. **Mobile**: joystick, breath button, hardware scaling, performance pass on a real phone.
8. **Polish**: sound hooks (music, breath, chime), title screen, save progress in `localStorage`.

---

## 12. Code structure

```
src/
  main.ts                 bootstrap engine + scene
  core/                   Game, InputManager, AssetLoader, SaveSystem
  world/                  ChapterLoader, ZoneStreamer, Backdrop, PaperCard, Ground
  player/                 PlayerController, PlayerVisual, BreathSystem
  companion/              Fairy, DialogueSystem
  gameplay/               FogBlockade, LightPoints, LightBridge, ChapterGate
  ui/                     Hud, BreathButton, Joystick, DebugOverlay
  shaders/                fogDissolve, paperCard
  config/                 palette.ts, tuning.ts (all speeds, radii, timings in one place)
  types/                  chapter.ts (JSON types)
```

- TypeScript strict mode.
- All tunable numbers live in `config/tuning.ts`.
- No game content (text, positions) hard-coded in systems.
=======
# Light Within — project rules

A calm 3D browser game that teaches Dr. Rulin Xiu's teaching on how to manifest.
Chapter 1 is "Receive". These rules hold for every later chapter too.

## Content rules (must follow)

- No medical or healing claims anywhere. Breathing is never described as healing.
- Manifestation is always framed as personal reflection, never as a promise.
- Dr. Rulin Xiu is named in third person only in the game's own writing. The one
  exception is the guide: she may carry a recorded teaching in which Dr. Rulin
  speaks for herself. That teaching is her words, presented as hers, and it is
  never put into the game's voice or the guide's.
- Blockages look soft and melancholic, never scary or horror-like.
- No enemies, no points, no score, no "game over", no timers.
- Exactly one companion: the guide, a small light that travels with the player.
  She is the only helper the game has and no chapter adds another.
- The guide leads. She shows the way through the world, she carries short
  messages, and at a blockage she opens a teaching. What she never does is
  take the moment: she speaks before or after an action, never during a
  breath, and she is always quiet while the player is breathing.
- The action still teaches the idea first. The guide's words come **after** the
  player has met the thing they are about, never as a briefing beforehand.
  Wherever a scene can be understood by doing it, she stays silent.
- The guide asks once. A message is shown once and is not repeated unless the
  player has been lost for a long time. She never nags.
- All player-facing text lives in `src/content/strings.en.ts`. A translation is a
  second file that satisfies `GameStrings` plus one entry in `LOCALES`.
- Player-facing text: short sentences, sentence case, no all caps, no filler.
- The working title lives in one constant, `GAME_TITLE` in `src/content/strings.en.ts`.

## Stack (fixed)

- TypeScript in strict mode. Vite. Babylon.js plain — no React, no scene editor,
  no `.babylon` or glTF files. Everything is built in code.
- Ground height and collision read the heightfield the terrain was built from.
  No physics engine, no acceleration structure, no raycast against the mesh.
- Babylon `PostProcess` passes for post-processing.
- Custom GLSL for the painted look. The grey-to-colour system is one material
  plugin on the lit surfaces and one shared piece of code in the raw shaders.
- Web Audio API for all sound. Sounds are generated in code; there are no audio files.
- UI overlays in plain HTML and CSS on top of the canvas.
- Saving: `localStorage` only.
- Tests: Vitest for logic, Playwright for browser runs and screenshots.
- ESLint and Prettier.
- Deploy target: static hosting. No server.

## Hard limits

- **No request ever leaves the origin.** No analytics, no external fonts, no
  CDNs, no streaming. A Playwright test fails the build if any request goes
  anywhere but the game's own origin.
- Loading from the game's own origin, after the start, is allowed and is how
  the large things are kept out of the first download: the handwriting font
  already works this way, and a teaching video works the same way. It is
  fetched from `public/` when it is first needed, never before.
- Outside assets are allowed where they raise the quality, but only under a
  licence that permits commercial use without attribution, and only if they can
  be bundled rather than fetched at run time. `@pmndrs/assets` is CC0 and ships
  as data, which keeps the no-network rule intact. The geometry is still
  generated in code.

## Performance budget

- Initial download 6 MB or less.
- Total 15 MB or less, not counting teaching videos. Each video is fetched
  only when its blockage is reached, so it is never part of what a player
  waits for at the start, and a chapter that ships none costs nothing.
- A teaching video is 720p or smaller, under 6 MB, and has a text version
  that says the same thing. The text is what a player on a slow connection,
  a muted device or a screen reader gets, so it is never a summary.
- Desktop mid-range laptop: 60 fps. Mid-range Android phone: 30 fps or more.
- Cap device pixel ratio at 1.5 on mobile.
- Three quality tiers: low, medium, high. The tier is picked from a short
  frame-time test at start and can be changed in settings.
- Low tier: painting filter at half resolution, fewer particles, fewer grass cards.
- A watchdog watches the real frame rate during play and steps the tier down
  when a device cannot keep up. It only ever steps **down**, so it cannot
  oscillate. It is off as soon as the player picks a tier by hand.
- Grass is built once at the highest count, as thin instances of one card. A
  tier only changes how many of them are drawn and how close they fade, so a
  quality change takes effect at once. The scattered trees are thin instances
  of fourteen originals, so a wood costs about what its originals cost.
  `skyStrokes` and `treeBlobs` are baked into the geometry at world build.

## Art rules

- Procedural geometry only: soft rolling hills, rounded rocks, stylised trees
  (trunk plus clustered soft blobs), a stone spring basin, a sign stone, a bridge.
- Grass and flowers are camera-facing cards with procedural brush-stroke alpha.
- Sky is a large dome with a painted gradient and soft cloud strokes from noise.
- Surfaces are physically based and rough, never metal. The shadowed side of
  everything is filled by a reflection probe rendered from the game's own sky,
  so the sky light always matches what the player can see and greys and warms
  with the valley for free. There is no ambient fill light on top of it: a flat
  fill only washes the contrast out.
- Tone mapping and the linear to sRGB conversion happen once, in the final
  pass, so the raw-shader sky, grass and pollen get the same treatment as the
  lit materials instead of drifting away from them.
- The rim light is additive and sits on top of real lighting, so it is kept
  low. Tuned against flat light it blows out anything seen edge on.
- Light is baked into vertex colours or the shader, plus one soft directional
  light. That light casts a real shadow map on the medium and high tiers: the
  map covers a box that follows the player and is snapped to whole texels, so
  it stays sharp and does not crawl. The low tier falls back to the blob shadow
  under the player. Grass never takes part in the shadow pass; 60,000
  alpha-tested cards would cost more than the rest of the valley together.
- Air is never empty. Pollen drifts in a box that repeats around the camera, so
  the player cannot walk out of the weather and nothing moves on the processor.
- The player has arms and legs and they are animated from the movement itself,
  in code. There is no skeleton and no animation clip: the body rises and falls
  twice per stride, rolls, leans into the direction of travel, and the limbs
  swing against each other. The phase follows distance, not time, so the step
  matches the speed. The cloak ends at the knee so the legs can be seen.
- The guide is a small light, never a face and never a body. She grows and
  warms with the player's own light, so what she looks like is a reading of
  how far they have come.
- Painting filter: Kuwahara-style, plus procedural paper grain and a soft vignette.
- Grey-to-colour: every world material shares one shader chunk. A uniform array
  holds restored zones (centre, radius, strength). Inside a zone the material
  shows full colour; outside it is desaturated, slightly blue-grey and held
  below the restored side in brightness. Zones grow over 2 to 4 seconds.
  Chapter end sets the global colour value to 1.
- Palette lives in `src/content/palette.ts`. Do not invent colours elsewhere.
- UI: quiet and minimal, one self-hosted humanist sans, frosted semi-transparent
  panels with a warm tint, no harsh borders, touch targets of at least 48 px.

## Code rules

- All tunable numbers live in `src/content/chapter1.ts`. No magic numbers in systems.
- Systems talk through the typed event bus in `src/core/events.ts`.
- Keep systems testable without a graphics device wherever possible. The logic
  systems (`breath`, `calm`, `light`, `transform`, `manifest`, `checks`) import
  nothing from the engine, and the follow camera holds only maths, so the tests
  that matter run in plain Vitest with no canvas.

## Accessibility

- The guide's messages are readable text first. They do not block play, they
  can be dismissed with a key, they meet the same contrast rule as every other
  panel, and anything she says is also shown, never only heard.
- Rhythm presets: normal (in 3, out 4), slow (in 4, out 6), easy (in 2, out 3).
  These are shorter than a breathing practice would use, on purpose. Four in and
  six out is a fine thing to sit with, but in a game it is ten seconds of
  holding a key before anything happens, and the player feels the wait rather
  than the breath. `slow` keeps the longer rhythm for anyone who wants it.
- Tests read durations from the presets, never as written-out numbers, so
  retuning the rhythm changes the game and not the tests.
- The player is never held still. They walk from the first second, but inside
  their own mist and with a short stride, and pushing on without stopping
  thickens it. One finished breath clears it for good. The penalty is something
  you can see, which is the only kind worth having in a game with no failure.
- On touch the two halves of the breath are one button per thumb: breathe in on
  the left, breathe out on the right. Both are pressed, neither is sat on.
- One breath uses two keys: hold space to breathe in, hold shift to breathe
  out. Letting go of a key is not an action; the out-breath is half the
  practice and needs its own press. On touch there are two buttons.
- Ask for repetition once. Every gate in the chapter is one calm breath: waking
  the valley, revealing a hidden spring, drawing a spring dry, each step of the
  fog, and the thanks on the bridge. The fog already asks the player to see it,
  stand in the wind and walk into the middle; a second breath on top of that is
  only waiting.
- Reduced motion: no camera shake, no trembling circle, slower colour transitions.
- Every important cue is visual **and** audio.
- Colour is never the only cue. A restored area is also **brighter** than a grey
  one, so the grey-to-colour change reads without colour perception. A browser
  test measures this in greyscale.
- All UI works with the keyboard. Visible focus states.
- Text contrast meets WCAG AA (Web Content Accessibility Guidelines, level AA).

## Build stamp

The start screen shows the git commit the build came from. Three times running,
a change was reported as done and the game on the other screen was an older
build. If the stamp does not match what was just shipped, the build is old,
whatever anyone believes.

## Debug

- `?debug=1` debug panel, `?scene=N` jump to a scene, `?autobreathe=1` automatic
  calm breathing for Playwright, `?nopaint=1` turn the painting filter off.
- `?chapter=N` open a chapter, `?autoname=1` answer the naming panel,
  `?calm=0.2` force the calm value.
- `?safe=1` draw the scene straight to the canvas, with no post-processing.
  It is a way out and a way to find out: a device that is black through the
  composer and right in safe mode has a problem with the render targets, and
  one that is black either way has a problem with the world's own shaders.
- The debug panel opens with a device report: the GPU as the driver names it,
  the WebGL version, whether fragment shaders really have high precision,
  whether half-float buffers work, the canvas size against the pixels drawn,
  and anything the driver said while compiling a shader. A phone cannot be
  reasoned about from here; it has to be asked.

## Shaders

- Geometry is generated in `src/render/geometry.ts`. Front faces wind
  counter-clockwise and the scene is right-handed; the engine assumes the
  other way round unless every mesh and every culling material is told, and
  the cost of getting it wrong is the ground quietly disappearing.
- Every custom shader declares `precision highp float;` in **both** stages.
  A desktop driver and a software renderer both treat `mediump` as full
  precision, so a shader a mobile GPU cannot run compiles and looks right
  here. At `mediump` a float holds about three digits and tops out near
  65504, which the usual noise idiom (`fract(sin(dot(p, k)) * 43758.5453)`)
  goes straight through.
- No `pow()` with an exponent in the hundreds. Drivers disagree about it and
  one `inf` in a colour turns the whole surface black. Use an angle and a
  `smoothstep` instead.
- No variable in an inner scope with the same name as one outside it.

## Commands

- `npm run dev` — dev server
- `npm run check` — typecheck, lint and unit tests
- `npm run build` — typecheck and production build
- `npm run e2e` — Playwright run, writes `screenshots/`
>>>>>>> efc9b0c07ebb61e1980dc4b618b81f7d6be748c6
