# Claude Code brief: Chapter 2 "Be aware"

Add chapter 2 to the existing game. Chapter 1 must be finished and working first.

Before you start: read `CLAUDE.md`, `REPORT.md` and the chapter 1 code. Follow all rules in `CLAUDE.md` (content rules, stack, performance budget, art rules). Do not change the tech stack.

Work through the milestones in order. After each milestone: run all tests, take screenshots, check them, commit.

---

## 1. What chapter 2 teaches

- **Lesson:** go inside and feel what is there. Notice it and name it, without pushing it away.
- **Place:** high meadows behind the bridge from chapter 1. The sky changes all the time.
- **Length:** 12 to 18 minutes.
- **Help level:** lower than chapter 1. Set breath circle `circleStrength` to 0.6.
- **New skills:** body check, naming feelings, sound breath, heart seed vs mind seed.

### Extra content rules for this chapter
- Naming feelings can bring up real pain. The pause button is always visible in this chapter.
- Never say "wrong". A wrong name gets the reply "Look again."
- The game never says it treats, heals or fixes feelings.
- Feelings are shown as weather. Weather is never punished or judged.

---

## 2. Changes to the existing game (do these first)

1. **Chapter system:** add a chapter registry. Each chapter has its own world module, its own content file (`src/content/chapter2.ts`) and its own strings section.
2. **Transition:** the chapter 1 end screen button "Coming soon" becomes "Continue to chapter 2". The player walks over the golden bridge, the screen fades, and chapter 2 loads.
3. **Chapter select:** the start screen lists completed chapters. Players can replay them.
4. **Save:** progress per chapter and per scene.
5. **Light at chapter start:** set light to a fixed value from the content file (chapter 2: 3). Do not carry light over.
6. **Start and end questions:** keep the start questions at the start of chapter 1. Move the end questions so they appear after the last chapter that exists in the build. Use a config value `lastAvailableChapter`.
7. **Seed choice panel:** in chapter 2, enable "Tree". Keep "Bridge" disabled here (no gap in this chapter). "House" and "Well" stay disabled.
8. **Mind seeds:** switch on the heart/mind logic that chapter 1 already has in code (calm ≥ 0.6 = heart seed).

---

## 3. New systems

### 3.1 Feeling weather (reusable)
Create one reusable `FeelingWeather` entity. Later chapters will use it too.

- Properties: `type` (sadness, anger, worry), `intensity` (0 to 1), `size`, `followsPlayer`.
- Each type has a clear visual and sound signature, so the player can recognize it:
  - **Sadness:** low, heavy blue-grey cloud (`#7F93A8`). Slow, soft rain. Soft falling sound.
  - **Anger:** dark red-violet cloud (`#9C4F6B`). Short, hard gusts. Low thunder rumble. Soft color pulses (see accessibility).
  - **Worry:** many small, pale yellow-green wisps (`#B8B86A`) that circle fast. Flickering light. Fast whispering wind.
- **Follow rule:** if `followsPlayer` is true and the player walks away, the weather follows at 90 percent of walking speed. When the player stands still, it stays above or around the player.

### 3.2 Naming panel
- Opens when the player stands still near a weather for 3 seconds and has completed 1 calm breath.
- Question: "What is this weather?"
- Three tap answers: "Sadness", "Anger", "Worry". Random order each time.
- **Correct:** the weather softens (intensity −40 percent) and the next step starts.
- **Not correct:** reply "Look again." The panel closes for 4 seconds. The weather shows its signature more strongly (bigger, clearer sound). No other effect.
- Record every attempt for the learning checks.

### 3.3 Sound breath
- A breath out that is calm **and** at least as long as the target out-breath makes a soft tone.
- Tones follow a pentatonic scale (five-note scale that always sounds pleasant). Each tone in a row plays the next note.
- Visual: a soft ring of light leaves the player at each tone.
- Each tone reduces the intensity of nearby anger or worry weather by 20 percent.
- The feature is unlocked in scene 4a. It then stays available in all later chapters.

### 3.4 Body glow
- The player figure has 4 glow points: feet, belly, heart, head.
- Each point can be lit separately. Lit points stay softly visible for the rest of the chapter.

