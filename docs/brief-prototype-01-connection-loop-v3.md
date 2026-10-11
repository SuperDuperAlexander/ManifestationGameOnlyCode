# Claude Code Brief: Prototype 01 "Connection Loop" (v3)

Repo: `SuperDuperAlexander/ManifestationGameOnlyCode`, branch `main` at commit `557fe6b` ("only 2 times breathing").
Work on a new branch: `connection-loop`.
Concept: `docs/light-within-concept-v2.md`. Where the concept and this brief differ, **this brief wins**.

The main game is the code-only valley in `src/valley/` (`index.html` and `valley.html`).
The paper-diorama game (`diorama.html`, `src/main.ts`, `src/world/`, `src/gameplay/`) is **not touched**.

---

## Goal

Turn the valley level into one full Connection Loop, on a mid-range Android phone at 30+ fps:

start → pick 3 cards → walk the valley → meet a disturbance → go within → Soul, Heart, One → return → the disturbance is quieter and lets you pass → after all 3: light bridge → arch → end card.

This prototype tests the loop, not final art.

## What stays (reuse, do not rebuild)

- The whole valley world: `ValleyTerrain`, `ValleyProps`, `ValleyLandmarks`, `ValleySky`, `ValleyWater`, `ValleyWalker`, `FollowCamera`, `valleyShader`, `ValleyLightBridge`, `Chapter.ts` / `public/data/valley/ch1.json`.
- Player: `PlayerVisual`, `ScarfTail`, `BreathSystem`, `BreathVisuals`, `BreathButton`, `BreathGuide`, `Joystick`, `InputManager`.
- The existing controls: Space = in, Shift = out; touch: hold the breath button = in, let go = out by itself; E / hand button = push.
- The mood system (`VALLEY_UNIFORMS.mood`, `TUNING.valley.mood`): dark near a disturbance, darker after a push, cleared by breathing.
- `Transition`, `StartScreen`, `Hud`, `DebugOverlay`, `Performance`, `Sound`.
- The level layout: stone bridge, pass, chasm, light bridge, arch.

## What changes

- **No fairy in the valley.** Remove `Fairy` and `ValleyStory` from `ValleyGame`. Keep both files: `src/companion/Fairy.ts` is still used by `diorama.html`. Move `ValleyStory.ts` to `legacy/valley-v1/`.
- **The 2 fog blockades become 3 disturbances.** Same idea of blocking the way, new meaning. Keep `ValleyFog.ts` in `legacy/valley-v1/` for reference.
- **The outer world turns grey.** Only disturbances show colour. Colour returns around each connected disturbance.
- **New:** onboarding cards, the dive, an inner world in its own scene, an AI endpoint with an offline fallback.

---

## Step 0: Make `main` build again (before anything else)

`npx tsc --noEmit` fails on `main` today:

```
src/valley/main.ts(15,41): error TS2554: Expected 2 arguments, but got 3.
```

`main.ts` passes the loaded `Chapter` to `ValleyGame`, but the constructor takes only `(canvas, ui)`. `ValleySave.ts` and `polishTuning.ts` (`POLISH`) exist but nothing uses them yet. So `npm run build` fails and a Vercel deploy of this commit fails.

- Add the `chapter: Chapter` parameter to the `ValleyGame` constructor. Store it. Use `chapter.title` / `chapter.subtitle` for the end card if easy.
- Do not wire `ValleySave` or `POLISH` now. List them in the report as "unfinished work from commit 557fe6b".
- `npm run build` must pass. Commit: `fix: ValleyGame takes the chapter (build was broken)`.
- Report to Alexander. Wait for his OK.

## Step 1: Update the project rules (docs only, no game code)

`CLAUDE.md` and `AGENTS.md` still describe the diorama game: fairy companion, fixed camera, paper cards, fog blockades. That is no longer the main game. Show Alexander the diffs. Wait for his OK.

- `CLAUDE.md` and `AGENTS.md` (keep them identical):
  - Section 2 Vision: replace with the Connection Loop from the concept. "No companion. No guide. No outside voice. The only voices are the player and the player's own disturbances. Nothing is destroyed or disappears; it becomes quieter."
  - State clearly: main game = `src/valley/`. Diorama = legacy, frozen.
  - Sections 3–7: mark the diorama parts as "diorama (legacy)". Add a short valley section: code-only 3D, free follow camera, soft toon shader, no image files.
  - Add content rules: the game never advises, diagnoses, judges or names a feeling for the player; no healing claims; everything is personal reflection.
  - Add: one Vercel serverless function `api/reflect.ts` is allowed. The browser only calls its own origin. Player text is never logged or stored on the server.
  - Section 11 Milestones: replace with this brief's steps.
