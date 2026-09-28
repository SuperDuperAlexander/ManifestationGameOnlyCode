# Decisions

Alexander asked Claude to make open design decisions and write them down.
Each entry: what was decided, why, and how to change it.

## Milestone 1 — Setup + greybox

**D1. Old code is copied to `legacy/`, not moved.**
The old full-3D game lives in a separate folder and git repo (`../GameLightWithin`).
Its source, tests and docs are copied into `legacy/GameLightWithin/`. The original folder is untouched.
The old note `public/teachings/` moved to `legacy/teachings/`. The fonts in `public/fonts/` are reused.

**D2. "Transparent" means alpha ≤ 4 when trimming props.**
The prop PNGs carry invisible dust pixels (alpha 1–4) out to the image border, so a strict
"alpha = 0" trim removed nothing. The converter treats alpha ≤ 4 as transparent and clears it in
the WebP. The PNG originals are never changed. Setting: `ALPHA_DUST` in `scripts/convert-assets.mjs`.

**D3. WebP files are not in git.** They are generated from the PNGs by `npm run assets`,
which runs automatically before `dev` and `build`.

**D4. The world bends down toward the horizon.**
A camera looking down at 35–45° never sees the sky: the painted backdrop would be invisible.
So the ground bends down beyond a flat zone in front of the player (like in Animal Crossing).
The horizon becomes visible at the top of the screen and the backdrop layers sit behind it.
Far zones disappear behind the bend by themselves, which also helps performance.
It is done in the shared vertex shader (`src/shaders/paperShader.ts`).
Settings: `TUNING.curve` in `src/config/tuning.ts`.

**D5. Camera: 38° from above, 18 m away, looking north. Paper cards lean back 32°.**
Perfectly vertical cards looked skewed (like parallelograms) from a camera that looks down.
Leaning them back so they almost face the camera keeps them undistorted, like pictures in a diorama.
Babylon's projection-plane tilt was tested and rejected (it cut off the bottom of the screen).
Settings: `TUNING.camera`, `TUNING.cards.leanBackDeg`.

**D6. Playwright is a dev dependency.** It opens the game in a real browser for the automatic
checks after each milestone (`npm run check:browser`). It is not part of the game.

**D7. `vite.config.ts` is not type-checked by `tsc`.** Type-checking it needs `@types/node`,
one more dependency for no gain. Vite checks it when it runs.

## Milestone 4 — Fairy

**D8. Dialogue is a calm line at the bottom of the screen**, not a speech bubble in the world.
It stays readable on phones and never hides behind trees.

**D9. Sounds are synthesized (Web Audio), no audio files yet.** A soft chime for hints and a warm
chord for a released fog. Real music and samples can plug into `src/core/Sound.ts` later (milestone 8).

**D10. A small start screen ("press any key or tap").** Browsers only allow sound after a key press
or tap, and the player should wake up on the meadow only when someone is watching.

**D11. Glow is made with soft additive light cards, not Babylon's GlowLayer.**
The GlowLayer would draw the un-bent world (see D4), so glows would float in the wrong place.
Light cards bend with the world and cost almost nothing on phones.

## Milestone 5 — Data-driven chapter

**D12. The chapter file format is extended** (all in `src/types/chapter.ts`):
zones have an `origin` (world position) and walkable `areas`; `terrain` holds the base ground,
the paths between zones, the river and the chasm; `assets` holds each prop's default height,
collider and shadow; `props` support rows (`line` + `count`) and scatters.
`scale` means the card height in metres.

**D13. Backdrop layers hang in front of the camera and are placed in screen space.**
The sky covers the top of the screen; mountains span the width and are sunk below the horizon
so only their upper part shows ("rise" = how far above the horizon, in screen heights).
The mountain images do not tile, so each layer is one wide copy. Parallax moves layers sideways
with the camera (near layers more than far ones). Order is fixed with `alphaIndex` 0–4.

**D14. Camera 36°, stronger bend.** The sky now takes about a quarter of the screen.
The chasm is 8 m wide and the gate stands 8 m behind it, so the gate is visible from the bridge.

**D15. Streaming uses the zone `neighbours` from the file**, plus a 3-second grace time before a
zone is unloaded. Neighbours include zones that can be seen from a zone, not only those joined by a path.

**D16. Culling per prop group.** Every tree group, fog and ground piece is hidden when it is off screen
or sunk behind the bent horizon. This keeps draw calls between about 30 and 60 (budget: 100).

**D17. New fairy lines** (drafts, please check): hints for the start, oak, well, forest, ruins,
monolith, river, ford, hidden path and chasm, plus short lines after each release. All in `en.json`.

## Milestone 6 — Bridge and gate

**D18. Planks appear when you are at the chasm**, one after another, even if the fogs were released
long before. So you always see the bridge being built. Each plank plays a soft tone.

