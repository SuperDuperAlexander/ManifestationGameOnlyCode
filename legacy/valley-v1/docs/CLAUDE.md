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
- This repo is `ManifestationGame`. The game is called **Light Within**.
- The older full-3D version (old repo `GameLightWithin`) lives in `legacy/GameLightWithin/`.
  Reuse what fits. Move old code to `/legacy` instead of deleting it.
- Context, current status and next step: `docs/HANDOVER.md`. All decisions made while building: `docs/DECISIONS.md`.

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
- **Style reference image:** `docs/style-reference.png`. Open it before any visual work. Match its look.

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
- 5 layers per region, back to front:
  1. `sky` (opaque)
  2. `mountains_farthest`
  3. `mountains_far`
  4. `landmark_far`
  5. `mountains_near`
- Each layer is a large plane at a different distance. Far layers move slower relative to the camera.
- Implement as child planes of a "backdrop" node that follows the camera with a per-layer factor
  (sky = 1.0 follows fully, farthest ≈ 0.9, far ≈ 0.8, landmark ≈ 0.75, near hills ≈ 0.6).
- **Atmospheric haze**: each layer has a `haze` value 0–1 (in JSON). The shader blends the layer color
  towards `PALETTE.ivory`/powder blue and lowers contrast. The landmark art is too sharp and warm
  for its distance — start with `haze: 0.35` on it.
- The landmark's bottom floats in the air. Position it so `mountains_near` covers its bottom edge.
- Order back to front must be stable: use `renderingGroupId` or explicit `alphaIndex`, not depth sorting.

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
  "backdrop": [
    { "id": "sky",                "image": "bg/sky",                "parallax": 1.0,  "haze": 0.0 },
    { "id": "mountains_farthest", "image": "bg/mountains_farthest", "parallax": 0.9,  "haze": 0.2 },
    { "id": "mountains_far",      "image": "bg/mountains_far",      "parallax": 0.8,  "haze": 0.1 },
    { "id": "landmark_far",       "image": "bg/landmark_far",       "parallax": 0.75, "haze": 0.35 },
    { "id": "mountains_near",     "image": "bg/mountains_near",     "parallax": 0.6,  "haze": 0.0 }
  ],
  "playerStart": { "zone": "meadow", "pos": [0, 0, 0] },
  "bridge": { "zone": "chasm", "planksRequired": 5, "planksTotal": 6 },
  "zones": [
    {
      "id": "meadow",
      "neighbours": ["clearing"],
      "ground": [
        { "type": "plane", "texture": "textures/ground_grass", "size": [40, 40], "pos": [0, 0, 0] }
      ],
      "props": [
        { "asset": "props/tree_round", "pos": [-6, 0, 4], "scale": 4 },
        { "asset": "props/flowers_white", "pos": [2, 0, -3], "scale": 1, "scatter": 12, "radius": 10 }
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

- Image paths in JSON have **no file extension**. The loader adds `.webp` (see section 9).
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
- Texture size: max 2048 px. Game uses **WebP** (section 9). KTX2 only later, if GPU memory on phones is a problem.
- Dispose zones that are out of range. Watch memory.
- Add a debug overlay (toggle with `F3`): fps, draw calls, active meshes, loaded zones.

---

## 9. Assets

All 22 images for chapter 1 are **ready** as PNG. The game must still run if one is missing:
use a colored placeholder (plane in palette color with the file name as label).

### 9.1 Where the images are
- Alexander has put all PNG originals into `public/assets/ch1/`.
- **First task:** check the folder. If the PNGs lie directly in `public/assets/ch1/`,
  move them into these subfolders (use `git mv` if tracked). Do not rename files.

```
public/assets/ch1/
  bg/        sky.png, mountains_farthest.png, mountains_far.png, landmark_far.png, mountains_near.png
  textures/  ground_grass.png, ground_path.png, ground_stone.png, ground_water.png
  props/     tree_round.png, tree_cypress.png, tree_old_oak.png, bush.png,
             rock_large.png, rocks_small.png, flowers_white.png, grass_tuft.png,
             well.png, ruin_pillar.png, ruin_arch.png, monolith_rune.png, gate_portal.png
public/data/
  chapters/ch1.json
  dialogue/en.json
scripts/
  convert-assets.mjs
```

- If a file is missing or has another name: list it in your report. Do not guess.
- PNG = original (source). WebP = what the game loads. Both live side by side in the same folder.
- Never edit or delete the PNG originals.

### 9.2 Conversion script `scripts/convert-assets.mjs`
- Use `sharp` (dev dependency).
- Walk `public/assets/` recursively. For every `.png`, write a `.webp` with the same name **next to it**.
- Skip a file if the WebP is newer than the PNG (fast re-runs).
- Settings:
  - `bg/` and `props/`: WebP quality 85, `alphaQuality: 90`, keep transparency.
  - `textures/`: WebP quality 85. Must stay seamless: no trimming, no resizing that breaks tiling.
  - `bg/sky`: opaque, quality 80.
- `props/` only: trim fully transparent margins (keep a 4 px border). Keeps cards tight and saves fill-rate.
  Write the trimmed result only to the WebP. The PNG stays untouched.
- If a PNG still has a solid magenta background (#FF00FF): key it out to transparency before converting.
- Max size 2048 px on the long side. Never upscale.
- Print a table at the end: file, PNG size, WebP size, saving in %.
- npm scripts:
  - `"assets": "node scripts/convert-assets.mjs"`
  - `"predev"` and `"prebuild"` run `assets` automatically.
- Optional: `--watch` flag that re-converts when a PNG changes.
- **Production build:** PNGs must not ship. After `vite build`, delete `dist/**/*.png`
  (small post-build step or Vite plugin). Only `.webp` goes online.

### 9.3 Loading rules
- Loader resolves `assetBase + image + ".webp"`.
- Sizes: backgrounds 1536×1024, textures 1024×1024 (seamless), props 1024×1024, gate 1024×1536.
- Paper card size: read the image aspect ratio and keep it. The card pivot is the bottom center.
- **Free variation for props** (per instance, from JSON or random with a fixed seed):
  scale ±15 %, slight hue/brightness shift, slight rotation around Y.
  One tree image must look like many trees.
- **Do NOT mirror props by default.** All art is lit from the right. Mirroring flips the light and breaks
  the scene. Only allow mirroring per asset with `"mirror": true` in JSON (e.g. grass, flowers).
- The sun in `sky` sits upper center/right. Keep the scene's light direction "from the right" consistent.
- Not from images (all code): player, fairy, fog, glow, light bridge, UI.

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
**Status 2026-09-28:** 1–7 done. Next: Alexander's feedback (`docs/HANDOVER.md` section 6), then 8.

1. **Setup + greybox**: Vite + TypeScript + Babylon.js. Sort assets into subfolders (9.1). Asset conversion script (9.2). Flat ground, placeholder props, procedural player, WASD, fixed follow camera, debug overlay.
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
