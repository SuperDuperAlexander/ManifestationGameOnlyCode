# HANDOVER — Light Within

Last update: 2026-10-14
Owner: Alexander
Repo: https://github.com/SuperDuperAlexander/ManifestationGameOnlyCode
Game title: **Light Within**. Current PoC (proof of concept = small complete test): **"The Lantern"**.

`CLAUDE.md` = working rules. `docs/GAME_DESIGN.md` = binding design. `docs/BUILD_PLAN.md` = steps.

---

## 1. What happened on 2026-10-11

- Alexander decided to **restart the game system**. The art basis (code-only 3D valley look, red-cloak figure) stays.
- New core idea: **the inner world reflects the outer world and the other way round.** The player can Look Within at any time.
- A first concept (`docs/concept/GAME_CONCEPT_V2_input.md`) was too big (package, Fear, Attachment, money, reflection questions).
  It was narrowed to **one theme: Anger**.
- Agreed with Alexander:
  - Anger starts through an **event** (a stranger bumps into the player), not through a menu.
  - **Breathing lets a Thought Wave pass. Pushing makes it stronger.**
  - Code first; Alexander's 3 concept images guide the look of the imp and the citizens.
  - Claude writes the docs. Claude Code builds the game.
  - The old level is **archived**, the new game is built from there.
  - **The fairy is removed completely.** An inner-voice text line guides instead.

## 2. Status

- Docs written: `CLAUDE.md`, `AGENTS.md` (same content, for other coding agents), `docs/GAME_DESIGN.md`, `docs/BUILD_PLAN.md`,
  this file, `docs/DECISIONS.md` (restarted), `legacy/valley-v1/README.md`, `legacy/valley-v1/docs/` (old docs).
- **Step 0 done** (2026-10-11): tag `archive/valley-v1` on GitHub, frozen build in `legacy/valley-v1/playable/`, old code in `legacy/valley-v1/src/`.
  Valley still runs from `index.html`: 60 fps, 35 draw calls, 0 console errors.
- **Step 1 done**: greybox town + inner valley, Q / diamond switch (1.6 s gold bloom). Town 27 draw calls, 60 fps. Inner 24 draw calls, 39 fps in the headless test (grass; check in Step 6).
- **Step 2 done**: Thought Waves in both worlds. Breathe = pass, E = push (stronger), nothing = hit (shove, slow, red edge). Scenario `waves` passes. 60 fps, ≤ 30 draw calls.
- **Steps 3 + 4 done**: 8 citizens with torches and steam mirror the anger (town 47 draw calls, 60 fps). Inner Tree, burned root, Source stream, Anger Imp (raging / calming / calm). Inner 34–39 draw calls.
- **Step 5 done**: whole PoC playable, beats 0–9, both orders (scenarios `lantern`, `lantern-alt`). Town 42–58 draw calls, inner 31–42, 60 fps.
- **Step 6 done**: touch controls, synth sounds, wave sources, phone grass cut. Max 59 draw calls (desktop and mobile emulation), 60 fps on this PC.
- **Look pass done** (after Alexander's feedback): town has valley layout + charm, nicer houses, visible breath ring, start screen. Town 42–62 draw calls, 60 fps.
- **Interface refresh done (2026-10-14).** The menu uses warm paper and code-made lantern and arch art. It shows Begin when ready and Continue when a save exists.
- Control icons now match their actions and have clear names. The layout accounts for desktop, phone portrait and phone landscape. Speech text stays inside the screen.
- A small tab icon is added. All game inputs, story text, save behavior and 2-second breath timing stay the same. No dependency was added.
- Build passes. Desktop and phone browser views, keys, touch, fresh Begin, Continue, both story orders and speech bounds pass. Peak: 55 draw calls. A real-phone playtest remains open.
- Two browser-test setup faults were fixed: use a walkable point near the imp and take the required first breath in both story orders. Game rules did not change.
- Separate villager work changed the live game during checks. The last shared browser check was blocked by a vertex-data error, then a page-load timeout. Those files were left untouched. Final interface checks passed with zero browser errors in `build/ui-refresh-check-20261014` (base `1a7b348` plus the same interface/test files). Review: `http://127.0.0.1:5180/`.
- **Next: Step 7 = playtest by Alexander** on desktop and a real phone. Then tune `TUNING.anger`, `TUNING.waves`, `TUNING.citizens` only.

## 3. Next step — start here

1. Read `CLAUDE.md`, then `docs/GAME_DESIGN.md`, then `docs/BUILD_PLAN.md`.
2. Do **Step 0** (archive). Report in German.
3. Do **Step 1** (two worlds + Look Within). Report.
4. Continue step by step.

## 4. Open questions (none blocks work)

- All texts in `GAME_DESIGN.md` section 10 are drafts. Alexander approves later.
- Citizens' own short reasons when you walk close — optional, Alexander decides.
- `.kilo/worktrees/cliff-region/` is an unfinished side branch from before. Leave it alone unless Alexander asks.

## 5. Feedback log

(Add Alexander's playtest feedback here, newest first.)

- 2026-10-14: Interface refresh completed. Menu, matching controls and desktop/mobile layouts are recorded in L22. Browser checks passed in the isolated review copy. Real-phone feedback remains open.
- 2026-10-11: "Nothing happened" — story waited for a first breath, hint was missed; breathing was not shown. Town looked like a greybox. → Fixed in the look pass (L18).

## 6. Villager kit update (2026-10-14)

- `villager-kit/` previews the live in-game citizen model with peaceful and angry states, six seeded colour sets, runtime colour controls, torch, and pooled steam.
- The final torch and framing checks passed on desktop and phone emulation. The preview uses 8 draw calls and 4,906 triangles. Colour changes, shared identity, torch motion, steam, and browser-error checks pass on the built preview at port 4173.
- Town checks showed 48 calm / 63 angry draw calls on desktop and 48 calm / 61 angry draw calls in phone emulation. The full lantern story passed with zero console problems.
- Final build passed on source commit `f916e2d`. The final phone town check passed with 48 calm / 61 angry draw calls and zero console problems.
- A real-phone hardware check remains open.
- Torch carry follow-up: bent elbow, relaxed upper arm, and a separate wrist joint in the same body mesh. The hand and torch share the grip transform. Front/side/phone preview review, full build, and browser checks passed. Evidence is in `screenshots/villager-pack/torch-hold/`.
- Grip and cost review: shaft now exits below the fist. Close-view checks and the full build passed. Town sampling held 60 frames per second on this PC in desktop and phone screen tests. This does not verify a real phone. Live player/villager comparison and raw counts are in `screenshots/villager-pack/grip-review/`.
- Women and men: town now has four of each. The villager preview has Woman/Man choices and keeps colours and mood when switched. Full build, desktop/phone preview, repeated switches, and phone town checks passed. Town stayed at 48 calm / 61 angry draw calls. Images: `screenshots/villager-pack/women/`.
