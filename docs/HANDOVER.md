# HANDOVER — Light Within

Last update: 2026-10-11
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
- Next: Step 6 (mirror polish, touch, phone performance, sounds).

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
