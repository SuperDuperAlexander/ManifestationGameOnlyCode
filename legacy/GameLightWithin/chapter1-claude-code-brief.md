# Claude Code brief: Chapter 1 "Receive"

Build the complete first chapter of a new 3D browser game. Start from an empty folder. Do not reuse code from any earlier project.

Work through the milestones in order. Do not stop between milestones unless you are blocked. After each milestone: run all tests, take screenshots, commit.

---

## 1. What this game is

- A calm 3D browser game that teaches Dr. Rulin Xiu's teaching on how to manifest.
- Working title: "Light Within". Keep the title in one constant so it is easy to change.
- No enemies, no points, no score, no "game over", no timers.
- The world starts grey. The player's inner state (shown through a breath rhythm) brings light and color back.
- The action teaches the idea. Text comes only after the player has experienced something.
- No companion or helper character.

### Content rules (must follow)

- No medical or healing claims anywhere. Breathing is never described as healing.
- Manifestation is always framed as personal reflection, never as a promise.
- Dr. Rulin Xiu is named in third person only, and only on the "Understand" card.
- Blockages look soft and melancholic, never scary or horror-like.
- All player-facing text lives in `src/content/strings.en.ts`. Prepare the structure so a German file can be added later.
- Player-facing text: short sentences, sentence case, no all caps, no filler.

---

## 2. Tech stack (fixed)

- TypeScript (strict mode)
- Vite
- Three.js (plain, no React, no React Three Fiber)
- `three-mesh-bvh` for collision and ground checks
- Three.js `EffectComposer` from `three/addons` for post-processing
- Custom GLSL shaders for the painted look and the grey-to-color system
- Web Audio API for all sound (generate sounds in code, no audio files needed)
- UI overlays in plain HTML and CSS on top of the canvas
- Saving: `localStorage` only. No network requests of any kind. No analytics. No external fonts or CDNs (self-host the font).
- Tests: Vitest (logic), Playwright (browser runs and screenshots)
- ESLint and Prettier
- Deploy target: static hosting (Vercel or Netlify). No server.

Create a `CLAUDE.md` in the project root. Put the content rules, the stack, the performance budget and the art rules from this brief into it, so later chapters follow the same rules.

---

## 3. Performance budget

- Initial download: 6 MB or less. Total: 15 MB or less.
- Desktop (mid-range laptop): 60 fps.
- Mid-range Android phone: 30 fps or more.
- Cap device pixel ratio at 1.5 on mobile.
- Three quality tiers (low, medium, high). Pick the tier automatically from a short frame-time test at start. Allow manual change in settings.
- Low tier: painting filter at half resolution, fewer particles, fewer grass cards.
- Report bundle size and measured fps in the completion report.

---

## 4. Art direction: painted look, made fully in code

All art is made in code. There are no model or texture files from outside, except the self-hosted font.

- **Shapes:** procedural geometry. Soft rolling hills, rounded rocks, simple stylized trees (trunk plus clustered soft blobs), a stone spring basin, a stone with a carved sign, a small bridge.
- **Grass and flowers:** camera-facing cards (billboards) with procedural brush-stroke alpha.
- **Sky:** a large sky dome with a painted gradient shader, soft cloud strokes from noise.
- **Light:** baked into vertex colors or shader, not heavy real-time shadows. One soft directional light is fine. Use a simple blob shadow under the player.
- **Painting filter (full screen):** a Kuwahara-style filter (smooths areas into brush-like patches while keeping edges). Add a subtle procedural paper grain and soft edge darkening (vignette).
- **Grey-to-color system:** every world material shares one shader chunk. A uniform array holds "restored zones" (center, radius, strength). Inside a zone, the material shows full color. Outside, it shows a desaturated, slightly blue-grey version. Zones grow smoothly over 2 to 4 seconds when they are added. Chapter end sets a global color value to 1.
- **Palette:**
  - Start grey: `#9AA0A7`, sky grey `#CFD2D6`
  - Receive gold: `#E8B84B`, sun `#F2C14E`
  - Blockage: `#4A5578`
  - Growth green: `#74B28D`, deep green `#3E8E69`
  - Far hills violet: `#B9A7D8`
  - Heart rose: `#E98BA3`
  - Warm sky: `#F5DCC0`
