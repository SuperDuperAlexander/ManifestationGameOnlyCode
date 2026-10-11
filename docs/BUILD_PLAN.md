# BUILD PLAN — "The Lantern" (Anger PoC)

What to build, in which order, and how to check each step.
Design: `docs/GAME_DESIGN.md`. Rules: `CLAUDE.md`. Decisions while building: `docs/DECISIONS.md`.

Work one step at a time. After each step: build, run in the browser, check the console, take screenshots,
git commit, and report to Alexander in German (3–6 short lines). Then continue unless blocked.

---

## Step 0 — Archive the old level and clean the start

Goal: the old valley and the diorama stay playable forever. The new game starts clean.

1. Make sure the working tree is clean. Commit anything open with the message `chore: state before restart`.
2. Tag it: `git tag archive/valley-v1` and `git push origin archive/valley-v1`.
3. Build once with the old code: `npm run build`. Copy `dist/` to `legacy/valley-v1/playable/`.
   Check: `npx vite preview --outDir legacy/valley-v1/playable --port 4174` opens the valley and `/diorama.html`.
4. Move (do not delete) old-only code into `legacy/valley-v1/src/`:
   - `src/main.ts`, `src/world/`, diorama-only gameplay (`src/gameplay/` files used only by the diorama),
     `diorama.html`, `valley.html`, `public/data/chapters/`, `public/assets/ch1/` (PNG + WebP), `scripts/convert-assets.mjs`.
   - Keep `src/valley/` **in place for now** as the source to reuse from (Step 1 moves the useful parts).
5. `legacy/valley-v1/docs/` and `legacy/valley-v1/README.md` already exist (written 2026-10-11). Do not overwrite them.
6. `tsconfig.json`: exclude `legacy/`. `vite.config.ts`: only `index.html` as input. Remove the asset scripts
   (`assets`, `predev`, `prebuild`) and the PNG-strip plugin if no PNGs remain in `public/`. Remove `sharp` only if unused.