### 3.5 Light well (prevents getting stuck)
- A small, always-available spring near the seed area in scene 5.
- It gives 1 light per calm breath with no limit, but only while the player has less than 5 light.
- Purpose: the player can never get stuck without enough light for a seed.

---

## 4. Chapter 2 flow

### Scene 1: Over the bridge
- The player arrives in the meadows. The sky changes slowly (clouds, light).
- A visible spring stands near the path. No sign, no hint.
- It gives 3 light.
- If the player walks past it for 180 s without receiving, a bird lands on it (late fallback hint).
- Check: `receivedWithoutSign`.

### Scene 2: The 4 body stones
- Four stones stand in a line up a small slope: feet, belly, heart, head. Each stone has a simple carved symbol.
- Only the next stone glows faintly. The order is fixed.
- At each stone: 3 calm breaths. The matching body glow point lights up. The stone gives 1 light.
- After the 4th stone, a small silhouette with the 4 lit points shows for 3 seconds. No text.
- Check: `bodyCheckTime` in seconds.

### Scene 3: The rain cloud
- A small sadness cloud appears and follows the player. It rains on the player.
- Steps:
  1. **Stop:** the player stands still. The cloud stays above.
  2. **Name:** naming panel (correct answer: Sadness).
  3. **Feel:** 2 calm breaths under the rain.
  4. **Release:** the rain turns soft, a small rainbow appears, the cloud dissolves. +2 light. A color zone appears.
- If the player runs, the cloud follows. Record each run away.
- Checks: `ranFromCloudCount`, `namingAttempts.sadness`.

### Scene 4a: The singing stone
- Before the storm, a tall stone hums a low, steady tone.
- When the player stands near it and makes a long, calm out-breath, the first sound breath plays together with the stone.
- The sound breath is now unlocked. No text. The stone's hum and the player's tone show the connection.

### Scene 4: The storm ridge
- An anger storm blocks the ridge path. It does not follow the player.
- Steps:
  1. **See it:** a message appears in the storm: "This is not fair." The player stays within 10 m until it is fully shown.
  2. **Name it:** naming panel (correct answer: Anger).
  3. **Feel it:** 2 calm breaths within 6 m. Wind pushes gently.
  4. **Calm it:** sound breaths. Each tone reduces intensity by 20 percent. After 5 tones, the storm opens.
  5. **Become one:** the player walks into the center. Quiet, darker. 3 calm breaths. The storm dissolves into light. +3 light. The path opens.
- Running away and push work like the chapter 1 fog (same caps).
- Checks: `namingAttempts.anger`, `soundBreathCount`, `pushCount`, `leftStormCount`.

### Scene 5: Two seeds
- A wide area with two seed spots:
  - **Spot A** at the edge of the old storm area. Leftover wind lowers calm faster here (calm decay × 2).
  - **Spot B** in a quiet hollow. Normal calm decay.
- The light well (section 3.5) is between them.
- The player must grow at least one heart tree to continue.
- **Mind seed:** loud, bright flicker. Needs half the away time (12.5 s). Grows into a bright tree, then fades after 60 s. Returns 2 light.
- **Heart seed:** quiet warm glow. Normal growth (25 s away time). Stays.
- Growth rules and return penalty: same as chapter 1.
- No text judges the result. The player only sees the difference.
- Checks: `seedTypesPlanted` (list), `heartSeedFirstTry`.

### Scene 6: Night
- The sky turns to night (`#1F2A44`). Stars appear (`#F6EBD0`).
- The player stands under the heart tree and makes 3 calm breaths with thanks. The tree turns golden. The meadows turn to full color, even at night (moonlit colors).
- The player lies down. Short dream sequence (10 to 15 s): a small village, where the same bird crosses the same roof twice. This hints at chapter 3. No text.
- Fade to the learning cycle.

### Learning cycle
1. **Reflect:** "Which weather did you meet most today?" Tap: "Sadness" / "Anger" / "Worry" / "None". Same reply for all: "Thank you for noticing."
2. **Understand:** "Dr. Rulin Xiu teaches that we can go inside and simply feel what is there, without pushing it away."
3. **Apply:** "Three times today, stop. Ask: what do I feel in my body now? Give it a name."
4. **End questions** only if `lastAvailableChapter` is 2.
5. **Chapter end screen:** "Chapter 2 complete." Buttons: "Play again", "Back to start". Chapter 3 shows "Coming soon".

