# Decisions and prototype notes — "The Lantern" (restart 2026-10-11)

**Status note (2026-10-16):** This file keeps the development history. Entries L22 onward that describe recent interface, guidance, controls, timing, or visual presentation record a current implementation experiment; they are editable ideas, not fixed design rules or blanket approvals. The original core story and spiritual foundations remain recorded as before. See [`GESTALTUNGSENTWUERFE.md`](GESTALTUNGSENTWUERFE.md) for the consolidated draft list.

Each entry records its source and prototype context where known. Earlier owner decisions remain historical facts; recent presentation choices can be revised with Alexander.

**Breath light feedback (2026-10-15).** Alexander asked for light particles to flow inward during both breath phases, with a small visual difference and no outward shots. Reuse the pooled light mesh with short gold/ivory flecks. Inhale follows a direct inward path; exhale follows a slower, gently curved inward path. Keep the two-second phases and all gameplay. Tune the look in `TUNING.breath.rays`.

**Player breath duration (2026-10-15).** Alexander then asked for menu controls for breath duration. Give inhale and exhale separate choices of 1, 2, 3, or 4 seconds. Both default to 2 seconds. Save the choices locally. Fill/empty rates, the guide, and rhythm checks follow the selected times in both worlds. This request replaces the fixed-duration rule; story completion rules stay unchanged.
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

**L26. Women and men residents (2026-10-14).** Add an optional citizen gender with male as the old default. Four town residents are women and four are men. Women use a bun or braid and a longer work tunic. Both use the same colour controls, calm/angry states, shared body material, and torch grip. The preview starts with Woman and lets the user choose Man.

**L27. Thought spawn rate (2026-10-14).** Set automatic Thought Wave and town Thought Bubble frequency to one third of the prior rate. Keep anger scaling, source proximity scaling, the immediate first bubble after the bump, push relief, and all other timing unchanged. Wave rate at full anger: 0.33 to 0.11 per second. Bubble gaps: calm 3.2 to 9.6 seconds, angry 1.2 to 3.6 seconds.

**L28. Direction labels and inner camera entry focus (2026-10-15).** The Q row and touch diamond show Go Inside in the town and Go Outside inside. Inside, the visible touch caption says Go Outside. Its accessible name and title say "Go back to the village." On each inner entry, the camera frames the visible Anger Imp. Camera drag or player movement releases this focus. Walking returns the camera behind the player. The calm first visit keeps its current view.

**L29. Reference interface revision (2026-10-15).** Use the read-only reference's Georgia and Work Sans type, live-scene start, cream action pills, gold star, dark-green return button, and native persistent menu with Escape, ×, and Return. Give desktop and touch users the existing control help. Opening the menu freezes updates without resetting progress or recreating Story; held input clears on open and close. Preserve the existing two-second breath, keys, saves, and worlds. Keep all text in `en.json`; add no dependency. Do not import old-game lessons, a fairy, or a score.

**L30. Clear next step (2026-10-15).** Alexander asked how to return, how to finish, and how to find the person who needs help. Show one short task hint from the current world and story flags. Reuse the soft gold beacon for the current place and show a small screen marker when the place is out of view. Guide to the alley, back inside after helping, and to the Old Tree after the lantern is lit. Keep Q return clear inside. Keep both story orders and all completion rules. Added task text is a draft; it gives control help, not new spiritual content. Validation is recorded in `HANDOVER.md`.

**L32. Action-driven opening guidance (2026-10-16).** Alexander reported delayed movement instructions and no response at the square marker. Opening prompts now follow movement input, breathing, arrival, and world changes. Completed prompts leave the dialogue queue. Arrival at the displayed square target or the square itself invites Look Within promptly. Timers remain only as gentle reminders. The first breath remains optional, and all story completion rules stay unchanged. No dependency added.

**L33. Contextual apple action (2026-10-16).** Alexander requested that the bottom E action show apple collection instead of Push away when an apple can be picked up. Use Collect apple, a code-made apple icon, and a calm gold highlight on desktop and touch. Derive the label from the same interaction conditions as E; restore the appropriate action when leaving range, collecting the last apple, or changing worlds. Keep interaction priority, pickup range, and story rules. New control copy is a draft. No dependency added.

**L34. Visible imp breath progress (2026-10-16).** Alexander requested a prominent gameplay counter for the final three breaths with the imp. Show the actual completed/required count, three progress marks, and remaining breaths. Use the existing Story breath count and eligibility; a full valid inhale/exhale counts after helping outside and within imp range. Reflect existing resets, hide outside the inner finale, and keep completion visible through transformation. Preserve all mechanics, timing, and story completion rules. New interface copy is a draft in en.json. No dependency added.

**L35. Unmistakable lantern finale (2026-10-16).** Alexander requested a large hanging lantern and more light at the Old Tree, followed by a beautiful completion screen reminiscent of entering the former golden gate. Replace the tiny delivered-lantern appearance with a clearly supported hanging lantern and localized warm light. Add an explicit completed-chapter screen with a warm light reveal and a deliberate return to exploration. Keep existing end title/line, all completion requirements, both-world healing, and a calm town with shade. No new gate task is added. Newly written control/status copy is a draft in en.json. User authorization updates GAME_DESIGN section 7.7. No dependency added.

**L36. Context-first imp and push cues (2026-10-16).** Alexander clarified that the final breath counter should appear only close enough to breathe with the imp. Far away, first invite the player to approach, look, and feel the anger; near the imp, show the breathing instructions and actual count. Leaving range hides the number without changing gameplay progress; completion remains visible through the flame transition. Alexander also requested a conspicuous pop on Push away for each genuinely available thought interaction in either world. Synchronize the cue with the same push eligibility as E, respect apple/tree interaction priority, and suppress it during transitions or modal screens. Keep pushing's strengthening effect, breathing as the alternative, and no new timer or penalty. New English guidance is a draft reflecting Alexander's wording. No dependency added.

**L37. Light for the return to the square (2026-10-16).** Alexander reported that Walk onto the square lacked a destination light after the calm inner visit. Reuse the golden beacon and screen-direction marker for this step, targeting the reachable square centre inside the actual bump-trigger area. Do not reuse the first invitation beacon just before that area. Reaching the destination keeps the existing bump progression and then replaces the square guidance with the alley task. No new text, dependency, or story rule added.

**L38. Push and breathing shown together (2026-10-16, presentation draft).** The current interface experiment presents Push away and breathing as simultaneous, central choices during relevant thought interactions. This is a prototype presentation choice and may be rearranged, restyled, or replaced after review. The underlying push and breathing mechanics remain part of the existing core design. See [`GESTALTUNGSENTWUERFE.md`](GESTALTUNGSENTWUERFE.md).