- `docs/HANDOVER.md`: new status, repo name `ManifestationGameOnlyCode`, fairy dropped (decision reversed, reason: Dr. Rulin's teaching, no outside guide).
- `docs/DECISIONS.md`: add D30 onwards for every decision in this brief.

## Step 2: Grey world and colour zones

- In `valleyShader.ts` add to `VALLEY_UNIFORMS`:
  - `saturation` (global, 0 = grey, 1 = full colour). Start value from `TUNING.connection.outerSaturation` (about 0.1).
  - Colour zones: up to 8 × (x, z, radius, strength). Inside a zone the material goes to full colour. Zones grow over 2 to 4 s.
- Add an option to `ValleyMaterialOptions`, same pattern as `mood`: `saturation?: number` (0 = not touched by the grey, keeps full colour). Disturbance materials use 0.
- A restored area is also a little **brighter**, so the change reads without colour vision.
- Sky, far mountains and water follow the same values.
- `?color` in the address shows full colour (debug).
- Browser check: screenshot grey start, screenshot with one zone.

## Step 3: Onboarding cards (concept 3.1)

- After the start screen, before walking: an HTML panel, same style as `StartScreen`.
- Text: "What pulls you or bothers you in your life? Pick 3."
- 8 cards: money, phone, a person, recognition, closed door, crowd, beautiful house, conflict.
- The 3 picks become the 3 disturbances in pick order.
- Keyboard reachable, touch targets 48 px or more.
- Save picks in `localStorage` (try/catch, same style as `ValleySave`).
- `?autopick` picks the first 3 (for tests). All text in `public/data/dialogue/en.json`, keys starting with `conn`.

## Step 4: Disturbances in the valley

- New `src/valley/Disturbance.ts`. It replaces `ValleyFog` in `ValleyGame`.
- Chapter data: add `disturbanceSpots` to `public/data/valley/ch1.json` layout, 3 spots: the two current fog spots (stone bridge, pass) plus one before the chasm edge. Extend `validateChapter` for it (same strict checks as the fog list). Keep `fogs` in the file, unused, so old data still validates, or remove it from the validator on purpose; say which in the report.
- 8 placeholder shapes, built in code like `ValleyProps` (slot machine, glowing phone, silhouette, trophy, locked door, crowd blob, golden house, storm cloud). Full colour, soft pulse, a quiet generated sound loop (via `Sound`).
- Each disturbance has a collider that blocks the way, like the fogs today. The existing `reach()` check must prove you cannot walk around them.
- States: `waiting` → `near` → `within` → `connected`.
- Near: existing approach darkness. Push (E / hand): it grows and pulses faster, the world goes darker (reuse the push code). It never breaks.
- Echo (concept 3.3): when the player passes a `waiting` disturbance, it shows one stored fragment of the player's own words as floating text (reuse `TextCard`). Before any words exist, it shows nothing.

## Step 5: Approach and choice

- Within `TUNING.connection.chooseRange` of a `near` disturbance: ambient sound down, a heartbeat up (generated in `Sound`).
- Two small buttons: `Stay outside` / `Go within`. They replace the key hint line while near.
- `Stay outside`: the buttons hide until the player leaves and comes back.
- `Go within`: the breath guide shows. One finished breath (`BreathSystem.onBreathDone`) starts the dive.

## Step 6: The dive

- During that breath's in-breath: take the camera out of `FollowCamera` control and move it smoothly into the player's chest. Reduced motion (`prefers-reduced-motion`): no flight, only a fade.
- Fade through warm gold with `Transition`.
- Switch to the inner world: a **second `Scene`** on the same `Engine`. The render loop renders only the active scene. Freeze the valley update while inside.
- Return: the reverse, back behind the player, `FollowCamera` takes over again.

## Step 7: Inner world

- New `src/inner/InnerWorld.ts`, `src/inner/parts.ts`.
- First-person camera. Look only: drag (right half on touch, mouse on desktop). Gyroscope only behind a permission button. What the view rests on for about 1.5 s drifts slowly closer.
- 12 parts, built in code: `fog`, `wall`, `water`, `light`, `wind`, `plants`, `cracks`, `canyon`, `door`, `openSpace`, `narrowSpace`, `particles`.
- Placeholder look: ivory paper planes with lace-like cut-outs from noise, warm gold back light (`PALETTE.ivory`, `PALETTE.gold`), soft particles. Use `GlowLayer` only on the light parts.
- `buildInner(spec: SceneSpec)` builds the room from data. Unknown parts are skipped.
- Budget: under 40 draw calls in the inner scene.

## Step 8: Inner steps

1. **Soul.** Floating text: "What did you come to teach me?" The player taps it to ask. The disturbance answers with one question.
2. **Answer.** 4 to 6 tap chips plus an optional text field "Your own words". At most 2 follow-up rounds.
3. **World.** `buildInner` with the result. The hard element (canyon, wall or fog) sits ahead.
4. **Heart.** Screen dims: "Close your eyes. Feel where it sits." 10 s sound only, then a soft chime. A simple body outline: the player taps a spot. A warm light appears there.
5. **One.** The player looks at the hard element and breathes. Each finished breath changes it one step (a bridge of light over the canyon, a door in the wall, the fog thinning). After `TUNING.connection.breathsToConnect` breaths (start with 2, like the current demo) it is changed. It never disappears.
6. **Keep a seed.** "Your sentence to keep:" prefilled from the player's own words, editable. Saved locally.

## Step 9: Return and the changed valley

- One finished breath → the dive back out.
- The disturbance stays: about half the glow, quieter sound, slower pulse, a little smaller. It moves 1.5 m to the side, so the path is free (collider follows).
- A colour zone grows around it (Step 2). `mood.byProgress` rises per connected disturbance, as it does now per released fog.
- After all 3 are connected and the player is near the chasm edge: the existing light bridge and arch flow. End card text from `en.json` (`conn` keys, no fairy lines).

## Step 10: AI endpoint and fallback

**Build the fallback first.** The whole loop must work without AI.

- `src/inner/fallback.ts`: a fixed table, chip → next question + chips + `SceneSpec`. Used when: `?noai`, dev server, request error, no answer after 6 s, or the player typed nothing.
- `src/inner/safety.ts`: a crisis word list, checked in the browser **before** sending. On a match: do not send, pause, show a calm panel with a help-line text and a `Return` button. Text in `en.json`.
- `api/reflect.ts` (repo root): Vercel serverless function. Key from `process.env.OPENROUTER_API_KEY`. Model `meta-llama/llama-3.3-70b-instruct:nitro`. Never log the request body.
- Request: `{ disturbance, step, history: [{ q, a }], chips, freeText }`
- Response, JSON only:

```json
{
  "question": "What would winning give you?",
  "chips": ["Freedom", "Safety", "Being seen", "I don't know"],
  "done": false,
  "sceneSpec": {
    "theme": "freedom",
    "parts": ["narrowSpace", "wall", "light"],
    "hardElement": "wall",
    "mood": "tight",
    "lightLevel": 0.3
  }
}
```

- System prompt: one short question; never advise, diagnose, judge or name the player's feeling; reuse the player's own words; no healing claims; English; JSON only.
- Validate every response in the browser: drop unknown parts, clamp numbers, cut long text. Invalid → fallback.
- While waiting: keep the breath visuals running. No spinner.
- `npm run dev` has no serverless runtime. It uses the fallback and says so in the debug overlay.
- Store up to 20 fragments (3 to 6 words) of the player's free text in `localStorage` for the echo (Step 4). Nothing on the server.

## Numbers and text

- All numbers: new block `TUNING.connection` in `src/config/tuning.ts`.
- All player text: `public/data/dialogue/en.json`, keys starting with `conn`.
- Colours: `PALETTE` / `SHADES` only.

## Tests

- Keep using `scripts/check-browser.mjs`. Add a scenario `connection` in `scripts/scenarios.mjs`:
  `npm run check:browser -- "http://localhost:5173/?autostart&autopick&noai&debug" --scenario connection`
  It walks to disturbance 1, pushes once, goes within, answers, does the heart step, connects, returns, checks: disturbance still exists, state `connected`, colour zone active, path free. Then all 3, bridge, arch.
- Add `__lw` hooks for this in `src/valley/main.ts` (read-only style, like the existing ones).
- Run the existing `valley` scenario too. Update it where the fairy or fogs are gone. Say what you changed.
- Run with `--mobile` once. Report fps and draw calls in the valley and in the inner scene.
- No new test framework. If you want one for the pure logic (fallback, safety, response check), ask first and say why.

## Out of scope

Returning themes (concept 3.2), RAG, microphone or camera input, double exposure, multiplayer, final art, the diorama game, `ValleySave` / `POLISH`.

## Acceptance

- `npm run build` passes.
- Full loop in the browser with `?noai`, and on Vercel with the AI.
- No fairy in the valley. `diorama.html` still starts.
- Android phone: 30+ fps in the valley and inside.
- No browser request to any other origin than the game's own.

## Report (in German, as `CLAUDE.md` section 1 says)

After each step: what you did, did it work, what Alexander does now. At the end, screenshots: grey valley, disturbance with the two buttons, dive, inner room, body outline, valley after (colour zone), light bridge.