**D19. 5 of 6 planks make the bridge walkable** (`planksRequired: 5`). The missing plank is filled by a
faint thread of light. The sixth fog makes the bridge complete and brighter.

**D20. The gate opens when the bridge is walkable.** The big fog in front of it dissolves, the gate glows,
and walking into it plays the light-and-fog blend (2.6 s), then a calm "Chapter complete" card.
There is no chapter 2 yet, so the card stays. Reload the page to play again.

**D21. Old hints are skipped.** If the player walked away before the fairy could show a hint,
she does not show it later somewhere else. After a release she only speaks if she is not talking already.

## Milestone 7 — Mobile

**D22. Touch controls appear only on touch screens** (or with `?touch` in the address).
Joystick: touch anywhere on the left half, it appears under the finger. Breath: one round button
bottom right; hold = breathe in, let go = the breath flows out by itself. A short tap on the right
half next to a fog counts as a push. The rhythm guide sits on the breath button.

**D23. "Hardware scaling" is measured against the phone's own pixels.** CLAUDE.md asks for 1.5–2.
Taken literally (CSS pixels) that would be very blurry on modern phones, so the game renders at
1 rendered pixel per 1.25–2 device pixels. It starts at 1.5 and adapts every 2.5 s:
below 38 fps it renders fewer pixels, above 56 fps more. Desktop renders at full sharpness (max 2×).
Settings: `TUNING.performance`, `src/core/Performance.ts`.

**D24. Portrait phones get a wider view** (vertical field of view 1.0 instead of 0.72),
so enough of the world fits left and right.

## Test valley (after milestone 7)

**D25. A code-only test valley lives next to the game: `valley.html`.**
Alexander's feedback (HANDOVER section 6) asks for free walking, a movable camera and one closed valley.
Paper cards cannot do this. The test valley checks if a real 3D world, made only in code, can match the
style reference. It reuses the player figure, the fairy, the input and the joystick. The game itself
(`index.html`) is unchanged. Code: `src/valley/`. Numbers: `TUNING.valley`.
- Terrain = one height formula: a flat floor, soft hills, a pond, terraced sandstone cliffs all around.
- Trees, rocks, grass, flowers = simple shapes with painted vertex colours, drawn as thin instances.
- One shared soft toon shader: warm light from the right, cool lavender shade, distance haze.
- Sky dome with sun and clouds in a shader; three rings of far mesas, each paler (layered depth).
- Third-person camera: drag to turn, wheel to zoom, it swings back behind the player by itself.
- About 25 draw calls, no image files. Browser check: `npm run check:browser -- http://localhost:5173/valley.html?debug --scenario valley`.
- The fairy now follows the player's height (`Fairy.update` uses `playerPos.y`; 0 in the game, so no change there).

**D26. The test valley is now a short MVP level** (Alexander chose the code-only world).
- Layout (`src/valley/valleyLayout.ts`): start meadow in the south, a winding path, a river across the whole
  valley with one stone bridge, a rock ridge with one pass, a wide layered chasm in the north, the arch beyond it.
- Two fog blockades block the only ways on: "I am not worthy" on the bridge, "I am angry" in the pass
  (releases: "I am worthy", "I choose peace" — drafts for Alexander). A browser check proves you cannot walk around them.
- Push (E or the hand button): the fog grows, gets denser and darker, and the whole world goes dark for a moment.
  The darkness stays until breathing clears it. Two calm full breaths (4 s in, 4 s out) dissolve a fresh fog; more after pushing.
- Release: a beam of light from the sky, rising sparks, a ring of light on the ground, the release sentence,
  +10 light points. The world becomes warmer and brighter, and the figure glows a little more each time.
- 20 points: at the chasm a bridge of 15 light planks appears. Walking through the arch ends the chapter.
- The fairy leads with lines from `en.json` (keys starting with `valley`). Numbers: `TUNING.valley.mood`, `.blockade`.
- Test: `npm run check:browser -- "http://localhost:5173/valley.html?autostart&debug" --scenario valley` (whole level)
  and `--scenario valleyviews` (look check with fps per view).

**D28. New player figure from `figure-kit/`** (Alexander, 2026-09-28).
- `src/player/PlayerVisual.ts` is now the figure from `figure-kit/src/figure/`: a moving cloak bell with a spring,
  a scarf wrap with two physics scarf tails (`src/player/ScarfTail.ts`), legs and boots, lean, nod, look-around.
- It uses the game's own shaders (`toonShader`, `paperShader`), so it bends with the world curve like everything else.
  The kit's own `toonShader`/`glowShader` are not used.
- Numbers live in `TUNING.player.figure` (values taken from the kit's `config.ts`). Colours: `PALETTE` and `SHADES`.
- The old simple figure moved to `legacy/player-v1/PlayerVisual.ts`. `figure-kit/` stays as the stand-alone demo.
