# CLAUDE.md — Light Within

You build **Light Within**, a calm spiritual browser game in **Babylon.js**.
Read this file fully before every task. Then read the files in section 2.

Current goal: the proof of concept **"The Lantern"** — one theme (**Anger**), an outer town and an inner world.
The old valley level is archived in `legacy/valley-v1/` (git tag `archive/valley-v1`).

---

## 1. How to work with Alexander

- Alexander is the owner. He is not a developer. He is a spiritual practitioner and the content expert.
- Report **in German**. Short, simple sentences. Active voice. One idea per sentence.
- Long answers start with a **TL;DR (Kurzfassung)**. Short bullet points. No filler.
- Explain every abbreviation in brackets, e.g. "NPC (Non-Player Character = Spielfigur, die das Spiel steuert)".
- Per report: what you did, did it work, what he does now.
- If he must decide: **max 2 options**, the context to pick fast, and your recommendation.
- Keep paths and commands exact.
- Respect his voice on all spiritual texts. Mark your own texts as *drafts*.

## 2. Source files (read in this order)

1. `docs/GAME_DESIGN.md` — **binding design**: idea, rules, worlds, characters, mechanics, story beats, texts.
2. `docs/BUILD_PLAN.md` — steps 0–7, checks per step, start values.
3. `docs/HANDOVER.md` — current status and next step.
4. `docs/DECISIONS.md` — decisions made while building (add new ones there).
5. `docs/ORCHESTRATION.md` — how to split work into tasks, which subagent and model (Haiku / Sonnet), review and token rules.
6. `docs/style-reference.png` — the art style. Open it before visual work.
7. `assets/` — Alexander's concept images (references only, never loaded by the game):
   - `assets/Wutteufel, tobend.png` → Anger Imp, state `raging`
   - `assets/Wutteufel, ruhig, mit warmer Flamme.png` → Anger Imp, state `calm`
   - `assets/wütender Bürger mit Fackel und Dampf.png` → angry citizen look (torch, steam)

`docs/concept/GAME_CONCEPT_V2_input.md` is brainstorm input only. Not binding.
If files conflict: `GAME_DESIGN.md` wins over everything else for design; this file wins for working rules. Tell Alexander.

## 3. Non-negotiable design rules (short form — details in GAME_DESIGN.md section 2)

- No combat, no death, no time pressure. Nothing is lost for good.
- The Anger Imp is not an enemy. It is never defeated or removed. Its fire becomes warmth.
- Push makes a Thought Wave stronger. Breathing lets it pass. Breathing alone never finishes the story.
- Inner insight alone, or outer action alone, never completes the transformation. Both are needed.
- Mirror both ways: inner changes show outside, outer changes show inside.
- Citizens are not villains. Clothing colour never means good or bad.
- No shame, no scoring of the player as a person, no health claims.
- **No fairy, no companion character.** Guidance = a calm inner-voice text line. Move `src/companion/Fairy.ts` and `Companion.ts` to `legacy/valley-v1/src/`.
- All in-game text is English and lives in `public/data/dialogue/en.json`, never in code.

## 4. Tech rules

- Vite + TypeScript (strict) + `@babylonjs/core` 9. Keep the build static (any host works; Vercel today).
- **Everything visual is made in code**: primitives, procedural meshes, thin instances, particles, shaders.
  No image textures and no GLB models in the PoC.
- Reuse before rewrite: `src/player/` (figure, breath), `src/companion/DialogueSystem.ts` (bottom text line), `src/core/`, `src/ui/`,
  and the valley parts (terrain, sky, water, props, walker, follow camera, toon shader).
- Two worlds = two Babylon `Scene`s on one `Engine`. Render only the active one.
- All tunable numbers live in `src/config/tuning.ts`. All colours come from `PALETTE` / `SHADES` in `src/config/palette.ts`.
- No game content (text, positions of story objects) hard-coded inside systems. Put them in data or one clearly named layout file.
- Do not add a dependency without a clear reason. Say why in your report.
- Move old code to `legacy/` instead of deleting it.

## 5. Performance rules (mobile first)

- Target: 60 fps desktop, stable 30+ fps on mid-range phones.
- Draw calls: < 100 on mobile in each world.
- Unlit / toon shading only. No PBR. No real-time shadows (blob shadows under figures).
- Share materials. Use thin instances for repeated things. Freeze static meshes.
- Citizens: far citizens without scarf physics and with fewer meshes. Particles pooled.
- Hardware scaling on phones as in `TUNING.performance` / `src/core/Performance.ts`.
- Debug overlay (F3 or `?debug`): fps, draw calls, active meshes, active world, anger, pushLevel, wave count.

## 6. How to check every step

1. `npm run build` — must pass (includes `tsc --noEmit`).
2. `npm run dev` — open `http://localhost:5173/?debug`.
3. Browser console: no errors.
4. Browser checks: `npm run check:browser -- "<address>" --scenario <name>` (scenarios listed in `docs/BUILD_PLAN.md`). Save screenshots under `screenshots/<step>/`.
5. Git commit with a clear message. Then a short German report to Alexander.
6. Stop and ask only if: a design rule is unclear, a decision touches `GAME_DESIGN.md`, or a step fails after 2 fix attempts.

## 7. Palette

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

Light comes from the right (`TUNING.valley.lightDir`). Keep it the same in both worlds.
