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

**L15. Steps 3 + 4 built in parallel.** Citizens are one CPU-posed mesh each, shadows share one mesh (town 45–47 draw calls).
`src/world/TreeShape.ts` = one silhouette for Old Tree and Inner Tree. Dry branch = burned root = index 2.
Imp at the imp clearing, hidden until `reveal()` (reveal rule). `LAYOUT.alleyDir` = west (guess, check in Step 5).
Test hooks: `teleport`, `setImpState`, `setRootHealth`, `reveal`; URL `?reveal`.

**L16. Step 5 story.** `Story.ts` directs, `StoryState.ts` holds beats 0–9 + flags + save. Q unlocks after the first breath.
Reveal + mirror: imp, burned root and BOTH dry branches appear only after the bump. Fountain jet rises when the root heals.
Town camera treats roofs as ground, so it never sits inside a wall. Torches keep a calm flame at anger 0 (design 7.7).
Open: no touch button for interact yet; "waves thicker near the alley" not built (Step 6).

**L17. Step 6.** Touch: hand button (push / interact), tap on glowing objects, `?touch` forces touch UI.
Sounds: Web Audio synth only (`src/core/Sound.ts`, `src/game/SoundCues.ts`), starts after the first input.
Waves come more often near their source (alley / imp) and 40 % start at agitated citizens.
Phones get 45 % of the inner grass. Memory stays flat after 20 world switches (43.5 → 43.3 MB).
Known flaky test: `lantern-alt --mobile` once timed out on the apples (test reached the alley before it was shown). Not reproduced in 3 runs.

**L18. Town = valley look and layout (Alexander, 2026-10-11).** The archived valley is the design guideline.
Town sits in a basin with sandstone cliffs, curving uphill Main Street, raised round square, stream + waterfall + stone bridge at the Town Edge.
All town surfaces use the valley shader, sky, haze and mood. Houses come from `src/outer/HouseBuilder.ts` (18 houses, 3 draw calls). Props from `TownProps.ts`.
Breath ring (`BreathGuide`) and start screen are back. Option B: story order stays; breath and Look Within hints repeat every 12 s until done; a gold beacon on Main Street shows where to go.

**L19. Calm start, bump on the square (Alexander, 2026-10-12).** Opening order: wake at the Town Edge → breathe once → walk to the square → First Look Within (all calm) → the bump on the square → the imp appears inside → back outside the town is angry too.
Why: the player first feels the calm town and the calm inner world. Then the bump makes everything angry, inside and outside. The contrast carries the story. The bump moves from Main Street to the square.
Change: section 3 (core loop), 5.1 (town table) and 9 (beats 1–3, 6) of `GAME_DESIGN.md`.

(L20 not needed: the valley-like town layout is already in L18.)

**L21. Thought Bubbles (Alexander, 2026-10-12).** Thought Waves become comic Thought Bubbles. Push → bigger next bubble + a citizen bumps into the player. Breathing calms the town. Imp 5x size, mirrors outer anger. Thought texts are drafts by Claude.
Change: `GAME_DESIGN.md` (sections 1–13), `public/data/dialogue/en.json` (new keys `thoughts`, `thoughtPushed`, `thoughtPassed`; old `wave…` keys kept).

**L22. Interface refresh (2026-10-14).** Warm-paper menu with code-made lantern and arch. Begin appears when ready; Continue appears when a save exists. Control icons match their actions and names. Speech text stays within the screen. The layout supports desktop, phone portrait and phone landscape. A small tab icon is added.
Keep all game inputs, story text, save behavior and the 2-second breath timing. No dependency was added. Build and desktop/phone browser checks passed. Test setup now uses a walkable point near the imp and the required first breath in both story orders; game rules stay the same. Concurrent villager work blocked the final shared runtime check, so final interface checks used base `1a7b348` plus identical interface/test files in an isolated copy. A real-phone playtest remains open.

**L23. Citizen appearance and state preview (2026-10-14).** Peaceful and angry citizens use the same code-made identity. Six seeded colour sets and a per-instance runtime appearance API support variation. `villager-kit/` re-exports the live game model. A lit torch stays softly lit when a citizen calms, and the arm lowers.

**L24. Natural torch carry (2026-10-14).** The torch arm has a lower upper arm, bent elbow, and a right wrist joint. The hand and torch share one grip transform. The torch sits beside the face, with a short handle below the fist. The figure keeps one body mesh.

**L25. Visible torch grip (2026-10-14).** Set the handle depth below the grip to 0.11 so the shaft visibly exits below the fist. The hand continues to hold the same shaft. The figure, flame, and carry pose stay the same.