- **Player:** a simple, soft, faceless figure (rounded body, small head, light cloak shape). A soft glow around the player shows calm (see section 5).
- **UI style:** quiet and minimal. One self-hosted humanist sans-serif typeface. Frosted, semi-transparent panels with a warm tint. No harsh borders. Large touch targets (at least 48 px).

---

## 5. Core systems

### 5.1 Controls

- Desktop: WASD or arrow keys to walk. Mouse drag to rotate the camera. Hold Space to breathe in, release to breathe out. E for "push". Esc for pause.
- Mobile: virtual joystick on the left. Large breath button on the right. Small push button above it. Drag on the empty screen to rotate the camera. Pause button in the top corner.
- Third-person camera that follows gently. No sudden moves.

### 5.2 Breath system (the base of everything)

- A breath circle UI in the lower center of the screen.
- The circle shows a target rhythm: it grows during the in-breath and shrinks during the out-breath.
- The player holds the breath button to breathe in and releases it to breathe out.
- One breath = one hold plus one release.
- A breath is **calm** when both durations are close to the target (tolerance ±30 percent).
- Breathing counts only while the player stands still. Walking resets the current breath.
- Rhythm presets (in settings):
  - Normal: in 4 s, out 6 s
  - Slow: in 5 s, out 7 s
  - Easy: in 3 s, out 4 s, tolerance ±45 percent
- **Calm value:** hidden number from 0 to 1. Each calm breath raises it. Non-calm breaths and walking lower it slowly. Never show the number.
- **Glow:** the player's glow brightness follows the calm value. Also give a soft sound cue when a breath is calm (do not rely on visuals only).
- Scaffolding: the circle has a strong outline in chapter 1. Keep a `circleStrength` parameter (1.0 in chapter 1) for later chapters.
- Emit events: `breathStarted`, `breathCompleted { calm: boolean }`, `calmChanged`.

### 5.3 Light (the only resource)

- The player carries light. Show it as small glowing motes that orbit the player. No numbers.
- Maximum 12 light.
- Sources in chapter 1: spring 1 gives 3, spring 2 gives 3, the fog gives 2, spring 3 gives 3.
- A seed costs 5 light.

### 5.4 Receive (springs)

- A spring gives 1 light per calm breath while the player stands within 3 m, up to its limit.
- Light visibly rises from the spring and flows into the player.
- When a spring is empty, it keeps a gentle glow and adds a restored color zone around it.
- Hidden springs are invisible until the player completes 2 calm breaths within 6 m of them.
- If the player walks, the flow stops. Nothing bad happens.

### 5.5 Transform (blockages)

- Chapter 1 has one blockage: a soft fog on a narrow path.
- Three steps:
  1. **See it:** when the player comes within 8 m, a message appears inside the fog in soft handwritten-style text: "I do not deserve this." The player must stay within 8 m until the text is fully shown (about 4 s). It cannot be skipped.
  2. **Feel it:** inside 5 m, a soft wind pushes gently, grass bends, the breath circle trembles slightly, a low drone plays. The player stays and completes 2 calm breaths.
  3. **Become one:** the player walks into the center. The screen darkens softly, sound becomes muffled. After 3 calm breaths, the fog dissolves into light motes that flow into the player (+2 light). The path opens and a color zone appears.
- **Running away:** if the player leaves the 8 m zone before step 3 ends, the fog grows by 10 percent (maximum +30 percent) and drifts 1 m toward the player. Progress in the current step resets. No other penalty.
- **Push (E / push button):** the push button is visible near the fog. Using it plays a small push animation. The fog gets visibly denser, and step 3 needs 1 extra calm breath (maximum +2). Push never works.

### 5.6 Manifest (seeds)

- The player can plant a seed only at marked seed spots. Chapter 1 has one spot at a gap in the path.
- At the spot, an interaction opens a small choice panel. In chapter 1 the only enabled choice is "Bridge". Show "Tree", "House" and "Well" as disabled for later chapters.
- Planting costs 5 light. The seed is a small glowing sprout.
- **Heart or mind seed:** decided by the calm value at planting (calm ≥ 0.6 = heart seed). In chapter 1, always create a heart seed, but keep the logic in code for chapter 2.
- **Growth rule:** the seed grows only while the player is more than 15 m away. While the player is within 15 m, growth pauses and the sprout glows a little dimmer.
- Growth needs 25 s of "away time" in total.
- Each time the player comes back within 15 m before growth is complete, the remaining time goes up by 3 s (maximum +9 s).
- When growth is complete, the bridge rises and forms over the gap in a short animation (3 s).
- Heart seed: quiet warm glow, stays. Mind seed (for later): bright flicker, grows 2 times faster, then fades after 60 s and returns half of its light.