---

## 5. Art additions

- **Meadows:** rolling alpine hills, tall grass cards that move in the wind, wild flowers, scattered rocks, distant mountains in soft violet.
- **Sky:** a slow day cycle for this chapter (morning to evening to night). Clouds move.
- **Stones:** rounded standing stones with simple carved symbols (drawn in code).
- **Weather:** built from particles and soft cloud cards. Keep the painted look.
- **Night:** moonlit version of the palette. The painting filter stays on.
- **Colors (new):** sadness `#7F93A8`, anger `#9C4F6B`, worry `#B8B86A`, night `#1F2A44`, stars `#F6EBD0`.

---

## 6. Sound additions

- Meadow wind ambience that follows the weather.
- Rain (soft), thunder (low rumble only, no sharp cracks), worry whisper wind.
- Singing stone hum.
- Sound breath tones (pentatonic).
- Night ambience (crickets, soft pad).

---

## 7. Accessibility

- **Flashes:** no flashes faster than 3 per second (WCAG 2.3.1, Web Content Accessibility Guidelines rule against seizure risk). Use soft color pulses for the anger storm.
- **Reduced motion:** no screen shake, calmer weather movement, pulses replaced by steady color.
- **Low thunder volume setting:** add "Soft storm sounds" in settings.
- The naming panel works with keyboard and touch.
- Pause text in this chapter: "Take all the time you need. It is okay to stop here."

---

## 8. Debug additions

- `?chapter=2&scene=N`: start at a chapter and scene.
- `?autoname=1`: the naming panel picks the correct answer automatically.
- `?calm=0.2`: force the calm value (for testing mind seeds).
- Debug panel: show weather type and intensity, sound breath count, seed types.

---

## 9. Tests

### Unit tests (Vitest), at least:
- Weather follow rule, intensity changes, caps.
- Naming: correct answer lowers intensity by 40 percent; wrong answer causes 4 s lock and no other change.
- Sound breath: only calm breaths with a long enough out-breath make a tone; each tone lowers anger and worry by 20 percent; sadness is not changed by tones.
- Storm: step order cannot be skipped; 5 tones open it.
- Seeds: calm below 0.6 gives a mind seed; mind seed grows in 12.5 s away time, fades after 60 s, returns 2 light.
- Light well: gives light only when light is below 5.
- Chapter system: save and load per chapter; end questions follow `lastAvailableChapter`.

### Browser tests (Playwright):
- Full run of chapter 2 with `?autobreathe=1&autoname=1`.
- A run with `?calm=0.2` that plants a mind seed first and still reaches the chapter end.
- Transition test: chapter 1 end screen to chapter 2 start.
- Screenshots per scene, desktop (1280 x 720) and mobile (390 x 844).
- No external network requests.

---

## 10. Milestones (in this order)

1. **C2-M0 Chapter system:** registry, transition, chapter select, save, end questions change.
2. **C2-M1 World:** meadows, sky cycle, stones, paths.
3. **C2-M2 Body stones:** body glow, scene 2.
4. **C2-M3 Weather:** FeelingWeather, naming panel, scene 3.
5. **C2-M4 Sound breath and storm:** singing stone, sound breath, scene 4a and scene 4.
6. **C2-M5 Seeds:** two spots, mind seed logic, light well, scene 5.
7. **C2-M6 Night and ending:** scene 6, dream, learning cycle, end screen.
8. **C2-M7 Polish:** sound, mobile, accessibility, performance, full test run.

---

## 11. Definition of done

- Chapter 2 is playable from the chapter 1 bridge to the chapter 2 end screen, on desktop and mobile.
- Chapter 1 still works (run its tests again).
- All tests pass.
- Performance budget from `CLAUDE.md` is met, or the report explains why not.
- No text breaks the content rules.

---

## 12. Completion report

Add a "Chapter 2" section to `REPORT.md` with:

1. What you built, per milestone (short).
2. Screenshots: one per scene, desktop and mobile.
3. Test results (passed and failed).
4. Bundle size and fps per quality tier.
5. Any place where you changed this brief, and why.
6. Known problems, ordered by severity.
7. Open questions for me (maximum 5).
