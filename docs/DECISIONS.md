# Decisions — "The Lantern" (restart 2026-10-11)

Each entry: what was decided, why, and how to change it.
The old decisions D1–D29 (diorama + valley) are archived in `legacy/valley-v1/docs/DECISIONS.md`.
New numbers start with **L** (for "Lantern").

## Made with Alexander on 2026-10-11

**L1. One theme only: Anger.** The concept input (package, Fear, Attachment, money) was too big for a first test.
Anger is easy to show outside (angry citizens, torches, steam) and inside (a raging imp).

**L2. Anger starts through an event, not a menu.** A stranger bumps into the player and the lantern almost goes out.
The player feels the anger instead of choosing it. A theme menu can come later when there are several themes.

**L3. Breathing lets a Thought Wave pass. Pushing makes it stronger.** Breathing gives space but does not finish the story.

**L4. The anger is transformed, not removed.** The imp's fire becomes a warm flame. It relights the lantern, warmer than before.

**L5. The player must act outside.** The stranger ran to his fallen child. The player helps gather the apples.
Insight: "I only saw a part of it." Only then can the imp calm down.

**L6. Two worlds, Look Within at any time (Q / diamond button).** Outer = a small enclosed town. Inner = the existing valley, smaller, with the Inner Tree and the Source pond.

**L7. Everything in code, no image files in the game.** Alexander's 3 images in `assets/` are references only.

**L8. The old level is archived.** Git tag `archive/valley-v1`, frozen build in `legacy/valley-v1/playable/`, old code in `legacy/valley-v1/src/`.

**L9. No fairy, no companion** (Alexander, 2026-10-11). Guidance is a calm inner-voice text line at the bottom of the screen.
The world shows the way: the Old Tree is always visible, important objects glow, waves come from their source.

**L10. Citizens use the same figure code as the player** with other colours, hood down, torches and steam puffs.
Colours are visual groups only — never good or bad.

## Made while building

**L11. Step 0 archive (2026-10-11).** The frozen build in `legacy/valley-v1/playable/` was made with `vite build` only.
The old code failed `tsc` (wrong argument count in `src/valley/main.ts`). That line is now fixed in the live code.
`sharp` and the PNG asset scripts are removed. No PNGs remain in `public/`.
Note: `scripts/check-browser.mjs` still lists diorama scenarios. They will fail. Replace them in Step 1.

**L12. Step 1 structure.** `src/game/World.ts` is the shared contract. `Town` (`src/outer/`) and `InnerValley` (`src/inner/`) each own a Scene, input and camera.
`Game` renders only the active world. The hidden world is frozen, so position and camera stay. Town now uses the same follow camera as the inner world.
Fairy, Companion and the old valley code are in `legacy/valley-v1/src/`.

**L13. Test hooks.** `window.__lw` = `world()`, `transitioning()`, `playerPos()`, `toggle()`, `drawCalls()`. Scenario `lookwithin`. Diorama scenarios removed.

**L14. Step 2 waves.** `src/game/Anger.ts` holds anger, floor, pushLevel, passStreak. `WaveField` per world, only the active world updates.
Waves face the camera so the text stays readable. E pushes only within `TUNING.waves.pushRange` (6 m).
Heat tint changes only the haze colour (`HeatMood`). Hit = red screen edge (`HitTint`). Touch push button comes in Step 6.

(Add L15, … here.)