### 5.7 Thanks

- When the player stands on a grown bridge and completes 3 calm breaths, the bridge turns golden, and color flows out from the bridge across the whole valley (global color value animates to 1 over 6 s).

### 5.8 Hints (soft, never text)

- Scene 3: if the player has not stopped and breathed for 120 s, a small bird lands near the hidden spring and sits still.
- Scene 5: if the player stays within 15 m of the seed for 30 s, a butterfly appears and flies slowly along the side path toward spring 3.

### 5.9 Hidden learning checks (local only)

Record these in `localStorage` and show them in the debug panel:

- `stoppedWithoutHint` (scene 3): did the player find the hidden spring before the bird hint?
- `pushCount` (scene 4): how many times push was used.
- `leftFogCount` (scene 4): how many times the player ran away.
- `walkedAwayFromSeed` (scene 5): did the player leave the 15 m zone without the butterfly hint?
- `timePerScene` in seconds.
  Add a debug button "Export results" that downloads a JSON file. Never send data anywhere.

---

## 6. Chapter 1 flow

**Place:** one small valley. Soft natural borders (steeper slopes and thicker mist). No invisible walls. If the player walks into the border, the mist turns them gently back.

**Length:** 10 to 15 minutes.

### Start screen

- Title, "Begin" button, settings (rhythm preset, quality, sound volume, reduced motion).

### Start questions (before scene 1)

- Two questions, each with a 1 to 5 scale:
  - "How easy is it for you to receive help or gifts?"
  - "How calm do you feel right now?"
- Short note under them: "Your answers stay on this device."

### Scene 1: Wake up

- The player wakes up in the grey valley. No text.
- Only the breath circle pulses.
- After 3 calm breaths, the glow appears and the player can walk.

### Scene 2: The dry spring

- A path leads to a dry spring. A stone next to it shows a carved symbol meaning "stop here" (a simple drawn symbol, no text).
- Receive mechanic with help. The spring gives 3 light.

### Scene 3: The hidden spring

- The valley opens into a wide field. No sign.
- Hidden spring 2 appears only after 2 calm breaths within 6 m.
- Bird hint after 120 s.

### Scene 4: The first fog

- The fog blocks a narrow path out of the field.
- Full transform mechanic (section 5.5). Push button visible.

### Scene 5: The first seed

- A gap in the ground stops the path. Seed spot at the edge.
- Player plants a bridge.
- A side path leads to hidden spring 3 (appears after 2 calm breaths, like scene 3). The walk there and back gives enough away time.
- Butterfly hint if the player stays near the seed.

### Scene 6: Thanks

- Thanks mechanic on the bridge. The whole valley turns to full color.

### After the play: learning cycle (overlay panels)

1. **Reflect:** "What happened when you stopped?" Three tap answers: "I felt calm." / "I felt impatient." / "I felt nothing yet." Every answer gets the same reply: "Thank you for noticing."
2. **Understand:** one card: "Dr. Rulin Xiu teaches that everything is already given to us. When we do not receive it, it is often we who hold it back."
3. **Apply:** "Your practice for today: three times today, stop. Breathe three times. Notice what is already given to you."
4. **End questions:** the same two questions as at the start (for now at the end of chapter 1).
5. **Chapter end screen:** "Chapter 1 complete." Buttons: "Play again", "Back to start". Show chapter 2 as "Coming soon".

### Always available

- Pause at any time. Pause screen text: "Take all the time you need."
- The player can quit at any point. Progress is saved per scene.

---

## 7. Accessibility

- Rhythm presets (section 5.2).
- Reduced motion: no camera shake, no trembling circle, slower color transitions.
- Every important cue is visual plus audio.
- All UI works with keyboard. Visible focus states.
- Text contrast meets WCAG AA (Web Content Accessibility Guidelines, level AA).