7. Leave `figure-kit/`, `legacy/GameLightWithin/`, `assets/` (Alexander's reference images) and `.kilo/` untouched.
8. Update `README.md` for the new game (how to run, controls, where the old version is).

Check: `npm run build` passes. `npm run dev` still starts (the old valley may still run from `index.html` at this point).

## Step 1 — Two worlds and Look Within

Goal: walk in a greybox town, press Q, arrive in the inner valley, press Q, come back.

- New folders (suggested): `src/game/` (Game, StoryState), `src/outer/` (Town), `src/inner/` (InnerValley), `src/transition/` (LookWithin).
- **Two Babylon `Scene`s on one `Engine`.** Build both at start. Render only the active one. Each has its own camera rig.
- Inner world: move the reusable valley parts from `src/valley/` to `src/inner/` (terrain, sky, water, props, walker, follow camera, shader).
  Shrink the valley (`TUNING.inner`). Keep pond + waterfall as the Source. Leave space at the centre for the Inner Tree.
- Outer world: greybox town per `GAME_DESIGN.md` 5.1. Boxes for houses, one cylinder for the Old Tree, a ring for the fountain.
  Flat ground with a gentle slope at the Town Edge. Simple box/circle colliders.
- Player in both worlds (one `PlayerVisual` per scene, or move one figure between scenes — pick the simpler).
- Look Within transition (1.6 s): camera moves to the diamond on the back, gold bloom overlay (DOM or full-screen quad), switch scene, reverse.
  Player position and camera angle in each world are kept.
- Q key + diamond touch button.
- Remove the fairy: move `src/companion/Fairy.ts` and `src/companion/Companion.ts` to `legacy/valley-v1/src/companion/`. Keep `DialogueSystem` (bottom text line = inner voice).
- Old `src/valley/` code that is no longer used: move to `legacy/valley-v1/src/valley/`.

Check: browser script (`scripts/check-browser.mjs`) scenario `lookwithin`: start → walk → Q → screenshot inner → Q → position equals start position. Draw calls in both worlds within budget. No console errors.

## Step 2 — Thought Waves, breath and anger

Goal: the core mechanic feels right before any story.

- `src/thought/ThoughtWave.ts`: band mesh (bent ribbon or a few soft planes) + heat-shimmer shader + text (reuse the text rendering from `ValleyFog`).
  States: `drifting`, `passing`, `pushed` (burst + hidden timer), `returning` (bigger), `hit`, `gone`.
- `src/thought/WaveField.ts`: spawns waves per world from source points, rate and size from `anger` and `pushLevel`.
- `src/game/Anger.ts`: the value `anger`, floor, `pushLevel`, `passStreak`, events (`passed`, `pushed`, `hit`).
- Hook breathing: a wave touching the player while `BreathSystem` state is `inhale` or `exhale` → `passing`.
- Push: E / hand button within range → `pushed`. Hit: stagger + slow + red edge tint (CSS overlay, cheap).
- World mood: reuse the valley mood (haze colour, warmth) and add a heat tint driven by `anger`.
- Debug: `?anger=0.7` starts with anger on. Debug overlay shows `anger`, `pushLevel`, wave count.

Check: scenario `waves`: with `?anger=0.7`, (a) breathing through 3 waves lowers anger, (b) 3 pushes make waves visibly larger, (c) 3 passes in a row reset size, (d) a large wave pushes the player but the player can walk on. Screenshots of each.

## Step 3 — Citizens

Goal: a town that visibly mirrors the anger.

- `src/npc/CitizenVisual.ts`: variant of the figure (shared code with `PlayerVisual`): colour sets, hood down + simple head/cap/beard, no diamond.
  Far citizens: no scarf physics, fewer meshes. Share materials between citizens.
- `src/npc/Torch.ts`: stick + flame particles. Flame height from agitation.
- `src/npc/Steam.ts`: puff sprites/meshes with a tiny lightning shape, pooled.
- `src/npc/Citizen.ts`: wander loops on a few waypoints, pairs chat, agitation states (`GAME_DESIGN.md` 6.1), bump pairs at high agitation, circle colliders.
- 8 citizens in the PoC. Reference look: `assets/wütender Bürger mit Fackel und Dampf.png`.

Check: scenario `town`: `?anger=0` vs `?anger=0.9` screenshots from the square. Draw calls ≤ 100 on `--mobile`. Stable fps.

## Step 4 — Inner Tree, roots and the Anger Imp

Goal: the inner world tells the anger story without words.

- `src/world/TreeShape.ts`: one shared silhouette definition (trunk, branch list, root list) used for the Old Tree (small) and the Inner Tree (giant).
  Each branch/root has an index and a `health` 0..1 (dry/burned ↔ healthy).
- Inner Tree with walkable large roots, burned root (dark cracked material + ember particles).
- `src/inner/AngerImp.ts`: procedural body (see `GAME_DESIGN.md` 6.3), states `raging` / `calming` / `calm`, fire-puff particles, lightning bolts, small rocks, wave source.
  Reference images: `assets/Wutteufel, tobend.png` (raging), `assets/Wutteufel, ruhig, mit warmer Flamme.png` (calm).
- Source water flows into a root when its health rises (animated stream or particles along the root).
- Reveal rule: imp and burned root exist only after the bump.

Check: scenario `imp`: screenshots of each imp state; root health 0 → 1 animation; draw calls inside within budget.

## Step 5 — Story, lantern, bump, alley

Goal: the whole PoC playable from start to end.

- `src/game/StoryState.ts`: beats 0–9 from `GAME_DESIGN.md` section 9, flags (`bumped`, `sawImp`, `helped`, `impCalm`, `lanternRelit`, `delivered`), checkpoint save.
- `src/game/Lantern.ts`: held lantern, `lanternLight`, flicker, warm relight.
- Bump sequence (≤ 4 s): stranger runs in, collision, lantern drop + light loss, stranger runs to the alley.
- Alley: child, stranger, 5 apples (glow + E/tap), basket, stranger line, insight.
- Imp transformation, flame to lantern, delivery niche in the Old Tree, both trees heal, end card.
- Dialogue: new keys in `public/data/dialogue/en.json` (section 10 of the design). No text in code.
- Remove old valley-only keys from `en.json` only after nothing uses them (move them to `legacy/valley-v1/`).

Check: scenario `lantern` plays the whole PoC with test hooks (`window.__lw`), ends with the end card. Also run it in a different order (alley before imp).

## Step 6 — Mirror polish, mobile, performance

- All rows of the mirror table (`GAME_DESIGN.md` section 8) visible and in sync. Fountain ↔ Source. Branch ↔ root.
- Touch: diamond button, hand button, tap-to-interact. Portrait and landscape.
- Performance pass on a real phone (`TUNING.performance`): draw calls, fps, memory after 5 world switches.
- Synth sounds: wave whoosh, push burst, pass (soft exhale), imp growl (soft, not scary), calm chime, lantern relight.

Check: scenario `lantern --mobile`. Screenshots per beat. Debug numbers in the report.

## Step 7 — Playtest with Alexander

- Alexander plays on desktop and phone. Collect his feedback in `docs/HANDOVER.md`.
- Tune numbers in `TUNING.anger`, `TUNING.waves`, `TUNING.citizens` only.

---

## Start values (put them in `src/config/tuning.ts`)

```ts
anger: {
  onBump: 0.7, floorBeforeHelp: 0.35,
  push: 0.08, hit: 0.02, pass: -0.05, afterHelp: -0.15,
  fadeOutTime: 4,
},
waves: {
  rateAtFullAnger: 0.33,   // waves per second at anger 1
  speed: 2.2,              // m/s, slower than walking
  width: 6, height: 2.2,   // metres
  pushRelief: 4,           // seconds without waves after a push
  pushGrow: 0.25,          // +25 % size per pushLevel
  maxPushLevel: 4,
  resetAfterPasses: 3,
  hitSlowTime: 2, hitSlowFactor: 0.5,
  bigWaveShove: 2.5,       // metres at max pushLevel
},
citizens: { count: 8, agitationWeight: 0.8, bumpAbove: 0.65 },
imp: { breathsToCalm: 3, scale: 1.5 },
lookWithin: { transitionTime: 1.6 },
```