---

## 8. Sound (Web Audio, generated)

- Ambient: soft evolving pad that gets warmer as color returns.
- Breath: filtered noise that rises on the in-breath and falls on the out-breath.
- Calm breath: soft bell tone.
- Spring: gentle water shimmer plus chime per light mote.
- Fog: low drone; muffled filter when inside.
- Push: dull thud.
- Seed growing: soft rising tones. Bridge complete: warm chord.
- Master volume and mute in settings. Start audio only after the first user interaction.

---

## 9. Project structure (suggested)

```
src/
  main.ts
  core/        (game loop, input, camera, events, save, quality tiers)
  systems/     (breath, calm, light, receive, transform, manifest, thanks, hints, checks)
  world/       (terrain, props, sky, grass, zones, colorRestore)
  render/      (shaders, painterly pass, composer setup)
  audio/
  ui/          (breath circle, panels, joystick, settings, debug)
  content/     (strings.en.ts, chapter1.ts with scene data and numbers)
tests/
  unit/
  e2e/
```

- Put all tunable numbers (durations, radii, light values) in `src/content/chapter1.ts`. No magic numbers in systems.
- Systems talk through a typed event bus. Keep systems testable without Three.js where possible.

---

## 10. Debug tools

- URL `?debug=1`: debug panel with calm value, light count, current scene, learning checks, fps, quality tier, "Export results".
- URL `?scene=N`: start directly at scene N with the right amount of light.
- URL `?autobreathe=1`: breathing happens automatically with calm breaths (for Playwright tests).

---

## 11. Tests

### Unit tests (Vitest), at least:

- Breath: a breath within tolerance is calm; outside is not; walking resets the breath; each preset uses its own values.
- Calm value: rises with calm breaths, falls slowly otherwise, stays within 0 to 1.
- Light: never above 12; seed cannot be planted with less than 5.
- Transform: leaving the zone grows the fog, capped at +30 percent; push adds breaths, capped at +2; step order cannot be skipped.
- Manifest: no growth within 15 m; growth completes after 25 s away time; return penalty capped at +9 s; heart/mind threshold at 0.6.
- Save: progress restores the correct scene.

### Browser tests (Playwright):

- Full run of chapter 1 with `?autobreathe=1` from start screen to chapter end screen.
- Screenshots at each scene, on desktop (1280 x 720) and mobile (390 x 844).
- Save screenshots to `screenshots/` with clear names, for example `scene4-fog-desktop.png`.
- Check that no network request goes to any external domain.

---

## 12. Milestones (in this order)

1. **M0 Setup:** Vite, TypeScript, Three.js, lint, tests, `CLAUDE.md`, debug URL parameters, empty scene renders.
2. **M1 World:** valley terrain, borders, sky, props, grass, player figure, movement, camera, collision.
3. **M2 Look:** painting filter, paper grain, grey-to-color zone system, quality tiers.
4. **M3 Breath:** breath input, circle UI, calm value, glow, sound cues, unit tests.
5. **M4 Receive:** springs, hidden springs, light motes, scenes 1 to 3, bird hint.
6. **M5 Transform:** fog, three steps, running away, push, scene 4.
7. **M6 Manifest:** seed spot, choice panel, growth rules, bridge, side path, butterfly hint, scene 5.
8. **M7 Thanks and ending:** scene 6, full color, learning cycle panels, start and end questions, save, chapter end screen.
9. **M8 Polish:** sound pass, mobile controls pass, accessibility pass, performance pass, full Playwright run.

After each milestone: run tests, take screenshots, check them yourself, fix visible problems, then commit with a clear message.

---

## 13. Definition of done

- Chapter 1 is playable from start to end on desktop and on a mobile browser.
- All unit and browser tests pass.
- Performance budget is met, or the report says clearly where it is not met and why.
- No external network requests.
- No text breaks the content rules in section 1.

---

## 14. Completion report

When you are done, write `REPORT.md` with:

1. What you built, per milestone (short).
2. Screenshots: one per scene, desktop and mobile.
3. Test results (numbers passed and failed).
4. Bundle size (initial and total) and measured fps per quality tier.
5. Any place where you changed this brief, and why.
6. Known problems, ordered by severity.
7. Open questions for me (maximum 5).
